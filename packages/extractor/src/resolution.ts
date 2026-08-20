import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import {
  ExtractionResult,
  type CompanyCandidate,
  type EventCandidate,
  type PersonCandidate,
} from './schema';
import { embedText, embedTexts, cosine } from './embeddings';
import { canonicalizeLinkedin } from './linkedin';
import { entityMatchesPersonName, nameSimilarity, slugify } from './slug';

export interface CommitPersonResolution {
  entityId: string;
  created: boolean;
  score: number | null;
}

export interface CommitResult {
  interactionId: string;
  entityIds: string[];
  companyIds: string[];
  eventIds: string[];
  topicIds: string[];
  newEntities: number;
  matchedEntities: number;
  persons: CommitPersonResolution[];
}

interface ResolveContext {
  db: DB;
  userId: string;
  transcript: string;
  capturedAt: Date;
  /** Optional client-generated idempotency key (interactions.client_capture_id). */
  clientCaptureId?: string | null;
}

/**
 * Run the full extraction → graph commit pipeline.
 *
 *   1. Upsert canonical Company rows (lazy promotion: observed_count++)
 *   2. Upsert canonical Event rows (slug + date-proximity match)
 *   3. Upsert canonical Topic rows
 *   4. Persist Interaction (needed before facts/topics for sourceInteractionId)
 *   5. Resolve Person candidates: strong keys + unique same-owner name first,
 *      then fuzzy score ≥ 0.85, else create
 *   6. Wire EntityCompany / EntityEvent / EntityTopic edges
 *   7. Persist notes/email/linkedin as EntityFact rows (stamped with interaction)
 *
 * All graph writes after embedding run inside a single libSQL transaction.
 */
