import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import {
  fingerprint,
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

    const intent = cand.linkedin?.trim() ? 'profile' : 'person';
    const query = buildWebSearchQuery({
      intent,
      name: cand.name,
      company: cand.companyHint ?? undefined,
      linkedinUrl: cand.linkedin ?? undefined,
    });
    if (!query.q.trim()) continue;

    const hits = await provider.search(query);
    const draft = hitsToPersonaDraft(cand, hits);

    if (draft.sourceUrl && !isBlockedExtractUrl(draft.sourceUrl)) {
      try {
        await provider.extract({ urls: [draft.sourceUrl], query: cand.name });
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
    if (fp) {
      facts.push({ key: 'fingerprint', value: fp.id, confidence: WEB_CONFIDENCE });
    }

    await insertBlankFacts(db, resolved.entityId, facts, interactionId);
  }
}

function canSearchPerson(cand: PersonCandidate): boolean {
  return Boolean(cand.companyHint?.trim() || cand.linkedin?.trim());
}
