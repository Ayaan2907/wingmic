import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';

import { captureRouter } from './capture';

function jpegBase64(byteLength = 32): string {
  const bytes = Buffer.alloc(byteLength);
  bytes.set([0xff, 0xd8, 0xff, 0xe0], 0);
  bytes.set([0xff, 0xd9], byteLength - 2);
  return bytes.toString('base64');
}

describe('capture.commit attachment retry', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_attachment';

  beforeEach(async () => {
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });
    await client.executeMultiple(`
      CREATE TABLE interaction (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, transcript TEXT NOT NULL,
        captured_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
        client_capture_id TEXT
      );
      CREATE TABLE entity_fact (
        id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, source_interaction_id TEXT
      );
      CREATE TABLE entity_topic (
        id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, source_interaction_id TEXT
      );
      CREATE TABLE interaction_attachment (
        id TEXT PRIMARY KEY, interaction_id TEXT NOT NULL, entity_id TEXT,
        event_id TEXT, mime_type TEXT DEFAULT 'image/jpeg' NOT NULL,
        jpeg_base64 TEXT NOT NULL, byte_size INTEGER NOT NULL, created_at INTEGER NOT NULL
      );
      INSERT INTO interaction (
        id, user_id, transcript, captured_at, created_at, client_capture_id
      ) VALUES ('int_attachment', 'user_attachment', 'photo memo', 1, 1, 'capture_attachment');
      INSERT INTO entity_fact (
        id, entity_id, source_interaction_id
      ) VALUES ('fact_attachment', 'entity_attachment', 'int_attachment');
    `);
  });

  function caller() {
    const ctx = {
      db,
      user: { id: userId },
      session: { user: { id: userId } },
    } as unknown as Parameters<typeof captureRouter.createCaller>[0];
    return captureRouter.createCaller(ctx);
  }

  it('backfills one missing attachment on an idempotent retry', async () => {
    const input = {
      transcript: 'photo memo',
      clientCaptureId: 'capture_attachment',
      attachment: { jpegBase64: jpegBase64() },
    };

    const first = await caller().commit(input);
    const second = await caller().commit(input);
    const rows = await db.query.interactionAttachments.findMany();

    expect(first.duplicate).toBe(true);
    expect(first.attachments).toHaveLength(1);
    expect(second.attachments).toEqual(first.attachments);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.interactionId).toBe('int_attachment');
    expect(rows[0]?.entityId).toBe('entity_attachment');
  });

  it.each([
    ['non-canonical base64', `${jpegBase64().slice(0, 4)}\n${jpegBase64().slice(4)}`],
    ['non-JPEG bytes', Buffer.alloc(32).toString('base64')],
    ['an oversized JPEG', jpegBase64(400_001)],
  ])('rejects %s before retry persistence', async (_label, value) => {
    await expect(
      caller().commit({
        transcript: 'photo memo',
        clientCaptureId: 'capture_attachment',
        attachment: { jpegBase64: value },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(await db.query.interactionAttachments.findMany()).toHaveLength(0);
  });
});

describe('capture.delete / restore', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_cap';
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
      CREATE TABLE interaction (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, transcript TEXT NOT NULL,
        captured_at INTEGER NOT NULL, embedding F32_BLOB(1536), created_at INTEGER NOT NULL,
        parent_interaction_id TEXT, thread_root_id TEXT, audio_storage_key TEXT,
        audio_retention_expiry INTEGER, client_capture_id TEXT,
        status TEXT DEFAULT 'committed' NOT NULL, deleted_at INTEGER
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
      sql: `INSERT INTO interaction (
        id, user_id, transcript, captured_at, created_at, status, deleted_at
      ) VALUES ('int_1', ?, 'hello', ?, ?, 'committed', null)`,
      args: [userId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO interaction (
        id, user_id, transcript, captured_at, created_at, status, deleted_at
      ) VALUES ('int_other', ?, 'nope', ?, ?, 'committed', null)`,
      args: [otherUserId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO interaction (
        id, user_id, transcript, captured_at, created_at, status, deleted_at
      ) VALUES ('int_draft', ?, 'draft', ?, ?, 'draft', null)`,
      args: [userId, now, now],
    });
  });

  function caller() {
    const ctx = {
      db,
      user: { id: userId },
      session: { user: { id: userId } },
    } as unknown as Parameters<typeof captureRouter.createCaller>[0];
    return captureRouter.createCaller(ctx);
  }

  it('soft-deletes the caller interaction and restores it', async () => {
    const c = caller();
    expect((await c.delete({ id: 'int_1' })).ok).toBe(true);
    const deleted = await db.query.interactions.findFirst({
      where: eq(schema.interactions.id, 'int_1'),
    });
    expect(deleted?.deletedAt).toBeTruthy();

    expect((await c.restore({ id: 'int_1' })).ok).toBe(true);
    const restored = await db.query.interactions.findFirst({
      where: eq(schema.interactions.id, 'int_1'),
    });
    expect(restored?.deletedAt).toBeNull();
  });

  it('refuses to delete another users interaction', async () => {
    const res = await caller().delete({ id: 'int_other' });
    expect(res.ok).toBe(false);
    const row = await db.query.interactions.findFirst({
      where: eq(schema.interactions.id, 'int_other'),
    });
    expect(row?.deletedAt).toBeNull();
  });

  it('refuses to restore another users interaction', async () => {
    await client.execute({
      sql: `UPDATE interaction SET deleted_at = ? WHERE id = 'int_other'`,
      args: [now],
    });
    const res = await caller().restore({ id: 'int_other' });
    expect(res.ok).toBe(false);
    const row = await db.query.interactions.findFirst({
      where: eq(schema.interactions.id, 'int_other'),
    });
    expect(row?.deletedAt).toBeTruthy();
  });

  it('delete is idempotent and does not reset deletedAt', async () => {
    const c = caller();
    await c.delete({ id: 'int_1' });
    const first = await db.query.interactions.findFirst({
      where: eq(schema.interactions.id, 'int_1'),
    });
    const firstDeletedAt = first?.deletedAt;
    expect(firstDeletedAt).toBeTruthy();

    expect((await c.delete({ id: 'int_1' })).ok).toBe(true);
    const second = await db.query.interactions.findFirst({
      where: eq(schema.interactions.id, 'int_1'),
    });
    expect(second?.deletedAt?.getTime()).toBe(firstDeletedAt?.getTime());
  });

  it('ignores draft interactions', async () => {
    const res = await caller().delete({ id: 'int_draft' });
    expect(res.ok).toBe(false);
    const row = await db.query.interactions.findFirst({
      where: eq(schema.interactions.id, 'int_draft'),
    });
    expect(row?.deletedAt).toBeNull();
  });
});
