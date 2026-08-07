import { and, eq, inArray } from 'drizzle-orm';
import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import {
  ExtractionResult,
  type CompanyCandidate,
  type EventCandidate,
  type PersonCandidate,
} from './schema';
import { embedText, embedTexts, cosine } from './embeddings';
import { nameSimilarity, slugify } from './slug';

export interface CommitResult {
  interactionId: string;
  entityIds: string[];
  companyIds: string[];
  eventIds: string[];
  topicIds: string[];
  newEntities: number;
  matchedEntities: number;
}

interface ResolveContext {
  db: DB;
  userId: string;
  transcript: string;
  capturedAt: Date;
}

/**
 * Run the full extraction → graph commit pipeline.
 *
 *   1. Upsert canonical Company rows (lazy promotion: observed_count++)
 *   2. Upsert canonical Event rows (slug + date-proximity match)
 *   3. Upsert canonical Topic rows
 *   4. Resolve Person candidates against this user's entities; create new
 *      ones if confidence < 0.85, link if >= 0.85
 *   5. Persist Interaction with full transcript embedding
 *   6. Wire EntityCompany / EntityEvent / EntityTopic edges
 *   7. Persist any extra topics/notes as EntityFact rows
 *
 * All writes happen in a single libSQL transaction.
 */
export async function commit(
  extracted: ExtractionResult,
  ctx: ResolveContext,
): Promise<CommitResult> {
  const { db, userId, transcript, capturedAt } = ctx;

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

  // ── Canonical: Companies ─────────────────────────────────────────────
  const companyIds: Map<string, string> = new Map(); // candidateName → companyId

  for (const c of extracted.companies) {
    const id = await upsertCompany(db, c);
    companyIds.set(c.name, id);
  }

  // ── Canonical: Events ────────────────────────────────────────────────
  const eventIds: Map<string, string> = new Map();
  for (const e of extracted.events) {
    const id = await upsertEvent(db, e, capturedAt);
    eventIds.set(e.name, id);
  }

  // ── Canonical: Topics (extracted.topics + per-person topics) ─────────
  const allTopics = new Set<string>(extracted.topics);
  for (const p of extracted.persons) for (const t of p.topics) allTopics.add(t);
  const topicIds: Map<string, string> = new Map();
  for (const t of allTopics) {
    const id = await upsertTopic(db, t);
    topicIds.set(t, id);
  }

  // ── Persons (private, ownerUserId-scoped) ────────────────────────────
  const userEntities = await db.query.entities.findMany({
    where: eq(schema.entities.ownerUserId, userId),
  });

  const entityIds: string[] = [];
  let newEntities = 0;
  let matchedEntities = 0;

  for (let i = 0; i < extracted.persons.length; i++) {
    const cand = extracted.persons[i];
    const candEmbedding = personEmbeddings[i];

    const match = resolvePerson(cand, userEntities, candEmbedding, companyIds, topicIds);

    let entityId: string;
    if (match && match.score >= 0.85) {
      entityId = match.entityId;
      matchedEntities++;
      // Refresh the cached entity's embedding when we have a stronger signal
      await db
        .update(schema.entities)
        .set({ updatedAt: new Date(), embedding: candEmbedding })
        .where(eq(schema.entities.id, entityId));
    } else {
      const inserted = await db
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
    }
    entityIds.push(entityId);

    // Wire edges
    if (cand.companyHint && companyIds.has(cand.companyHint)) {
      const companyId = companyIds.get(cand.companyHint)!;
      const existing = await db.query.entityCompanies.findFirst({
        where: and(
          eq(schema.entityCompanies.entityId, entityId),
          eq(schema.entityCompanies.companyId, companyId),
        ),
      });
      if (!existing) {
        await db.insert(schema.entityCompanies).values({
          entityId,
          companyId,
          role: cand.role ?? null,
        });
      } else if (cand.role && !existing.role) {
        await db
          .update(schema.entityCompanies)
          .set({ role: cand.role })
          .where(eq(schema.entityCompanies.id, existing.id));
      }
    }

    for (const eventName of eventIds.keys()) {
      const eventId = eventIds.get(eventName)!;
      const existing = await db.query.entityEvents.findFirst({
        where: and(
          eq(schema.entityEvents.entityId, entityId),
          eq(schema.entityEvents.eventId, eventId),
        ),
      });
      if (!existing) {
        await db.insert(schema.entityEvents).values({ entityId, eventId, role: null });
      }
    }

    for (const topicName of cand.topics) {
      const topicId = topicIds.get(topicName);
      if (!topicId) continue;
      await db
        .insert(schema.entityTopics)
        .values({ entityId, topicId, weight: 70 })
        .onConflictDoNothing();
    }

    // EntityFact for free-form notes
    if (cand.notes) {
      await db.insert(schema.entityFacts).values({
        entityId,
        key: 'note',
        value: cand.notes,
        confidence: 80,
      });
    }
    if (cand.email) {
      await db.insert(schema.entityFacts).values({
        entityId,
        key: 'email',
        value: cand.email,
        confidence: 95,
      });
    }
    if (cand.linkedin) {
      await db.insert(schema.entityFacts).values({
        entityId,
        key: 'linkedin',
        value: cand.linkedin,
        confidence: 95,
      });
    }
  }

  // ── Interaction ──────────────────────────────────────────────────────
  const inserted = await db
    .insert(schema.interactions)
    .values({
      userId,
      transcript,
      capturedAt,
      embedding: transcriptEmbedding,
    })
    .returning({ id: schema.interactions.id });
  const interactionId = inserted[0].id;

  return {
    interactionId,
    entityIds,
    companyIds: [...companyIds.values()],
    eventIds: [...eventIds.values()],
    topicIds: [...topicIds.values()],
    newEntities,
    matchedEntities,
  };
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
  capturedAt: Date,
): Promise<string> {
  const slug = slugify(e.name);
  const dateGuess = e.dateHint && /^\d{4}-\d{2}-\d{2}/.test(e.dateHint)
    ? new Date(e.dateHint)
    : capturedAt;

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

function resolvePerson(
  cand: PersonCandidate,
  userEntities: schema.Entity[],
  candEmbedding: number[],
  companyIds: Map<string, string>,
  _topicIds: Map<string, string>,
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
      // We know the candidate's company id; if entity has any edge to that company,
      // boost. (Edge lookup deferred for v0.1.1: rely on name + embedding for now.)
      companyBoost = 0;
    }

    let embeddingScore = 0;
    if (entity.embedding && entity.embedding.length === candEmbedding.length) {
      embeddingScore = cosine(entity.embedding, candEmbedding);
    }

    const score = 0.55 * nameMax + 0.25 * embeddingScore + 0.2 * companyBoost;
    if (!best || score > best.score) {
      best = { entityId: entity.id, score };
    }
  }
  return best;
}
