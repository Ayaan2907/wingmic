import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';

import { actsRouter } from './acts';

describe('acts router', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_acts';
  const otherUserId = 'user_other';
  let now = Date.now();

  beforeAll(async () => {
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });

    await client.executeMultiple(`
      CREATE TABLE user (
        id TEXT PRIMARY KEY, email TEXT NOT NULL, email_verified INTEGER DEFAULT 0,
        name TEXT, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE entity (
        id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, kind TEXT DEFAULT 'person',
        name TEXT NOT NULL, aliases TEXT DEFAULT '[]', import_source TEXT,
        embedding F32_BLOB(1536), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );
      CREATE TABLE interaction (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, transcript TEXT NOT NULL,
        captured_at INTEGER NOT NULL, embedding F32_BLOB(1536), created_at INTEGER NOT NULL,
        parent_interaction_id TEXT, thread_root_id TEXT, audio_storage_key TEXT,
        audio_retention_expiry INTEGER, client_capture_id TEXT,
        status TEXT DEFAULT 'committed' NOT NULL, deleted_at INTEGER
      );
      CREATE TABLE act (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
        kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'drafted',
        body TEXT NOT NULL, subject TEXT, when_hint TEXT, run_at INTEGER,
        target_entity_id TEXT, secondary_entity_id TEXT, source_interaction_id TEXT,
        confidence INTEGER NOT NULL DEFAULT 80,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE entity_fact (
        id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, key TEXT NOT NULL,
        value TEXT NOT NULL, source_interaction_id TEXT,
        confidence INTEGER NOT NULL DEFAULT 85,
        embedding F32_BLOB(1536), created_at INTEGER NOT NULL
      );
    `);

    now = Date.now();
    await client.execute({
      sql: `INSERT INTO user VALUES (?, 'a@a', 0, null, null, ?, ?)`,
      args: [userId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO user VALUES (?, 'b@b', 0, null, null, ?, ?)`,
      args: [otherUserId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity VALUES ('e_ada', ?, 'person', 'Ada Lovelace', '[]', null, null, ?, ?, null)`,
      args: [userId, now, now],
    });
  });

  function caller() {
    const ctx = {
      db,
      user: { id: userId },
      session: { user: { id: userId } },
    } as unknown as Parameters<typeof actsRouter.createCaller>[0];
    return actsRouter.createCaller(ctx);
  }

  async function insertAct(
    id: string,
    opts: { userId?: string; status?: string; target?: string | null } = {},
  ) {
    await client.execute({
      sql: `INSERT INTO act VALUES (
        ?, ?, 'email', ?, 'send the deck', null, 'tomorrow', null,
        ?, null, null, 88, ?, ?
      )`,
      args: [
        id,
        opts.userId ?? userId,
        opts.status ?? 'drafted',
        opts.target === undefined ? 'e_ada' : opts.target,
        now,
        now,
      ],
    });
  }

  it('lists only drafted/snoozed acts for the current user', async () => {
    await insertAct('act_list_1');
    await insertAct('act_list_other', { userId: otherUserId });
    await insertAct('act_list_sent', { status: 'sent' });

    const result = await caller().list({ limit: 20 });
    const ids = result.acts.map((a) => a.id);
    expect(ids).toContain('act_list_1');
    expect(ids).not.toContain('act_list_other');
    expect(ids).not.toContain('act_list_sent');
    const row = result.acts.find((a) => a.id === 'act_list_1');
    expect(row?.name).toBe('Ada Lovelace');
    expect(row?.actionKind).toBe('email');
  });

  it('includes targetEmail from entity facts when present', async () => {
    await client.execute({
      sql: `INSERT INTO entity_fact VALUES ('fact_email', 'e_ada', 'email', 'ada@example.com', null, 95, null, ?)`,
      args: [now],
    });
    await insertAct('act_email_1');
    const result = await caller().list({ limit: 20 });
    const row = result.acts.find((a) => a.id === 'act_email_1');
    expect(row?.targetEmail).toBe('ada@example.com');
  });

  it('omits targetEmail when the target entity is soft-deleted', async () => {
    await client.execute({
      sql: `INSERT INTO entity VALUES ('e_gone', ?, 'person', 'Gone Person', '[]', null, null, ?, ?, ?)`,
      args: [userId, now, now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity_fact VALUES ('fact_gone', 'e_gone', 'email', 'gone@example.com', null, 95, null, ?)`,
      args: [now],
    });
    await insertAct('act_gone_email', { target: 'e_gone' });
    const result = await caller().list({ limit: 50 });
    const row = result.acts.find((a) => a.id === 'act_gone_email');
    expect(row?.targetEmail).toBeNull();
  });

  it('markSent updates status to sent and drops from default list', async () => {
    await insertAct('act_send_1');
    const res = await caller().markSent({ id: 'act_send_1' });
    expect(res.ok).toBe(true);
    const after = await caller().list({ limit: 50 });
    expect(after.acts.map((a) => a.id)).not.toContain('act_send_1');
  });

  it('refuses markSent for another users act', async () => {
    await insertAct('act_send_other', { userId: otherUserId });
    const res = await caller().markSent({ id: 'act_send_other' });
    expect(res.ok).toBe(false);
  });

  it('refuses markSent when act is already sent', async () => {
    await insertAct('act_send_done', { status: 'sent' });
    const res = await caller().markSent({ id: 'act_send_done' });
    expect(res.ok).toBe(false);
  });

  it('dismiss ignores other users acts', async () => {
    await insertAct('act_dismiss_other', { userId: otherUserId });
    const res = await caller().dismiss({ id: 'act_dismiss_other' });
    expect(res.ok).toBe(false);
  });

  it('createDraft inserts a polished check-in for an owned person', async () => {
    const res = await caller().createDraft({
      kind: 'email',
      intent: 'check-in',
      targetEntityId: 'e_ada',
      seedBody: 'check in with ada',
    });
    expect(res.ok).toBe(true);
    expect(res.id).toBeTruthy();
    const listed = await caller().list({ limit: 50 });
    const row = listed.acts.find((a) => a.id === res.id);
    expect(row?.actionKind).toBe('email');
    expect(row?.subject).toBeTruthy();
    expect(row?.body.toLowerCase()).toContain('check in with ada');
  });

  it('createDraft refuses unknown target entities', async () => {
    const res = await caller().createDraft({
      kind: 'email',
      intent: 'check-in',
      targetEntityId: 'missing',
    });
    expect(res.ok).toBe(false);
  });

  it('snooze sets status and runAt and hides from default list until due', async () => {
    await insertAct('act_snooze_1');
    const res = await caller().snooze({ id: 'act_snooze_1', hours: 24 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.runAt.getTime()).toBeGreaterThan(Date.now());
    const listed = await caller().list({ status: 'snoozed', limit: 50 });
    expect(listed.acts.map((a) => a.id)).toContain('act_snooze_1');
    const inbox = await caller().list({ limit: 50 });
    expect(inbox.acts.map((a) => a.id)).not.toContain('act_snooze_1');
  });

  it('refuses snooze for another users act', async () => {
    await insertAct('act_snooze_other', { userId: otherUserId });
    const res = await caller().snooze({ id: 'act_snooze_other', hours: 24 });
    expect(res.ok).toBe(false);
  });

  it('update edits body and subject', async () => {
    await insertAct('act_edit_1');
    const res = await caller().update({
      id: 'act_edit_1',
      body: 'revised follow-up',
      subject: 'hello again',
    });
    expect(res.ok).toBe(true);
    const listed = await caller().list({ limit: 50 });
    const row = listed.acts.find((a) => a.id === 'act_edit_1');
    expect(row?.body).toBe('revised follow-up');
    expect(row?.subject).toBe('hello again');
  });

  it('refuses update for another users act', async () => {
    await insertAct('act_edit_other', { userId: otherUserId });
    const res = await caller().update({
      id: 'act_edit_other',
      body: 'nope',
    });
    expect(res.ok).toBe(false);
  });
});
