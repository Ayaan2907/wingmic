import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
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
    // Shared cache so drizzle transactions see the same in-memory schema.
    client = createClient({ url: 'file::memory:?cache=shared' });
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

  it('matches a later row in the same batch by email added earlier', async () => {
    const res = await caller(userA).upsertBatch({
      kind: 'vcard',
      contacts: [
        {
          name: 'Katherine Johnson',
          email: 'kathy@example.com',
          linkedinUrl: null,
          company: 'NASA',
          role: null,
        },
        {
          name: 'K. Johnson',
          email: 'kathy@example.com',
          linkedinUrl: 'https://www.linkedin.com/in/kjohnson',
          company: 'NASA',
          role: 'Mathematician',
        },
      ],
    });
    expect(res.created).toBe(1);
    expect(res.matched).toBe(1);
    expect(res.entityIds[0]).toBe(res.entityIds[1]);
  });

  it('does not steal another entity LinkedIn map when email matches a different person', async () => {
    const ada = await caller(userA).upsertBatch({
      kind: 'linkedin',
      contacts: [
        {
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          linkedinUrl: null,
          company: null,
          role: null,
        },
      ],
    });
    const byron = await caller(userA).upsertBatch({
      kind: 'linkedin',
      contacts: [
        {
          name: 'Lord Byron',
          email: null,
          linkedinUrl: 'https://www.linkedin.com/in/byron',
          company: null,
          role: null,
        },
      ],
    });
    const adaId = ada.entityIds[0]!;
    const byronId = byron.entityIds[0]!;

    const conflicted = await caller(userA).upsertBatch({
      kind: 'vcard',
      contacts: [
        {
          name: 'Ada Byron',
          email: 'ada@example.com',
          linkedinUrl: 'https://www.linkedin.com/in/byron',
          company: null,
          role: null,
        },
        {
          name: 'George Byron',
          email: null,
          linkedinUrl: 'https://www.linkedin.com/in/byron',
          company: null,
          role: null,
        },
      ],
    });
    // Ambiguous row without resolution → force-create (keeps identifiers).
    // Second row then sees a multi-owner LinkedIn key → also force-creates.
    expect(conflicted.created).toBe(2);
    expect(conflicted.matched).toBe(0);
    expect(conflicted.entityIds[0]).not.toBe(adaId);
    expect(conflicted.entityIds[0]).not.toBe(byronId);

    const linkedinFacts = await client.execute({
      sql: `SELECT entity_id, value FROM entity_fact WHERE key = 'linkedin' AND lower(value) LIKE '%/in/byron'`,
      args: [],
    });
    const owners = linkedinFacts.rows.map((r) => r.entity_id);
    expect(owners).toContain(byronId);
    expect(owners).toContain(conflicted.entityIds[0]);
    expect(owners).not.toContain(adaId);
  });

  it('force-create keeps identifier facts even when they collide', async () => {
    const seeded = await caller(userA).upsertBatch({
      kind: 'linkedin',
      contacts: [
        {
          name: 'Owner Email',
          email: 'collide@example.com',
          linkedinUrl: null,
          company: null,
          role: null,
        },
        {
          name: 'Owner LinkedIn',
          email: null,
          linkedinUrl: 'https://www.linkedin.com/in/collide',
          company: null,
          role: null,
        },
      ],
    });
    const emailOwner = seeded.entityIds[0]!;
    const liOwner = seeded.entityIds[1]!;

    const created = await caller(userA).upsertBatch({
      kind: 'vcard',
      contacts: [
        {
          name: 'Force Keep Ids',
          email: 'collide@example.com',
          linkedinUrl: 'https://www.linkedin.com/in/collide',
          company: null,
          role: null,
        },
      ],
    });
    expect(created.created).toBe(1);
    const newId = created.entityIds[0]!;
    expect(newId).not.toBe(emailOwner);
    expect(newId).not.toBe(liOwner);

    const facts = await client.execute({
      sql: `SELECT key, value FROM entity_fact WHERE entity_id = ? ORDER BY key`,
      args: [newId],
    });
    const byKey = Object.fromEntries(facts.rows.map((r) => [r.key, r.value]));
    expect(byKey.email).toBe('collide@example.com');
    expect(String(byKey.linkedin)).toContain('/in/collide');
  });

  it('previewBatch flags email vs linkedin collisions as ambiguous', async () => {
    await caller(userA).upsertBatch({
      kind: 'linkedin',
      contacts: [
        {
          name: 'Entity A',
          email: 'a@example.com',
          linkedinUrl: null,
          company: null,
          role: null,
        },
        {
          name: 'Entity B',
          email: null,
          linkedinUrl: 'https://www.linkedin.com/in/entity-b',
          company: null,
          role: null,
        },
      ],
    });

    const preview = await caller(userA).previewBatch({
      contacts: [
        {
          name: 'Mixed',
          email: 'a@example.com',
          linkedinUrl: 'https://www.linkedin.com/in/entity-b',
          company: null,
          role: null,
        },
      ],
    });
    expect(preview.ambiguousCount).toBe(1);
    expect(preview.rows[0]!.status).toBe('ambiguous');
    expect(preview.rows[0]!.candidates).toHaveLength(2);
  });

  it('honors an explicit resolution to merge an ambiguous contact', async () => {
    const seeded = await caller(userA).upsertBatch({
      kind: 'linkedin',
      contacts: [
        {
          name: 'Seed A',
          email: 'seed-a@example.com',
          linkedinUrl: null,
          company: null,
          role: null,
        },
        {
          name: 'Seed B',
          email: null,
          linkedinUrl: 'https://www.linkedin.com/in/seed-b',
          company: null,
          role: null,
        },
      ],
    });
    const seedA = seeded.entityIds[0]!;

    const res = await caller(userA).upsertBatch({
      kind: 'vcard',
      contacts: [
        {
          name: 'Mixed Seed',
          email: 'seed-a@example.com',
          linkedinUrl: 'https://www.linkedin.com/in/seed-b',
          company: null,
          role: null,
        },
      ],
      resolutions: [{ index: 0, entityId: seedA }],
    });
    expect(res.created).toBe(0);
    expect(res.matched).toBe(1);
    expect(res.entityIds[0]).toBe(seedA);
  });

  it('undoBatch soft-deletes only entities stamped with that importSource', async () => {
    const created = await caller(userA).upsertBatch({
      kind: 'linkedin',
      contacts: [
        {
          name: 'Undo Me',
          email: 'undo-me@example.com',
          linkedinUrl: null,
          company: null,
          role: null,
        },
      ],
    });
    const undone = await caller(userA).undoBatch({
      kind: 'linkedin',
      batchId: created.batchId,
    });
    expect(undone.removed).toBe(1);

    const stillThere = await db.query.entities.findFirst({
      where: eq(schema.entities.id, created.entityIds[0]!),
    });
    expect(stillThere?.deletedAt).not.toBeNull();
  });
});
