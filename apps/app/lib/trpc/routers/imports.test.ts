import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';
import { importsRouter } from './imports';

describe('imports router', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userA = 'user_imp_a';
  const userB = 'user_imp_b';
  let now = Date.now();

  beforeAll(async () => {
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });
    await client.executeMultiple(`
      CREATE TABLE user (
        id TEXT PRIMARY KEY, email TEXT NOT NULL, email_verified INTEGER DEFAULT 0,
        name TEXT, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
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
    `);
    now = Date.now();
    await client.execute({
      sql: `INSERT INTO user VALUES (?, 'a@example.com', 0, null, null, ?, ?)`,
      args: [userA, now, now],
    });
    await client.execute({
      sql: `INSERT INTO user VALUES (?, 'b@example.com', 0, null, null, ?, ?)`,
      args: [userB, now, now],
    });
  });

  function caller(userId: string) {
    const ctx = {
      db,
      user: { id: userId },
      session: { user: { id: userId } },
    } as unknown as Parameters<typeof importsRouter.createCaller>[0];
    return importsRouter.createCaller(ctx);
  }

  it('creates entities for the importing user only', async () => {
    const res = await caller(userA).upsertBatch({
      kind: 'linkedin',
      contacts: [
        {
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          linkedinUrl: 'https://www.linkedin.com/in/ada-lovelace',
          company: 'Analytical Engines',
          role: 'Mathematician',
        },
      ],
    });
    expect(res.created).toBe(1);
    expect(res.matched).toBe(0);
    expect(res.importSource.startsWith('linkedin:')).toBe(true);

    const aRows = await client.execute({
      sql: `SELECT id, owner_user_id, name, import_source FROM entity WHERE owner_user_id = ?`,
      args: [userA],
    });
    expect(aRows.rows).toHaveLength(1);
    expect(aRows.rows[0]!.name).toBe('Ada Lovelace');

    const bRows = await client.execute({
      sql: `SELECT id FROM entity WHERE owner_user_id = ?`,
      args: [userB],
    });
    expect(bRows.rows).toHaveLength(0);
  });

  it('does not leak user A imports to user B match by email', async () => {
    const res = await caller(userB).upsertBatch({
      kind: 'vcard',
      contacts: [
        {
          name: 'Ada B',
          email: 'ada@example.com',
          linkedinUrl: null,
          company: null,
          role: null,
        },
      ],
    });
    // Same email as user A — still creates a private copy for B.
    expect(res.created).toBe(1);
    expect(res.matched).toBe(0);
    const bEntities = await client.execute({
      sql: `SELECT name FROM entity WHERE owner_user_id = ?`,
      args: [userB],
    });
    expect(bEntities.rows.map((r) => r.name)).toContain('Ada B');
  });

  it('matches an existing contact by email on re-import', async () => {
    const first = await caller(userA).upsertBatch({
      kind: 'linkedin',
      contacts: [
        {
          name: 'Grace Hopper',
          email: 'grace@example.com',
          linkedinUrl: null,
          company: 'Navy',
          role: null,
        },
      ],
    });
    expect(first.created).toBe(1);

    const second = await caller(userA).upsertBatch({
      kind: 'vcard',
      contacts: [
        {
          name: 'Grace Hopper',
          email: 'grace@example.com',
          linkedinUrl: 'https://www.linkedin.com/in/grace',
          company: 'US Navy',
          role: 'Admiral',
        },
      ],
    });
    expect(second.created).toBe(0);
    expect(second.matched).toBe(1);
    expect(second.entityIds[0]).toBe(first.entityIds[0]);
  });
});
