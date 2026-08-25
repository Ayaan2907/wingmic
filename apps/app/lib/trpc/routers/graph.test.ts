import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';

import { graphRouter, discussedHubLinks } from './graph';

// graph.get — userId-scoped force-graph payload built from the entity edge
// tables. Mirrors the in-memory libSQL harness from entity.test.ts: real
// Drizzle over `:memory:`, createCaller with a stubbed ctx, two-user isolation.

describe('graph.get', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_g1';
  const otherUserId = 'user_other';
  const emptyUserId = 'user_empty';

  beforeAll(async () => {
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });

    await client.executeMultiple(`
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
      CREATE TABLE company (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, domain TEXT, industry TEXT, observed_count INTEGER DEFAULT 1, promoted_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE event (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, date_range_start INTEGER, date_range_end INTEGER, location TEXT, url TEXT, external_source TEXT, external_id TEXT, observed_count INTEGER DEFAULT 1, promoted_at INTEGER, created_at INTEGER NOT NULL);
      CREATE TABLE topic (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, aliases TEXT DEFAULT '[]', parent_id TEXT, created_at INTEGER NOT NULL);
    `);

    const now = Date.now();

    // Canonical layer (no per-user ownership).
    await client.execute({
      sql: `INSERT INTO company VALUES ('co_acme', 'acme', 'Acme Corp', 'acme.com', '["infra"]', 1, null, ?, ?)`,
      args: [now, now],
    });
    await client.execute({
      sql: `INSERT INTO event VALUES ('ev_dc', 'devconnect-26', 'DevConnect 26', null, null, 'sf', null, null, null, 1, null, ?)`,
      args: [now],
    });
    await client.execute({
      sql: `INSERT INTO topic VALUES ('tp_rust', 'rust', 'rust', '[]', null, ?)`,
      args: [now],
    });
    // A second company only the OTHER user touches — must never surface.
    await client.execute({
      sql: `INSERT INTO company VALUES ('co_secret', 'secret', 'Secret Inc', null, '[]', 1, null, ?, ?)`,
      args: [now, now],
    });
    // A topic only reachable through a soft-deleted edge — must not surface.
    await client.execute({
      sql: `INSERT INTO topic VALUES ('tp_ghost', 'ghost', 'ghost', '[]', null, ?)`,
      args: [now],
    });

    const insertEnt = async (id: string, name: string, owner: string, deleted = false) => {
      await client.execute({
        sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, created_at, updated_at, deleted_at) VALUES (?, ?, 'person', ?, '[]', ?, ?, ?)`,
        args: [id, owner, name, now, now, deleted ? now : null],
      });
    };
    await insertEnt('en_sarah', 'Sarah Chen', userId);
    await insertEnt('en_marcus', 'Marcus Rivera', userId);
    await insertEnt('en_gone', 'Gone Person', userId, true); // soft-deleted
    await insertEnt('en_other', 'Other Person', otherUserId);

    // Sarah: works at Acme + attended DevConnect.
    await client.execute({
      sql: `INSERT INTO entity_company (id, entity_id, company_id, role, created_at, source_deleted) VALUES ('ec_1', 'en_sarah', 'co_acme', 'Rust Lead', ?, 0)`,
      args: [now],
    });
    await client.execute({
      sql: `INSERT INTO entity_event (id, entity_id, event_id, role, created_at, source_deleted) VALUES ('ee_1', 'en_sarah', 'ev_dc', null, ?, 0)`,
      args: [now],
    });
    // Marcus: discussed rust (topic).
    await client.execute({
      sql: `INSERT INTO entity_topic (id, entity_id, topic_id, weight, source_interaction_id, created_at, source_deleted) VALUES ('et_1', 'en_marcus', 'tp_rust', 70, null, ?, 0)`,
      args: [now],
    });
    // Sarah also discussed rust so company/event share the topic hub.
    await client.execute({
      sql: `INSERT INTO entity_topic (id, entity_id, topic_id, weight, source_interaction_id, created_at, source_deleted) VALUES ('et_sarah', 'en_sarah', 'tp_rust', 70, null, ?, 0)`,
      args: [now],
    });
    // Soft-deleted edge: Sarah → ghost topic. Must be excluded.
    await client.execute({
      sql: `INSERT INTO entity_topic (id, entity_id, topic_id, weight, source_interaction_id, created_at, source_deleted) VALUES ('et_ghost', 'en_sarah', 'tp_ghost', 70, null, ?, 1)`,
      args: [now],
    });
    // Other user's entity → Secret Inc. Must never surface for `userId`.
    await client.execute({
      sql: `INSERT INTO entity_company (id, entity_id, company_id, role, created_at, source_deleted) VALUES ('ec_other', 'en_other', 'co_secret', 'Founder', ?, 0)`,
      args: [now],
    });
  });

  function caller(uid = userId) {
    const ctx = {
      db,
      user: { id: uid },
      session: { user: { id: uid } },
    } as unknown as Parameters<typeof graphRouter.createCaller>[0];
    return graphRouter.createCaller(ctx);
  }

  it('returns userId-scoped nodes + links from entity edges', async () => {
    const res = await caller().get();

    // Nodes: sarah (person), marcus (person), acme (company), devconnect (event),
    // rust (topic) = 5. Soft-deleted entity + ghost topic excluded.
    const personIds = res.nodes.filter((n) => n.kind === 'person').map((n) => n.id).sort();
    expect(personIds).toEqual(['en_marcus', 'en_sarah']);
    expect(res.nodes.some((n) => n.kind === 'company' && n.id === 'co_acme')).toBe(true);
    expect(res.nodes.some((n) => n.kind === 'event' && n.id === 'ev_dc')).toBe(true);
    expect(res.nodes.some((n) => n.kind === 'topic' && n.id === 'tp_rust')).toBe(true);
    expect(res.nodes).toHaveLength(5);

    // Links: works_at, attended, discussed (+ company/event hubs).
    expect(res.links).toContainEqual({ source: 'en_sarah', target: 'co_acme', rel: 'works_at' });
    expect(res.links).toContainEqual({ source: 'en_sarah', target: 'ev_dc', rel: 'attended' });
    expect(res.links).toContainEqual({ source: 'en_marcus', target: 'tp_rust', rel: 'discussed' });
    expect(res.links).toContainEqual({ source: 'en_sarah', target: 'tp_rust', rel: 'discussed' });
    expect(res.links).toContainEqual({
      source: 'co_acme',
      target: 'tp_rust',
      rel: 'discussed',
      hub: true,
    });
    expect(res.links).toContainEqual({
      source: 'ev_dc',
      target: 'tp_rust',
      rel: 'discussed',
      hub: true,
    });
    expect(res.links).toHaveLength(6);
  });

  it('draws company and event hub links when a person discussed a shared topic', () => {
    expect(
      discussedHubLinks(
        [{ entityId: 'en_sarah', companyId: 'co_acme' }],
        [{ entityId: 'en_sarah', eventId: 'ev_dc' }],
        [{ entityId: 'en_sarah', topicId: 'tp_rust' }],
      ),
    ).toEqual([
      { source: 'co_acme', target: 'tp_rust', rel: 'discussed', hub: true },
      { source: 'ev_dc', target: 'tp_rust', rel: 'discussed', hub: true },
    ]);
  });

  it('excludes soft-deleted entities and sourceDeleted edges', async () => {
    const res = await caller().get();
    // The soft-deleted entity never appears as a node.
    expect(res.nodes.some((n) => n.id === 'en_gone')).toBe(false);
    // The ghost topic (only reachable through a sourceDeleted edge) is absent.
    expect(res.nodes.some((n) => n.id === 'tp_ghost')).toBe(false);
    expect(res.links.some((l) => l.target === 'tp_ghost')).toBe(false);
  });

  it('does not leak another user’s nodes or links (isolation)', async () => {
    const res = await caller().get();
    expect(res.nodes.some((n) => n.id === 'en_other')).toBe(false);
    expect(res.nodes.some((n) => n.id === 'co_secret')).toBe(false);
    expect(res.links.some((l) => l.target === 'co_secret')).toBe(false);
  });

  it('returns an empty graph for a user with no entities', async () => {
    const res = await caller(emptyUserId).get();
    expect(res.nodes).toEqual([]);
    expect(res.links).toEqual([]);
  });
});
