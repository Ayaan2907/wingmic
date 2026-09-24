import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';

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

const extractorMock = vi.mocked(commit);
const extractHybridMock = vi.mocked(extractHybrid);

describe('capture.commit — deferred acts drafting (spec D2)', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_deferred';
  let now = Date.now();

  const extractedResult = {
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
    actions: [
      {
        kind: 'email' as const,
        body: 'send the deck',
        whenHint: 'tomorrow',
        targetPersonName: 'Ada Lovelace',
      },
    ],
  };

  const commitResult = {
    interactionId: 'int_new',
    entityIds: ['ent_ada'],
    companyIds: [],
    eventIds: [],
    topicIds: [],
    newEntities: 1,
    matchedEntities: 0,
    persons: [{ entityId: 'ent_ada', created: true, score: 1 }],
  };

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
        jpeg_base64 TEXT NOT NULL, byte_size INTEGER NOT NULL, created_at INTEGER NOT NULL
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
      sql: `INSERT INTO user VALUES (?, 'd@d', 0, null, null, ?, ?, null)`,
      args: [userId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity VALUES ('ent_ada', ?, 'person', 'Ada Lovelace', '[]', null, null, ?, ?, null)`,
      args: [userId, now, now],
    });
  });

  beforeEach(async () => {
    await client.executeMultiple(`DELETE FROM act; DELETE FROM interaction;`);
    scheduleActDraftingMock.mockClear();
    extractHybridMock.mockClear();
    extractHybridMock.mockResolvedValue(extractedResult);
    extractorMock.mockClear();
    extractorMock.mockResolvedValue(commitResult);
  });

  function caller() {
    const ctx = {
      db,
      user: { id: userId },
      session: { user: { id: userId } },
    } as unknown as Parameters<typeof captureRouter.createCaller>[0];
    return captureRouter.createCaller(ctx);
  }

  it('returns before drafts exist: rows stay drafting and the queue is scheduled', async () => {
    const res = await caller().commit({
      transcript: 'coffee with ada — send the deck tomorrow',
    });

    expect(res.actsPending).toBe(1);
    const rows = await db.query.acts.findMany();
    expect(rows).toHaveLength(1);
    // The commit response no longer waits on polishDraft — the placeholder row
    // is still in 'drafting' with the extractor seed as its body.
    expect(rows[0]?.status).toBe('drafting');
    expect(rows[0]?.body).toBe('send the deck');
    expect(rows[0]?.subject).toBeNull();
    expect(rows[0]?.sourceInteractionId).toBe(res.interactionId);
  });

  it('schedules the background polish with the interaction and transcript', async () => {
    const res = await caller().commit({
      transcript: 'coffee with ada — send the deck tomorrow',
    });

    expect(scheduleActDraftingMock).toHaveBeenCalledTimes(1);
    expect(scheduleActDraftingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        interactionId: res.interactionId,
        transcript: 'coffee with ada — send the deck tomorrow',
      }),
    );
  });

  it('creates one placeholder per extracted action and reports the count', async () => {
    extractHybridMock.mockResolvedValue({
      ...extractedResult,
      actions: [
        {
          kind: 'email' as const,
          body: 'send the deck',
          whenHint: null,
          targetPersonName: 'Ada Lovelace',
        },
        {
          kind: 'reminder' as const,
          body: 'book the follow-up',
          whenHint: 'friday',
          targetPersonName: null,
        },
      ],
    });

    const res = await caller().commit({ transcript: 'memo with two actions' });

    expect(res.actsPending).toBe(2);
    const rows = await db.query.acts.findMany();
    expect(rows.map((r) => r.status)).toEqual(['drafting', 'drafting']);
    expect(scheduleActDraftingMock).toHaveBeenCalledTimes(1);
  });

  it('returns actsPending 0 and queues nothing when extraction finds no actions', async () => {
    extractHybridMock.mockResolvedValue({ ...extractedResult, actions: [] });

    const res = await caller().commit({ transcript: 'just a memo' });

    expect(res.actsPending).toBe(0);
    expect(await db.query.acts.findMany()).toHaveLength(0);
    expect(scheduleActDraftingMock).not.toHaveBeenCalled();
  });

  it('skips placeholder insert + queue on an idempotent retry', async () => {
    await client.execute({
      sql: `INSERT INTO interaction (id, user_id, transcript, captured_at, created_at, client_capture_id)
            VALUES ('int_dup', ?, 'dup memo', 1, 1, 'capture_dup')`,
      args: [userId],
    });

    const res = await caller().commit({ transcript: 'dup memo', clientCaptureId: 'capture_dup' });

    expect(res.duplicate).toBe(true);
    expect(res.actsPending).toBe(0);
    expect(await db.query.acts.findMany()).toHaveLength(0);
    expect(scheduleActDraftingMock).not.toHaveBeenCalled();
    expect(extractHybridMock).not.toHaveBeenCalled();
  });

  it('a placeholder insert failure does not fail the capture', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await client.execute(`DROP TABLE act`);

    try {
      const res = await caller().commit({ transcript: 'acts table gone' });
      expect(res.interactionId).toBe('int_new');
      expect(res.actsPending).toBe(0);
      expect(consoleError).toHaveBeenCalled(); // surfaced, not silent
    } finally {
      consoleError.mockRestore();
      await client.execute(`CREATE TABLE act (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
        kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'drafted',
        body TEXT NOT NULL, subject TEXT, when_hint TEXT, run_at INTEGER,
        target_entity_id TEXT, secondary_entity_id TEXT, source_interaction_id TEXT,
        confidence INTEGER NOT NULL DEFAULT 80,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      )`);
    }
  });
});
