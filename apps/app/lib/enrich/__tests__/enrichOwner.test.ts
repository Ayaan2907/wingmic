import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';
import type { WebSearchProvider } from '@/lib/web-search';
import { enrichOwnerAfterLinkedin } from '../enrichOwner';

describe('enrichOwnerAfterLinkedin', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const userId = 'user_a';

  beforeAll(async () => {
    const client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });
    const now = Date.now();
    await client.executeMultiple(`
      CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL, email_verified INTEGER DEFAULT 0, name TEXT, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE identity_claim (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, value TEXT NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0, public INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
      );
    `);
    await client.execute({
      sql: `INSERT INTO user VALUES (?, 'ada@example.com', 0, 'Ada Lovelace', null, ?, ?)`,
      args: [userId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO identity_claim VALUES ('c1', ?, 'linkedin', 'https://www.linkedin.com/in/ada-lovelace', 0, 0, ?)`,
      args: [userId, now],
    });
  });

  it('writes a homepage url claim from public hits, never extracting LinkedIn', async () => {
    const extract = vi.fn(async () => {
      throw new Error('must not extract');
    });
    const search = vi.fn(async () => [
      {
        title: 'Ada | LinkedIn',
        url: 'https://www.linkedin.com/in/ada-lovelace',
        snippet: 'profile',
      },
      {
        title: 'Ada Lovelace',
        url: 'https://www.analytical-engines.example/ada',
        snippet: 'homepage',
      },
    ]);
    const provider: WebSearchProvider = { id: 'tavily', search, extract };

    await enrichOwnerAfterLinkedin({
      db: db as never,
      userId,
      linkedinUrl: 'https://www.linkedin.com/in/ada-lovelace',
      name: 'Ada Lovelace',
      provider,
    });

    expect(search).toHaveBeenCalled();
    expect(extract).not.toHaveBeenCalled();
    const claims = await db.query.identityClaims.findMany({
      where: eq(schema.identityClaims.userId, userId),
    });
    expect(claims.some((c) => c.kind === 'url' && c.value.includes('analytical-engines'))).toBe(
      true,
    );
  });

  it('no-ops without a provider', async () => {
    await expect(
      enrichOwnerAfterLinkedin({
        db: db as never,
        userId,
        linkedinUrl: 'https://www.linkedin.com/in/ada-lovelace',
        provider: null,
      }),
    ).resolves.toBeUndefined();
  });
});