export async function commit(
  extracted: ExtractionResult,
  ctx: ResolveContext,
): Promise<CommitResult> {
  const { db, userId, transcript, capturedAt, clientCaptureId } = ctx;

  // ── Embeddings (parallel) ────────────────────────────────────────────
  const transcriptEmbedding = await embedText(transcript);

  const personEmbedTexts = extracted.persons.map((p) =>
    [
      p.name,
      p.role ?? '',
      p.companyHint ?? '',
      p.topics.join(' '),
      p.notes ?? '',
    ]
      .filter(Boolean)
      .join(' · '),
  );
  const personEmbeddings = personEmbedTexts.length
    ? await embedTexts(personEmbedTexts)
    : [];

  return db.transaction(async (tx) => {
    const writeDb = tx as unknown as DB;

  // ── Canonical: Companies ─────────────────────────────────────────────
  const companyIds: Map<string, string> = new Map(); // candidateName → companyId

  for (const c of extracted.companies) {
    const id = await upsertCompany(writeDb, c);
    companyIds.set(c.name, id);
  }

  // ── Canonical: Events ────────────────────────────────────────────────
  const eventIds: Map<string, string> = new Map();
  for (const e of extracted.events) {
    const id = await upsertEvent(writeDb, e, capturedAt);
    eventIds.set(e.name, id);
  }

  // ── Canonical: Topics (extracted.topics + per-person topics) ─────────
  const allTopics = new Set<string>(extracted.topics);
  for (const p of extracted.persons) for (const t of p.topics) allTopics.add(t);
  const topicIds: Map<string, string> = new Map();
  for (const t of allTopics) {
    const id = await upsertTopic(writeDb, t);
    topicIds.set(t, id);
  }

  // ── Interaction first ────────────────────────────────────────────────
  // Facts/topics reference source_interaction_id so person detail can list
  // the captures that created them. Insert before edge/fact writes.
  const insertedInteraction = await writeDb
    .insert(schema.interactions)
    .values({
      userId,
      transcript,
      capturedAt,
      embedding: transcriptEmbedding,
      ...(clientCaptureId ? { clientCaptureId } : {}),
    })
    .returning({ id: schema.interactions.id });
  const interactionId = insertedInteraction[0].id;

  // ── Persons (private, ownerUserId-scoped) ────────────────────────────
  const userEntities = await writeDb.query.entities.findMany({
    where: and(
      eq(schema.entities.ownerUserId, userId),
      isNull(schema.entities.deletedAt),
    ),
  });

  const ownedIds = userEntities.map((e) => e.id);
  const emailFacts =
    ownedIds.length > 0
      ? await writeDb.query.entityFacts.findMany({
          where: and(
            inArray(schema.entityFacts.entityId, ownedIds),
            eq(schema.entityFacts.key, 'email'),
          ),
          columns: { entityId: true, value: true },
        })
      : [];
  const emailsByEntity = new Map<string, string[]>();
  for (const f of emailFacts) {
    const list = emailsByEntity.get(f.entityId) ?? [];
    list.push(f.value.trim().toLowerCase());
    emailsByEntity.set(f.entityId, list);
  }

  const linkedinFacts =
    ownedIds.length > 0
      ? await writeDb.query.entityFacts.findMany({
          where: and(
            inArray(schema.entityFacts.entityId, ownedIds),
            eq(schema.entityFacts.key, 'linkedin'),
          ),
          columns: { entityId: true, value: true },
        })
      : [];
  const linkedinsByEntity = new Map<string, string[]>();
  for (const f of linkedinFacts) {
    const canon = canonicalizeLinkedin(f.value);
    if (!canon) continue;
    const list = linkedinsByEntity.get(f.entityId) ?? [];
    list.push(canon);
    linkedinsByEntity.set(f.entityId, list);
  }

  const entityCompanyRows =
    ownedIds.length > 0
      ? await writeDb.query.entityCompanies.findMany({
          where: inArray(schema.entityCompanies.entityId, ownedIds),
          columns: { entityId: true, companyId: true },
        })
      : [];
  const companiesByEntity = new Map<string, Set<string>>();
  for (const row of entityCompanyRows) {
    const set = companiesByEntity.get(row.entityId) ?? new Set<string>();
    set.add(row.companyId);
    companiesByEntity.set(row.entityId, set);
  }

  const entityIds: string[] = [];
  const persons: CommitPersonResolution[] = [];
  let newEntities = 0;
  let matchedEntities = 0;

  for (let i = 0; i < extracted.persons.length; i++) {
    const cand = extracted.persons[i];
    const candEmbedding = personEmbeddings[i];

    const localMatch = matchLocalPerson(
      cand,
      userEntities,
      candEmbedding,
      companyIds,
      emailsByEntity,
      linkedinsByEntity,
      companiesByEntity,
    );

    let entityId: string;
    if (localMatch) {
      entityId = localMatch.entityId;
      matchedEntities++;
      persons.push({ entityId, created: false, score: localMatch.score });
      const matchedEntity = userEntities.find((e) => e.id === entityId);
      if (localMatch.appendAlias && matchedEntity) {
        await maybeAppendAlias(writeDb, entityId, cand.name, matchedEntity);
      }
      await writeDb
        .update(schema.entities)
        .set({ updatedAt: new Date(), embedding: candEmbedding })
        .where(eq(schema.entities.id, entityId));
    } else {
      const inserted = await writeDb
        .insert(schema.entities)
        .values({
          ownerUserId: userId,
          kind: 'person',
          name: cand.name,
          aliases: cand.aliases,
          importSource: 'voice-capture',
          embedding: candEmbedding,
        })
        .returning({ id: schema.entities.id });
      entityId = inserted[0].id;
      newEntities++;
      persons.push({ entityId, created: true, score: null });
    }
    entityIds.push(entityId);

    // Wire edges
    if (cand.companyHint && companyIds.has(cand.companyHint)) {
      const companyId = companyIds.get(cand.companyHint)!;
      const existing = await writeDb.query.entityCompanies.findFirst({
        where: and(
          eq(schema.entityCompanies.entityId, entityId),
          eq(schema.entityCompanies.companyId, companyId),
        ),
      });
      if (!existing) {
        await writeDb.insert(schema.entityCompanies).values({
          entityId,
          companyId,
          role: cand.role ?? null,
        });
      } else if (cand.role && !existing.role) {
        await writeDb
          .update(schema.entityCompanies)
          .set({ role: cand.role })
          .where(eq(schema.entityCompanies.id, existing.id));
      }
    }

    for (const eventName of eventIds.keys()) {
      const eventId = eventIds.get(eventName)!;
      const existing = await writeDb.query.entityEvents.findFirst({
        where: and(
          eq(schema.entityEvents.entityId, entityId),
          eq(schema.entityEvents.eventId, eventId),
        ),
      });
      if (!existing) {
        await writeDb.insert(schema.entityEvents).values({ entityId, eventId, role: null });
      }
    }

    const personTopicNames = new Set<string>(cand.topics);
    for (const t of extracted.topics) personTopicNames.add(t);
    for (const topicName of personTopicNames) {
      const topicId = topicIds.get(topicName);
      if (!topicId) continue;
      const existingTopic = await writeDb.query.entityTopics.findFirst({
        where: and(
          eq(schema.entityTopics.entityId, entityId),
          eq(schema.entityTopics.topicId, topicId),
        ),
      });
      if (existingTopic) continue;
      await writeDb.insert(schema.entityTopics).values({
        entityId,
        topicId,
        weight: 70,
        sourceInteractionId: interactionId,
      });
    }

    if (cand.notes) {
      await writeDb.insert(schema.entityFacts).values({
        entityId,
        key: 'note',
        value: cand.notes,
        confidence: 80,
        sourceInteractionId: interactionId,
      });
    }
    if (cand.email) {
      const hasEmail = await entityHasComparableFact(
        writeDb,
        entityId,
        'email',
        cand.email,
      );
      if (!hasEmail) {
        await writeDb.insert(schema.entityFacts).values({
          entityId,
          key: 'email',
          value: cand.email,
          confidence: 95,
          sourceInteractionId: interactionId,
        });
      }
    }
    if (cand.linkedin) {
      const hasLinkedin = await entityHasComparableFact(
        writeDb,
        entityId,
        'linkedin',
        cand.linkedin,
      );
      if (!hasLinkedin) {
        await writeDb.insert(schema.entityFacts).values({
          entityId,
          key: 'linkedin',
          value: cand.linkedin,
          confidence: 95,
          sourceInteractionId: interactionId,
        });
      }
    }
  }

  return {
    interactionId,
    entityIds,
    companyIds: [...companyIds.values()],
    eventIds: [...eventIds.values()],
    topicIds: [...topicIds.values()],
    newEntities,
    matchedEntities,
    persons,
  };
  });
}

