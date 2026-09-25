// Schema pins for the bay layer, checked against a REAL migrated libSQL —
// not a snapshot diff. Two things matter here:
// 1. the contract columns exist with the declared types and nullability;
// 2. the graph `event` table is untouched — its db shape matches schema.ts
//    exactly, and live-inventory semantics (observedCount/promotedAt) live
//    only there.
import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { bayEvents, events, places } from '../schema';
import { freshDb, tableColumns } from './testing';

const col = (columns: { name: string; type: string; notnull: number; pk: number }[], name: string) => {
  const found = columns.find((c) => c.name === name);
  expect(found, `column ${name} missing`).toBeDefined();
  return found!;
};

describe('migration 0015 — bay tables', () => {
  it('applies on a fresh libSQL', async () => {
    const { db } = await freshDb();
    expect(await db.$count(places)).toBe(0);
    expect(await db.$count(bayEvents)).toBe(0);
  });

  describe('places', () => {
    it('has the contract columns', async () => {
      const { client } = await freshDb();
      const cols = await tableColumns(client, 'places');
      expect(cols.map((c) => c.name).sort()).toEqual(
        ['category', 'embedding', 'fetched_at', 'first_seen_at', 'id', 'lat', 'lng', 'name', 'note', 'slug', 'source'].sort(),
      );
      expect(col(cols, 'id')).toMatchObject({ type: 'text', pk: 1 });
      expect(col(cols, 'slug')).toMatchObject({ type: 'text', notnull: 1 });
      // the first-person note is mandatory — never a bare pin
      expect(col(cols, 'note')).toMatchObject({ type: 'text', notnull: 1 });
      expect(col(cols, 'category')).toMatchObject({ type: 'text', notnull: 1 });
      expect(col(cols, 'lat')).toMatchObject({ type: 'real', notnull: 1 });
      expect(col(cols, 'lng')).toMatchObject({ type: 'real', notnull: 1 });
      expect(col(cols, 'source')).toMatchObject({ type: 'text', notnull: 0 });
      expect(col(cols, 'embedding')).toMatchObject({ type: 'f32_blob(1536)', notnull: 0 });
    });

    it('has a unique slug and a category index', async () => {
      const { client } = await freshDb();
      const indices = await client.execute(
        "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'places'",
      );
      const byName = new Map(indices.rows.map((r) => [String(r['name']), String(r['sql'] ?? '')]));
      expect(byName.get('places_slug_unique')).toContain('UNIQUE');
      expect(byName.has('places_category_idx')).toBe(true);
    });
  });

  describe('bay_events', () => {
    it('has the contract columns', async () => {
      const { client } = await freshDb();
      const cols = await tableColumns(client, 'bay_events');
      expect(cols.map((c) => c.name).sort()).toEqual(
        [
          'canonical_event_id', 'category', 'embedding', 'ends_at', 'expires_at',
          'external_id', 'fetched_at', 'first_seen_at', 'id', 'lat', 'lng',
          'note', 'price', 'source', 'starts_at', 'title', 'url', 'venue',
        ].sort(),
      );
      expect(col(cols, 'id')).toMatchObject({ type: 'text', pk: 1 });
      expect(col(cols, 'canonical_event_id')).toMatchObject({ type: 'text', notnull: 0 });
      expect(col(cols, 'source')).toMatchObject({ type: 'text', notnull: 1 });
      expect(col(cols, 'external_id')).toMatchObject({ type: 'text', notnull: 1 });
      expect(col(cols, 'title')).toMatchObject({ type: 'text', notnull: 1 });
      expect(col(cols, 'venue')).toMatchObject({ type: 'text', notnull: 0 });
      expect(col(cols, 'lat')).toMatchObject({ type: 'real', notnull: 0 });
      expect(col(cols, 'lng')).toMatchObject({ type: 'real', notnull: 0 });
      expect(col(cols, 'price')).toMatchObject({ type: 'text', notnull: 0 });
      expect(col(cols, 'category')).toMatchObject({ type: 'text', notnull: 1 });
      expect(col(cols, 'url')).toMatchObject({ type: 'text', notnull: 1 });
      expect(col(cols, 'starts_at')).toMatchObject({ type: 'integer', notnull: 0 });
      expect(col(cols, 'ends_at')).toMatchObject({ type: 'integer', notnull: 0 });
      expect(col(cols, 'expires_at')).toMatchObject({ type: 'integer', notnull: 0 });
      expect(col(cols, 'first_seen_at')).toMatchObject({ type: 'integer', notnull: 1 });
      expect(col(cols, 'fetched_at')).toMatchObject({ type: 'integer', notnull: 1 });
      expect(col(cols, 'embedding')).toMatchObject({ type: 'f32_blob(1536)', notnull: 0 });
    });

    it('has its three indices', async () => {
      const { client } = await freshDb();
      const indices = await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'bay_events'",
      );
      const names = indices.rows.map((r) => String(r['name']));
      expect(names).toContain('bay_events_source_idx');
      expect(names).toContain('bay_events_starts_at_idx');
      expect(names).toContain('bay_events_canonical_event_idx');
    });
  });

  describe('separation from the graph event table', () => {
    it('leaves the graph event table exactly as schema.ts declares it', async () => {
      const { client } = await freshDb();
      const dbCols = (await tableColumns(client, 'event')).map((c) => c.name).sort();
      // schema.ts is the source of truth — if someone edits the event table
      // without regenerating, or drifts the db shape, this fails
      const schemaCols = Object.values(getTableColumns(events)).map((c) => c.name).sort();
      expect(dbCols).toEqual(schemaCols);
    });

    it('keeps memory semantics on event and away from bay_events', async () => {
      const { client } = await freshDb();
      const eventCols = (await tableColumns(client, 'event')).map((c) => c.name);
      expect(eventCols).toContain('observed_count');
      expect(eventCols).toContain('promoted_at');
      const bayCols = (await tableColumns(client, 'bay_events')).map((c) => c.name);
      expect(bayCols).not.toContain('observed_count');
      expect(bayCols).not.toContain('promoted_at');
    });

    it('writes to bay_events without touching the event table', async () => {
      const { db } = await freshDb();
      const now = new Date('2026-09-25T00:00:00.000Z');
      await db.insert(bayEvents).values({
        id: 'seed:calhacks',
        source: 'seed',
        externalId: 'calhacks',
        title: 'Cal Hacks',
        category: 'hackathons',
        url: 'https://calhacks.io',
        startsAt: now,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        firstSeenAt: now,
        fetchedAt: now,
      });
      expect(await db.$count(bayEvents)).toBe(1);
      expect(await db.$count(events)).toBe(0);
    });
  });

  it('round-trips timestamps and embeddings through drizzle', async () => {
    const { db } = await freshDb();
    const now = new Date('2026-09-25T00:00:00.000Z');
    await db.insert(places).values({
      id: 'seed:golden-gate-bridge',
      slug: 'golden-gate-bridge',
      name: 'Golden Gate Bridge',
      note: 'Walk it at sunrise; bring a layer.',
      category: 'tours',
      lat: 37.8199,
      lng: -122.4783,
      source: 'seed',
      embedding: null,
      firstSeenAt: now,
      fetchedAt: now,
    });
    const [place] = await db.select().from(places);
    expect(place.slug).toBe('golden-gate-bridge');
    // integer timestamps are second-precision Dates
    expect(place.firstSeenAt.toISOString()).toBe('2026-09-25T00:00:00.000Z');

    await db.insert(bayEvents).values({
      id: 'luma:test',
      source: 'luma',
      externalId: 'test',
      title: 'Luma event',
      category: 'events',
      url: 'https://lu.ma/test',
      startsAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      embedding: Array.from({ length: 1536 }, () => 0.5),
      firstSeenAt: now,
      fetchedAt: now,
    });
    const [bayEvent] = await db.select().from(bayEvents);
    // F32_BLOB quantizes to f32 — 0.5 is exact in binary
    expect(bayEvent.embedding?.length).toBe(1536);
  });
});
