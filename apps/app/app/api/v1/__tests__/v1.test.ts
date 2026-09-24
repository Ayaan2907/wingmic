import { describe, it, expect, beforeAll, vi } from 'vitest';
import type { Client as LibsqlClient } from '@libsql/client';

// Handler-level tests for the /api/v1 REST surface. The db singleton is
// swapped for an in-memory libSQL db (same harness as the router tests);
// the capture extractor is stubbed so the HTTP layer is tested in
// isolation. Scope matrix: every endpoint 200s for a key holding its scope
// and 403s (naming the missing scope) for keys without it.

const harness = vi.hoisted(() => ({ client: null as null | LibsqlClient }));

vi.mock('@wingmic/db', async () => {
  const { createClient } = await import('@libsql/client');
  const { drizzle } = await import('drizzle-orm/libsql');
  const schema = await import('@wingmic/db/schema');
  const client = createClient({ url: ':memory:' });
  harness.client = client as LibsqlClient;
  return { db: drizzle(client, { schema }), schema };
});

vi.mock('@wingmic/extractor', async (orig) => {
  const actual = await orig<typeof import('@wingmic/extractor')>();
  return {
    ...actual, // ExtractionError / EmbeddingError identities stay real
    extractHybrid: vi.fn(async () => ({
      persons: [], companies: [], events: [], topics: [], actions: [],
    })),
    commit: vi.fn(async () => ({
      interactionId: 'int_v1',
      entityIds: ['en_v1'],
      eventIds: [],
      persons: [],
      companyIds: [],
      topicIds: [],
      newEntities: 0,
      matchedEntities: 1,
    })),
  };
});

vi.mock('@wingmic/extractor/embeddings', () => ({
  embedText: vi.fn(async () => {
    const vec = new Array(1536).fill(0);
    vec[0] = 1;
    return vec;
  }),
  buildRecallContext: vi.fn(async () => ({})),
}));

import { db } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import { drizzle } from 'drizzle-orm/libsql';
import { createApiKey, revokeApiKey } from '@/lib/api/keys';
import { windowStartFor } from '@/lib/api/rateLimit';

import { GET as graphGET } from '../graph/route';
import { GET as peopleGET } from '../people/route';
import { POST as capturePOST } from '../capture/route';
import { GET as recallGET } from '../recall/route';

// Direct router imports for the apiCallerContext contract pin below.
import { graphRouter } from '@/lib/trpc/routers/graph';
import { entityRouter } from '@/lib/trpc/routers/entity';
import { captureRouter } from '@/lib/trpc/routers/capture';
import { recallRouter } from '@/lib/trpc/routers/recall';

type DB = ReturnType<typeof drizzle<typeof schema>>;

const USER_ID = 'user_v1';