// ── Canonical upserts ──────────────────────────────────────────────────

async function upsertCompany(db: DB, c: CompanyCandidate): Promise<string> {
  const slug = slugify(c.name);
  const existingByDomain = c.domainHint
    ? await db.query.companies.findFirst({
        where: eq(schema.companies.domain, c.domainHint),
      })
    : null;
  if (existingByDomain) {
    await db
      .update(schema.companies)
      .set({
        observedCount: existingByDomain.observedCount + 1,
        updatedAt: new Date(),
        promotedAt:
          existingByDomain.observedCount + 1 >= 2 && !existingByDomain.promotedAt
            ? new Date()
            : existingByDomain.promotedAt,
      })
      .where(eq(schema.companies.id, existingByDomain.id));
    return existingByDomain.id;
  }
  const existingBySlug = await db.query.companies.findFirst({
    where: eq(schema.companies.slug, slug),
  });
  if (existingBySlug) {
    await db
      .update(schema.companies)
      .set({
        observedCount: existingBySlug.observedCount + 1,
        domain: existingBySlug.domain ?? c.domainHint ?? null,
        updatedAt: new Date(),
        promotedAt:
          existingBySlug.observedCount + 1 >= 2 && !existingBySlug.promotedAt
            ? new Date()
            : existingBySlug.promotedAt,
      })
      .where(eq(schema.companies.id, existingBySlug.id));
    return existingBySlug.id;
  }
  const inserted = await db
    .insert(schema.companies)
    .values({
      slug,
      name: c.name,
      domain: c.domainHint ?? null,
      industry: c.industry,
      observedCount: 1,
    })
    .returning({ id: schema.companies.id });
  return inserted[0].id;
}

