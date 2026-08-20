import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';
import { mergePersonEntities, undoPersonMerge } from './mergePerson';

describe('mergePersonEntities', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_merge_1';

  beforeAll(async () => {
    client = createClient({ url: 'file::memory:?cache=shared' });
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
    await client.execute({
      sql: `INSERT INTO user VALUES (?, 'm@x', 0, null, null, ?, ?)`,
      args: [userId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO company VALUES ('co_x', 'x', 'X Corp', null, '[]', 1, null, ?, ?)`,
      args: [now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, created_at, updated_at) VALUES (?, ?, 'person', ?, '[]', ?, ?)`,
      args: ['en_keep', userId, 'Jordan Lee', now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, created_at, updated_at) VALUES (?, ?, 'person', ?, '[]', ?, ?)`,
      args: ['en_src', userId, 'Jordan Lee', now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity_fact (id, entity_id, key, value, source_interaction_id, confidence, created_at) VALUES (?, ?, 'note', 'from source', null, 80, ?)`,
      args: ['fact_src', 'en_src', now],
    });
    await client.execute({
      sql: `INSERT INTO entity_company (id, entity_id, company_id, role, created_at, source_deleted) VALUES (?, ?, ?, 'eng', ?, 0)`,
      args: ['ec_src', 'en_src', 'co_x', now],
    });
    await client.execute({
      sql: `INSERT INTO act (id, user_id, kind, status, body, target_entity_id, confidence, created_at, updated_at) VALUES (?, ?, 'email', 'drafted', 'ping', ?, 80, ?, ?)`,
      args: ['act_1', userId, 'en_src', now, now],
    });
  });

  it('re-points facts, edges, acts and soft-deletes source', async () => {
    const res = await mergePersonEntities(db, userId, 'en_src', 'en_keep');
    expect(res.sourceName).toBe('Jordan Lee');
    expect(res.mergeId).toBeTruthy();

    const source = await db.query.entities.findFirst({
      where: (t, { eq }) => eq(t.id, 'en_src'),
    });
    expect(source?.deletedAt).not.toBeNull();

    const fact = await db.query.entityFacts.findFirst({
      where: (t, { eq }) => eq(t.id, 'fact_src'),
    });
    expect(fact?.entityId).toBe('en_keep');

    const ec = await db.query.entityCompanies.findFirst({
      where: (t, { eq }) => eq(t.id, 'ec_src'),
    });
    expect(ec?.entityId).toBe('en_keep');

    const act = await db.query.acts.findFirst({
      where: (t, { eq }) => eq(t.id, 'act_1'),
    });
    expect(act?.targetEntityId).toBe('en_keep');

    const target = await db.query.entities.findFirst({
      where: (t, { eq }) => eq(t.id, 'en_keep'),
    });
    expect(target?.aliases).toContain('Jordan Lee');

    await undoPersonMerge(db, userId, res.mergeId);

    const restored = await db.query.entities.findFirst({
      where: (t, { eq }) => eq(t.id, 'en_src'),
    });
    expect(restored?.deletedAt).toBeNull();

    const factBack = await db.query.entityFacts.findFirst({
      where: (t, { eq }) => eq(t.id, 'fact_src'),
    });
    expect(factBack?.entityId).toBe('en_src');
  });
});
