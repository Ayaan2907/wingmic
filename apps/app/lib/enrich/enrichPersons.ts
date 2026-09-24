import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import {
  fingerprint,
  isStrongFingerprint,
  type CommitPersonResolution,
  type PersonCandidate,
} from '@wingmic/extractor';
import {
  buildWebSearchQuery,
  isBlockedExtractUrl,
  type WebSearchProvider,
} from '@/lib/web-search';
import { insertBlankFacts } from './blankFacts';
import { hitsToPersonaDraft } from './hitsToDraft';

const WEB_CONFIDENCE = 70;

/** Minimum person identity the web search needs. PersonCandidate satisfies
 * this structurally, and so does a DB-loaded entity (company edge + linkedin
 * fact) — which is what the entities.enrich retry path builds. */
export type PersonEnrichInput = {
  name: string;
  companyHint?: string | null;
  linkedin?: string | null;
};

/**
 * Search the web for one person entity and write blank facts (source_url /
 * url / linkedin / fingerprint at confidence 70). Shared core for the
 * post-commit capture path and the entities.enrich retry mutation — same
 * enrichment code, now reachable from the UI.
 *
 * Errors propagate: the batch path catches per person (one vendor miss must
 * not skip later people), while the retry path surfaces failure so the card
 * can show an honest "not enriched · retry" state.
 */
export async function enrichPersonFacts(opts: {
  db: DB;
  entityId: string;
  person: PersonEnrichInput;
  provider: WebSearchProvider;
  sourceInteractionId?: string | null;
}): Promise<{ wroteFactKeys: string[] }> {
  const { db, entityId, person, provider } = opts;

  const intent = person.linkedin?.trim() ? 'profile' : 'person';
  const query = buildWebSearchQuery({
    intent,
    name: person.name,
    company: person.companyHint ?? undefined,
    linkedinUrl: person.linkedin ?? undefined,
  });
  if (!query.q.trim()) return { wroteFactKeys: [] };

  const hits = await provider.search(query);
  const draft = hitsToPersonaDraft(person, hits);

  if (draft.sourceUrl && !isBlockedExtractUrl(draft.sourceUrl)) {
    try {
      await provider.extract({ urls: [draft.sourceUrl], query: person.name });
    } catch {
      // snippets are enough
    }
  }

  const facts = [
    draft.sourceUrl ? { key: 'source_url', value: draft.sourceUrl, confidence: WEB_CONFIDENCE } : null,
    draft.sourceUrl ? { key: 'url', value: draft.sourceUrl, confidence: WEB_CONFIDENCE } : null,
    draft.linkedin ? { key: 'linkedin', value: draft.linkedin, confidence: WEB_CONFIDENCE } : null,
  ].filter((f): f is { key: string; value: string; confidence: number } => f != null);

  const fp = fingerprint(draft);
  if (fp && isStrongFingerprint(fp.kind)) {
    facts.push({ key: 'fingerprint', value: fp.id, confidence: WEB_CONFIDENCE });
  }

  const wroteFactKeys = await insertBlankFacts(
    db,
    entityId,
    facts,
    opts.sourceInteractionId ?? null,
  );
  return { wroteFactKeys };
}

/**
 * Build the web-search hint for an owned person entity from the graph itself:
 * entity name + primary company name + best linkedin fact. Returns null when
 * the entity doesn't exist, isn't a person, or isn't owned by this user —
 * that's the mutation's ownership check.
 */
export async function getPersonEnrichInput(
  db: DB,
  userId: string,
  entityId: string,
): Promise<PersonEnrichInput | null> {
  const entity = await db.query.entities.findFirst({
    where: and(
      eq(schema.entities.id, entityId),
      eq(schema.entities.ownerUserId, userId),
      isNull(schema.entities.deletedAt),
      eq(schema.entities.kind, 'person'),
    ),
    columns: { id: true, name: true },
  });
  if (!entity) return null;

  const [edge, linkedinRows] = await Promise.all([
    db.query.entityCompanies.findFirst({
      where: and(
        eq(schema.entityCompanies.entityId, entityId),
        eq(schema.entityCompanies.sourceDeleted, false),
      ),
      columns: { companyId: true },
    }),
    db.query.entityFacts.findMany({
      where: and(
        eq(schema.entityFacts.entityId, entityId),
        eq(schema.entityFacts.key, 'linkedin'),
      ),
      columns: { value: true, confidence: true },
    }),
  ]);

  const company = edge
    ? await db.query.companies.findFirst({
        where: eq(schema.companies.id, edge.companyId),
        columns: { name: true },
      })
    : null;

  const linkedinFact = [...linkedinRows]
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .find((f) => f.value.trim().length > 0);

  return {
    name: entity.name,
    companyHint: company?.name ?? null,
    linkedin: linkedinFact?.value ?? null,
  };
}

export async function enrichPersonsAfterCommit(opts: {
  db: DB;
  userId: string;
  interactionId: string;
  extractedPersons: PersonCandidate[];
  persons: CommitPersonResolution[];
  provider: WebSearchProvider | null;
}): Promise<void> {
  const { db, userId, interactionId, extractedPersons, persons, provider } = opts;
  if (!provider) return;

  const n = Math.min(extractedPersons.length, persons.length);
  for (let i = 0; i < n; i++) {
    const cand = extractedPersons[i]!;
    const resolved = persons[i]!;
    if (!resolved.created) continue;
    if (!canSearchPerson(cand)) continue;

    const owned = await db.query.entities.findFirst({
      where: and(
        eq(schema.entities.id, resolved.entityId),
        eq(schema.entities.ownerUserId, userId),
        isNull(schema.entities.deletedAt),
      ),
      columns: { id: true },
    });
    if (!owned) continue;

    try {
      await enrichPersonFacts({
        db,
        entityId: resolved.entityId,
        person: cand,
        provider,
        sourceInteractionId: interactionId,
      });
    } catch {
      // one vendor miss must not skip later people
    }
  }
}

function canSearchPerson(cand: PersonCandidate): boolean {
  return Boolean(cand.companyHint?.trim() || cand.linkedin?.trim());
}
