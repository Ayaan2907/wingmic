// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';
import type { DB } from '@wingmic/db';
import { consumeDailyUsage, DAILY_LIMITS, utcDay } from '../dailyCap';

const USAGE_TABLE_SQL = `
  CREATE TABLE usage_daily (
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    kind TEXT NOT NULL,
    count INTEGER DEFAULT 0 NOT NULL,
    PRIMARY KEY (user_id, day, kind)
  );
`;

describe('consumeDailyUsage', () => {
  let client: Client;
  let db: DB;
  const userId = 'user-caps';

  beforeEach(async () => {
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema }) as unknown as DB;
    await client.executeMultiple(USAGE_TABLE_SQL);
  });

  it('allows up to the cap, then denies', async () => {
    for (let i = 0; i < DAILY_LIMITS.recording; i++) {
      expect(await consumeDailyUsage(db, userId, 'recording')).toBe(true);
    }
    expect(await consumeDailyUsage(db, userId, 'recording')).toBe(false);
    expect(await consumeDailyUsage(db, userId, 'recording')).toBe(false);
  });

  it('tracks kinds independently', async () => {
    for (let i = 0; i <= DAILY_LIMITS.image; i++) {
      await consumeDailyUsage(db, userId, 'image');
    }
    expect(await consumeDailyUsage(db, userId, 'image')).toBe(false);
    expect(await consumeDailyUsage(db, userId, 'message')).toBe(true);
  });

  it('tracks users independently', async () => {
    for (let i = 0; i <= DAILY_LIMITS.message; i++) {
      await consumeDailyUsage(db, userId, 'message');
    }
    expect(await consumeDailyUsage(db, userId, 'message')).toBe(false);
    expect(await consumeDailyUsage(db, 'user-other', 'message')).toBe(true);
  });

  it('a spent budget on a past day does not affect today', async () => {
    await client.execute({
      sql: 'INSERT INTO usage_daily (user_id, day, kind, count) VALUES (?, ?, ?, ?)',
      args: [userId, '2000-01-01', 'recording', 999],
    });
    expect(await consumeDailyUsage(db, userId, 'recording')).toBe(true);
  });

  it('utcDay formats as YYYY-MM-DD in UTC', () => {
    expect(utcDay(new Date('2026-08-24T23:59:59.999Z'))).toBe('2026-08-24');
    expect(utcDay(new Date('2026-08-25T00:00:00.000Z'))).toBe('2026-08-25');
  });
});
