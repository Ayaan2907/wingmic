import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';

// Mock embedText so we don't hit OpenAI from tests.
vi.mock('@wingmic/extractor/embeddings', async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    embedText: vi.fn(async (q: string) => {
      // Deterministic 1536-dim vector: lean toward 1.0 if query mentions "rust", else 0.
      const v = new Array(1536).fill(0);
      const seed = q.toLowerCase().includes('rust') ? 1 : 0;
      v[0] = seed;
      v[1] = 1 - seed;
      // normalize
      const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
      return v.map((x) => x / norm);
    }),
  };
});

import { embedText } from '@wingmic/extractor/embeddings';
import { recallRouter } from './recall';

// Helper: f32 buffer from number[]
function f32(arr: number[]): Buffer {
  const a = new Float32Array(arr);
  return Buffer.from(a.buffer, a.byteOffset, a.byteLength);
}

describe('recall.query (libSQL vector_top_k)', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_test_1';

  beforeAll(async () => {
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });

    // Minimal subset of schema needed for recall (we use the migration SQL shape).
    await client.executeMultiple(`
      CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL, email_verified INTEGER DEFAULT 0, name TEXT, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE entity (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        kind TEXT DEFAULT 'person',
        name TEXT NOT NULL,
        aliases TEXT DEFAULT '[]',
        import_source TEXT,
        embedding F32_BLOB(1536),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );
      CREATE TABLE entity_company (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, company_id TEXT NOT NULL, role TEXT, since INTEGER, until INTEGER, created_at INTEGER NOT NULL, source_deleted INTEGER DEFAULT false NOT NULL);
      CREATE TABLE entity_event (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, event_id TEXT NOT NULL, role TEXT, created_at INTEGER NOT NULL, source_deleted INTEGER DEFAULT false NOT NULL);
      CREATE TABLE entity_topic (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, topic_id TEXT NOT NULL, weight INTEGER DEFAULT 50, source_interaction_id TEXT, created_at INTEGER NOT NULL, source_deleted INTEGER DEFAULT false NOT NULL);
      CREATE TABLE entity_fact (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, source_interaction_id TEXT, confidence INTEGER DEFAULT 85, embedding F32_BLOB(1536), created_at INTEGER NOT NULL);
      CREATE TABLE company (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, domain TEXT, industry TEXT, observed_count INTEGER DEFAULT 1, promoted_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE event (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, date_range_start INTEGER, date_range_end INTEGER, location TEXT, url TEXT, observed_count INTEGER DEFAULT 1, promoted_at INTEGER, created_at INTEGER NOT NULL);
      CREATE TABLE topic (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, aliases TEXT DEFAULT '[]', parent_id TEXT, created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS entity_embedding_vector_idx ON entity (libsql_vector_idx(embedding));
    `);

    // 3 entities. e1's embedding leans rust-axis (v[0]=1), e2/e3 lean other axis.
    const now = Date.now();
    const insertEntity = async (
      id: string,
      name: string,
      vec: number[],
    ): Promise<void> => {
      await client.execute({
        sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, embedding, created_at, updated_at) VALUES (?, ?, 'person', ?, '[]', ?, ?, ?)`,
        args: [id, userId, name, f32(vec), now, now],
      });
    };

    const rustVec = new Array(1536).fill(0);
    rustVec[0] = 1;
    const otherVec = new Array(1536).fill(0);
    otherVec[1] = 1;

    await insertEntity('e1', 'Alice Rustacean', rustVec);
    await insertEntity('e2', 'Bob TypeScript', otherVec);
    await insertEntity('e3', 'Carol Python', otherVec);
  });

  it('returns top entity ranked by vector_top_k', async () => {
    const ctx = {
      db,
      user: { id: userId },
      session: { user: { id: userId } },
    } as unknown as Parameters<typeof recallRouter.createCaller>[0];

    const caller = recallRouter.createCaller(ctx);
    const res = await caller.query({ q: 'who works on rust?', limit: 3 });

    expect(res.entities.length).toBeGreaterThan(0);
    expect(res.entities[0]?.id).toBe('e1');
    expect(res.entities[0]?.name).toBe('Alice Rustacean');
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
    expect(res.mode).toBe('semantic');
  });

  it('isolates results to the calling user (cross-user safety)', async () => {
    // Seed a second user with entities whose embeddings are a STRONGER rust
    // match than any of user_test_1's. If the router leaked across users, the
    // top result would be one of these.
    const otherUserId = 'user_test_2';
    const now = Date.now();
    const insert = async (id: string, name: string, vec: number[]) => {
      await client.execute({
        sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, embedding, created_at, updated_at) VALUES (?, ?, 'person', ?, '[]', ?, ?, ?)`,
        args: [id, otherUserId, name, f32(vec), now, now],
      });
    };
    const strongRust = new Array(1536).fill(0);
    strongRust[0] = 1; // identical-axis match — globally top-ranked
    await insert('x1', 'Other Rustacean', strongRust);
    await insert('x2', 'Other Rustacean Two', strongRust);

    const ctx = {
      db,
      user: { id: userId },
      session: { user: { id: userId } },
    } as unknown as Parameters<typeof recallRouter.createCaller>[0];
    const caller = recallRouter.createCaller(ctx);
    const res = await caller.query({ q: 'who works on rust?', limit: 10 });

    const ids = res.entities.map((e) => e.id);
    expect(ids).not.toContain('x1');
    expect(ids).not.toContain('x2');
    expect(ids.every((id) => ['e1', 'e2', 'e3'].includes(id))).toBe(true);
    expect(res.mode).toBe('semantic');
  });

  it('gracefully returns fewer rows when limit > index size', async () => {
    const ctx = {
      db,
      user: { id: userId },
      session: { user: { id: userId } },
    } as unknown as Parameters<typeof recallRouter.createCaller>[0];

    const caller = recallRouter.createCaller(ctx);
    const res = await caller.query({ q: 'anything', limit: 50 });
    expect(res.entities.length).toBeLessThanOrEqual(3);
    expect(res.mode).toBe('semantic');
  });

  it('falls back to text match when embed fails, then recovers to semantic', async () => {
    const embedMock = vi.mocked(embedText);
    embedMock.mockImplementationOnce(async () => {
      throw new Error('no key');
    });

    const ctx = {
      db,
      user: { id: userId },
      session: { user: { id: userId } },
    } as unknown as Parameters<typeof recallRouter.createCaller>[0];
    const caller = recallRouter.createCaller(ctx);

    const textRes = await caller.query({ q: 'alice', limit: 5 });
    expect(textRes.mode).toBe('text');
    expect(textRes.entities.map((e) => e.id)).toContain('e1');
    expect(textRes.entities.every((e) => e.score === 0)).toBe(true);

    const semanticRes = await caller.query({ q: 'who works on rust?', limit: 3 });
    expect(semanticRes.mode).toBe('semantic');
    expect(semanticRes.entities[0]?.id).toBe('e1');
  });
});
