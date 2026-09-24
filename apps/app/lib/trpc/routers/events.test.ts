import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';

import { eventsRouter } from './events';
import { getIcsSnapshot } from '@/lib/enrich/icsSnapshot';
import type { ParsedIcsEvent } from '@/lib/enrich/parseIcs';

vi.mock('@/lib/enrich/icsSnapshot', () => ({ getIcsSnapshot: vi.fn() }));

const getIcsSnapshotMock = vi.mocked(getIcsSnapshot);

const MIN = 60_000;
const HOUR = 60 * MIN;

function ics(overrides: Partial<ParsedIcsEvent>): ParsedIcsEvent {
  return {
    summary: 'Event',
    location: null,
    url: null,
    dateRangeStart: null,
    dateRangeEnd: null,
    allDay: false,
    ...overrides,
  };
}

// Fixtures relative to the real clock — events.current matches against
// `new Date()`, so relative instants keep the tests deterministic.
const now = () => Date.now();
const ongoingIcs = (summary: string) =>
  ics({
    summary,
    dateRangeStart: new Date(now() - HOUR),
    dateRangeEnd: new Date(now() + HOUR),
  });
const upcomingIcs = (summary: string) =>
  ics({
    summary,
    dateRangeStart: new Date(now() + 30 * MIN),
    dateRangeEnd: new Date(now() + 90 * MIN),
  });

