import type { DB } from '@wingmic/db';
import { sql } from 'drizzle-orm';

export type BlankFact = { key: string; value: string; confidence: number };

/** Same id pattern the imports router uses when drizzle's $defaultFn isn't in
 * play (raw SQL bypasses JS-level column defaults). */
function newId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `fact_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Insert entity_fact rows only when that key is still missing on the person.
 * Each fact is one atomic INSERT … SELECT … WHERE NOT EXISTS — the retry
 * mutation can race the post-commit enrichment path (two tabs, or a user tap
 * while the capture pipeline is still writing), and a select-then-insert
 * produced duplicate rows in that window. Returns the keys this call wrote;
 * $defaultFn column defaults don't apply to raw SQL, so id/created_at are set
 * explicitly. */
export async function insertBlankFacts(
  db: DB,
  entityId: string,
  facts: BlankFact[],
  sourceInteractionId: string | null,
): Promise<string[]> {
  const usable = facts.filter((f) => f.value.trim().length > 0);

  const wrote: string[] = [];
  const attempted = new Set<string>();
  for (const f of usable) {
    if (attempted.has(f.key)) continue; // first value wins within one call
    attempted.add(f.key);
    const rows = await db.all<{ key: string }>(sql`
      INSERT INTO entity_fact
        (id, entity_id, key, value, confidence, source_interaction_id, created_at)
      SELECT
        ${newId()}, ${entityId}, ${f.key}, ${f.value.trim()},
        ${f.confidence}, ${sourceInteractionId}, ${Math.floor(Date.now() / 1000)}
      WHERE NOT EXISTS (
        SELECT 1 FROM entity_fact
        WHERE entity_id = ${entityId} AND key = ${f.key}
      )
      RETURNING key
    `);
    if (rows.length > 0) wrote.push(f.key);
  }
  return wrote;
}
