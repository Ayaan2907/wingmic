import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';

import { entityRouter } from './entity';

describe('entity.detail', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_e2';
  const otherUserId = 'user_other';

  beforeAll(async () => {
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });

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
      CREATE TABLE entity_merge (
        id TEXT PRIMARY KEY,
        source_entity_id TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        merged_by_user_id TEXT,
        merged_at INTEGER NOT NULL,
        reversed_at INTEGER,
        moves TEXT
      );
    `);

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
    expect(res.captures[0]!.transcript).toContain('sarah');
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
    expect(res.captures[0]!.topics).toEqual(['rust']);
  });

  it('topic detail 404s when the user has no mentions', async () => {
    await expect(caller(otherUserId).detail({ kind: 'topic', id: 'tp_rust' })).rejects.toThrow();
  });

  it('includes per-capture topic chips on person detail', async () => {
    const res = await caller().detail({ kind: 'person', id: 'en_sarah' });
    expect(res.captures[0]!.topics).toEqual(['rust']);
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
