/**
 * Taxonomy test — spec art_LkglG0Xb verification row: "taxonomy test
 * asserting every tracked event fires in dev".
 *
 * The PostHog client is mocked (no network, no key needed to observe calls
 * — the env mock enables analytics explicitly). Real router/middleware code
 * is driven end-to-end over in-memory libSQL so each taxonomy event is
 * proven to fire from its actual instrumentation point, with the required
 * properties present and nothing PII-shaped anywhere in the payloads.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';
import type { Client as LibsqlClient } from '@libsql/client';

// ── Hoisted state ─────────────────────────────────────────────────────────

// Every PostHog capture the analytics module emits lands here.
const ph = vi.hoisted(() => ({
  calls: [] as Array<{
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
  }>,
}));

// Analytics enabled for this file — the real env module's defaults stay,
// with the PostHog fields overridden.
const mockEnv = vi.hoisted(() => ({
  POSTHOG_KEY: 'phc_test_taxonomy' as string | undefined,
  POSTHOG_HOST: 'https://analytics.test' as string | undefined,
  NEXT_PUBLIC_POSTHOG_KEY: undefined as string | undefined,
}));

// The '@wingmic/db' singleton swap for withApiKey's module-level db
// (same harness as v1.test.ts).
const harness = vi.hoisted(() => ({ client: null as null | LibsqlClient }));

// ── Module mocks ──────────────────────────────────────────────────────────

vi.mock('@/lib/config/env', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/config/env')>();
  return { ...real, env: { ...real.env, ...mockEnv } };
});

vi.mock('posthog-node', () => ({
  PostHog: class {
    capture(evt: { distinctId: string; event: string; properties?: Record<string, unknown> }) {
      ph.calls.push(evt);
    }
  },
}));

vi.mock('@wingmic/db', async () => {
  const { createClient } = await import('@libsql/client');
  const { drizzle } = await import('drizzle-orm/libsql');
  const schema = await import('@wingmic/db/schema');
  const client = createClient({ url: ':memory:' });
  harness.client = client as LibsqlClient;
  return { db: drizzle(client, { schema }), schema };
});

vi.mock('@wingmic/extractor', async (importOriginal) => {
  const real = await importOriginal<typeof import('@wingmic/extractor')>();
  return {
    ...real, // ExtractionError / EmbeddingError identities stay real
    extractHybrid: vi.fn(async () => ({
      persons: [],
      companies: [],
      events: [],
      topics: [],
      actions: [],
    })),
    commit: vi.fn(async () => ({
      interactionId: 'int_tax_fresh',
      entityIds: [],
      eventIds: [],
      persons: [],
      companyIds: [],
      topicIds: [],
      newEntities: 2,
      matchedEntities: 1,
    })),
  };
});

vi.mock('@wingmic/extractor/embeddings', async (importOriginal) => {
  const real = await importOriginal<typeof import('@wingmic/extractor/embeddings')>();
  return {
    ...real,
    embedText: vi.fn(async (q: string) => {
      // Deterministic 1536-dim vector leaning the rust axis (same trick as
      // recall.test.ts) so the semantic path ranks the seeded entity.
      const v = new Array(1536).fill(0);
      const seed = q.toLowerCase().includes('rust') ? 1 : 0;
      v[0] = seed;
      v[1] = 1 - seed;
      const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
      return v.map((x) => x / norm);
    }),
  };
});

// ── Imports under test (after mocks) ─────────────────────────────────────

import { captureRouter } from '@/lib/trpc/routers/capture';
import { recallRouter } from '@/lib/trpc/routers/recall';
import { withApiKey } from '@/lib/api/server';
import { createApiKey } from '@/lib/api/keys';
import { enrichPersonFacts } from '@/lib/enrich/enrichPersons';
import { enrichEventsAfterCommit } from '@/lib/enrich/enrichEvents';
import { auth } from '@/lib/auth';
import type { WebSearchProvider } from '@/lib/web-search';
import { ANALYTICS_EVENT_NAMES } from '../events';
import { db as moduleDb } from '@wingmic/db';

type DB = ReturnType<typeof drizzle<typeof schema>>;

function f32(arr: number[]): Buffer {
  const a = new Float32Array(arr);
  return Buffer.from(a.buffer, a.byteOffset, a.byteLength);
}

const USER_ID = 'user_tax';

function callerCtx(db: DB) {
  return {
    db,
    user: { id: USER_ID },
    session: { user: { id: USER_ID } },
  } as unknown as Parameters<typeof captureRouter.createCaller>[0];
}

describe('analytics taxonomy (spec art_LkglG0Xb)', () => {
  let client: ReturnType<typeof createClient>;
  let db: DB;

  beforeEach(async () => {
    ph.calls.length = 0;
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema }) as DB;
    await client.executeMultiple(`
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
        client_capture_id TEXT
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
      CREATE INDEX IF NOT EXISTS entity_embedding_vector_idx ON entity (libsql_vector_idx(embedding));
      CREATE TABLE entity_company (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, company_id TEXT NOT NULL, role TEXT, since INTEGER, until INTEGER, created_at INTEGER NOT NULL, source_deleted INTEGER DEFAULT 0 NOT NULL);
      CREATE TABLE entity_event (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, event_id TEXT NOT NULL, role TEXT, created_at INTEGER NOT NULL, source_deleted INTEGER DEFAULT 0 NOT NULL);
      CREATE TABLE entity_topic (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, topic_id TEXT NOT NULL, weight INTEGER DEFAULT 50, source_interaction_id TEXT, created_at INTEGER NOT NULL, source_deleted INTEGER DEFAULT 0 NOT NULL);
      CREATE TABLE entity_fact (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, source_interaction_id TEXT, confidence INTEGER DEFAULT 85, embedding F32_BLOB(1536), created_at INTEGER NOT NULL);
      CREATE TABLE company (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, domain TEXT, industry TEXT, observed_count INTEGER DEFAULT 1, promoted_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE event (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, date_range_start INTEGER, date_range_end INTEGER, location TEXT, url TEXT, external_source TEXT, external_id TEXT, observed_count INTEGER DEFAULT 1, promoted_at INTEGER, created_at INTEGER NOT NULL);
      CREATE TABLE topic (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, aliases TEXT DEFAULT '[]', parent_id TEXT, created_at INTEGER NOT NULL);
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
    `);

    // withApiKey reads the module-level '@wingmic/db' singleton (mocked to a
    // separate in-memory client that persists across tests in this file) —
    // its api tables live there.
    await harness.client!.executeMultiple(`
      CREATE TABLE IF NOT EXISTS api_key (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
        prefix TEXT NOT NULL, key_hash TEXT NOT NULL, scopes TEXT NOT NULL,
        created_at INTEGER NOT NULL, last_used_at INTEGER, revoked_at INTEGER
      );
      CREATE UNIQUE INDEX IF NOT EXISTS api_key_hash_idx ON api_key (key_hash);
      CREATE TABLE IF NOT EXISTS api_rate_window (
        key_id TEXT NOT NULL, window_start INTEGER NOT NULL,
        count INTEGER DEFAULT 0 NOT NULL, PRIMARY KEY (key_id, window_start)
      );
    `);
  });

  const events = () => ph.calls.map((c) => c.event);

  it('capture.commit (duplicate retry) fires capture_started and capture_completed', async () => {
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO interaction (id, user_id, transcript, captured_at, created_at, client_capture_id)
            VALUES ('int_dup', ?, 'photo memo', ?, ?, 'cap_dup')`,
      args: [USER_ID, now, now],
    });

    const caller = captureRouter.createCaller(callerCtx(db));
    const res = await caller.commit({
      transcript: 'photo memo',
      clientCaptureId: 'cap_dup',
    });

    expect(res.duplicate).toBe(true);
    expect(events()).toEqual(['capture_started', 'capture_completed']);

    const started = ph.calls[0]!;
    expect(started.distinctId).toBe(USER_ID);
    expect(started.properties).toMatchObject({
      hasAttachment: false,
      hasParent: false,
      hasTarget: false,
    });

    const completed = ph.calls[1]!;
    expect(completed.distinctId).toBe(USER_ID);
    expect(completed.properties).toMatchObject({
      duplicate: true,
      hasAttachment: false,
      newEntities: 0,
      matchedEntities: 0,
      actions: 0,
      actsPending: 0,
    });
    expect((completed.properties!.durationMs as number) >= 0).toBe(true);
  });

  it('capture.commit (fresh) fires capture_completed with volume and entity_created', async () => {
    const caller = captureRouter.createCaller(callerCtx(db));
    const res = await caller.commit({
      transcript: 'Met Sarah Chen at the Analytical Engines demo day',
      clientCaptureId: 'cap_fresh',
    });

    // The fresh path returns the committed interaction + provenance (no
    // duplicate flag — only the retry path carries one).
    expect(res.interactionId).toBe('int_tax_fresh');
    expect(events()).toEqual(['capture_started', 'capture_completed', 'entity_created']);

    const completed = ph.calls[1]!;
    expect(completed.properties).toMatchObject({
      duplicate: false,
      newEntities: 2,
      matchedEntities: 1,
      actions: 0,
      actsPending: 0,
    });

    const created = ph.calls[2]!;
    expect(created.distinctId).toBe(USER_ID);
    expect(created.properties).toMatchObject({
      newEntities: 2,
      matchedEntities: 1,
      persons: 0,
      companies: 0,
      events: 0,
      topics: 0,
    });
  });

  it('recall.query fires search_run with mode, result count, and duration (semantic hit)', async () => {
    const now = Date.now();
    const rustVec = new Array(1536).fill(0);
    rustVec[0] = 1;
    await client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, embedding, created_at, updated_at)
            VALUES ('e_rust', ?, 'person', 'Alice Rustacean', '[]', ?, ?, ?)`,
      args: [USER_ID, f32(rustVec), now, now],
    });

    const caller = recallRouter.createCaller(callerCtx(db) as never);
    const res = await caller.query({ q: 'who works on rust?', limit: 3 });

    expect(res.mode).toBe('semantic');
    expect(res.entities.length).toBeGreaterThan(0);
    expect(events()).toEqual(['search_run']);
    expect(ph.calls[0]!.distinctId).toBe(USER_ID);
    expect(ph.calls[0]!.properties).toMatchObject({
      mode: 'semantic',
      results: res.entities.length,
    });
  });

  it('recall.query fires search_run even on a zero-result query', async () => {
    const caller = recallRouter.createCaller(callerCtx(db) as never);
    const res = await caller.query({ q: 'zzzqqq nothing matches this', limit: 3 });

    expect(res.entities).toEqual([]);
    expect(events()).toEqual(['search_run']);
    expect(ph.calls[0]!.properties).toMatchObject({ results: 0 });
  });

  it('withApiKey fires api_call with method, route, scope, and status for valid keys — and stays silent on 401s', async () => {
    // Keys are created on the same db singleton withApiKey authenticates against.
    const { rawKey } = await createApiKey({
      db: moduleDb as DB,
      userId: USER_ID,
      name: 'taxonomy',
      scopes: ['graph:read'],
    });

    const ok = await withApiKey(
      new Request('http://localhost/api/v1/graph', {
        headers: { Authorization: `Bearer ${rawKey}` },
      }),
      'graph:read',
      async () => ({ ok: true }),
    );
    expect(ok.status).toBe(200);
    expect(events()).toEqual(['api_call']);
    expect(ph.calls[0]!.distinctId).toBe(USER_ID);
    expect(ph.calls[0]!.properties).toMatchObject({
      method: 'GET',
      route: '/api/v1/graph',
      scope: 'graph:read',
      status: 200,
    });

    // No identity → no event: 401 abuse noise is not product signal.
    const bad = await withApiKey(
      new Request('http://localhost/api/v1/graph', {
        headers: { Authorization: 'Bearer wk_live_bogus' },
      }),
      'graph:read',
      async () => ({ ok: true }),
    );
    expect(bad.status).toBe(401);
    expect(events()).toEqual(['api_call']);
  });

  it('person enrichment fires enrichment_run(ok) with a field count, and enrichment_run(error) without swallowing the failure', async () => {
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, created_at, updated_at)
            VALUES ('en_ada', ?, 'person', 'Ada Lovelace', '[]', ?, ?)`,
      args: [USER_ID, now, now],
    });

    const provider: WebSearchProvider = {
      id: 'tavily',
      search: vi.fn(async () => [
        {
          title: 'Ada Lovelace',
          url: 'https://www.analytical-engines.example/ada',
          snippet: 'mathematician',
        },
      ]),
      extract: vi.fn(async () => []),
    };
    const { wroteFactKeys } = await enrichPersonFacts({
      db: db as DB,
      userId: USER_ID,
      entityId: 'en_ada',
      person: {
        name: 'Ada Lovelace',
        companyHint: 'Analytical Engines',
      },
      provider,
      sourceInteractionId: null,
    });

    expect(wroteFactKeys.length).toBeGreaterThan(0);
    expect(events()).toEqual(['enrichment_run']);
    expect(ph.calls[0]!.properties).toMatchObject({
      kind: 'person',
      status: 'ok',
      fields: wroteFactKeys.length,
    });

    // Failure path: the event still fires, and the error still propagates.
    ph.calls.length = 0;
    const failing: WebSearchProvider = {
      id: 'tavily',
      search: vi.fn(async () => {
        throw new Error('provider unavailable');
      }),
      extract: vi.fn(async () => []),
    };
    await expect(
      enrichPersonFacts({
        db: db as DB,
        userId: USER_ID,
        entityId: 'en_ada',
        person: {
          name: 'Ada Lovelace',
          companyHint: 'Analytical Engines',
        },
        provider: failing,
        sourceInteractionId: null,
      }),
    ).rejects.toThrow('provider unavailable');

    expect(events()).toEqual(['enrichment_run']);
    expect(ph.calls[0]!.properties).toMatchObject({ kind: 'person', status: 'error', fields: 0 });
  });

  it('event enrichment fires enrichment_run(ok) with the patched field count', async () => {
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO event (id, slug, name, observed_count, created_at)
            VALUES ('ev_eth', 'eth-denver', 'ETH Denver', 1, ?)`,
      args: [now],
    });

    const provider: WebSearchProvider = {
      id: 'tavily',
      search: vi.fn(async () => [
        {
          title: 'ETH Denver 2026',
          url: 'https://www.ethdenver.com',
          snippet: 'Feb 27 – Mar 1, 2026 · Denver',
        },
      ]),
      extract: vi.fn(async () => []),
    };
    await enrichEventsAfterCommit({
      db: db as DB,
      userId: USER_ID,
      eventIds: ['ev_eth'],
      capturedAt: new Date('2026-08-20T00:00:00Z'),
      provider,
    });

    expect(events()).toEqual(['enrichment_run']);
    expect(ph.calls[0]!.properties).toMatchObject({
      kind: 'event',
      status: 'ok',
    });
    expect((ph.calls[0]!.properties!.fields as number) > 0).toBe(true);
  });

  it('BetterAuth user creation fires signup with the magic-link method', async () => {
    const hooks = (auth as unknown as {
      options: {
        databaseHooks: {
          user: { create: { after: (u: { id: string }) => Promise<void> } };
        };
      };
    }).options.databaseHooks;

    await hooks.user.create.after({ id: 'user_new_1' });

    expect(events()).toEqual(['signup']);
    expect(ph.calls[0]!.distinctId).toBe('user_new_1');
    expect(ph.calls[0]!.properties).toMatchObject({ method: 'magic_link' });
  });

  it('every locked taxonomy event fires from its instrumentation point, and no payload carries PII', async () => {
    // Drive all seven surfaces in one pass, then assert full coverage.
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO interaction (id, user_id, transcript, captured_at, created_at, client_capture_id)
            VALUES ('int_all', ?, 'grabbed coffee with Sarah Chen', ?, ?, 'cap_all')`,
      args: [USER_ID, now, now],
    });
    const rustVec = new Array(1536).fill(0);
    rustVec[0] = 1;
    await client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, embedding, created_at, updated_at)
            VALUES ('e_all', ?, 'person', 'Alice Rustacean', '[]', ?, ?, ?)`,
      args: [USER_ID, f32(rustVec), now, now],
    });

    const capture = captureRouter.createCaller(callerCtx(db));
    // Duplicate retry (seeded row): capture_started + capture_completed.
    await capture.commit({ transcript: 'photo memo', clientCaptureId: 'cap_all' });
    // Fresh commit (no seeded row): also fires entity_created.
    await capture.commit({
      transcript: 'quick coffee with Ada Lovelace',
      clientCaptureId: 'cap_all_fresh',
    });
    const recall = recallRouter.createCaller(callerCtx(db) as never);
    await recall.query({ q: 'who works on rust?', limit: 3 }); // search_run
    const { rawKey } = await createApiKey({
      db: moduleDb as DB,
      userId: USER_ID,
      name: 'all',
      scopes: ['graph:read'],
    });
    await withApiKey(
      new Request('http://localhost/api/v1/graph', {
        headers: { Authorization: `Bearer ${rawKey}` },
      }),
      'graph:read',
      async () => ({ ok: true }),
    ); // api_call
    const hooks = (auth as unknown as {
      options: {
        databaseHooks: {
          user: { create: { after: (u: { id: string }) => Promise<void> } };
        };
      };
    }).options.databaseHooks;
    await hooks.user.create.after({ id: 'user_new_2' }); // signup
    // enrichment_run comes from the dedicated person/event tests above via a
    // direct call here (provider stub, one field written):
    await client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, created_at, updated_at)
            VALUES ('en_all', ?, 'person', 'Ada Lovelace', '[]', ?, ?)`,
      args: [USER_ID, now, now],
    });
    const adaProvider: WebSearchProvider = {
      id: 'tavily',
      search: vi.fn(async () => [
        {
          title: 'Ada Lovelace',
          url: 'https://www.analytical-engines.example/ada',
          snippet: 'mathematician',
        },
      ]),
      extract: vi.fn(async () => []),
    };
    await enrichPersonFacts({
      db: db as DB,
      userId: USER_ID,
      entityId: 'en_all',
      person: {
        name: 'Ada Lovelace',
        companyHint: 'Analytical Engines',
      },
      provider: adaProvider,
      sourceInteractionId: null,
    });

    const fired = new Set(events());
    const missing = ANALYTICS_EVENT_NAMES.filter((name) => !fired.has(name));
    expect(missing).toEqual([]);

    // PII scan: no transcript text, no names, no emails anywhere in the
    // property bags (spec capture invariant + orchestrator contract).
    const forbidden = ['Sarah Chen', 'Ada Lovelace', 'sarah@', 'photo memo', 'grabbed coffee'];
    for (const call of ph.calls) {
      const flat = JSON.stringify(call.properties ?? {});
      for (const needle of forbidden) {
        expect(flat).not.toContain(needle);
      }
      expect(call.distinctId).not.toContain('@');
    }
  });
});
