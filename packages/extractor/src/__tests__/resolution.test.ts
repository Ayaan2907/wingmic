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
    const dupUserId = 'user_commit_dup_name';
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO user (id, email, email_verified, name, image, created_at, updated_at)
            VALUES (?, 'dup-name@example.com', 1, 'Jordan', null, ?, ?)`,
      args: [dupUserId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, import_source, embedding, created_at, updated_at)
            VALUES ('dup_a', ?, 'person', 'Jordan Lee', '[]', 'voice-capture', NULL, ?, ?),
                   ('dup_b', ?, 'person', 'Jordan Lee', '[]', 'voice-capture', NULL, ?, ?)`,
      args: [dupUserId, now, now, dupUserId, now, now],
    });

    const result = await commit(
      {
        persons: [
          {
            name: 'Jordan Lee',
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
        userId: dupUserId,
        transcript: 'met Jordan Lee again',
        capturedAt: new Date(),
      },
    );

    expect(result.newEntities).toBe(1);
    expect(result.persons[0]!.created).toBe(true);

    const people = await db.query.entities.findMany({
      where: and(eq(schema.entities.ownerUserId, dupUserId), eq(schema.entities.kind, 'person')),
    });
    expect(people).toHaveLength(3);
  });

  it('reuses the person with a unique email when two same-name people exist', async () => {
    const dupUserId = 'user_commit_dup_email';
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO user (id, email, email_verified, name, image, created_at, updated_at)
            VALUES (?, 'dup-email@example.com', 1, 'Jordan', null, ?, ?)`,
      args: [dupUserId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, import_source, embedding, created_at, updated_at)
            VALUES ('dup_email_a', ?, 'person', 'Jordan Lee', '[]', 'voice-capture', NULL, ?, ?),
                   ('dup_email_b', ?, 'person', 'Jordan Lee', '[]', 'voice-capture', NULL, ?, ?)`,
      args: [dupUserId, now, now, dupUserId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity_fact (id, entity_id, key, value, confidence, created_at)
            VALUES ('fact_dup_email', 'dup_email_a', 'email', 'jordan@example.com', 95, ?)`,
      args: [now],
    });

    const result = await commit(
      {
        persons: [
          {
            name: 'Jordan Lee',
            role: null,
            companyHint: null,
            topics: [],
            notes: null,
            email: 'jordan@example.com',
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
        userId: dupUserId,
        transcript: 'email follow-up with Jordan',
        capturedAt: new Date(),
      },
    );

    expect(result.persons[0]!.created).toBe(false);
    expect(result.persons[0]!.entityId).toBe('dup_email_a');
  });

  it('does not reuse a full name when the candidate is only a first name', async () => {
    const partialUserId = 'user_commit_partial_name';
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO user (id, email, email_verified, name, image, created_at, updated_at)
            VALUES (?, 'partial-name@example.com', 1, 'Jordan', null, ?, ?)`,
      args: [partialUserId, now, now],
    });

    const first = await commit(
      {
        persons: [
          {
            name: 'Jordan Lee',
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
        transcript: 'met Jordan Lee',
        capturedAt: new Date(),
      },
    );

    const second = await commit(
      {
        persons: [
          {
            name: 'Jordan',
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
        transcript: 'saw Jordan',
        capturedAt: new Date(),
      },
    );

    expect(second.newEntities).toBe(1);
    expect(second.persons[0]!.created).toBe(true);
    expect(second.persons[0]!.entityId).not.toBe(first.entityIds[0]);
  });

  it('reuses the selected person when two same-name people exist', async () => {
    const bindUserId = 'user_commit_preferred_dup';
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO user (id, email, email_verified, name, image, created_at, updated_at)
            VALUES (?, 'preferred-dup@example.com', 1, 'Ada', null, ?, ?)`,
      args: [bindUserId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, import_source, embedding, created_at, updated_at)
            VALUES ('pref_jordan_a', ?, 'person', 'Jordan Lee', '[]', 'voice-capture', NULL, ?, ?),
                   ('pref_jordan_b', ?, 'person', 'Jordan Lee', '[]', 'voice-capture', NULL, ?, ?)`,
      args: [bindUserId, now, now, bindUserId, now, now],
    });

    const result = await commit(
      {
        persons: [
          {
            name: 'Jordan Lee',
            role: null,
            companyHint: null,
            topics: [],
            notes: 'add to the one I just opened',
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
        userId: bindUserId,
        transcript: 'add to the one I just opened',
        capturedAt: new Date(),
        preferredEntityId: 'pref_jordan_a',
      },
    );

    expect(result.newEntities).toBe(0);
    expect(result.persons[0]!.created).toBe(false);
    expect(result.persons[0]!.entityId).toBe('pref_jordan_a');
  });

  it('injects and links the preferred person when extraction returns none', async () => {
    const bindUserId = 'user_commit_preferred_empty';
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO user (id, email, email_verified, name, image, created_at, updated_at)
            VALUES (?, 'preferred-empty@example.com', 1, 'Ada', null, ?, ?)`,
      args: [bindUserId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, import_source, embedding, created_at, updated_at)
            VALUES ('pref_grace', ?, 'person', 'Grace Hopper', '[]', 'voice-capture', NULL, ?, ?)`,
      args: [bindUserId, now, now],
    });

    const result = await commit(
      {
        persons: [],
        companies: [],
        events: [],
        topics: [],
        actions: [],
      },
      {
        db: db as never,
        userId: bindUserId,
        transcript: 'her linkedin is /in/gracehopper',
        capturedAt: new Date(),
        preferredEntityId: 'pref_grace',
      },
    );

    expect(result.newEntities).toBe(0);
    expect(result.matchedEntities).toBe(1);
    expect(result.entityIds).toEqual(['pref_grace']);
    expect(result.persons[0]!.created).toBe(false);

    const notes = await db.query.entityFacts.findMany({
      where: and(
        eq(schema.entityFacts.entityId, 'pref_grace'),
        eq(schema.entityFacts.key, 'note'),
      ),
    });
    expect(notes.some((f) => f.value === 'her linkedin is /in/gracehopper')).toBe(true);

    const linkedin = await db.query.entityFacts.findMany({
      where: and(
        eq(schema.entityFacts.entityId, 'pref_grace'),
        eq(schema.entityFacts.key, 'linkedin'),
      ),
    });
    expect(linkedin[0]?.value).toBe('https://www.linkedin.com/in/gracehopper');
  });

  it('does not force preferred onto a differently named unique person', async () => {
    const bindUserId = 'user_commit_preferred_other';
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO user (id, email, email_verified, name, image, created_at, updated_at)
            VALUES (?, 'preferred-other@example.com', 1, 'Ada', null, ?, ?)`,
      args: [bindUserId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity (id, owner_user_id, kind, name, aliases, import_source, embedding, created_at, updated_at)
            VALUES ('pref_open_grace', ?, 'person', 'Grace Hopper', '[]', 'voice-capture', NULL, ?, ?),
                   ('pref_named_ada', ?, 'person', 'Ada Lovelace', '[]', 'voice-capture', NULL, ?, ?)`,
      args: [bindUserId, now, now, bindUserId, now, now],
    });

    const result = await commit(
      {
        persons: [
          {
            name: 'Ada Lovelace',
            role: null,
            companyHint: null,
            topics: [],
            notes: 'also met ada',
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
        userId: bindUserId,
        transcript: 'also met ada lovelace',
        capturedAt: new Date(),
        preferredEntityId: 'pref_open_grace',
      },
    );

    expect(result.persons[0]!.entityId).toBe('pref_named_ada');
    expect(result.persons[0]!.created).toBe(false);
  });

  it('writes parentInteractionId and threadRootId on a follow-up capture', async () => {
    const bindUserId = 'user_commit_parent';
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO user (id, email, email_verified, name, image, created_at, updated_at)
            VALUES (?, 'parent@example.com', 1, 'Ada', null, ?, ?)`,
      args: [bindUserId, now, now],
    });

    const first = await commit(
      {
        persons: [
          {
            name: 'Grace Hopper',
            role: null,
            companyHint: null,
            topics: [],
            notes: 'first take',
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
        userId: bindUserId,
        transcript: 'met grace hopper',
        capturedAt: new Date(),
      },
    );

    const second = await commit(
      {
        persons: [
          {
            name: 'Grace Hopper',
            role: null,
            companyHint: null,
            topics: [],
            notes: 'linkedin follow-up',
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
        userId: bindUserId,
        transcript: 'her linkedin is /in/gracehopper',
        capturedAt: new Date(),
        parentInteractionId: first.interactionId,
        threadRootId: first.interactionId,
        preferredEntityId: first.entityIds[0],
      },
    );

    const child = await db.query.interactions.findFirst({
      where: eq(schema.interactions.id, second.interactionId),
    });
    expect(child?.parentInteractionId).toBe(first.interactionId);
    expect(child?.threadRootId).toBe(first.interactionId);
    expect(second.persons[0]!.entityId).toBe(first.entityIds[0]);
  });

  it('stamps a pasted LinkedIn URL on the unique person and skips url-token topics', async () => {
    const bindUserId = 'user_commit_linkedin_url';
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO user (id, email, email_verified, name, image, created_at, updated_at)
            VALUES (?, 'li-url@example.com', 1, 'Ada', null, ?, ?)`,
      args: [bindUserId, now, now],
    });

    const first = await commit(
      {
        persons: [
          {
            name: 'Tanzila Sameen',
            role: null,
            companyHint: 'Noemai',
            topics: ['novium'],
            notes: 'met at salesforce event',
            email: null,
            linkedin: null,
            aliases: [],
          },
        ],
        companies: [{ name: 'Noemai', domainHint: null, industry: [] }],
        events: [],
        topics: ['novium'],
        actions: [],
      },
      {
        db: db as never,
        userId: bindUserId,
        transcript: 'met Tanzila Sameen at Noemai',
        capturedAt: new Date(),
      },
    );

    const second = await commit(
      {
        persons: [
          {
            name: 'Tanzila Sameen',
            role: null,
            companyHint: null,
            topics: ['https', 'linkedin', 'tanzeela-sameen'],
            notes: null,
            email: null,
            linkedin: null,
            aliases: [],
          },
        ],
        companies: [],
        events: [],
        topics: ['https', 'linkedin', 'tanzeela-sameen'],
        actions: [],
      },
      {
        db: db as never,
        userId: bindUserId,
        transcript: 'https://in.linkedin.com/in/tanzeela-sameen her linkedin',
        capturedAt: new Date(),
        parentInteractionId: first.interactionId,
        threadRootId: first.interactionId,
        preferredEntityId: first.entityIds[0],
      },
    );

    expect(second.persons[0]!.entityId).toBe(first.entityIds[0]);
    const linkedin = await db.query.entityFacts.findMany({
      where: and(
        eq(schema.entityFacts.entityId, first.entityIds[0]!),
        eq(schema.entityFacts.key, 'linkedin'),
      ),
    });
    expect(linkedin[0]?.value).toBe('https://www.linkedin.com/in/tanzeela-sameen');

    const topicRows = await db.query.entityTopics.findMany({
      where: eq(schema.entityTopics.sourceInteractionId, second.interactionId),
    });
    const topicIds = topicRows.map((t) => t.topicId);
    const topics =
      topicIds.length > 0
        ? await db.query.topics.findMany()
        : [];
    const names = topics
      .filter((t) => topicIds.includes(t.id))
      .map((t) => t.name.toLowerCase());
    expect(names).not.toContain('https');
    expect(names).not.toContain('linkedin');
    expect(names).not.toContain('tanzeela-sameen');
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

  it('harvests a pasted luma url onto a new event and binds the person', async () => {
    const result = await commit(
      {
        persons: [
          {
            name: 'Ada Lovelace',
            role: null,
            companyHint: null,
            topics: ['https', 'luma'],
            notes: null,
            email: null,
            linkedin: null,
            aliases: [],
          },
        ],
        companies: [],
        events: [],
        topics: ['https', 'luma', 'ethdenver'],
        actions: [],
      },
      {
        db: db as never,
        userId,
        transcript: 'https://lu.ma/ethdenver met ada there',
        capturedAt: new Date('2026-08-20T12:00:00Z'),
      },
    );
    expect(result.eventIds).toHaveLength(1);
    const event = await db.query.events.findFirst({
      where: eq(schema.events.id, result.eventIds[0]!),
    });
    expect(event?.url).toBe('https://lu.ma/ethdenver');
    expect(event?.externalSource).toBe('luma');
    expect(event?.externalId).toBe('ethdenver');
    const edge = await db.query.entityEvents.findFirst({
      where: and(
        eq(schema.entityEvents.entityId, result.entityIds[0]!),
        eq(schema.entityEvents.eventId, result.eventIds[0]!),
      ),
    });
    expect(edge).toBeTruthy();
  });

  it('inherits preferredEventId when the follow-up names no event', async () => {
    const first = await commit(
      {
        persons: [
          {
            name: 'Ada Lovelace',
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
        events: [{ name: 'ETH Denver', dateHint: null, location: null }],
        topics: [],
        actions: [],
      },
      {
        db: db as never,
        userId,
        transcript: 'met ada at eth denver',
        capturedAt: new Date('2026-08-20T12:00:00Z'),
      },
    );
    const second = await commit(
      {
        persons: [],
        companies: [],
        events: [],
        topics: [],
        actions: [],
      },
      {
        db: db as never,
        userId,
        transcript: 'attached a photo',
        capturedAt: new Date('2026-08-20T12:05:00Z'),
        preferredEntityId: first.entityIds[0],
        preferredEventId: first.eventIds[0],
        parentInteractionId: first.interactionId,
        threadRootId: first.interactionId,
      },
    );
    const edge = await db.query.entityEvents.findFirst({
      where: and(
        eq(schema.entityEvents.entityId, first.entityIds[0]!),
        eq(schema.entityEvents.eventId, first.eventIds[0]!),
      ),
    });
    expect(second.eventIds).toEqual(first.eventIds);
    expect(edge).toBeTruthy();
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