describe('events router', () => {
  let client: ReturnType<typeof createClient>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const userId = 'user_a';

  beforeEach(async () => {
    getIcsSnapshotMock.mockReset();
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
        updated_at INTEGER NOT NULL,
        calendar_ics_url TEXT
      );
      CREATE TABLE ics_snapshot (
        owner_user_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        FOREIGN KEY (owner_user_id) REFERENCES user(id) ON DELETE CASCADE
      );
      CREATE TABLE event (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        date_range_start INTEGER,
        date_range_end INTEGER,
        location TEXT,
        url TEXT,
        external_source TEXT,
        external_id TEXT,
        observed_count INTEGER NOT NULL DEFAULT 1,
        promoted_at INTEGER,
        created_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX event_external_idx ON event (external_source, external_id);
      INSERT INTO user (id, email, created_at, updated_at) VALUES ('user_a', 'a@example.com', 1, 1);
    `);
  });

  function caller() {
    const ctx = {
      db,
      user: { id: userId },
      session: { user: { id: userId } },
    } as unknown as Parameters<typeof eventsRouter.createCaller>[0];
    return eventsRouter.createCaller(ctx);
  }

  async function setUserIcsUrl(url: string | null): Promise<void> {
    await client.execute({
      sql: `UPDATE user SET calendar_ics_url = ? WHERE id = ?`,
      args: [url, userId],
    });
  }

  describe('current', () => {
    it('returns session null and no candidates when no ICS is set', async () => {
      await setUserIcsUrl(null);

      const res = await caller().current();

      expect(res).toEqual({ session: null, candidates: [] });
      expect(getIcsSnapshotMock).not.toHaveBeenCalled();
    });

    it('auto-binds with source ics-auto on exactly one ongoing match', async () => {
      await setUserIcsUrl('https://calendar.google.com/calendar/ical/a%40example.com/public/basic.ics');
      getIcsSnapshotMock.mockResolvedValue([ongoingIcs('NEXA Summit')]);

      const res = await caller().current();

      expect(res.session).toMatchObject({
        state: 'bound',
        source: 'ics-auto',
      });
      if (res.session?.state === 'bound') {
        expect(res.session.event.name).toBe('NEXA Summit');
        // ICS events have no canonical row yet — id arrives via bind.
        expect(res.session.event.id).toBeNull();
      }
      expect(res.candidates).toHaveLength(1);
    });

    it('reports ambiguous with merged candidates on two ongoing matches', async () => {
      await setUserIcsUrl('https://calendar.google.com/calendar/ical/a%40example.com/public/basic.ics');
      getIcsSnapshotMock.mockResolvedValue([
        ongoingIcs('Morning talk'),
        ongoingIcs('Hallway sessions'),
      ]);

      const res = await caller().current();

      expect(res.session).toEqual({
        state: 'ambiguous',
        candidates: expect.any(Array),
      });
      if (res.session?.state === 'ambiguous') {
        expect(res.session.candidates.map((e) => e.name)).toEqual([
          'Morning talk',
          'Hallway sessions',
        ]);
      }
      expect(res.candidates).toHaveLength(2);
    });

    it('stays unbound with upcoming events listed as candidates', async () => {
      await setUserIcsUrl('https://calendar.google.com/calendar/ical/a%40example.com/public/basic.ics');
      getIcsSnapshotMock.mockResolvedValue([upcomingIcs('Next up')]);

      const res = await caller().current();

      expect(res.session).toBeNull();
      expect(res.candidates.map((e) => e.name)).toEqual(['Next up']);
    });

    it('merges ongoing first, then upcoming, into candidates', async () => {
      await setUserIcsUrl('https://calendar.google.com/calendar/ical/a%40example.com/public/basic.ics');
      getIcsSnapshotMock.mockResolvedValue([ongoingIcs('Happening now'), upcomingIcs('Next up')]);

      const res = await caller().current();

      expect(res.session).toMatchObject({ state: 'bound', source: 'ics-auto' });
      expect(res.candidates.map((e) => e.name)).toEqual(['Happening now', 'Next up']);
    });

    it('returns session null when zero windows match', async () => {
      await setUserIcsUrl('https://calendar.google.com/calendar/ical/a%40example.com/public/basic.ics');
      getIcsSnapshotMock.mockResolvedValue([
        ics({
          summary: 'Long over',
          dateRangeStart: new Date(now() - 2 * 24 * HOUR),
          dateRangeEnd: new Date(now() - 2 * 24 * HOUR + HOUR),
        }),
      ]);

      const res = await caller().current();

      expect(res).toEqual({ session: null, candidates: [] });
    });
  });

  describe('bind', () => {
    it('lazily creates the canonical event row with observedCount untouched', async () => {
      const res = await caller().bind({
        event: {
          name: 'NEXA Summit',
          location: 'Denver',
          dateRangeStart: new Date(now()),
          dateRangeEnd: new Date(now() + 2 * HOUR),
        },
      });

      expect(res.session.state).toBe('bound');
      if (res.session.state !== 'bound') return;
      expect(res.session.source).toBe('picked');
      expect(res.session.event.id).not.toBeNull();

      const row = await db.query.events.findFirst({
        where: eq(schema.events.slug, 'nexa-summit'),
      });
      expect(row).not.toBeNull();
      expect(row!.id).toBe(res.session.event.id);
      expect(row!.name).toBe('NEXA Summit');
      expect(row!.location).toBe('Denver');
      expect(row!.observedCount).toBe(0);
      expect(row!.promotedAt).toBeNull();
      // Binding is not an observation — dates come from the calendar.
      expect(row!.dateRangeStart).toBeInstanceOf(Date);
    });

    it('is idempotent on re-bind — same row, no duplicates, no increments', async () => {
      const descriptor = {
        name: 'NEXA Summit',
        dateRangeStart: new Date(now()),
        dateRangeEnd: new Date(now() + HOUR),
      };

      const first = await caller().bind({ event: descriptor });
      const second = await caller().bind({ event: descriptor });

      if (first.session.state !== 'bound' || second.session.state !== 'bound') {
        throw new Error('expected bound sessions');
      }
      expect(second.session.event.id).toBe(first.session.event.id);

      const rows = await db.query.events.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.observedCount).toBe(0);
      expect(rows[0]!.promotedAt).toBeNull();
    });

    it('binds onto an existing row without touching observedCount or promotion', async () => {
      await client.execute({
        sql: `INSERT INTO event (id, slug, name, observed_count, promoted_at, created_at)
              VALUES ('evt_seed', 'team-sync', 'Team sync', 5, 999, 1)`,
        args: [],
      });

      const res = await caller().bind({ event: { name: 'Team sync' } });

      if (res.session.state !== 'bound') throw new Error('expected bound session');
      expect(res.session.event.id).toBe('evt_seed');

      const row = await db.query.events.findFirst({ where: eq(schema.events.id, 'evt_seed') });
      expect(row!.observedCount).toBe(5);
      expect(row!.promotedAt).not.toBeNull();
    });

    it('pins an explicit canonical id without writing', async () => {
      await client.execute({
        sql: `INSERT INTO event (id, slug, name, observed_count, created_at)
              VALUES ('evt_recent', 'founders-dinner', 'Founders dinner', 3, 1)`,
        args: [],
      });

      const res = await caller().bind({
        event: { id: 'evt_recent', name: 'Founders dinner' },
      });

      if (res.session.state !== 'bound') throw new Error('expected bound session');
      expect(res.session.event.id).toBe('evt_recent');
      expect(res.session.event.name).toBe('Founders dinner');

      const rows = await db.query.events.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.observedCount).toBe(3);
    });

    it('falls back to descriptor resolution when the id is stale', async () => {
      const res = await caller().bind({
        event: { id: 'evt_deleted', name: 'Fresh Event' },
      });

      if (res.session.state !== 'bound') throw new Error('expected bound session');
      expect(res.session.event.id).not.toBe('evt_deleted');

      const row = await db.query.events.findFirst({
        where: eq(schema.events.slug, 'fresh-event'),
      });
      expect(row).not.toBeNull();
      expect(row!.id).toBe(res.session.event.id);
    });

    it('harvests luma urls into external identity and dedupes on re-bind', async () => {
      const descriptor = { name: 'Demo night', url: 'https://lu.ma/abc123' };

      const first = await caller().bind({ event: descriptor });
      const second = await caller().bind({
        event: { ...descriptor, name: 'Demo night renamed' },
      });

      if (first.session.state !== 'bound' || second.session.state !== 'bound') {
        throw new Error('expected bound sessions');
      }
      expect(second.session.event.id).toBe(first.session.event.id);

      const row = await db.query.events.findFirst({
        where: eq(schema.events.id, first.session.event.id!),
      });
      expect(row!.externalSource).toBe('luma');
      expect(row!.externalId).toBe('abc123');
      expect(await db.query.events.findMany()).toHaveLength(1);
    });

    it('echoes a client-supplied ics-auto source', async () => {
      const res = await caller().bind({
        event: { name: 'NEXA Summit' },
        source: 'ics-auto',
      });

      expect(res.session.state).toBe('bound');
      if (res.session.state === 'bound') {
        expect(res.session.source).toBe('ics-auto');
      }
    });
  });
});
