import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';
import type { WebSearchProvider } from '@/lib/web-search';

import { entityRouter } from './entity';

// Shared in-memory DDL for entity router tests (entity.detail + entity.enrich).
const ENTITY_TEST_DDL = `
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
      CREATE TABLE entity_company (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, company_id TEXT NOT NULL, role TEXT, since INTEGER, until INTEGER, created_at INTEGER NOT NULL, source_deleted INTEGER DEFAULT 0 NOT NULL);
      CREATE TABLE entity_event (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, event_id TEXT NOT NULL, role TEXT, created_at INTEGER NOT NULL, source_deleted INTEGER DEFAULT 0 NOT NULL);
      CREATE TABLE entity_topic (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, topic_id TEXT NOT NULL, weight INTEGER DEFAULT 50, source_interaction_id TEXT, created_at INTEGER NOT NULL, source_deleted INTEGER DEFAULT 0 NOT NULL);
      CREATE TABLE entity_fact (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, source_interaction_id TEXT, confidence INTEGER DEFAULT 85, embedding F32_BLOB(1536), created_at INTEGER NOT NULL);
      CREATE TABLE company (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, domain TEXT, industry TEXT, observed_count INTEGER DEFAULT 1, promoted_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE event (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, date_range_start INTEGER, date_range_end INTEGER, location TEXT, url TEXT, external_source TEXT, external_id TEXT, observed_count INTEGER DEFAULT 1, promoted_at INTEGER, created_at INTEGER NOT NULL);
      CREATE TABLE topic (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, aliases TEXT DEFAULT '[]', parent_id TEXT, created_at INTEGER NOT NULL);
      CREATE TABLE interaction (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        transcript TEXT NOT NULL,
        captured_at INTEGER NOT NULL,
        embedding F32_BLOB(1536),
        created_at INTEGER NOT NULL,
        parent_interaction_id TEXT,
        thread_root_id TEXT,
        audio_storage_key TEXT,
        audio_retention_expiry INTEGER,
        client_capture_id TEXT,
        status TEXT DEFAULT 'committed' NOT NULL,
        deleted_at INTEGER
      );
      CREATE TABLE act (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        status TEXT DEFAULT 'drafted' NOT NULL,
        body TEXT NOT NULL,
        subject TEXT,
        when_hint TEXT,
        run_at INTEGER,
        target_entity_id TEXT,
        secondary_entity_id TEXT,
        source_interaction_id TEXT,
        confidence INTEGER DEFAULT 80 NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE interaction_attachment (
        id TEXT PRIMARY KEY,
        interaction_id TEXT NOT NULL,
        entity_id TEXT,
        event_id TEXT,
        mime_type TEXT DEFAULT 'image/jpeg' NOT NULL,
        jpeg_base64 TEXT NOT NULL,
        byte_size INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE entity_merge (
        id TEXT PRIMARY KEY,
        source_entity_id TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        merged_by_user_id TEXT,
        merged_at INTEGER NOT NULL,
        reversed_at INTEGER,
        moves TEXT
      );
    `;

