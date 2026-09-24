import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';

import { getIcsSnapshot, ICS_SNAPSHOT_TTL_MS } from '../icsSnapshot';

const ICS_URL = 'https://calendar.google.com/calendar/ical/ada%40example.com/public/basic.ics';
const OTHER_ICS_URL =
  'https://calendar.google.com/calendar/ical/grace%40example.com/public/basic.ics';

function icsFeed(summary: string, start: string, end: string): string {
  return `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:${summary}
DTSTART:${start}
DTEND:${end}
END:VEVENT
END:VCALENDAR`;
}

const FEED_A = icsFeed('NEXA Summit', '20260924T170000Z', '20260924T190000Z');
const FEED_B = icsFeed('ETH Denver', '20270226T150000Z', '20270301T220000Z');

describe('getIcsSnapshot', () => {
  let client: ReturnType<typeof createClient>;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function stubFeed(responses: string[]) {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      const body = responses[Math.min(call, responses.length - 1)]!;
      call += 1;
      // 500s make fetchCalendarIcs return null — the "feed unreachable" path.
      if (body === ':500') return new Response('unavailable', { status: 500 });
      return new Response(body, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    return {
      calls: () => call,
    };
  }

  async function seedTables(): Promise<void> {
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });
    await client.executeMultiple(`
      CREATE TABLE user (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        email_verified INTEGER NOT NULL DEFAULT 0,
        name TEXT,
        image TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE ics_snapshot (
        owner_user_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        FOREIGN KEY (owner_user_id) REFERENCES user(id) ON DELETE CASCADE
      );
      INSERT INTO user (id, email, created_at, updated_at) VALUES ('u1', 'u1@example.com', 1, 1);
      INSERT INTO user (id, email, created_at, updated_at) VALUES ('u2', 'u2@example.com', 1, 1);
      INSERT INTO user (id, email, created_at, updated_at) VALUES ('u3', 'u3@example.com', 1, 1);
      INSERT INTO user (id, email, created_at, updated_at) VALUES ('u4', 'u4@example.com', 1, 1);
      INSERT INTO user (id, email, created_at, updated_at) VALUES ('u5', 'u5@example.com', 1, 1);
      INSERT INTO user (id, email, created_at, updated_at) VALUES ('u6', 'u6@example.com', 1, 1);
    `);
  }

  async function fallbackRow(userId: string) {
    return db.query.icsSnapshots.findFirst({
      where: eq(schema.icsSnapshots.ownerUserId, userId),
    });
  }

  it('fetches, parses, and persists the fallback row', async () => {
    await seedTables();
    stubFeed([FEED_A]);

    const events = await getIcsSnapshot(db, 'u1', ICS_URL);

    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe('NEXA Summit');
    expect(events[0]!.dateRangeStart?.toISOString()).toBe('2026-09-24T17:00:00.000Z');

    const row = await fallbackRow('u1');
    expect(row).not.toBeNull();
    expect(row!.payload).toEqual([
      {
        summary: 'NEXA Summit',
        location: null,
        url: null,
        dateRangeStart: '2026-09-24T17:00:00.000Z',
        dateRangeEnd: '2026-09-24T19:00:00.000Z',
        allDay: false,
      },
    ]);
    expect(row!.fetchedAt).toBeInstanceOf(Date);
  });

  it('serves the in-memory cache within the TTL', async () => {
    await seedTables();
    const feed = stubFeed([FEED_A]);

    await getIcsSnapshot(db, 'u2', ICS_URL);
    await getIcsSnapshot(db, 'u2', ICS_URL);
    const events = await getIcsSnapshot(db, 'u2', ICS_URL);

    expect(feed.calls()).toBe(1);
    expect(events).toHaveLength(1);
  });

  it('refetches after the TTL expires', async () => {
    await seedTables();
    const feed = stubFeed([FEED_A, FEED_A]);
    vi.useFakeTimers({ now: new Date('2026-09-24T12:00:00Z') });

    await getIcsSnapshot(db, 'u3', ICS_URL);
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z').getTime() + ICS_SNAPSHOT_TTL_MS + 1);
    await getIcsSnapshot(db, 'u3', ICS_URL);

    expect(feed.calls()).toBe(2);
  });

  it('falls back to the DB row when the feed is unreachable', async () => {
    await seedTables();
    const feed = stubFeed([FEED_A, ':500']);
    vi.useFakeTimers({ now: new Date('2026-09-24T12:00:00Z') });

    const first = await getIcsSnapshot(db, 'u4', ICS_URL);
    expect(first).toHaveLength(1);

    vi.setSystemTime(new Date('2026-09-24T12:00:00Z').getTime() + ICS_SNAPSHOT_TTL_MS + 1);
    const second = await getIcsSnapshot(db, 'u4', ICS_URL);

    expect(feed.calls()).toBe(2);
    expect(second).toHaveLength(1);
    expect(second[0]!.summary).toBe('NEXA Summit');
    expect(second[0]!.dateRangeStart).toBeInstanceOf(Date);
  });

  it('returns nothing and never fetches when no url is set', async () => {
    await seedTables();
    const feed = stubFeed([FEED_A]);

    const events = await getIcsSnapshot(db, 'u5', null);

    expect(events).toEqual([]);
    expect(feed.calls()).toBe(0);
  });

  it('invalidates the cache when the calendar url changes', async () => {
    await seedTables();
    const feed = stubFeed([FEED_A, FEED_B]);

    // Fresh user — the module-level cache outlives individual tests.
    const before = await getIcsSnapshot(db, 'u6', ICS_URL);
    const after = await getIcsSnapshot(db, 'u6', OTHER_ICS_URL);

    expect(feed.calls()).toBe(2);
    expect(before[0]!.summary).toBe('NEXA Summit');
    expect(after[0]!.summary).toBe('ETH Denver');
  });
});
