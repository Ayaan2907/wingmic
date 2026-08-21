import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

export type BlankFact = { key: string; value: string; confidence: number };

/** Insert entity_fact rows only when that key is still missing on the person. */
export async function insertBlankFacts(
  db: DB,
  entityId: string,
  facts: BlankFact[],
  sourceInteractionId: string | null,
): Promise<string[]> {
  const usable = facts.filter((f) => f.value.trim().length > 0);
  if (usable.length === 0) return [];

  const existing = await db.query.entityFacts.findMany({
    where: and(
      eq(schema.entityFacts.entityId, entityId),
      inArray(
        schema.entityFacts.key,
        usable.map((f) => f.key),
      ),
    ),
    columns: { key: true },
  });
  const have = new Set(existing.map((r) => r.key));
  const fresh: BlankFact[] = [];
  for (const f of usable) {
    if (have.has(f.key)) continue;
    have.add(f.key);
    fresh.push(f);
  }
  if (fresh.length === 0) return [];

  await db.insert(schema.entityFacts).values(
    fresh.map((f) => ({
      entityId,
      key: f.key,
      value: f.value.trim(),
      confidence: f.confidence,
      sourceInteractionId,
    })),
  );
  return fresh.map((f) => f.key);
}
