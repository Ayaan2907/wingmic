import { describe, it, expect } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { resolve } from 'node:path';
import * as schema from '@wingmic/db/schema';
import { hydrateThreadItems } from '../hydrateThread';

async function setupDb() {
  const client = createClient({ url: 'file::memory:' });
  const db = drizzle(client, { schema });
  await migrate(db, {
    migrationsFolder: resolve(__dirname, '../../../../../packages/db/drizzle'),
  });
  return { client, db };
}

describe('hydrateThreadItems', () => {
  it('rebuilds persons + companies + topics + acts for an interaction', async () => {
    const { client, db } = await setupDb();
    const now = new Date();

    await db.insert(schema.users).values({
      id: 'u1',
      name: 'Ada',
      email: 'ada@example.com',
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.interactions).values({
      id: 'ix1',
      userId: 'u1',
      transcript: 'met grace at acme, rust lead',
      capturedAt: now,
      status: 'committed',
    });

    await db.insert(schema.entities).values({
      id: 'e1',
      ownerUserId: 'u1',
      kind: 'person',
      name: 'Grace Hopper',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.companies).values({
      id: 'c1',
      name: 'Acme Corp',
      slug: 'acme-corp',
      observedCount: 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.topics).values({
      id: 't1',
      name: 'rust',
      slug: 'rust',
      createdAt: now,
    });

    await db.insert(schema.entityFacts).values([
      {
        id: 'f1',
        entityId: 'e1',
        key: 'role',
        value: 'rust lead',
        sourceInteractionId: 'ix1',
        confidence: 90,
        createdAt: now,
      },
    ]);

    await db.insert(schema.entityCompanies).values({
      id: 'ec1',
      entityId: 'e1',
      companyId: 'c1',
      role: 'rust lead',
      createdAt: now,
      sourceDeleted: false,
    });

    await db.insert(schema.entityTopics).values({
      id: 'et1',
      entityId: 'e1',
      topicId: 't1',
      weight: 50,
      sourceInteractionId: 'ix1',
      createdAt: now,
      sourceDeleted: false,
    });

    await db.insert(schema.acts).values({
      id: 'a1',
      userId: 'u1',
      kind: 'email',
      status: 'drafted',
      body: 'send the repo',
      whenHint: 'tomorrow',
      sourceInteractionId: 'ix1',
      targetEntityId: 'e1',
      createdAt: now,
      updatedAt: now,
    });

    const items = await hydrateThreadItems(db as never, 'u1', [
      { id: 'ix1', transcript: 'met grace at acme, rust lead', capturedAt: now },
    ]);

    expect(items).toHaveLength(1);
    const g = items[0]!.graphResult;
    expect(g.interactionId).toBe('ix1');
    expect(g.extracted.persons[0]?.name).toBe('Grace Hopper');
    expect(g.extracted.persons[0]?.role).toBe('rust lead');
    expect(g.extracted.companies.map((c) => c.name)).toContain('Acme Corp');
    expect(g.extracted.topics).toContain('rust');
    expect(g.extracted.actions[0]?.body).toBe('send the repo');
    expect(g.extracted.actions[0]?.targetPersonName).toBe('Grace Hopper');
    expect(g.entityIds).toEqual(['e1']);
    expect(g.companyIds).toEqual(['c1']);

    client.close();
  });

  it('returns empty extraction when interaction has no linked entities', async () => {
    const { client, db } = await setupDb();
    const now = new Date();
    await db.insert(schema.users).values({
      id: 'u1',
      name: 'Ada',
      email: 'ada@example.com',
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.interactions).values({
      id: 'ix2',
      userId: 'u1',
      transcript: 'just thinking out loud',
      capturedAt: now,
      status: 'committed',
    });

    const items = await hydrateThreadItems(db as never, 'u1', [
      { id: 'ix2', transcript: 'just thinking out loud', capturedAt: now },
    ]);
    expect(items[0]!.graphResult.extracted.persons).toEqual([]);
    expect(items[0]!.graphResult.extracted.actions).toEqual([]);
    client.close();
  });
});
