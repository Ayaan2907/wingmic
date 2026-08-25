import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';
import { insertBlankFacts } from '../blankFacts';

describe('insertBlankFacts', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(async () => {
    const client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });
    const now = Date.now();
    await client.executeMultiple(`
      CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL, email_verified INTEGER DEFAULT 0, name TEXT, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE entity (
        id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, kind TEXT DEFAULT 'person',
        name TEXT NOT NULL, aliases TEXT DEFAULT '[]', import_source TEXT,
        embedding F32_BLOB(1536), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
      );
      CREATE TABLE entity_fact (
        id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
        source_interaction_id TEXT, confidence INTEGER DEFAULT 85, embedding F32_BLOB(1536), created_at INTEGER NOT NULL
      );
    `);
    await client.execute({
      sql: `INSERT INTO user VALUES ('user_e2', 'a@a', 0, null, null, ?, ?)`,
      args: [now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, created_at, updated_at) VALUES ('en_ada', 'user_e2', 'person', 'Ada Lovelace', '[]', ?, ?)`,
      args: [now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity_fact (id, entity_id, key, value, confidence, created_at) VALUES ('f1', 'en_ada', 'email', 'ada@example.com', 95, ?)`,
      args: [now],
    });
  });

  it('writes missing keys and leaves spoken email alone', async () => {
    const wrote = await insertBlankFacts(
      db as never,
      'en_ada',
      [
        { key: 'email', value: 'other@example.com', confidence: 70 },
        { key: 'url', value: 'https://www.analytical-engines.example/ada', confidence: 70 },
        { key: 'source_url', value: 'https://www.analytical-engines.example/ada', confidence: 70 },
      ],
      'it_1',
    );
    expect(wrote.sort()).toEqual(['source_url', 'url']);
    const facts = await db.query.entityFacts.findMany({
      where: eq(schema.entityFacts.entityId, 'en_ada'),
    });
    const email = facts.find((f) => f.key === 'email');
    expect(email?.value).toBe('ada@example.com');
    expect(facts.some((f) => f.key === 'url')).toBe(true);
  });

  it('keeps only the first of duplicate keys in one call', async () => {
    const wrote = await insertBlankFacts(
      db as never,
      'en_ada',
      [
        { key: 'role', value: 'mathematician', confidence: 70 },
        { key: 'role', value: 'poet', confidence: 40 },
      ],
      'it_2',
    );
    expect(wrote).toEqual(['role']);
    const roles = await db.query.entityFacts.findMany({
      where: eq(schema.entityFacts.entityId, 'en_ada'),
    });
    expect(roles.filter((f) => f.key === 'role')).toHaveLength(1);
    expect(roles.find((f) => f.key === 'role')?.value).toBe('mathematician');
  });
});
