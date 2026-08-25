/**
 * Per-user daily usage caps, backed by the `usage_daily` table so counts
 * survive deploys (the per-minute limiter in the transcribe route is
 * in-memory burst control only).
 *
 * Attempts are counted, not successes — the cap protects paid upstream
 * calls (AssemblyAI, extraction LLM), so a commit that later fails still
 * spends a unit.
 */
import { sql } from 'drizzle-orm';
import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';

export const DAILY_LIMITS = {
  recording: 10,
  message: 20,
  image: 10,
} as const;

export type UsageKind = keyof typeof DAILY_LIMITS;

/** UTC calendar day, YYYY-MM-DD. Caps reset at midnight UTC. */
export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Atomically consume one unit of `kind` for today. Returns false once the
 * day's cap is spent (single upsert statement, so concurrent requests
 * cannot sneak past the limit).
 */
export async function consumeDailyUsage(
  db: DB,
  userId: string,
  kind: UsageKind,
): Promise<boolean> {
  const rows = await db
    .insert(schema.usageDaily)
    .values({ userId, day: utcDay(), kind, count: 1 })
    .onConflictDoUpdate({
      target: [schema.usageDaily.userId, schema.usageDaily.day, schema.usageDaily.kind],
      set: { count: sql`${schema.usageDaily.count} + 1` },
    })
    .returning({ count: schema.usageDaily.count });
  return (rows[0]?.count ?? 1) <= DAILY_LIMITS[kind];
}