async function upsertEvent(
  db: DB,
  e: EventCandidate,
  _capturedAt: Date,
): Promise<string> {
  const slug = slugify(e.name);
  const dateGuess =
    e.dateHint && /^\d{4}-\d{2}-\d{2}/.test(e.dateHint) ? new Date(e.dateHint) : null;

  const existing = await db.query.events.findFirst({
    where: eq(schema.events.slug, slug),
  });
  if (existing) {
    await db
      .update(schema.events)
      .set({
        observedCount: existing.observedCount + 1,
        promotedAt:
          existing.observedCount + 1 >= 2 && !existing.promotedAt
            ? new Date()
            : existing.promotedAt,
      })
      .where(eq(schema.events.id, existing.id));
    return existing.id;
  }
  const inserted = await db
    .insert(schema.events)
    .values({
      slug,
      name: e.name,
      dateRangeStart: dateGuess,
      dateRangeEnd: dateGuess,
      location: e.location ?? null,
      observedCount: 1,
    })
    .returning({ id: schema.events.id });
  return inserted[0].id;
}

async function upsertTopic(db: DB, name: string): Promise<string> {
  const slug = slugify(name);
  const existing = await db.query.topics.findFirst({
    where: eq(schema.topics.slug, slug),
  });
  if (existing) return existing.id;
  const inserted = await db
    .insert(schema.topics)
    .values({ slug, name, aliases: [] })
    .returning({ id: schema.topics.id });
  return inserted[0].id;
}

// ── Person resolution ──────────────────────────────────────────────────

interface ResolvedMatch {
  entityId: string;
  score: number;
}

type LocalMatchReason =
  | 'uniqueEmail'
  | 'uniqueLinkedin'
  | 'collidingIdentifier'
  | 'uniqueNameAtCompany'
  | 'uniqueName'
  | 'fuzzy';

interface LocalMatch extends ResolvedMatch {
  reason: LocalMatchReason;
  appendAlias: boolean;
}

function factValuesEqual(key: string, a: string, b: string): boolean {
  if (key === 'email') return a.trim().toLowerCase() === b.trim().toLowerCase();
  if (key === 'linkedin') {
    const ca = canonicalizeLinkedin(a);
    const cb = canonicalizeLinkedin(b);
    return ca !== null && ca === cb;
  }
  return a === b;
}

async function entityHasComparableFact(
  db: DB,
  entityId: string,
  key: string,
  value: string,
): Promise<boolean> {
  const rows = await db.query.entityFacts.findMany({
    where: and(eq(schema.entityFacts.entityId, entityId), eq(schema.entityFacts.key, key)),
    columns: { value: true },
  });
  return rows.some((r) => factValuesEqual(key, r.value, value));
}

async function maybeAppendAlias(
  db: DB,
  entityId: string,
  candidateName: string,
  entity: schema.Entity,
): Promise<void> {
  if (entityMatchesPersonName(candidateName, entity)) return;
  const aliases = entity.aliases ?? [];
  if (aliases.some((a) => entityMatchesPersonName(candidateName, { name: a, aliases: [] }))) {
    return;
  }
  await db
    .update(schema.entities)
    .set({ aliases: [...aliases, candidateName], updatedAt: new Date() })
    .where(eq(schema.entities.id, entityId));
}

