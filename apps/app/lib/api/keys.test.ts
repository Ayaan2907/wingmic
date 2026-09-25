import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';

import {
  API_SCOPES,
  authenticateApiKey,
  createApiKey,
  generateRawKey,
  hashKey,
  keyPrefix,
  listApiKeys,
  parseScopes,
  revokeApiKey,
} from './keys';

// Key service over the real schema on an in-memory libSQL db — same harness
// as the router tests. Covers the round-trip: create (raw shown once, hash
// stored) -> authenticate (by digest) -> revoke (auth fails immediately).

describe('api key service', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_keys_1';

  beforeAll(async () => {
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });
    await client.executeMultiple(`
      CREATE TABLE api_key (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        scopes TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER,
        revoked_at INTEGER
      );
      CREATE UNIQUE INDEX api_key_hash_idx ON api_key (key_hash);
      CREATE INDEX api_key_user_idx ON api_key (user_id);
    `);
  });

  it('generates wk_live_ keys with enough entropy and a stable 16-char prefix', () => {
    const key = generateRawKey();
    expect(key.startsWith('wk_live_')).toBe(true);
    expect(key.length).toBeGreaterThanOrEqual(32);
    expect(keyPrefix(key)).toBe(key.slice(0, 16));
    expect(keyPrefix(key)).not.toBe(key); // prefix alone never reveals the key
  });

  it('hashes to sha256 hex — the raw key never reaches storage', () => {
    const key = generateRawKey();
    const hash = hashKey(key);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(key);
    expect(hashKey(key)).toBe(hash); // deterministic
  });

  it('createApiKey returns the raw key once and persists only the hash', async () => {
    const { rawKey, apiKey } = await createApiKey({
      db,
      userId,
      name: 'cli',
      scopes: ['graph:read', 'search:read'],
    });
    expect(rawKey.startsWith('wk_live_')).toBe(true);
    expect(apiKey.name).toBe('cli');
    expect(apiKey.prefix).toBe(rawKey.slice(0, 16));
    expect(apiKey.scopes).toEqual(['graph:read', 'search:read']);

    // Storage: hash + prefix present, raw key nowhere.
    const row = await db.query.apiKeys.findFirst({ where: (k, { eq }) => eq(k.id, apiKey.id) });
    expect(row?.keyHash).toBe(hashKey(rawKey));
    expect(row?.prefix).toBe(rawKey.slice(0, 16));
    expect(JSON.stringify(row)).not.toContain(rawKey);
  });

  it('authenticates a valid key to its owning user', async () => {
    const { rawKey } = await createApiKey({
      db,
      userId,
      name: 'roundtrip',
      scopes: ['graph:read'],
    });
    const authed = await authenticateApiKey(db, rawKey);
    expect(authed).not.toBeNull();
    expect(authed?.userId).toBe(userId);
    expect(authed?.scopes).toEqual(['graph:read']);
  });

  it('rejects unknown and malformed keys with null (no existence leak)', async () => {
    expect(await authenticateApiKey(db, 'wk_live_doesnotexist')).toBeNull();
    expect(await authenticateApiKey(db, 'not-a-key')).toBeNull();
    expect(await authenticateApiKey(db, '')).toBeNull();
  });

  it('rejects a revoked key immediately', async () => {
    const { rawKey, apiKey } = await createApiKey({
      db,
      userId,
      name: 'shortlived',
      scopes: ['capture:write'],
    });
    expect(await authenticateApiKey(db, rawKey)).not.toBeNull();

    const ok = await revokeApiKey(db, userId, apiKey.id);
    expect(ok).toBe(true);

    expect(await authenticateApiKey(db, rawKey)).toBeNull();
    expect(await revokeApiKey(db, userId, apiKey.id)).toBe(false); // idempotent
  });

  it('other users cannot revoke or list someone else keys', async () => {
    const { apiKey } = await createApiKey({
      db,
      userId,
      name: 'mine',
      scopes: ['graph:read'],
    });
    expect(await revokeApiKey(db, 'user_attacker', apiKey.id)).toBe(false);
    const attackerKeys = await listApiKeys(db, 'user_attacker');
    expect(attackerKeys).toEqual([]);
    const mine = await listApiKeys(db, userId);
    expect(mine.map((k) => k.id)).toContain(apiKey.id);
  });

  it('updates lastUsedAt when authenticating a fresh key', async () => {
    const { rawKey, apiKey } = await createApiKey({
      db,
      userId,
      name: 'touched',
      scopes: ['graph:read'],
    });
    await authenticateApiKey(db, rawKey);
    const row = await db.query.apiKeys.findFirst({ where: (k, { eq }) => eq(k.id, apiKey.id) });
    expect(row?.lastUsedAt).toBeInstanceOf(Date);
  });

  it('parseScopes drops unknown scope strings', () => {
    expect(parseScopes(JSON.stringify(['graph:read', 'admin:everything']))).toEqual(['graph:read']);
    expect(parseScopes('not json')).toEqual([]);
    expect(parseScopes(JSON.stringify('graph:read'))).toEqual([]);
    expect(parseScopes(JSON.stringify(API_SCOPES))).toEqual([...API_SCOPES]);
  });
});
