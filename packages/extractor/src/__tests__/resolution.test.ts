import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import * as schema from '@wingmic/db/schema';

vi.mock('../embeddings', () => ({
  embedText: vi.fn(async () => Array.from({ length: 1536 }, () => 0.01)),
  embedTexts: vi.fn(async (texts: string[]) =>
    texts.map(() => Array.from({ length: 1536 }, () => 0.01)),
  ),
  cosine: vi.fn(() => 0),
}));

import { commit } from '../resolution';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../db/drizzle',
);
const dbPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  `wingmic-resolution-test-${randomUUID()}.db`,
);

describe('commit() sourceInteractionId', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_commit_1';

  beforeAll(async () => {
    client = createClient({ url: `file:${dbPath}` });
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });

    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO user (id, email, email_verified, name, image, created_at, updated_at)
            VALUES (?, 'ada@example.com', 1, 'Ada', null, ?, ?)`,
      args: [userId, now, now],
    });
  });

  it('stamps sourceInteractionId on entity facts and topics', async () => {
    const result = await commit(
      {
        persons: [
          {
            name: 'Ada Lovelace',
            role: 'analyst',
            companyHint: 'Analytical Engines',
            topics: ['math'],
            notes: 'Met over tea; discussed difference engine.',
            email: null,
            linkedin: null,
            aliases: [],
          },
        ],
        companies: [{ name: 'Analytical Engines', domainHint: null, industry: [] }],
        events: [],
        topics: ['math'],
        actions: [],
      },
      {
        db: db as never,
        userId,
        transcript: 'met Ada Lovelace from Analytical Engines, talked math over tea',
        capturedAt: new Date(),
      },
    );

    expect(result.interactionId).toBeTruthy();
    expect(result.newEntities).toBe(1);
    expect(result.entityIds).toHaveLength(1);

    const facts = await db.query.entityFacts.findMany({
      where: eq(schema.entityFacts.entityId, result.entityIds[0]),
    });
    expect(facts.length).toBeGreaterThan(0);
    for (const f of facts) {
      expect(f.sourceInteractionId).toBe(result.interactionId);
    }

    const topics = await db.query.entityTopics.findMany({
      where: eq(schema.entityTopics.entityId, result.entityIds[0]),
    });
    expect(topics.length).toBeGreaterThan(0);
    for (const t of topics) {
      expect(t.sourceInteractionId).toBe(result.interactionId);
    }
  });

  afterAll(async () => {
    await client.close();
    try {
      unlinkSync(dbPath);
    } catch {
      // ignore missing file
    }
  });
});