describe('entity.detail', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_e2';
  const otherUserId = 'user_other';

  beforeAll(async () => {
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });

    await client.executeMultiple(ENTITY_TEST_DDL);

    const now = Date.now();
    const ts = (offsetDays = 0) => now - offsetDays * 86_400_000;

    // Users
    await client.execute({
      sql: `INSERT INTO user VALUES (?, 'a@a', 0, null, null, ?, ?)`,
      args: [userId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO user VALUES (?, 'b@b', 0, null, null, ?, ?)`,
      args: [otherUserId, now, now],
    });

    // Canonical
    await client.execute({
      sql: `INSERT INTO company VALUES ('co_acme', 'acme', 'Acme Corp', 'acme.com', '["infra"]', 1, null, ?, ?)`,
      args: [now, now],
    });
    await client.execute({
      sql: `INSERT INTO event VALUES ('ev_dc', 'devconnect-26', 'DevConnect 26', ?, ?, 'sf', null, null, null, 1, null, ?)`,
      args: [ts(8), ts(7), now],
    });
    await client.execute({
      sql: `INSERT INTO topic VALUES ('tp_rust', 'rust', 'rust', '[]', null, ?)`,
      args: [now],
    });

    // Entities (Sarah + Marcus owned by userId; Other for cross-user safety)
    const insertEnt = async (id: string, name: string, owner: string) => {
      await client.execute({
        sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, created_at, updated_at) VALUES (?, ?, 'person', ?, '[]', ?, ?)`,
        args: [id, owner, name, now, now],
      });
    };
    await insertEnt('en_sarah', 'Sarah Chen', userId);
    await insertEnt('en_marcus', 'Marcus Rivera', userId);
    await insertEnt('en_other', 'Other Person', otherUserId);
    await insertEnt('en_priya', 'Priya Nair', userId);

    // Interactions
    await client.execute({
      sql: `INSERT INTO interaction (id, user_id, transcript, captured_at, created_at, status) VALUES (?, ?, ?, ?, ?, 'committed')`,
      args: ['it_1', userId, 'met sarah at devconnect, rust lead at acme', ts(7), now],
    });
    await client.execute({
      sql: `INSERT INTO interaction (id, user_id, transcript, captured_at, created_at, status) VALUES (?, ?, ?, ?, ?, 'committed')`,
      args: ['it_2', userId, 'marcus from acme too, cto vibes', ts(3), now],
    });

    // Edges
    await client.execute({
      sql: `INSERT INTO entity_company (id, entity_id, company_id, role, created_at, source_deleted) VALUES (?, ?, ?, ?, ?, 0)`,
      args: ['ec_1', 'en_sarah', 'co_acme', 'Rust Lead', now],
    });
    await client.execute({
      sql: `INSERT INTO entity_company (id, entity_id, company_id, role, created_at, source_deleted) VALUES (?, ?, ?, ?, ?, 0)`,
      args: ['ec_2', 'en_marcus', 'co_acme', 'CTO', now],
    });
    await client.execute({
      sql: `INSERT INTO entity_event (id, entity_id, event_id, role, created_at, source_deleted) VALUES (?, ?, ?, null, ?, 0)`,
      args: ['ee_1', 'en_sarah', 'ev_dc', now],
    });
    await client.execute({
      sql: `INSERT INTO entity_event (id, entity_id, event_id, role, created_at, source_deleted) VALUES (?, ?, ?, null, ?, 0)`,
      args: ['ee_2', 'en_marcus', 'ev_dc', now],
    });
    await client.execute({
      sql: `INSERT INTO entity_topic (id, entity_id, topic_id, weight, source_interaction_id, created_at, source_deleted) VALUES (?, ?, ?, 70, ?, ?, 0)`,
      args: ['et_1', 'en_sarah', 'tp_rust', 'it_1', now],
    });
    await client.execute({
      sql: `INSERT INTO entity_topic (id, entity_id, topic_id, weight, source_interaction_id, created_at, source_deleted) VALUES (?, ?, ?, 70, ?, ?, 0)`,
      args: ['et_2', 'en_marcus', 'tp_rust', 'it_2', now],
    });
    await client.execute({
      sql: `INSERT INTO entity_topic (id, entity_id, topic_id, weight, source_interaction_id, created_at, source_deleted) VALUES (?, ?, ?, 70, ?, ?, 0)`,
      args: ['et_3', 'en_priya', 'tp_rust', 'it_1', now],
    });

    await client.execute({
      sql: `INSERT INTO entity_fact (id, entity_id, key, value, source_interaction_id, confidence, created_at) VALUES (?, ?, ?, ?, ?, 80, ?)`,
      args: ['fact_1', 'en_sarah', 'note', 'said she would send repo', 'it_1', now],
    });

    await client.execute({
      sql: `INSERT INTO interaction (id, user_id, transcript, captured_at, created_at, status) VALUES (?, ?, ?, ?, ?, 'committed')`,
      args: ['it_photo', userId, 'attached a photo', ts(0), now],
    });
    await client.execute({
      sql: `INSERT INTO entity_fact (id, entity_id, key, value, source_interaction_id, confidence, created_at) VALUES (?, ?, ?, ?, ?, 80, ?)`,
      args: ['fact_photo', 'en_sarah', 'note', 'attached a photo', 'it_photo', now],
    });
    await client.execute({
      sql: `INSERT INTO interaction_attachment (id, interaction_id, entity_id, event_id, mime_type, jpeg_base64, byte_size, created_at) VALUES (?, ?, ?, ?, 'image/jpeg', ?, 64, ?)`,
      args: [
        'att_1',
        'it_photo',
        'en_sarah',
        'ev_dc',
        'aGVsbG93aW5nbWljLXRlc3QtcGhvdG8tZGF0YQ==',
        now,
      ],
    });
  });

  function caller(uid = userId) {
    const ctx = {
      db,
      user: { id: uid },
      session: { user: { id: uid } },
    } as unknown as Parameters<typeof entityRouter.createCaller>[0];
    return entityRouter.createCaller(ctx);
  }

  it('person detail returns sub, stats, captures, related, topics', async () => {
    const res = await caller().detail({ kind: 'person', id: 'en_sarah' });
    expect(res.kind).toBe('person');
    expect(res.name).toBe('Sarah Chen');
    expect((res.sub as any).role).toBe('Rust Lead');
    expect((res.sub as any).companyName).toBe('Acme Corp');
    expect(res.stats).toHaveLength(3);
    expect(res.stats[0]!.value).toBe('3'); // 1 company + 1 event + 1 topic
    expect(res.captures.length).toBeGreaterThan(0);
    expect(res.captures.some((c) => c.transcript.includes('sarah'))).toBe(true);
    expect(res.related.some((r) => r.id === 'en_marcus')).toBe(true);
    expect(res.related.every((r) => r.id !== 'en_sarah')).toBe(true);
    expect(res.related.every((r) => r.id !== 'en_priya')).toBe(true);
    expect(res.topics.map((t) => t.name)).toContain('rust');
    expect((res as { publicProfile?: { linkedin: string | null } }).publicProfile).toEqual({
      linkedin: null,
      url: null,
      sourceUrl: null,
    });
    expect((res as { possibleMatches?: unknown[] }).possibleMatches).toEqual([]);
    const photo = res.captures.find((c) => c.interactionId === 'it_photo');
    expect(photo?.transcript).toBe('attached a photo');
    expect(photo?.jpegBase64).toBe('aGVsbG93aW5nbWljLXRlc3QtcGhvdG8tZGF0YQ==');
  });

  it('returns public profile facts and same-name cards', async () => {
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO entity_fact (id, entity_id, key, value, source_interaction_id, confidence, created_at) VALUES (?, ?, ?, ?, null, 70, ?)`,
      args: ['fact_li', 'en_sarah', 'linkedin', 'https://www.linkedin.com/in/ada-lovelace', now],
    });
    await client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, created_at, updated_at) VALUES (?, ?, 'person', ?, '[]', ?, ?)`,
      args: ['en_sarah_b', userId, 'Sarah', now, now],
    });
    const res = await caller().detail({ kind: 'person', id: 'en_sarah' });
    expect((res as { publicProfile: { linkedin: string | null } }).publicProfile.linkedin).toBe(
      'https://www.linkedin.com/in/ada-lovelace',
    );
    const matches = (res as { possibleMatches: Array<{ id: string }> }).possibleMatches;
    expect(matches.some((m) => m.id === 'en_sarah_b')).toBe(true);
  });

  it('person detail 404s on cross-user access', async () => {
    await expect(caller(otherUserId).detail({ kind: 'person', id: 'en_sarah' })).rejects.toThrow();
  });

  it('company detail counts only this user’s entities', async () => {
    const res = await caller().detail({ kind: 'company', id: 'co_acme' });
    expect(res.kind).toBe('company');
    expect(res.name).toBe('Acme Corp');
    expect((res.sub as any).domain).toBe('acme.com');
    expect(res.stats[0]!.value).toBe('2'); // sarah + marcus
    expect(res.related.length).toBe(2);
    expect(res.related.every((r) => r.kind === 'person')).toBe(true);
    expect(res.captures.length).toBeGreaterThan(0);
    expect(res.captures.some((c) => c.jpegBase64 === 'aGVsbG93aW5nbWljLXRlc3QtcGhvdG8tZGF0YQ==')).toBe(
      true,
    );
  });

  it('event detail returns people met + topics', async () => {
    const res = await caller().detail({ kind: 'event', id: 'ev_dc' });
    expect(res.kind).toBe('event');
    expect(res.name).toBe('DevConnect 26');
    expect((res.sub as any).location).toBe('sf');
    expect((res.sub as any).durationDays).toBeGreaterThanOrEqual(1);
    expect(res.stats[0]!.value).toBe('2'); // people met
    expect(res.related.map((r) => r.id).sort()).toEqual(['en_marcus', 'en_sarah']);
    expect(res.topics.map((t) => t.name)).toContain('rust');
    expect(res.captures.some((c) => c.jpegBase64 === 'aGVsbG93aW5nbWljLXRlc3QtcGhvdG8tZGF0YQ==')).toBe(
      true,
    );
  });

  it('event detail includes a public url when stored', async () => {
    await client.execute({
      sql: `UPDATE event SET url = ? WHERE id = 'ev_dc'`,
      args: ['https://devconnect.example/2026'],
    });
    const res = await caller().detail({ kind: 'event', id: 'ev_dc' });
    expect((res.sub as { url?: string | null }).url).toBe('https://devconnect.example/2026');
  });

  it('NOT_FOUND on missing ids', async () => {
    await expect(caller().detail({ kind: 'company', id: 'co_nope' })).rejects.toThrow();
    await expect(caller().detail({ kind: 'event', id: 'ev_nope' })).rejects.toThrow();
    await expect(caller().detail({ kind: 'topic', id: 'tp_nope' })).rejects.toThrow();
  });

  it('topic detail returns people, companies, events, and captures', async () => {
    const res = await caller().detail({ kind: 'topic', id: 'tp_rust' });
    expect(res.kind).toBe('topic');
    expect(res.name).toBe('rust');
    expect(res.stats[0]!.value).toBe('3');
    expect(res.related.some((r) => r.kind === 'person' && r.id === 'en_sarah')).toBe(true);
    expect(res.related.some((r) => r.kind === 'company' && r.id === 'co_acme')).toBe(true);
    expect(res.related.some((r) => r.kind === 'event' && r.id === 'ev_dc')).toBe(true);
    expect(res.captures.length).toBeGreaterThan(0);
    expect(res.stats.find((s) => s.key === 'commits')?.value).toBe(String(res.captures.length));
    expect(res.captures[0]!.topics).toEqual(['rust']);
  });

  it('topic detail 404s when the user has no mentions', async () => {
    await expect(caller(otherUserId).detail({ kind: 'topic', id: 'tp_rust' })).rejects.toThrow();
  });

  it('includes per-capture topic chips on person detail', async () => {
    const res = await caller().detail({ kind: 'person', id: 'en_sarah' });
    expect(res.captures.some((c) => c.topics?.includes('rust'))).toBe(true);
  });

  it('counts only owned, live interactions in detail commit stats', async () => {
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO interaction (id, user_id, transcript, captured_at, created_at, status) VALUES (?, ?, ?, ?, ?, 'committed')`,
      args: ['it_other_photo', otherUserId, 'other user photo', now, now],
    });
    await client.execute({
      sql: `INSERT INTO interaction (id, user_id, transcript, captured_at, created_at, status, deleted_at) VALUES (?, ?, ?, ?, ?, 'committed', ?)`,
      args: ['it_deleted_photo', userId, 'deleted photo', now, now, now],
    });
    for (const interactionId of ['it_other_photo', 'it_deleted_photo']) {
      await client.execute({
        sql: `INSERT INTO interaction_attachment (id, interaction_id, entity_id, event_id, mime_type, jpeg_base64, byte_size, created_at) VALUES (?, ?, 'en_sarah', 'ev_dc', 'image/jpeg', 'jpeg', 4, ?)`,
        args: [`att_${interactionId}`, interactionId, now],
      });
    }

    const [person, company, event] = await Promise.all([
      caller().detail({ kind: 'person', id: 'en_sarah' }),
      caller().detail({ kind: 'company', id: 'co_acme' }),
      caller().detail({ kind: 'event', id: 'ev_dc' }),
    ]);

    expect(person.stats.find((stat) => stat.key === 'commits')?.value).toBe('2');
    expect(company.stats.find((stat) => stat.key === 'commits')?.value).toBe('3');
    expect(event.stats.find((stat) => stat.key === 'commits')?.value).toBe('3');
  });

  it('respects soft-deleted entities (deletedAt)', async () => {
    // Soft-delete marcus, then company detail should drop to 1.
    await client.execute({
      sql: `UPDATE entity SET deleted_at = ? WHERE id = 'en_marcus'`,
      args: [Date.now()],
    });
    const res = await caller().detail({ kind: 'company', id: 'co_acme' });
    expect(res.stats[0]!.value).toBe('1');
    expect(res.related.length).toBe(1);
    expect(res.related[0]!.id).toBe('en_sarah');
    // Restore for any later tests
    await client.execute({
      sql: `UPDATE entity SET deleted_at = null WHERE id = 'en_marcus'`,
      args: [],
    });
  });
});

// ────────────────────────────────────────────────────────────────────
// entity.enrich (D3 — visible, retryable enrichment)
// ────────────────────────────────────────────────────────────────────

// Partial barrel mock: keep the REAL query building / blocked-url logic that
// the enrich path uses, and only stub the env provider factory so each test
// controls what "the provider" is — including the none case.
const providerState = vi.hoisted(() => ({
  provider: null as WebSearchProvider | null,
}));

vi.mock('@/lib/web-search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/web-search')>();
  return {
    ...actual,
    webSearchProviderFromEnv: () => providerState.provider,
  };
});

describe('entity.enrich', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_e2';
  const otherUserId = 'user_other';

  beforeAll(async () => {
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });

    await client.executeMultiple(ENTITY_TEST_DDL);

    const now = Date.now();
    for (const id of [userId, otherUserId]) {
      await client.execute({
        sql: `INSERT INTO user VALUES (?, ?, 0, null, null, ?, ?)`,
        args: [id, `${id}@t`, now, now],
      });
    }
    await client.execute({
      sql: `INSERT INTO company VALUES ('co_glow', 'glow-labs', 'Glow Labs', 'glowlabs.dev', '[]', 1, null, ?, ?)`,
      args: [now, now],
    });
    const insertPerson = async (id: string, name: string, owner: string, withCompany = false) => {
      await client.execute({
        sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, created_at, updated_at) VALUES (?, ?, 'person', ?, '[]', ?, ?)`,
        args: [id, owner, name, now, now],
      });
      if (withCompany) {
        await client.execute({
          sql: `INSERT INTO entity_company (id, entity_id, company_id, role, created_at, source_deleted) VALUES (?, ?, ?, null, ?, 0)`,
          args: [`ec_${id}`, id, 'co_glow', now],
        });
      }
    };
    await insertPerson('en_nadia', 'Nadia Rahman', userId, true);
    await insertPerson('en_omar', 'Omar Haddad', userId);
    await client.execute({
      sql: `INSERT INTO entity_fact (id, entity_id, key, value, source_interaction_id, confidence, created_at) VALUES ('fact_omar_li', 'en_omar', 'linkedin', 'https://www.linkedin.com/in/omarhaddad', null, 80, ?)`,
      args: [now],
    });
  });

  afterEach(async () => {
    providerState.provider = null;
    // tests share one in-memory DB — facts written by an earlier test would
    // break later blank-fact / empty-state assertions
    await client.execute('DELETE FROM entity_fact');
  });

  function mockProvider(opts: { hits?: Array<{ title: string; url: string; snippet: string }>; searchError?: Error }) {
    return {
      id: 'tavily' as const,
      search: vi.fn(async (_query: { intent: string; q: string }) => {
        if (opts.searchError) throw opts.searchError;
        return opts.hits ?? [];
      }),
      extract: vi.fn(async () => []),
    };
  }

  function caller(uid = userId) {
    const ctx = {
      db,
      user: { id: uid },
      session: { user: { id: uid } },
    } as unknown as Parameters<typeof entityRouter.createCaller>[0];
    return entityRouter.createCaller(ctx);
  }

  async function factRows(entityId: string) {
    return db.query.entityFacts.findMany({
      where: eq(schema.entityFacts.entityId, entityId),
    });
  }

  it('fetches the web for an owned person and writes source facts at confidence 70', async () => {
    const provider = mockProvider({
      hits: [
        {
          title: 'Nadia Rahman — Glow Labs',
          url: 'https://glowlabs.dev/people/nadia',
          snippet: 'engineer at glow labs',
        },
      ],
    });
    providerState.provider = provider;

    const res = await caller().enrich({ entityId: 'en_nadia' });
    if (!res.ok) throw new Error('expected enrich to succeed');

    // reuses the enrich path: same query shape the commit path builds
    expect(provider.search).toHaveBeenCalledTimes(1);
    expect(provider.search).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'person',
        q: expect.stringContaining('Nadia Rahman'),
      }),
    );
    expect(provider.search.mock.calls[0]![0]!.q).toContain('Glow Labs');
    // extract step of the shared path runs on the top source
    expect(provider.extract).toHaveBeenCalledWith(
      expect.objectContaining({ urls: ['https://glowlabs.dev/people/nadia'] }),
    );

    const facts = await factRows('en_nadia');
    const sourceUrl = facts.find((f) => f.key === 'source_url');
    expect(sourceUrl?.value).toBe('https://glowlabs.dev/people/nadia');
    expect(sourceUrl?.confidence).toBe(70);
    expect(facts.find((f) => f.key === 'url')?.value).toBe('https://glowlabs.dev/people/nadia');
    // card-initiated retry has no interaction to attribute
    expect(sourceUrl?.sourceInteractionId).toBeNull();
  });

  it('uses the profile intent when the person already has a linkedin fact', async () => {
    // facts are wiped between tests — seed inline
    await client.execute({
      sql: `INSERT INTO entity_fact (id, entity_id, key, value, source_interaction_id, confidence, created_at) VALUES ('fact_omar_li', 'en_omar', 'linkedin', 'https://www.linkedin.com/in/omarhaddad', null, 80, ?)`,
      args: [Date.now()],
    });
    const provider = mockProvider({ hits: [] });
    providerState.provider = provider;

    await caller().enrich({ entityId: 'en_omar' });

    expect(provider.search).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'profile' }),
    );
  });

  it('propagates provider failure as an honest failed result, writing nothing', async () => {
    providerState.provider = mockProvider({ searchError: new Error('tavily down') });

    const res = await caller().enrich({ entityId: 'en_nadia' });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('failed');
      expect(res.message).toBe('tavily down');
    }
    expect((await factRows('en_nadia')).filter((f) => f.key !== 'linkedin')).toHaveLength(0);
  });

  it('no-ops without calling anything when no provider is configured', async () => {
    providerState.provider = null;

    const res = await caller().enrich({ entityId: 'en_nadia' });

    expect(res).toEqual({ ok: false, reason: 'no_provider' });
    expect(await factRows('en_nadia')).toHaveLength(0);
  });

  it('throws NOT_FOUND for an entity the user does not own', async () => {
    providerState.provider = mockProvider({ hits: [] });

    await expect(
      caller(otherUserId).enrich({ entityId: 'en_nadia' }),
    ).rejects.toThrow('entity not found');
  });

  it('never duplicates existing facts (blank-fact semantics)', async () => {
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO entity_fact (id, entity_id, key, value, source_interaction_id, confidence, created_at) VALUES ('fact_nadia_pre', 'en_nadia', 'source_url', 'https://stale.example.com', null, 70, ?)`,
      args: [now],
    });
    providerState.provider = mockProvider({
      hits: [
        {
          title: 'Nadia Rahman — Glow Labs',
          url: 'https://glowlabs.dev/people/nadia',
          snippet: 'engineer',
        },
      ],
    });

    const res = await caller().enrich({ entityId: 'en_nadia' });
    if (!res.ok) throw new Error('expected enrich to succeed');

    expect(res.wroteFactKeys).not.toContain('source_url');
    const rows = (await factRows('en_nadia')).filter((f) => f.key === 'source_url');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe('https://stale.example.com');
  });

  it('detail reports webSearchConfigured from the provider factory', async () => {
    providerState.provider = mockProvider({ hits: [] });
    const configured = await caller().detail({ kind: 'person', id: 'en_nadia' });
    expect((configured as { webSearchConfigured?: boolean }).webSearchConfigured).toBe(true);

    providerState.provider = null;
    const notConfigured = await caller().detail({ kind: 'person', id: 'en_nadia' });
    expect((notConfigured as { webSearchConfigured?: boolean }).webSearchConfigured).toBe(false);
  });
});
