import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';

import { API_RATE_LIMIT, consumeRateLimit, windowStartFor } from './rateLimit';

// DB-backed fixed-window limiter. The counter lives in api_rate_window, so
// it survives deploys and is shared across app instances — verified here
// against a real in-memory libSQL db with the atomic-upsert path exercised
// (the same one production uses).

describe('consumeRateLimit', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;

  beforeAll(async () => {
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });
    await client.executeMultiple(`
      CREATE TABLE api_rate_window (
        key_id TEXT NOT NULL,
        window_start INTEGER NOT NULL,
        count INTEGER DEFAULT 0 NOT NULL,
        PRIMARY KEY (key_id, window_start)
      );
    `);
  });

  it('allows requests under the limit and counts them atomically', async () => {
    const keyId = 'key_under';
    for (let i = 0; i < 5; i++) {
      const res = await consumeRateLimit(db, keyId, { limit: 5 });
      expect(res.allowed).toBe(true);
    }
    const row = await client.execute({
      sql: 'SELECT count FROM api_rate_window WHERE key_id = ?',
      args: [keyId],
    });
    expect(Number(row.rows[0]!.count)).toBe(5);
  });

  it('blocks requests over the limit with a retry-after', async () => {
    const keyId = 'key_over';
    for (let i = 0; i < 3; i++) {
      await consumeRateLimit(db, keyId, { limit: 3 });
    }
    const blocked = await consumeRateLimit(db, keyId, { limit: 3 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('keys are limited independently', async () => {
    const keyA = 'key_a';
    const keyB = 'key_b';
    for (let i = 0; i < 3; i++) {
      await consumeRateLimit(db, keyA, { limit: 3 });
    }
    expect((await consumeRateLimit(db, keyA, { limit: 3 })).allowed).toBe(false);
    expect((await consumeRateLimit(db, keyB, { limit: 3 })).allowed).toBe(true);
  });

  it('resets when the window rolls over', async () => {
    const keyId = 'key_window';
    const t1 = new Date('2026-09-24T12:00:30Z'); // inside window 12:00:00
    for (let i = 0; i < 2; i++) {
      await consumeRateLimit(db, keyId, { limit: 2, now: t1 });
    }
    expect((await consumeRateLimit(db, keyId, { limit: 2, now: t1 })).allowed).toBe(false);

    const t2 = new Date('2026-09-24T12:01:00Z'); // next window
    const fresh = await consumeRateLimit(db, keyId, { limit: 2, now: t2 });
    expect(fresh.allowed).toBe(true);

    // Both windows counted separately; the blocked attempt in window 1 also
    // bumped its counter (atomic upsert runs before the limit check), so
    // window 1 shows 3 — two allowed plus the rejected one.
    const rows = await client.execute({
      sql: 'SELECT count FROM api_rate_window WHERE key_id = ? ORDER BY window_start',
      args: [keyId],
    });
    expect(rows.rows.map((r) => Number(r.count))).toEqual([3, 1]);
  });

  it('windowStartFor aligns to fixed epoch windows', () => {
    expect(windowStartFor(new Date('2026-09-24T12:00:59Z'))).toBe(
      Math.floor(Date.parse('2026-09-24T12:00:59Z') / 1000 / 60) * 60,
    );
    expect(windowStartFor(new Date('2026-09-24T12:01:00Z'))).toBe(
      Math.floor(Date.parse('2026-09-24T12:01:00Z') / 1000 / 60) * 60,
    );
  });

  it('exposes the documented default limit', () => {
    expect(API_RATE_LIMIT).toBe(60);
  });
});
