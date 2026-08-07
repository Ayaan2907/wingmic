import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';

vi.mock('../embeddings', () => ({
  embedText: vi.fn(async () => Array.from({ length: 1536 }, () => 0.01)),
  embedTexts: vi.fn(async (texts: string[]) =>
    texts.map(() => Array.from({ length: 1536 }, () => 0.01)),
  ),
  cosine: vi.fn(() => 0),
}));

import { commit } from '../resolution';

describe('commit() sourceInteractionId', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const userId = 'user_commit_1';

  beforeAll(async () => {
    const client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });

    await client.executeMultiple(`
      CREATE TABLE user (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        email_verified INTEGER DEFAULT 0,
        name TEXT,
        image TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        audio_retention_mode TEXT DEFAULT '24h',
        linker_model_override TEXT,
        preferred_mic_device_id TEXT,
        asr_language TEXT DEFAULT 'en-US',
        acknowledged_privacy INTEGER DEFAULT 0
      );
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
      CREATE TABLE company (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        domain TEXT,
        industry TEXT,
        observed_count INTEGER DEFAULT 1,
        promoted_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE event (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        date_range_start INTEGER,
        date_range_end INTEGER,
        location TEXT,
        url TEXT,
        observed_count INTEGER DEFAULT 1,
        promoted_at INTEGER,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE topic (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        aliases TEXT DEFAULT '[]',
        parent_id TEXT,
        created_at INTEGER NOT NULL
      );
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
      CREATE TABLE entity_company (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        role TEXT,
        since INTEGER,
        until INTEGER,
        created_at INTEGER NOT NULL,
        source_deleted INTEGER DEFAULT 0 NOT NULL
      );
      CREATE TABLE entity_event (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        role TEXT,
        created_at INTEGER NOT NULL,
        source_deleted INTEGER DEFAULT 0 NOT NULL
      );
      CREATE TABLE entity_topic (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        weight INTEGER DEFAULT 50,
        source_interaction_id TEXT,
        created_at INTEGER NOT NULL,
        source_deleted INTEGER DEFAULT 0 NOT NULL
      );
      CREATE TABLE entity_fact (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        source_interaction_id TEXT,
        confidence INTEGER DEFAULT 85,
        embedding F32_BLOB(1536),
        created_at INTEGER NOT NULL
      );
    `);

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
});
