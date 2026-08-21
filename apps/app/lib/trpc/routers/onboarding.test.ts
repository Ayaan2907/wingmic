import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';

import { onboardingRouter } from './onboarding';

// onboarding.acknowledge flips users.acknowledgedPrivacy → true, scoped to the
// caller's own row. Optional first/last compose user.name; linkedin url upserts
// identity_claim(kind='linkedin', verified=false). SECURITY: WHERE id = ctx.user.id.

describe('onboarding router', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_a';
  const otherUserId = 'user_b';

  beforeAll(async () => {
    client = createClient({ url: 'file::memory:?cache=shared' });
    db = drizzle(client, { schema });

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
        acknowledged_privacy INTEGER NOT NULL DEFAULT 0,
        calendar_ics_url TEXT
      );
      CREATE TABLE identity_claim (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        value TEXT NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0,
        public INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES user(id)
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

  async function userRow(uid: string) {
    return db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, uid),
    });
  }

  it('a freshly-seeded user has acknowledgedPrivacy = false', async () => {
    expect((await userRow(userId))?.acknowledgedPrivacy).toBe(false);
    expect((await userRow(otherUserId))?.acknowledgedPrivacy).toBe(false);
  });

  it('acknowledge() flips the caller acknowledgedPrivacy to true', async () => {
    const res = await caller(userId).acknowledge();
    expect(res).toEqual({ ok: true });
    expect((await userRow(userId))?.acknowledgedPrivacy).toBe(true);
  });

  it('isolation: A acknowledge does not flip B flag', async () => {
    expect((await userRow(userId))?.acknowledgedPrivacy).toBe(true);
    expect((await userRow(otherUserId))?.acknowledgedPrivacy).toBe(false);
  });

  it('composes first+last into user.name and writes a self-asserted linkedin claim', async () => {
    const res = await caller(userId).acknowledge({
      firstName: 'Ada',
      lastName: 'Lovelace',
      linkedinUrl: 'https://www.linkedin.com/in/ada-lovelace?trk=share',
    });
    expect(res).toEqual({ ok: true });
    expect((await userRow(userId))?.name).toBe('Ada Lovelace');

    const claims = await client.execute({
      sql: `SELECT kind, value, verified, public FROM identity_claim WHERE user_id = ?`,
      args: [userId],
    });
    expect(claims.rows).toHaveLength(1);
    expect(claims.rows[0]!.kind).toBe('linkedin');
    expect(String(claims.rows[0]!.value)).toBe('https://www.linkedin.com/in/ada-lovelace');
    expect(Number(claims.rows[0]!.verified)).toBe(0);
    expect(Number(claims.rows[0]!.public)).toBe(0);
  });

  it('upserts the linkedin claim on repeat rather than duplicating', async () => {
    await caller(userId).acknowledge({
      linkedinUrl: 'https://www.linkedin.com/in/ada-lovelace-2',
    });
    const claims = await client.execute({
      sql: `SELECT value FROM identity_claim WHERE user_id = ? AND kind = 'linkedin'`,
      args: [userId],
    });
    expect(claims.rows).toHaveLength(1);
    expect(String(claims.rows[0]!.value)).toBe('https://www.linkedin.com/in/ada-lovelace-2');
  });

  it('rejects a non-linkedin url', async () => {
    await expect(
      caller(userId).acknowledge({ linkedinUrl: 'https://example.com/in/ada' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects a profile that has only one name', async () => {
    await expect(caller(userId).acknowledge({ firstName: 'Ada' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('resets verified and public when the linkedin url changes', async () => {
    await client.execute({
      sql: `UPDATE identity_claim SET verified = 1, public = 1 WHERE user_id = ? AND kind = 'linkedin'`,
      args: [userId],
    });
    await caller(userId).acknowledge({
      linkedinUrl: 'https://www.linkedin.com/in/ada-lovelace-3',
    });
    const claims = await client.execute({
      sql: `SELECT value, verified, public FROM identity_claim WHERE user_id = ? AND kind = 'linkedin'`,
      args: [userId],
    });
    expect(claims.rows).toHaveLength(1);
    expect(String(claims.rows[0]!.value)).toBe('https://www.linkedin.com/in/ada-lovelace-3');
    expect(Number(claims.rows[0]!.verified)).toBe(0);
    expect(Number(claims.rows[0]!.public)).toBe(0);
  });

  it('persists a public calendar ics url on acknowledge', async () => {
    const ics =
      'https://calendar.google.com/calendar/ical/ada%40example.com/public/basic.ics';
    await caller(userId).acknowledge({ calendarIcsUrl: ics });
    expect((await userRow(userId))?.calendarIcsUrl).toBe(ics);
  });

  it('rejects a secret private-token calendar ics url on acknowledge', async () => {
    await expect(
      caller(userId).acknowledge({
        calendarIcsUrl:
          'https://calendar.google.com/calendar/ical/ada%40example.com/private-abc/basic.ics',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('does not copy A profile onto B', async () => {
    expect((await userRow(otherUserId))?.name).toBeNull();
    const bClaims = await client.execute({
      sql: `SELECT id FROM identity_claim WHERE user_id = ?`,
      args: [otherUserId],
    });
    expect(bClaims.rows).toHaveLength(0);
  });
});
