import { sql } from 'drizzle-orm';
import { embedText } from '@wingmic/extractor/embeddings';
import type { TRPCContext } from '@/lib/trpc/context';

type Db = TRPCContext['db'];

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/**
 * F32 embedding similarity over the bay tables — the same mechanism entity
 * recall uses: embedText from the extractor, libSQL vector_distance_cos over
 * F32_BLOB columns. There is no vector index on these tables (fine at hundreds
 * of rows; the spec's own ceiling note), so the scan is serve-time and bounded
 * by table size. Throws rather than degrading — the ask catches and falls back
 * to the pure text ranker, which is why this helper can stay honest about why
 * (no key, db trouble) instead of swallowing.
 */
export async function embeddingScores(db: Db, q: string): Promise<Map<string, number>> {
  const emb = await embedText(q);
  const literal = `[${emb.join(',')}]`;
  const [placeRows, eventRows] = await Promise.all([
    db.all<{ id: string; sim: number }>(sql`
      SELECT id, (1.0 - vector_distance_cos(embedding, vector32(${literal}))) AS sim
      FROM places
      WHERE embedding IS NOT NULL
    `),
    db.all<{ id: string; sim: number }>(sql`
      SELECT id, (1.0 - vector_distance_cos(embedding, vector32(${literal}))) AS sim
      FROM bay_events
      WHERE embedding IS NOT NULL
    `),
  ]);
  const out = new Map<string, number>();
  for (const row of placeRows) out.set(`place:${row.id}`, clamp01(row.sim));
  for (const row of eventRows) out.set(`event:${row.id}`, clamp01(row.sim));
  return out;
}