/** Strong-key and unique-name match before fuzzy score. Same owner only. */
export function matchLocalPerson(
  cand: PersonCandidate,
  userEntities: schema.Entity[],
  candEmbedding: number[],
  companyIds: Map<string, string>,
  emailsByEntity: Map<string, string[]>,
  linkedinsByEntity: Map<string, string[]>,
  companiesByEntity: Map<string, Set<string>>,
): LocalMatch | null {
  if (userEntities.length === 0) return null;

  const candEmail = cand.email?.trim().toLowerCase();
  if (candEmail) {
    const hits = userEntities.filter((e) => (emailsByEntity.get(e.id) ?? []).includes(candEmail));
    if (hits.length === 1) {
      return {
        entityId: hits[0]!.id,
        score: 1,
        reason: 'uniqueEmail',
        appendAlias: true,
      };
    }
    if (hits.length > 1) {
      const best = resolvePerson(
        cand,
        hits,
        candEmbedding,
        companyIds,
        emailsByEntity,
        companiesByEntity,
      );
      if (best) {
        return {
          entityId: best.entityId,
          score: best.score,
          reason: 'collidingIdentifier',
          appendAlias: true,
        };
      }
    }
  }

  const candLinkedin = cand.linkedin ? canonicalizeLinkedin(cand.linkedin) : null;
  if (candLinkedin) {
    const hits = userEntities.filter((e) =>
      (linkedinsByEntity.get(e.id) ?? []).includes(candLinkedin),
    );
    if (hits.length === 1) {
      return {
        entityId: hits[0]!.id,
        score: 1,
        reason: 'uniqueLinkedin',
        appendAlias: true,
      };
    }
    if (hits.length > 1) {
      const best = resolvePerson(
        cand,
        hits,
        candEmbedding,
        companyIds,
        emailsByEntity,
        companiesByEntity,
      );
      if (best) {
        return {
          entityId: best.entityId,
          score: best.score,
          reason: 'collidingIdentifier',
          appendAlias: true,
        };
      }
    }
  }

  const companyId = cand.companyHint ? companyIds.get(cand.companyHint) : undefined;
  const nameMatches = userEntities.filter((e) => entityMatchesPersonName(cand.name, e));

  if (companyId && nameMatches.length > 0) {
    const atCompany = nameMatches.filter((e) => companiesByEntity.get(e.id)?.has(companyId));
    if (atCompany.length === 1) {
      return {
        entityId: atCompany[0]!.id,
        score: 1,
        reason: 'uniqueNameAtCompany',
        appendAlias: false,
      };
    }
  }

  if (nameMatches.length === 1) {
    return {
      entityId: nameMatches[0]!.id,
      score: 1,
      reason: 'uniqueName',
      appendAlias: false,
    };
  }

  const fuzzy = resolvePerson(
    cand,
    userEntities,
    candEmbedding,
    companyIds,
    emailsByEntity,
    companiesByEntity,
  );
  if (fuzzy && fuzzy.score >= 0.85) {
    return {
      entityId: fuzzy.entityId,
      score: fuzzy.score,
      reason: 'fuzzy',
      appendAlias: false,
    };
  }

  return null;
}

function resolvePerson(
  cand: PersonCandidate,
  userEntities: schema.Entity[],
  candEmbedding: number[],
  companyIds: Map<string, string>,
  emailsByEntity: Map<string, string[]> = new Map(),
  companiesByEntity: Map<string, Set<string>> = new Map(),
): ResolvedMatch | null {
  if (userEntities.length === 0) return null;

  let best: ResolvedMatch | null = null;
  for (const entity of userEntities) {
    const nameScore = nameSimilarity(cand.name, entity.name);
    const aliasScore = (entity.aliases ?? []).reduce(
      (m, a) => Math.max(m, nameSimilarity(cand.name, a)),
      0,
    );
    const nameMax = Math.max(nameScore, aliasScore);

    let companyBoost = 0;
    if (cand.companyHint && companyIds.has(cand.companyHint)) {
      const companyId = companyIds.get(cand.companyHint)!;
      if (companiesByEntity.get(entity.id)?.has(companyId)) {
        companyBoost = 1;
      }
    }

    let embeddingScore = 0;
    if (entity.embedding && entity.embedding.length === candEmbedding.length) {
      embeddingScore = cosine(entity.embedding, candEmbedding);
    }

    let emailBoost = 0;
    const candEmail = cand.email?.trim().toLowerCase();
    if (candEmail) {
      const emails = emailsByEntity.get(entity.id) ?? [];
      if (emails.includes(candEmail)) emailBoost = 1;
    }

    const importBoost =
      entity.importSource && entity.importSource !== 'voice-capture' ? 0.05 : 0;

    const score =
      0.5 * nameMax + 0.2 * embeddingScore + 0.15 * companyBoost + 0.3 * emailBoost + importBoost;
    if (!best || score > best.score) {
      best = { entityId: entity.id, score };
    }
  }
  return best;
}
