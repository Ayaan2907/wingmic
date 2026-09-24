/**
 * Per-key rate limiting for /api/v1 — a fixed-window counter backed by the
 * `api_rate_window` table (one row per key per window), consumed with the
 * same atomic upsert discipline as the daily caps in lib/usage/dailyCap.ts.
 *
 * The counter is DB-backed, not per-instance: it survives deploys and is
 * correct across horizontally scaled app instances (the in-memory limiter
 * in api/demo/capture is burst control for one instance only — this is the
 * durable variant). Cost is one upsert per authenticated request.
 */
import { sql } from 'drizzle-orm';
import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';

/** Authenticated requests allowed per key per window. */
export const API_RATE_LIMIT = 60;

/** Fixed window length in seconds. */
export const RATE_WINDOW_SECONDS = 60;

/** Epoch seconds of the window containing `now`. */
export function windowStartFor(now: Date, windowSeconds = RATE_WINDOW_SECONDS): number {
  return Math.floor(now.getTime() / 1000 / windowSeconds) * windowSeconds;
}

export type RateLimitResult = {
  allowed: boolean;
  /** Seconds until the window resets (for the Retry-After header). */
  retryAfterSeconds: number;
};

/**
 * Atomically count one request against `keyId`'s current window. Returns
 * `allowed: false` once the window's limit is spent; the single upsert
 * statement means concurrent requests cannot sneak past the limit.
 */
export async function consumeRateLimit(
  db: DB,
  keyId: string,
  opts: { limit?: number; now?: Date } = {},
): Promise<RateLimitResult> {
  const limit = opts.limit ?? API_RATE_LIMIT;
  const now = opts.now ?? new Date();
  const windowStart = windowStartFor(now);

  const rows = await db
    .insert(schema.apiKeyRateWindows)
    .values({ keyId, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [schema.apiKeyRateWindows.keyId, schema.apiKeyRateWindows.windowStart],
      set: { count: sql`${schema.apiKeyRateWindows.count} + 1` },
    })
    .returning({ count: schema.apiKeyRateWindows.count });

  const count = rows[0]?.count ?? 1;
  const retryAfterSeconds = Math.max(
    1,
    windowStart + RATE_WINDOW_SECONDS - Math.floor(now.getTime() / 1000),
  );
  return { allowed: count <= limit, retryAfterSeconds };
}
