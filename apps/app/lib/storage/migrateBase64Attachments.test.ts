import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';
import { attachmentStorageKey, createMemoryObjectStore } from '@wingmic/storage';
import { migrateBase64Attachments } from './migrateBase64Attachments';
import { attachmentBytesMatchKey, setAttachmentStoreForTests, sha256Hex } from './attachments';

describe('migrateBase64Attachments — base64 rows move to the object store', () => {
  let client: ReturnType<typeof createClient>;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  function makeJpeg(byteLength: number, fill: number): Buffer {
    const bytes = Buffer.alloc(byteLength, fill);
    bytes[0] = 0xff;
    bytes[1] = 0xd8;
    bytes[2] = 0xff;
    bytes[byteLength - 2] = 0xff;
    bytes[byteLength - 1] = 0xd9;
    return bytes;
  }

  const goodA = makeJpeg(64, 0x11);
  const goodB = makeJpeg(80, 0x22);
  const now = new Date();

  beforeEach(async () => {
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });
    await client.executeMultiple(`
      CREATE TABLE user (
        id TEXT PRIMARY KEY, email TEXT NOT NULL, email_verified INTEGER DEFAULT 0,
        name TEXT, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        calendar_ics_url TEXT
      );
      CREATE TABLE interaction (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, transcript TEXT NOT NULL,
        captured_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
        client_capture_id TEXT
      );
      CREATE TABLE interaction_attachment (
        id TEXT PRIMARY KEY, interaction_id TEXT NOT NULL, entity_id TEXT,
        event_id TEXT, mime_type TEXT DEFAULT 'image/jpeg' NOT NULL,
        storage_key TEXT, jpeg_base64 TEXT, byte_size INTEGER NOT NULL, created_at INTEGER NOT NULL
      );
    `);
    // Raw-SQL seeding: drizzle inserts would materialize every defaulted
    // column (e.g. users.audio_retention_mode) that this reduced fixture
    // DDL intentionally omits.
    await client.execute({
      sql: `INSERT INTO user VALUES (?, 'm@m', 0, null, null, ?, ?, null)`,
      args: ['u_mig', now.getTime(), now.getTime()],
    });
    await client.execute({
      sql: `INSERT INTO interaction (id, user_id, transcript, captured_at, created_at) VALUES ('i1', 'u_mig', 'coffee with ada', ?, ?)`,
      args: [now.getTime(), now.getTime()],
    });
    setAttachmentStoreForTests(createMemoryObjectStore());
  });

  afterEach(() => {
    setAttachmentStoreForTests(undefined);
    vi.restoreAllMocks();
  });

  it('moves legacy rows with verified integrity and leaves corrupt rows untouched', async () => {
    const corruptJpeg = makeJpeg(40, 0x33);
    await db.insert(schema.interactionAttachments).values([
      {
        interactionId: 'i1',
        jpegBase64: goodA.toString('base64'),
        byteSize: goodA.byteLength,
        createdAt: now,
      },
      {
        interactionId: 'i1',
        jpegBase64: goodB.toString('base64'),
        byteSize: goodB.byteLength,
        createdAt: now,
      },
      {
        // byte_size disagrees with the payload — must fail, not migrate.
        id: 'att_corrupt',
        interactionId: 'i1',
        jpegBase64: corruptJpeg.toString('base64'),
        byteSize: 999,
        createdAt: now,
      },
      {
        // Already migrated — must be skipped entirely.
        id: 'att_done',
        interactionId: 'i1',
        storageKey: 'attachments/v1/u_mig/' + 'a'.repeat(64) + '.jpg',
        jpegBase64: null,
        byteSize: 32,
        createdAt: now,
      },
    ]);

    const store = createMemoryObjectStore();
    const report = await migrateBase64Attachments({
      db: db as Parameters<typeof migrateBase64Attachments>[0]['db'],
      store,
    });

    expect(report.scanned).toBe(3); // the already-migrated row is filtered out
    expect(report.migrated).toBe(2);
    expect(report.failed).toBe(1);
    expect(report.failures[0]?.id).toBe('att_corrupt');
    expect(report.failures[0]?.reason).toContain('byte_size');
    expect(report.remainingBase64Rows).toBe(1);

    const rows = await db.query.interactionAttachments.findMany();
    const byId = new Map(rows.map((r) => [r.id, r]));

    // Good rows: key set, base64 cleared, bytes in the store match exactly.
    const goodRows = rows.filter((r) => r.id !== 'att_corrupt' && r.id !== 'att_done');
    expect(goodRows).toHaveLength(2);
    for (const row of goodRows) {
      expect(row.jpegBase64).toBeNull();
      expect(row.storageKey).toMatch(/^attachments\/v1\/u_mig\/[a-f0-9]{64}\.jpg$/);
      const object = await store.get(row.storageKey!);
      expect(object).not.toBeNull();
      expect(attachmentBytesMatchKey(row.storageKey!, Buffer.from(object!.body))).toBe(true);
    }

    // Corrupt row untouched; already-migrated row untouched.
    expect(byId.get('att_corrupt')?.jpegBase64).toBe(corruptJpeg.toString('base64'));
    expect(byId.get('att_corrupt')?.storageKey).toBeNull();
    expect(byId.get('att_done')?.storageKey).toBe('attachments/v1/u_mig/' + 'a'.repeat(64) + '.jpg');

    // Distinct content landed under distinct keys.
    const keys = goodRows.map((r) => r.storageKey!);
    expect(new Set(keys).size).toBe(2);
  });

  it('dry-run reports without touching rows', async () => {
    await db.insert(schema.interactionAttachments).values({
      id: 'att_dry',
      interactionId: 'i1',
      jpegBase64: goodA.toString('base64'),
      byteSize: goodA.byteLength,
      createdAt: now,
    });

    const store = createMemoryObjectStore();
    const report = await migrateBase64Attachments({
      db: db as Parameters<typeof migrateBase64Attachments>[0]['db'],
      store,
      dryRun: true,
    });

    expect(report.scanned).toBe(1);
    expect(report.migrated).toBe(0);
    expect(report.remainingBase64Rows).toBeNull();

    const rows = await db.query.interactionAttachments.findMany();
    expect(rows[0]?.jpegBase64).toBe(goodA.toString('base64'));
    expect(rows[0]?.storageKey).toBeNull();

    // The store is untouched — the documented contract is scan-and-report,
    // so a dry-run against production credentials uploads nothing.
    const expectedKey = attachmentStorageKey({
      userId: 'u_mig',
      sha256Hex: sha256Hex(goodA),
    });
    expect(await store.get(expectedKey)).toBeNull();
  });

  it('paginates by keyset — a limit stops the scan and the rest migrates on the next run', async () => {
    await db.insert(schema.interactionAttachments).values([
      { id: 'att_b1', interactionId: 'i1', jpegBase64: goodA.toString('base64'), byteSize: goodA.byteLength, createdAt: now },
      { id: 'att_b2', interactionId: 'i1', jpegBase64: goodB.toString('base64'), byteSize: goodB.byteLength, createdAt: now },
      {
        id: 'att_b3',
        interactionId: 'i1',
        jpegBase64: makeJpeg(48, 0x44).toString('base64'),
        byteSize: 48,
        createdAt: now,
      },
    ]);

    const store = createMemoryObjectStore();
    const capped = await migrateBase64Attachments({
      db: db as Parameters<typeof migrateBase64Attachments>[0]['db'],
      store,
      limit: 2,
    });
    expect(capped.scanned).toBe(2);
    expect(capped.migrated).toBe(2);
    expect(capped.remainingBase64Rows).toBe(1);

    // The uncapped continuation picks up exactly the remaining row.
    const rest = await migrateBase64Attachments({
      db: db as Parameters<typeof migrateBase64Attachments>[0]['db'],
      store,
    });
    expect(rest.scanned).toBe(1);
    expect(rest.migrated).toBe(1);
    expect(rest.failed).toBe(0);
  });

  it('is idempotent — a second run finds nothing to do', async () => {
    await db.insert(schema.interactionAttachments).values({
      interactionId: 'i1',
      jpegBase64: goodA.toString('base64'),
      byteSize: goodA.byteLength,
      createdAt: now,
    });

    const store = createMemoryObjectStore();
    const first = await migrateBase64Attachments({
      db: db as Parameters<typeof migrateBase64Attachments>[0]['db'],
      store,
    });
    expect(first.migrated).toBe(1);
    expect(first.failed).toBe(0);

    const second = await migrateBase64Attachments({
      db: db as Parameters<typeof migrateBase64Attachments>[0]['db'],
      store,
    });
    expect(second.scanned).toBe(0);
    expect(second.migrated).toBe(0);
  });
});
