/**
 * API key lifecycle for the public REST surface (/api/v1).
 *
 * A raw key (`wk_live_<base64url>`) is generated once at creation, shown to
 * the user exactly once, and persisted only as a sha256 digest — the raw
 * value is never stored, logged, or included in any API response. Lookups
 * go by digest; a constant-time compare guards the (defensive) digest match.
 *
 * Scopes gate /api/v1 endpoints: a request is 401'd for a missing/revoked
 * key and 403'd (naming the scope) for a key that lacks the needed scope.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';

export { API_SCOPES, isApiScope, parseScopes } from './scopes';
export type { ApiScope } from './scopes';
import { parseScopes } from './scopes';
import type { ApiScope } from './scopes';

export const API_KEY_PREFIX = 'wk_live';

/** How stale lastUsedAt may get before we bother writing it again. */
const LAST_USED_WRITE_THROTTLE_MS = 60_000;

/** Generate a raw bearer key. The caller owns the one chance to show it. */
export function generateRawKey(): string {
  return `${API_KEY_PREFIX}_${randomBytes(24).toString('base64url')}`;
}

/** Non-secret prefix (first 16 chars) safe to show in the dashboard. */
export function keyPrefix(rawKey: string): string {
  return rawKey.slice(0, 16);
}

/** sha256 hex digest — the only form of a key we ever persist. */
export function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export type CreatedApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  createdAt: Date;
};

/**
 * Create a key for `userId`. Returns `rawKey` exactly once — the service
 * layer returns it, the hash is what gets stored.
 */
export async function createApiKey(args: {
  db: DB;
  userId: string;
  name: string;
  scopes: ApiScope[];
}): Promise<{ rawKey: string; apiKey: CreatedApiKey }> {
  const rawKey = generateRawKey();
  const rows = await args.db
    .insert(schema.apiKeys)
    .values({
      userId: args.userId,
      name: args.name,
      prefix: keyPrefix(rawKey),
      keyHash: hashKey(rawKey),
      scopes: JSON.stringify(args.scopes),
    })
    .returning({
      id: schema.apiKeys.id,
      name: schema.apiKeys.name,
      prefix: schema.apiKeys.prefix,
      scopes: schema.apiKeys.scopes,
      createdAt: schema.apiKeys.createdAt,
    });

  const row = rows[0]!;
  return {
    rawKey,
    apiKey: {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      scopes: parseScopes(row.scopes),
      createdAt: row.createdAt,
    },
  };
}

/** List the caller's keys, newest first. Raw keys and hashes never appear. */
export async function listApiKeys(
  db: DB,
  userId: string,
): Promise<Array<CreatedApiKey & { lastUsedAt: Date | null; revokedAt: Date | null }>> {
  const rows = await db.query.apiKeys.findMany({
    where: eq(schema.apiKeys.userId, userId),
    orderBy: (key, { desc }) => [desc(key.createdAt)],
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: parseScopes(row.scopes),
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
  }));
}

/** Soft-revoke one of the caller's keys. Idempotent; false when not owned. */
export async function revokeApiKey(db: DB, userId: string, keyId: string): Promise<boolean> {
  const now = new Date();
  const existing = await db.query.apiKeys.findFirst({
    where: and(
      eq(schema.apiKeys.id, keyId),
      eq(schema.apiKeys.userId, userId),
      isNull(schema.apiKeys.revokedAt),
    ),
    columns: { id: true },
  });
  if (!existing) return false;
  await db
    .update(schema.apiKeys)
    .set({ revokedAt: now })
    .where(eq(schema.apiKeys.id, keyId));
  return true;
}

export type AuthenticatedApiKey = {
  id: string;
  userId: string;
  scopes: ApiScope[];
};

/**
 * Resolve a raw bearer key to its principal. Returns null for unknown,
 * revoked, or malformed keys — indistinguishably, so responses never leak
 * whether a key ever existed. Touches lastUsedAt at most once a minute.
 */
export async function authenticateApiKey(
  db: DB,
  rawKey: string,
  now: Date = new Date(),
): Promise<AuthenticatedApiKey | null> {
  const keyHash = hashKey(rawKey);
  const row = await db.query.apiKeys.findFirst({
    where: eq(schema.apiKeys.keyHash, keyHash),
  });
  if (!row) return null;

  // Defensive: the index lookup already matched, but compare digests in
  // constant time so a hypothetical hash collision probe gains no timing.
  const stored = Buffer.from(row.keyHash, 'hex');
  const presented = Buffer.from(keyHash, 'hex');
  if (stored.length !== presented.length || !timingSafeEqual(stored, presented)) return null;
  if (row.revokedAt) return null;

  // Throttled lastUsedAt — avoids a write per request.
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_WRITE_THROTTLE_MS) {
    await db
      .update(schema.apiKeys)
      .set({ lastUsedAt: now })
      .where(eq(schema.apiKeys.id, row.id));
  }

  return { id: row.id, userId: row.userId, scopes: parseScopes(row.scopes) };
}
