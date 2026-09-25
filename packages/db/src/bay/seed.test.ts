// Contract pins for the bay seed — the ported ayaan-site store rules:
// CANON vocabulary fold, mandatory first-person notes, https-only urls,
// 24h expiry grace, idempotent merge with the earliest firstSeenAt surviving.
// The last two groups run against the REAL lifted seed files under seed/bay/.
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { bayEvents, places } from '../schema';
import { canonicalCategory } from './categories';
import {
  EVENT_GRACE_MS,
  bayExpiryAt,
  externalIdFor,
  loadBaySeedDir,
  mergeByStableId,
  normalizeBayEvent,
  normalizeBayPlace,
  placeIdFor,
  seedBay,
  slugify,
} from './seed';
import { BAY_SEED_DIR, freshDb } from './testing';

const NOW = new Date('2026-09-25T00:00:00.000Z'); // second-aligned — timestamp columns are second-precision

const placeInput = {
  id: 'seed:golden-gate-bridge',
  name: 'Golden Gate Bridge',
  note: 'Walk it at sunrise.',
  category: 'tour',
  lat: 37.8199,
  lng: -122.4783,
  source: 'seed',
};

const eventInput = {
  id: 'seed:calhacks',
  title: 'Cal Hacks',
  category: 'hackathons',
  source: 'seed',
  url: 'https://calhacks.io',
  startsAt: '2026-10-01T09:00:00.000Z',
  endsAt: '2026-10-01T18:00:00.000Z',
  fetchedAt: '2026-09-24T12:00:00.000Z',
};

describe('category fold', () => {
  it('folds both vocabularies to the plural form', () => {
    expect(canonicalCategory('startup')).toBe('startups');
    expect(canonicalCategory('office')).toBe('offices');
    expect(canonicalCategory('tour')).toBe('tours');
    expect(canonicalCategory('startups')).toBe('startups');
    expect(canonicalCategory('events')).toBe('events');
  });

  it('returns null for unknown categories — never a silent guess', () => {
    expect(canonicalCategory('museums')).toBeNull();
    expect(canonicalCategory('')).toBeNull();
  });
});

describe('stable ids', () => {
  it('collapses bare slugs and prefixed ids onto one row', () => {
    expect(placeIdFor('golden-gate-bridge')).toEqual({ id: 'seed:golden-gate-bridge', slug: 'golden-gate-bridge' });
    expect(placeIdFor('seed:golden-gate-bridge')).toEqual({ id: 'seed:golden-gate-bridge', slug: 'golden-gate-bridge' });
  });

  it('slugifies messy ids', () => {
    expect(slugify('The Mission (SF)')).toBe('the-mission-sf');
    expect(placeIdFor('')).toBeNull();
  });

  it('derives externalId from the source prefix', () => {
    expect(externalIdFor('luma:abc123')).toBe('abc123');
    expect(externalIdFor('bare-slug')).toBe('bare-slug');
  });
});

describe('expiry with the 24h grace', () => {
  it('expires at endsAt + grace', () => {
    const endsAt = new Date('2026-10-01T18:00:00.000Z');
    expect(bayExpiryAt({ endsAt, startsAt: new Date('2026-10-01T09:00:00.000Z') })?.getTime()).toBe(
      endsAt.getTime() + EVENT_GRACE_MS,
    );
  });

  it('falls back to startsAt when there is no endsAt', () => {
    const startsAt = new Date('2026-10-01T09:00:00.000Z');
    expect(bayExpiryAt({ endsAt: null, startsAt })?.getTime()).toBe(startsAt.getTime() + EVENT_GRACE_MS);
  });

  it('never guesses when nothing is known', () => {
    expect(bayExpiryAt({ endsAt: null, startsAt: null })).toBeNull();
  });
});

describe('normalizeBayPlace', () => {
  it('folds the category and derives the stable id', () => {
    const result = normalizeBayPlace(placeInput, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      id: 'seed:golden-gate-bridge',
      slug: 'golden-gate-bridge',
      category: 'tours',
      lat: 37.8199,
      lng: -122.4783,
      firstSeenAt: NOW,
      fetchedAt: NOW,
    });
  });

  it('rejects a place without its first-person note — never a bare pin', () => {
    const result = normalizeBayPlace({ ...placeInput, note: '   ' }, NOW);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('note is required') });
  });

  it('rejects unknown categories', () => {
    const result = normalizeBayPlace({ ...placeInput, category: 'museums' }, NOW);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('unknown category') });
  });

  it('rejects out-of-range coordinates', () => {
    expect(normalizeBayPlace({ ...placeInput, lat: 95 }, NOW)).toMatchObject({ ok: false });
    expect(normalizeBayPlace({ ...placeInput, lng: -200 }, NOW)).toMatchObject({ ok: false });
  });
});

