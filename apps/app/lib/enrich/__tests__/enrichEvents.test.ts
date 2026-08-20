import { describe, it, expect, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';
import type { WebSearchProvider } from '@/lib/web-search';
import { enrichEventsAfterCommit } from '../enrichEvents';

async function seedEvent(extra: {
  url?: string | null;
  dates?: boolean;
}) {
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client, { schema });
  const now = Date.now();
  await client.executeMultiple(`
    CREATE TABLE event (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL,
      date_range_start INTEGER, date_range_end INTEGER, location TEXT, url TEXT,
      external_source TEXT, external_id TEXT,
      observed_count INTEGER DEFAULT 1, promoted_at INTEGER, created_at INTEGER NOT NULL
    );
  `);
  await client.execute({
    sql: `INSERT INTO event VALUES ('ev_eth', 'eth-denver', 'ETH Denver', ?, ?, null, ?, null, null, 1, null, ?)`,
    args: [
      extra.dates ? now : null,
      extra.dates ? now : null,
      extra.url ?? null,
      now,
    ],
  });
  return db;
}

describe('enrichEventsAfterCommit', () => {
  it('fills blank url, location, and dates from search hits', async () => {
    const db = await seedEvent({});
    const search = vi.fn(async () => [
      {
        title: 'ETH Denver 2026',
        url: 'https://www.ethdenver.com',
        snippet: 'Feb 27 – Mar 1, 2026 · Denver',
      },
    ]);
    const provider: WebSearchProvider = { id: 'tavily', search, extract: async () => [] };

    await enrichEventsAfterCommit({
      db: db as never,
      eventIds: ['ev_eth'],
      capturedAt: new Date('2026-08-20T00:00:00Z'),
      provider,
    });

    const row = await db.query.events.findFirst({ where: eq(schema.events.id, 'ev_eth') });
    expect(row?.url).toBe('https://www.ethdenver.com');
    expect(row?.location).toBe('Denver');
    expect(row?.dateRangeStart).toBeTruthy();
    expect(row?.dateRangeEnd).toBeTruthy();
  });

  it('stores luma external id from a snippet url', async () => {
    const db = await seedEvent({});
    const search = vi.fn(async () => [
      {
        title: 'ETH Denver',
        url: 'https://lu.ma/ethdenver',
        snippet: 'tickets https://lu.ma/ethdenver',
      },
    ]);
    await enrichEventsAfterCommit({
      db: db as never,
      eventIds: ['ev_eth'],
      capturedAt: new Date('2026-08-20T00:00:00Z'),
      provider: { id: 'tavily', search, extract: async () => [] },
    });
    const row = await db.query.events.findFirst({ where: eq(schema.events.id, 'ev_eth') });
    expect(row?.externalSource).toBe('luma');
    expect(row?.externalId).toBe('ethdenver');
  });

  it('skips search when url and dates are already set', async () => {
    const db = await seedEvent({ url: 'https://www.ethdenver.com', dates: true });
    const search = vi.fn(async () => []);
    await enrichEventsAfterCommit({
      db: db as never,
      eventIds: ['ev_eth'],
      capturedAt: new Date('2026-08-20T00:00:00Z'),
      provider: { id: 'tavily', search, extract: async () => [] },
    });
    expect(search).not.toHaveBeenCalled();
  });

  it('no-ops without a provider', async () => {
    const db = await seedEvent({});
    await expect(
      enrichEventsAfterCommit({
        db: db as never,
        eventIds: ['ev_eth'],
        capturedAt: new Date(),
        provider: null,
      }),
    ).resolves.toBeUndefined();
  });
});