function authedReq(handler: (req: Request) => Promise<Response>, opts: {
  method?: 'GET' | 'POST';
  key?: string;
  url?: string;
  body?: unknown;
} = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.key !== undefined) headers.Authorization = `Bearer ${opts.key}`;
  const req = new Request(opts.url ?? 'http://localhost/api/v1/x', {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return handler(req);
}

const endpoints = [
  { name: 'graph', scope: 'graph:read', call: (k?: string) => authedReq(graphGET, { key: k }) },
  {
    name: 'people',
    scope: 'graph:read',
    call: (k?: string) => authedReq(peopleGET, { key: k, url: 'http://localhost/api/v1/people?limit=5' }),
  },
  {
    name: 'capture',
    scope: 'capture:write',
    call: (k?: string) =>
      authedReq(capturePOST, {
        method: 'POST',
        key: k,
        body: { transcript: 'grabbed coffee with Sarah Chen — follow up next week' },
      }),
  },
  {
    name: 'recall',
    scope: 'search:read',
    call: (k?: string) => authedReq(recallGET, { key: k, url: 'http://localhost/api/v1/recall?q=rust' }),
  },
] as const;

const scopeSets = [
  { label: 'graph-only', scopes: ['graph:read'] },
  { label: 'capture-only', scopes: ['capture:write'] },
  { label: 'search-only', scopes: ['search:read'] },
  { label: 'full', scopes: ['graph:read', 'capture:write', 'search:read'] },
] as const;

describe('/api/v1', () => {
  let keys: Record<string, { rawKey: string; id: string }> = {};

  beforeAll(async () => {
    await harness.client!.executeMultiple(`
      CREATE TABLE api_key (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
        prefix TEXT NOT NULL, key_hash TEXT NOT NULL, scopes TEXT NOT NULL,
        created_at INTEGER NOT NULL, last_used_at INTEGER, revoked_at INTEGER
      );
      CREATE UNIQUE INDEX api_key_hash_idx ON api_key (key_hash);
      CREATE TABLE api_rate_window (
        key_id TEXT NOT NULL, window_start INTEGER NOT NULL,
        count INTEGER DEFAULT 0 NOT NULL, PRIMARY KEY (key_id, window_start)
      );
      CREATE TABLE user (
        id TEXT PRIMARY KEY, email TEXT NOT NULL, email_verified INTEGER DEFAULT 0,
        name TEXT, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        calendar_ics_url TEXT
      );
      CREATE TABLE usage_daily (
        user_id TEXT NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL,
        count INTEGER DEFAULT 0 NOT NULL, PRIMARY KEY (user_id, day, kind)
      );
      CREATE TABLE interaction (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, transcript TEXT NOT NULL,
        captured_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
        client_capture_id TEXT, deleted_at INTEGER, status TEXT DEFAULT 'committed'
      );
      CREATE TABLE interaction_attachment (
        id TEXT PRIMARY KEY, interaction_id TEXT NOT NULL, entity_id TEXT, event_id TEXT,
        mime_type TEXT DEFAULT 'image/jpeg' NOT NULL, jpeg_base64 TEXT NOT NULL,
        byte_size INTEGER NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE TABLE entity (
        id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, kind TEXT DEFAULT 'person',
        name TEXT NOT NULL, aliases TEXT DEFAULT '[]', import_source TEXT,
        embedding F32_BLOB(1536), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );
      CREATE TABLE entity_company (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, company_id TEXT NOT NULL, role TEXT, since INTEGER, until INTEGER, created_at INTEGER NOT NULL, source_deleted INTEGER DEFAULT 0 NOT NULL);
      CREATE TABLE entity_event (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, event_id TEXT NOT NULL, role TEXT, created_at INTEGER NOT NULL, source_deleted INTEGER DEFAULT 0 NOT NULL);
      CREATE TABLE entity_topic (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, topic_id TEXT NOT NULL, weight INTEGER DEFAULT 50, source_interaction_id TEXT, created_at INTEGER NOT NULL, source_deleted INTEGER DEFAULT 0 NOT NULL);
      CREATE TABLE entity_fact (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, source_interaction_id TEXT, confidence INTEGER DEFAULT 85, embedding F32_BLOB(1536), created_at INTEGER NOT NULL);
      CREATE TABLE company (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, domain TEXT, industry TEXT, observed_count INTEGER DEFAULT 1, promoted_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE event (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, date_range_start INTEGER, date_range_end INTEGER, location TEXT, url TEXT, external_source TEXT, external_id TEXT, observed_count INTEGER DEFAULT 1, promoted_at INTEGER, created_at INTEGER NOT NULL);
      CREATE TABLE topic (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, aliases TEXT DEFAULT '[]', parent_id TEXT, created_at INTEGER NOT NULL);
      CREATE INDEX entity_embedding_vector_idx ON entity (libsql_vector_idx(embedding));
    `);

    const now = Date.now();
    await harness.client!.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, created_at, updated_at) VALUES ('en_v1', ?, 'person', 'Sarah Chen', '[]', ?, ?)`,
      args: [USER_ID, now, now],
    });

    for (const set of scopeSets) {
      const { rawKey, apiKey } = await createApiKey({
        db: db as DB,
        userId: USER_ID,
        name: set.label,
        scopes: [...set.scopes],
      });
      keys[set.label] = { rawKey, id: apiKey.id };
    }
  });

  it('scope matrix: every endpoint 200s for keys holding its scope', async () => {
    for (const ep of endpoints) {
      const res = await ep.call(keys.full!.rawKey);
      expect(res.status, `${ep.name} with full key`).toBe(200);
      const body = await res.json();
      expect(body.error).toBeUndefined();
    }
  });

  it('scope matrix: keys without the endpoint scope get 403 naming it', async () => {
    for (const ep of endpoints) {
      for (const set of scopeSets) {
        if ((set.scopes as readonly string[]).includes(ep.scope)) continue; // covered by the 200s
        const res = await ep.call(keys[set.label]!.rawKey);
        expect(res.status, `${ep.name} with ${set.label}`).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('insufficient_scope');
        expect(body.error.missingScope).toBe(ep.scope);
        expect(body.error.message).toContain(ep.scope);
      }
    }
  });

  it('contract pin: v1-reachable procedures read only ctx.user.id (the synthesized context carries nothing else)', async () => {
    // apiCallerContext hands the routers a user of `{ id }` while the real
    // BetterAuth session user carries email/name/... — the widening cast is
    // safe ONLY while every /api/v1 procedure consumes just `user.id`. This
    // test fails the first time a procedure reads any other field off the
    // user, which is the signal to widen apiCallerContext deliberately.
    const reads: string[] = [];
    const trackedUser = new Proxy<Record<string, unknown>>({ id: USER_ID }, {
      get(target, prop) {
        if (typeof prop === 'string') reads.push(prop);
        return target[prop as string];
      },
    });
    const ctx = {
      db,
      session: { user: trackedUser },
      user: trackedUser,
      headers: new Headers(),
    } as unknown as Parameters<typeof graphRouter.createCaller>[0];

    // Drive every procedure /api/v1 can reach. Validation failures still
    // record reads — .catch keeps the read-tracker authoritative.
    await graphRouter.createCaller(ctx).get().catch(() => undefined);
    await entityRouter.createCaller(ctx).listPeople({ limit: 5 }).catch(() => undefined);
    await captureRouter
      .createCaller(ctx)
      .commit({ transcript: 'grabbed coffee with Sarah Chen — follow up next week' })
      .catch(() => undefined);
    await recallRouter.createCaller(ctx).query({ q: 'rust' }).catch(() => undefined);

    const unexpected = [...new Set(reads)].filter((k) => k !== 'id');
    expect(
      unexpected,
      `procedures read ctx.user.${unexpected.join(', ctx.user.')} — apiCallerContext does not synthesize it`,
    ).toEqual([]);
  });

  it('unauthenticated requests get 401', async () => {
    const cases: Array<Response> = [
      await authedReq(graphGET, {}), // no header
      await graphGET(
        new Request('http://localhost/api/v1/graph', { headers: { Authorization: 'Basic abc' } }),
      ),
      await authedReq(graphGET, { key: 'wk_live_unknown' }),
      await authedReq(graphGET, { key: '' }),
    ];
    for (const res of cases) {
      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe('unauthorized');
    }
  });

  it('revoked keys get 401 immediately', async () => {
    const { rawKey, apiKey } = await createApiKey({
      db: db as DB,
      userId: USER_ID,
      name: 'revoke-me',
      scopes: ['graph:read'],
    });
    expect((await graphGET(
      new Request('http://localhost/api/v1/graph', { headers: { Authorization: `Bearer ${rawKey}` } }),
    )).status).toBe(200);

    await revokeApiKey(db as DB, USER_ID, apiKey.id);
    const res = await graphGET(
      new Request('http://localhost/api/v1/graph', { headers: { Authorization: `Bearer ${rawKey}` } }),
    );
    expect(res.status).toBe(401);
  });

  it('capture maps a bad body to 400 without touching auth scopes', async () => {
    const res = await authedReq(capturePOST, {
      method: 'POST',
      key: keys['capture-only']!.rawKey,
      body: { nope: true },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('bad_request');
  });

  it('per-key rate limit returns 429 with Retry-After when the window is full', async () => {
    const { rawKey, apiKey } = await createApiKey({
      db: db as DB,
      userId: USER_ID,
      name: 'limited',
      scopes: ['graph:read'],
    });
    const windowStart = windowStartFor(new Date());
    await harness.client!.execute({
      sql: 'INSERT INTO api_rate_window (key_id, window_start, count) VALUES (?, ?, 60)',
      args: [apiKey.id, windowStart],
    });

    const res = await graphGET(
      new Request('http://localhost/api/v1/graph', {
        headers: { Authorization: `Bearer ${rawKey}` },
      }),
    );
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1);
    expect((await res.json()).error.code).toBe('rate_limited');
  });
});