describe('normalizeBayEvent', () => {
  it('computes expiry at the boundary with the grace period', () => {
    const result = normalizeBayEvent(eventInput, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.expiresAt?.toISOString()).toBe('2026-10-02T18:00:00.000Z');
    expect(result.value.externalId).toBe('calhacks');
    expect(result.value.category).toBe('hackathons');
  });

  it('lets an explicit expiresAt win over the computed one', () => {
    const result = normalizeBayEvent(
      { ...eventInput, expiresAt: '2026-10-05T00:00:00.000Z' },
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.expiresAt?.toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });

  it('enforces https-only urls', () => {
    expect(normalizeBayEvent({ ...eventInput, url: 'http://calhacks.io' }, NOW)).toMatchObject({
      ok: false,
      error: expect.stringContaining('https'),
    });
  });

  it('requires a url and a parseable startsAt', () => {
    expect(normalizeBayEvent({ ...eventInput, url: '' }, NOW)).toMatchObject({ ok: false });
    expect(normalizeBayEvent({ ...eventInput, startsAt: 'not-a-date' }, NOW)).toMatchObject({ ok: false });
  });

  it('rejects unknown sources', () => {
    expect(normalizeBayEvent({ ...eventInput, source: 'eventbrite' }, NOW)).toMatchObject({ ok: false });
  });
});

describe('mergeByStableId', () => {
  const row = (id: string, firstSeenAt: Date, title = 'same'): { id: string; firstSeenAt: Date; title: string } => ({
    id,
    firstSeenAt,
    title,
  });

  it('counts created and updated rows', () => {
    const firstSeenAt = new Date('2026-09-24T00:00:00.000Z');
    const { rows, summary } = mergeByStableId([row('a', firstSeenAt), row('b', firstSeenAt)], [
      row('b', firstSeenAt, 'changed'),
      row('c', firstSeenAt),
    ]);
    expect(summary).toEqual({ created: 1, updated: 1 });
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(rows.find((r) => r.id === 'b')?.title).toBe('changed');
  });

  it('keeps the earliest firstSeenAt on merge', () => {
    const earlier = new Date('2026-09-20T00:00:00.000Z');
    const later = new Date('2026-09-25T00:00:00.000Z');
    const { rows } = mergeByStableId([row('a', earlier)], [row('a', later, 'changed')]);
    expect(rows[0]?.firstSeenAt).toEqual(earlier);
  });

  it('is deterministic in output order', () => {
    const firstSeenAt = new Date('2026-09-24T00:00:00.000Z');
    const run = () => mergeByStableId([], [row('z', firstSeenAt), row('a', firstSeenAt)]).rows.map((r) => r.id);
    expect(run()).toEqual(run());
    expect(run()).toEqual(['a', 'z']);
  });
});

describe('the lifted seed files', () => {
  const data = loadBaySeedDir(BAY_SEED_DIR, NOW);

  it('loads 35 raw rows — 23 geojson features + 12 store seeds, 5 described twice', () => {
    expect(data.places.length).toBe(35);
    expect(new Set(data.places.map((p) => p.id)).size).toBe(30); // the five double-curated places collapse at seed time
    expect(data.events.length).toBe(3);
  });

  it('gives every place a note and a plural category', () => {
    for (const place of data.places) {
      expect(place.note.length, `${place.id} has no note`).toBeGreaterThan(0);
      expect(place.category).not.toBe('startup');
      expect(place.category).not.toBe('office');
      expect(place.category).not.toBe('tour');
    }
  });

  it('collapses the five double-curated places, keeping the earliest firstSeenAt', () => {
    const { rows } = mergeByStableId([], data.places);
    expect(rows.length).toBe(30);
    const bridge = rows.find((p) => p.id === 'seed:golden-gate-bridge');
    expect(bridge).toBeDefined();
    // the store seed's 2026-09-24 fetch beats the geojson's seed-time now
    expect(bridge?.firstSeenAt.toISOString()).toBe('2026-09-24T12:00:00.000Z');
  });

  it('uses https urls and known sources on every event', () => {
    for (const event of data.events) {
      expect(event.url.startsWith('https://')).toBe(true);
      expect(['luma', 'partiful', 'web', 'meetup', 'ics', 'submitted', 'seed']).toContain(event.source);
      expect(event.expiresAt).not.toBeNull();
    }
  });
});

describe('seedBay idempotency', () => {
  it('inserts once and updates nothing on the second run', async () => {
    const { db } = await freshDb();
    const data = loadBaySeedDir(BAY_SEED_DIR, NOW);

    const first = await seedBay(db, data);
    expect(first.places).toEqual({ created: 30, updated: 0 });
    expect(first.events).toEqual({ created: 3, updated: 0 });
    expect(await db.$count(places)).toBe(30);
    expect(await db.$count(bayEvents)).toBe(3);

    const second = await seedBay(db, data);
    expect(second.places).toEqual({ created: 0, updated: 0 });
    expect(second.events).toEqual({ created: 0, updated: 0 });
    expect(await db.$count(places)).toBe(30);
    expect(await db.$count(bayEvents)).toBe(3);

    // the earliest sighting survives across runs — provenance is not rewritten
    const [bridge] = await db
      .select()
      .from(places)
      .where(eq(places.id, 'seed:golden-gate-bridge'));
    expect(bridge.firstSeenAt.toISOString()).toBe('2026-09-24T12:00:00.000Z');
  });
});
