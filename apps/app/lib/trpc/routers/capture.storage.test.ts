import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';
import { createMemoryObjectStore } from '@wingmic/storage';

const { scheduleActDraftingMock } = vi.hoisted(() => ({ scheduleActDraftingMock: vi.fn() }));

vi.mock('@/lib/acts/scheduleActDrafting', () => ({
  scheduleActDrafting: (...args: unknown[]) => scheduleActDraftingMock(...args),
}));

vi.mock('@wingmic/extractor', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@wingmic/extractor')>();
  return {
    ...mod,
    extractHybrid: vi.fn(),
    commit: vi.fn(),
  };
});

import { captureRouter } from './capture';
import { extractHybrid, commit } from '@wingmic/extractor';
import {
  attachmentBytesMatchKey,
  setAttachmentStoreForTests,
  sha256Hex,
} from '@/lib/storage/attachments';

const extractorMock = vi.mocked(commit);
const extractHybridMock = vi.mocked(extractHybrid);

describe('capture.commit — image persistence lands in object storage', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_storage';
  let now = Date.now();

  /** Minimal valid JPEG shape: FFD8FF start, FFD9 end, >=32 bytes. */
  function makeJpeg(byteLength = 64, fill = 0x00): Buffer {
    const bytes = Buffer.alloc(byteLength, fill);
    bytes[0] = 0xff;
    bytes[1] = 0xd8;
    bytes[2] = 0xff;
    bytes[byteLength - 2] = 0xff;
    bytes[byteLength - 1] = 0xd9;
    return bytes;
  }

  beforeAll(async () => {
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
      CREATE TABLE usage_daily (
        user_id TEXT NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL,
        count INTEGER DEFAULT 0 NOT NULL, PRIMARY KEY (user_id, day, kind)
      );
      CREATE TABLE entity (
        id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, kind TEXT DEFAULT 'person',
        name TEXT NOT NULL, aliases TEXT DEFAULT '[]', import_source TEXT,
        embedding F32_BLOB(1536), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );
      CREATE TABLE entity_fact (
        id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, key TEXT NOT NULL,
        value TEXT NOT NULL, source_interaction_id TEXT,
        confidence INTEGER NOT NULL DEFAULT 85,
        embedding F32_BLOB(1536), created_at INTEGER NOT NULL
      );
      CREATE TABLE entity_topic (
        id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, source_interaction_id TEXT
      );
      CREATE TABLE entity_company (
        id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, company_id TEXT NOT NULL
      );
      CREATE TABLE interaction_attachment (
        id TEXT PRIMARY KEY, interaction_id TEXT NOT NULL, entity_id TEXT,
        event_id TEXT, mime_type TEXT DEFAULT 'image/jpeg' NOT NULL,
        storage_key TEXT, jpeg_base64 TEXT, byte_size INTEGER NOT NULL, created_at INTEGER NOT NULL
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
      sql: `INSERT INTO user VALUES (?, 's@s', 0, null, null, ?, ?, null)`,
      args: [userId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity VALUES ('ent_ada', ?, 'person', 'Ada Lovelace', '[]', null, null, ?, ?, null)`,
      args: [userId, now, now],
    });

    setAttachmentStoreForTests(createMemoryObjectStore());
  });

  afterAll(() => {
    setAttachmentStoreForTests(undefined);
  });

  beforeEach(async () => {
    await client.executeMultiple(`DELETE FROM act; DELETE FROM interaction; DELETE FROM interaction_attachment;`);
    scheduleActDraftingMock.mockClear();
    extractHybridMock.mockClear();
    extractHybridMock.mockResolvedValue({
      persons: [
        {
          name: 'Ada Lovelace',
          aliases: [] as string[],
          role: null,
          companyHint: null,
          topics: [] as string[],
          email: null,
          linkedin: null,
          notes: null,
        },
      ],
      companies: [],
      events: [],
      topics: [],
      actions: [],
    });
    extractorMock.mockClear();
    extractorMock.mockResolvedValue({
      interactionId: 'int_new',
      entityIds: ['ent_ada'],
      companyIds: [],
      eventIds: [],
      topicIds: [],
      newEntities: 1,
      matchedEntities: 0,
      persons: [{ entityId: 'ent_ada', created: true, score: 1 }],
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

  it('stores image bytes in the object store and never as a base64 row', async () => {
    const jpeg = makeJpeg(64, 0x5a);
    const jpegBase64 = jpeg.toString('base64');

    const res = await caller().commit({
      transcript: 'coffee with ada',
      attachment: { jpegBase64 },
    });

    const rows = await db.query.interactionAttachments.findMany();
    expect(rows).toHaveLength(1);
    const row = rows[0]!;

    // The row carries the content-addressed key, not the bytes.
    expect(row.jpegBase64).toBeNull();
    expect(row.byteSize).toBe(64);
    expect(row.storageKey).toMatch(/^attachments\/v1\/user_storage\/[a-f0-9]{64}\.jpg$/);

    // The bytes in the store are exactly the upload, key hash matches content.
    const { getAttachmentStore } = await import('@/lib/storage/attachments');
    const object = await getAttachmentStore().get(row.storageKey!);
    expect(object).not.toBeNull();
    expect(Buffer.compare(Buffer.from(object!.body), jpeg)).toBe(0);
    expect(attachmentBytesMatchKey(row.storageKey!, jpeg)).toBe(true);
    expect(sha256Hex(jpeg)).toBe(sha256Hex(object!.body));

    // Wire contract: the caller still receives base64 for rendering.
    expect(res.attachments[0]?.jpegBase64).toBe(jpegBase64);
  });

  it('re-capture of the same interaction hydrates the existing storage-backed row', async () => {
    const jpeg = makeJpeg(48, 0x3c);
    const jpegBase64 = jpeg.toString('base64');

    const first = await caller().commit({ transcript: 'first capture', attachment: { jpegBase64 } });
    const second = await caller().commit({ transcript: 'second capture', attachment: { jpegBase64 } });

    // Dedupe: the second commit must not add a duplicate attachment row.
    const rows = await db.query.interactionAttachments.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.jpegBase64).toBeNull();

    // The dedupe path still returns base64 to the wire — hydrated from the
    // object store, proving the storage-backed read path works for re-captures.
    expect(first.attachments[0]?.jpegBase64).toBe(jpegBase64);
    expect(second.attachments[0]?.jpegBase64).toBe(jpegBase64);
  });
});
