import { afterEach, describe, it, expect, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';
import type { WebSearchProvider } from '@/lib/web-search';
import { enrichEventsAfterCommit } from '../enrichEvents';

const PUBLIC_ICS_URL =
  'https://calendar.google.com/calendar/ical/ada%40example.com/public/basic.ics';
const EVENT_ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:ETH Denver
DTSTART:20260227T150000Z
DTEND:20260301T220000Z
LOCATION:Denver
URL:https://calendar.example/eth-denver
END:VEVENT
END:VCALENDAR`;

async function seedEvent(extra: { url?: string | null; dates?: boolean }) {
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
    args: [extra.dates ? now : null, extra.dates ? now : null, extra.url ?? null, now],
  });
  return db;
}

describe('enrichEventsAfterCommit', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it('extracts a pasted luma url instead of searching by name', async () => {
    const db = await seedEvent({ url: 'https://lu.ma/ethdenver' });
    const search = vi.fn(async () => []);
    const extract = vi.fn(async () => [
      {
        url: 'https://lu.ma/ethdenver',
        content: 'Feb 27 – Mar 1, 2026 · Denver',
      },
    ]);
    await enrichEventsAfterCommit({
      db: db as never,
      eventIds: ['ev_eth'],
      capturedAt: new Date('2026-08-20T00:00:00Z'),
      provider: { id: 'tavily', search, extract },
    });
    expect(search).not.toHaveBeenCalled();
    expect(extract).toHaveBeenCalled();
    const row = await db.query.events.findFirst({ where: eq(schema.events.id, 'ev_eth') });
    expect(row?.location).toBe('Denver');
    expect(row?.externalSource).toBe('luma');
    expect(row?.externalId).toBe('ethdenver');
  });

  it('falls back to search when extracting a pasted url fails', async () => {
    const db = await seedEvent({ url: 'https://lu.ma/ethdenver' });
    const search = vi.fn(async () => [
      {
        title: 'ETH Denver 2026',
        url: 'https://www.ethdenver.com',
        snippet: 'Feb 27 – Mar 1, 2026 · Denver',
      },
    ]);
    const extract = vi.fn(async () => {
      throw new Error('provider unavailable');
    });

    await enrichEventsAfterCommit({
      db: db as never,
      eventIds: ['ev_eth'],
      capturedAt: new Date('2026-08-20T00:00:00Z'),
      provider: { id: 'tavily', search, extract },
    });

    expect(extract).toHaveBeenCalled();
    expect(search).toHaveBeenCalled();
    const row = await db.query.events.findFirst({ where: eq(schema.events.id, 'ev_eth') });
    expect(row?.url).toBe('https://lu.ma/ethdenver');
    expect(row?.location).toBe('Denver');
  });

  it('keeps an ICS patch when the provider fails', async () => {
    const db = await seedEvent({});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(EVENT_ICS)),
    );
    const search = vi.fn(async () => {
      throw new Error('provider unavailable');
    });

    await expect(
      enrichEventsAfterCommit({
        db: db as never,
        eventIds: ['ev_eth'],
        capturedAt: new Date('2026-08-20T00:00:00Z'),
        provider: { id: 'tavily', search, extract: async () => [] },
        calendarIcsUrl: PUBLIC_ICS_URL,
      }),
    ).resolves.toBeUndefined();

    const row = await db.query.events.findFirst({ where: eq(schema.events.id, 'ev_eth') });
    expect(row?.url).toBe('https://calendar.example/eth-denver');
    expect(row?.location).toBe('Denver');
    expect(row?.dateRangeStart).toBeTruthy();
    expect(row?.dateRangeEnd).toBeTruthy();
  });

  it('preserves an ICS url over a search result url', async () => {
    const db = await seedEvent({});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(EVENT_ICS)),
    );
    const search = vi.fn(async () => [
      {
        title: 'ETH Denver 2026',
        url: 'https://search.example/eth-denver',
        snippet: 'Feb 27 – Mar 1, 2026 · Denver',
      },
    ]);

    await enrichEventsAfterCommit({
      db: db as never,
      eventIds: ['ev_eth'],
      capturedAt: new Date('2026-08-20T00:00:00Z'),
      provider: { id: 'tavily', search, extract: async () => [] },
      calendarIcsUrl: PUBLIC_ICS_URL,
    });

    const row = await db.query.events.findFirst({ where: eq(schema.events.id, 'ev_eth') });
    expect(row?.url).toBe('https://calendar.example/eth-denver');
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
