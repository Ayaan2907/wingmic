import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { eq, and } from 'drizzle-orm';
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

    expect(result.persons).toHaveLength(1);
    expect(result.persons[0]!.created).toBe(true);
    expect(result.persons[0]!.entityId).toBe(result.entityIds[0]);

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

  });

  it('attaches capture-level topics even when the person candidate has none', async () => {
    const topicUserId = 'user_commit_topics';
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO user (id, email, email_verified, name, image, created_at, updated_at)
            VALUES (?, 'grace@example.com', 1, 'Grace', null, ?, ?)`,
      args: [topicUserId, now, now],
    });

    const result = await commit(
      {
        persons: [
          {
            name: 'Grace Hopper',
            role: null,
            companyHint: null,
            topics: [],
            notes: null,
            email: null,
            linkedin: null,
            aliases: [],
          },
        ],
        companies: [],
        events: [],
        topics: ['cobol'],
        actions: [],
      },
      {
        db: db as never,
        userId: topicUserId,
        transcript: 'met grace hopper, talked cobol',
        capturedAt: new Date(),
      },
    );
    const topics = await db.query.entityTopics.findMany({
      where: eq(schema.entityTopics.entityId, result.entityIds[0]!),
    });
    expect(topics).toHaveLength(1);
  });

  it('reuses a unique same-owner person on recapture without needing fuzzy score', async () => {
    const recaptureUserId = 'user_commit_recapture';
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO user (id, email, email_verified, name, image, created_at, updated_at)
            VALUES (?, 'recapture@example.com', 1, 'Grace', null, ?, ?)`,
      args: [recaptureUserId, now, now],
    });

    const first = await commit(
      {
        persons: [
          {
            name: 'Grace Hopper',
            role: 'admiral',
            companyHint: 'US Navy',
            topics: ['cobol'],
            notes: 'First meeting.',
            email: null,
            linkedin: null,
            aliases: [],
          },
        ],
        companies: [{ name: 'US Navy', domainHint: null, industry: [] }],
        events: [],
        topics: ['cobol'],
        actions: [],
      },
      {
        db: db as never,
        userId: recaptureUserId,
        transcript: 'met Grace Hopper from US Navy',
        capturedAt: new Date('2026-08-20T10:00:00Z'),
      },
    );

    expect(first.newEntities).toBe(1);
    expect(first.persons[0]!.created).toBe(true);

    const second = await commit(
      {
        persons: [
          {
            name: 'Grace Hopper',
            role: null,
            companyHint: 'US Navy',
            topics: ['compilers'],
            notes: 'Second chat.',
            email: null,
            linkedin: null,
            aliases: [],
          },
        ],
        companies: [{ name: 'US Navy', domainHint: null, industry: [] }],
        events: [],
        topics: ['compilers'],
        actions: [],
      },
      {
        db: db as never,
        userId: recaptureUserId,
        transcript: 'caught up with Grace Hopper again',
        capturedAt: new Date('2026-08-21T10:00:00Z'),
      },
    );

    expect(second.newEntities).toBe(0);
    expect(second.matchedEntities).toBe(1);
    expect(second.persons[0]!.created).toBe(false);
    expect(second.persons[0]!.entityId).toBe(first.entityIds[0]);

    const entities = await db.query.entities.findMany({
      where: eq(schema.entities.ownerUserId, recaptureUserId),
    });
    expect(entities.filter((e) => e.kind === 'person')).toHaveLength(1);

    const interactions = await db.query.interactions.findMany({
      where: eq(schema.interactions.userId, recaptureUserId),
    });
    expect(interactions).toHaveLength(2);

    const notes = await db.query.entityFacts.findMany({
      where: and(
        eq(schema.entityFacts.entityId, first.entityIds[0]!),
        eq(schema.entityFacts.key, 'note'),
      ),
    });
    expect(notes.length).toBe(2);

    const roles = await db.query.entityCompanies.findMany({
      where: eq(schema.entityCompanies.entityId, first.entityIds[0]!),
    });
    expect(roles[0]?.role).toBe('admiral');
  });

  it('creates a third person when two same-name people already exist', async () => {
    const tomoUserId = 'user_commit_tomo_dup';
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO user (id, email, email_verified, name, image, created_at, updated_at)
            VALUES (?, 'tomo-dup@example.com', 1, 'Tomo', null, ?, ?)`,
      args: [tomoUserId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, import_source, embedding, created_at, updated_at)
            VALUES ('tomo_a', ?, 'person', 'Tomo Matsuo', '[]', 'voice-capture', NULL, ?, ?),
                   ('tomo_b', ?, 'person', 'Tomo Matsuo', '[]', 'voice-capture', NULL, ?, ?)`,
      args: [tomoUserId, now, now, tomoUserId, now, now],
    });

    const result = await commit(
      {
        persons: [
          {
            name: 'Tomo Matsuo',
            role: null,
            companyHint: null,
            topics: [],
            notes: 'third memo',
            email: null,
            linkedin: null,
            aliases: [],
          },
        ],
        companies: [],
        events: [],
        topics: [],
        actions: [],
      },
      {
        db: db as never,
        userId: tomoUserId,
        transcript: 'met Tomo Matsuo again',
        capturedAt: new Date(),
      },
    );

    expect(result.newEntities).toBe(1);
    expect(result.persons[0]!.created).toBe(true);

    const people = await db.query.entities.findMany({
      where: and(eq(schema.entities.ownerUserId, tomoUserId), eq(schema.entities.kind, 'person')),
    });
    expect(people).toHaveLength(3);
  });

  it('reuses the Tomo with a unique email when two same-name people exist', async () => {
    const tomoUserId = 'user_commit_tomo_email';
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO user (id, email, email_verified, name, image, created_at, updated_at)
            VALUES (?, 'tomo-email@example.com', 1, 'Tomo', null, ?, ?)`,
      args: [tomoUserId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, import_source, embedding, created_at, updated_at)
            VALUES ('tomo_email_a', ?, 'person', 'Tomo Matsuo', '[]', 'voice-capture', NULL, ?, ?),
                   ('tomo_email_b', ?, 'person', 'Tomo Matsuo', '[]', 'voice-capture', NULL, ?, ?)`,
      args: [tomoUserId, now, now, tomoUserId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity_fact (id, entity_id, key, value, confidence, created_at)
            VALUES ('fact_tomo_email', 'tomo_email_a', 'email', 'tomo@example.com', 95, ?)`,
      args: [now],
    });

    const result = await commit(
      {
        persons: [
          {
            name: 'Tomo Matsuo',
            role: null,
            companyHint: null,
            topics: [],
            notes: null,
            email: 'tomo@example.com',
            linkedin: null,
            aliases: [],
          },
        ],
        companies: [],
        events: [],
        topics: [],
        actions: [],
      },
      {
        db: db as never,
        userId: tomoUserId,
        transcript: 'email follow-up with Tomo',
        capturedAt: new Date(),
      },
    );

    expect(result.persons[0]!.created).toBe(false);
    expect(result.persons[0]!.entityId).toBe('tomo_email_a');
  });

  it('does not reuse a full name when the candidate is only a first name', async () => {
    const partialUserId = 'user_commit_tomo_partial';
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO user (id, email, email_verified, name, image, created_at, updated_at)
            VALUES (?, 'tomo-partial@example.com', 1, 'Tomo', null, ?, ?)`,
      args: [partialUserId, now, now],
    });

    const first = await commit(
      {
        persons: [
          {
            name: 'Tomo Matsuo',
            role: null,
            companyHint: null,
            topics: [],
            notes: null,
            email: null,
            linkedin: null,
            aliases: [],
          },
        ],
        companies: [],
        events: [],
        topics: [],
        actions: [],
      },
      {
        db: db as never,
        userId: partialUserId,
        transcript: 'met Tomo Matsuo',
        capturedAt: new Date(),
      },
    );

    const second = await commit(
      {
        persons: [
          {
            name: 'Tomo',
            role: null,
            companyHint: null,
            topics: [],
            notes: null,
            email: null,
            linkedin: null,
            aliases: [],
          },
        ],
        companies: [],
        events: [],
        topics: [],
        actions: [],
      },
      {
        db: db as never,
        userId: partialUserId,
        transcript: 'saw Tomo',
        capturedAt: new Date(),
      },
    );

    expect(second.newEntities).toBe(1);
    expect(second.persons[0]!.created).toBe(true);
    expect(second.persons[0]!.entityId).not.toBe(first.entityIds[0]);
  });

  it('leaves event dates blank when speech has no date hint', async () => {
    const result = await commit(
      {
        persons: [],
        companies: [],
        events: [{ name: 'ETH Denver', dateHint: null, location: null }],
        topics: [],
        actions: [],
      },
      {
        db: db as never,
        userId,
        transcript: 'heading to eth denver',
        capturedAt: new Date('2026-08-20T12:00:00Z'),
      },
    );
    expect(result.eventIds).toHaveLength(1);
    const event = await db.query.events.findFirst({
      where: eq(schema.events.id, result.eventIds[0]!),
    });
    expect(event?.dateRangeStart).toBeNull();
    expect(event?.dateRangeEnd).toBeNull();
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
