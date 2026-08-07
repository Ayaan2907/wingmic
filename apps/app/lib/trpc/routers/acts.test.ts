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

  it('markSent updates status to sent and drops from default list', async () => {
    await insertAct('act_send_1');
    const res = await caller().markSent({ id: 'act_send_1' });
    expect(res.ok).toBe(true);
    const after = await caller().list({ limit: 50 });
    expect(after.acts.map((a) => a.id)).not.toContain('act_send_1');
  });

  it('dismiss ignores other users acts', async () => {
    await insertAct('act_dismiss_other', { userId: otherUserId });
    const res = await caller().dismiss({ id: 'act_dismiss_other' });
    expect(res.ok).toBe(false);
  });
});
