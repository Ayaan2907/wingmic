import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';

import { onboardingRouter } from './onboarding';

// onboarding.acknowledge flips users.acknowledgedPrivacy → true, scoped to the
// caller's own row. SECURITY: the write is `WHERE id = ctx.user.id`; a userId
// is NEVER accepted from input. The isolation case proves A's acknowledge does
// not flip B's flag.

describe('onboarding router', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_a';
  const otherUserId = 'user_b';

  beforeAll(async () => {
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });

    // user table with the acknowledged_privacy column + DEFAULT, so a
    // named-column INSERT that omits it exercises the real default (false).
    await client.executeMultiple(`
      CREATE TABLE user (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        email_verified INTEGER NOT NULL DEFAULT 0,
        name TEXT,
        image TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        audio_retention_mode TEXT NOT NULL DEFAULT '24h',
        linker_model_override TEXT,
        preferred_mic_device_id TEXT,
        asr_language TEXT NOT NULL DEFAULT 'en-US',
        acknowledged_privacy INTEGER NOT NULL DEFAULT 0
      );
    `);

    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO user (id, email, created_at, updated_at) VALUES (?, 'a@example.com', ?, ?)`,
      args: [userId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO user (id, email, created_at, updated_at) VALUES (?, 'b@example.com', ?, ?)`,
      args: [otherUserId, now, now],
    });
  });

  function caller(uid = userId) {
    const ctx = {
      db,
      user: { id: uid },
      session: { user: { id: uid } },
    } as unknown as Parameters<typeof onboardingRouter.createCaller>[0];
    return onboardingRouter.createCaller(ctx);
  }

  async function flagOf(uid: string): Promise<boolean> {
    const row = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, uid),
    });
    return Boolean(row?.acknowledgedPrivacy);
  }

  it('a freshly-seeded user has acknowledgedPrivacy = false', async () => {
    expect(await flagOf(userId)).toBe(false);
    expect(await flagOf(otherUserId)).toBe(false);
  });

  it('acknowledge() flips the caller acknowledgedPrivacy to true', async () => {
    const res = await caller(userId).acknowledge();
    expect(res).toEqual({ ok: true });
    expect(await flagOf(userId)).toBe(true);
  });

  it('isolation: A acknowledge does not flip B flag', async () => {
    // userId already acknowledged above; otherUserId must still be false.
    expect(await flagOf(userId)).toBe(true);
    expect(await flagOf(otherUserId)).toBe(false);
  });
});
