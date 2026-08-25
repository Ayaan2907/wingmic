import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';
import type { WebSearchProvider } from '@/lib/web-search';
import { enrichPersonsAfterCommit } from '../enrichPersons';

function memDb() {
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client, { schema });
  return { client, db };
}

describe('enrichPersonsAfterCommit', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const now = Date.now();

  beforeAll(async () => {
    const mem = memDb();
    db = mem.db;
    client = mem.client;
    await mem.client.executeMultiple(`
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
    await mem.client.execute({
      sql: `INSERT INTO user VALUES ('user_e2', 'a@a', 0, null, null, ?, ?)`,
      args: [now, now],
    });
    await mem.client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, created_at, updated_at) VALUES ('en_ada', 'user_e2', 'person', 'Ada Lovelace', '[]', ?, ?)`,
      args: [now, now],
    });
  });

  const personCand = {
    name: 'Ada Lovelace',
    companyHint: 'Analytical Engines',
    topics: [],
    aliases: [],
    role: null,
    email: null,
    linkedin: null,
    notes: null,
  };

  it('writes homepage facts for a newly created person', async () => {
    const search = vi.fn(async () => [
      {
        title: 'Ada Lovelace',
        url: 'https://www.analytical-engines.example/ada',
        snippet: 'mathematician',
      },
    ]);
    const extract = vi.fn(async () => []);
    const provider: WebSearchProvider = { id: 'tavily', search, extract };

    await enrichPersonsAfterCommit({
      db: db as never,
      userId: 'user_e2',
      interactionId: 'it_1',
      extractedPersons: [personCand],
      persons: [{ entityId: 'en_ada', created: true, score: null }],
      provider,
    });

    expect(search).toHaveBeenCalled();
    const facts = await db.query.entityFacts.findMany({
      where: eq(schema.entityFacts.entityId, 'en_ada'),
    });
    expect(facts.some((f) => f.key === 'url')).toBe(true);
    expect(facts.some((f) => f.key === 'source_url')).toBe(true);
  });

  it('skips web when the person was a local match', async () => {
    const search = vi.fn(async () => []);
    await enrichPersonsAfterCommit({
      db: db as never,
      userId: 'user_e2',
      interactionId: 'it_1',
      extractedPersons: [personCand],
      persons: [{ entityId: 'en_ada', created: false, score: 0.92 }],
      provider: { id: 'tavily', search, extract: async () => [] },
    });
    expect(search).not.toHaveBeenCalled();
  });

  it('skips name-only people', async () => {
    const search = vi.fn(async () => []);
    await enrichPersonsAfterCommit({
      db: db as never,
      userId: 'user_e2',
      interactionId: 'it_1',
      extractedPersons: [{ ...personCand, companyHint: null }],
      persons: [{ entityId: 'en_ada', created: true, score: null }],
      provider: { id: 'tavily', search, extract: async () => [] },
    });
    expect(search).not.toHaveBeenCalled();
  });

  it('no-ops when the provider is missing', async () => {
    await expect(
      enrichPersonsAfterCommit({
        db: db as never,
        userId: 'user_e2',
        interactionId: 'it_1',
        extractedPersons: [personCand],
        persons: [{ entityId: 'en_ada', created: true, score: null }],
        provider: null,
      }),
    ).resolves.toBeUndefined();
  });

  it('continues later people when one search fails', async () => {
    await client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, created_at, updated_at) VALUES ('en_bob', 'user_e2', 'person', 'Bob', '[]', ?, ?)`,
      args: [now, now],
    });
    const search = vi
      .fn()
      .mockRejectedValueOnce(new Error('vendor down'))
      .mockResolvedValueOnce([
        {
          title: 'Bob',
          url: 'https://www.analytical-engines.example/bob',
          snippet: 'engineer',
        },
      ]);
    await enrichPersonsAfterCommit({
      db: db as never,
      userId: 'user_e2',
      interactionId: 'it_1',
      extractedPersons: [personCand, { ...personCand, name: 'Bob' }],
      persons: [
        { entityId: 'en_ada', created: true, score: null },
        { entityId: 'en_bob', created: true, score: null },
      ],
      provider: { id: 'tavily', search, extract: async () => [] },
    });
    expect(search).toHaveBeenCalledTimes(2);
    const bobFacts = await db.query.entityFacts.findMany({
      where: eq(schema.entityFacts.entityId, 'en_bob'),
    });
    expect(bobFacts.some((f) => f.key === 'url')).toBe(true);
  });

  it('does not persist a weak name_company fingerprint', async () => {
    const facts = await db.query.entityFacts.findMany({
      where: eq(schema.entityFacts.entityId, 'en_ada'),
    });
    expect(facts.some((f) => f.key === 'fingerprint')).toBe(false);
  });
});
