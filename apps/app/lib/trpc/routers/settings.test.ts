import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';

import { settingsRouter } from './settings';

describe('settings router', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_a';
  const otherUserId = 'user_b';

  beforeAll(async () => {
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });

    // user table WITH the five v0.1.2 settings columns + DEFAULT clauses, so a
    // named-column INSERT that omits them exercises the real defaults.
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
    // Named-column INSERT: omit the five settings columns → DEFAULT applies.
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
    } as unknown as Parameters<typeof settingsRouter.createCaller>[0];
    return settingsRouter.createCaller(ctx);
  }

  it('get() returns defaults for a freshly-seeded user', async () => {
    const res = await caller(otherUserId).get();
    expect(res.audioRetentionMode).toBe('24h');
    expect(res.asrLanguage).toBe('en-US');
    expect(res.acknowledgedPrivacy).toBe(false);
    expect(res.linkerModelOverride).toBeNull();
    expect(res.preferredMicDeviceId).toBeNull();
  });

  it('update() persists a new audio retention mode, get() reflects it', async () => {
    await caller().update({ audioRetentionMode: '7d' });
    const res = await caller().get();
    expect(res.audioRetentionMode).toBe('7d');
  });

  it('isolation: user A update does not touch user B row', async () => {
    await caller(userId).update({ audioRetentionMode: 'forever', asrLanguage: 'fr-FR' });
    const a = await caller(userId).get();
    const b = await caller(otherUserId).get();
    expect(a.audioRetentionMode).toBe('forever');
    expect(a.asrLanguage).toBe('fr-FR');
    // user B untouched by A's writes
    expect(b.audioRetentionMode).toBe('24h');
    expect(b.asrLanguage).toBe('en-US');
  });

  it('rejects an invalid audioRetentionMode enum value (Zod)', async () => {
    await expect(
      // @ts-expect-error — deliberately invalid enum to assert server-side rejection
      caller().update({ audioRetentionMode: 'bogus' }),
    ).rejects.toThrow();
  });

  it('explicit null clears a nullable text field', async () => {
    await caller().update({ linkerModelOverride: 'claude-haiku' });
    expect((await caller().get()).linkerModelOverride).toBe('claude-haiku');
    await caller().update({ linkerModelOverride: null });
    expect((await caller().get()).linkerModelOverride).toBeNull();
  });

  it('update({}) is a no-op (no-op patch does not throw)', async () => {
    const res = await caller().update({});
    expect(res.ok).toBe(true);
  });
});
