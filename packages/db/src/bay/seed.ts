// The bay seed: lifts ayaan-site's curated content into the merged store.
// Sources live under seed/bay/ (lifted verbatim):
//   places-geo.json — the 23-feature map GeoJSON (singular cats, [lng, lat] coords)
//   places.json     — the store's deduped seed (plural cats, lat/lng fields)
//   events.json     — the store's 3 seed events
// The singular→plural category fold happens ONCE, here, at the seed boundary
// (the spec's "normalize once at port" rule); rows land in the plural form the
// store speaks. Everything here is pure except loadBaySeedDir's file reads, so
// the tests can pin the contract with inline fixtures.
//
// Idempotency follows the ported mergeRecords contract: re-seeding lands on the
// same stable id, updates content in place, and the earliest firstSeenAt
// survives so provenance keeps its first sighting. Nothing is silently deleted.

import { inArray, sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DB } from '../client';
import { bayEvents, places, type NewBayEvent, type NewPlace } from '../schema';
import { BAY_EVENT_SOURCES } from '../schema';
import { canonicalCategory } from './categories';

// an event stays live this long past its last known moment — fresh the same
// night, gone the next morning (ported EVENT_GRACE_MS).
export const EVENT_GRACE_MS = 24 * 60 * 60 * 1000;

const TEXT_MAX = { title: 160, venue: 200, note: 500, id: 120 } as const;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,119}$/;

export type NormalizeResult<T> = { ok: true; value: T } | { ok: false; error: string };

const clampText = (value: string, max: number): string => String(value).trim().slice(0, max);

const isParseableDate = (value: string): boolean => Number.isFinite(Date.parse(value));

const toDate = (value: string): Date => new Date(Date.parse(value));

const isHttpUrl = (value: string): boolean => /^https:\/\//.test(value);

export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * A place's stable id is `seed:<slug>`. Bare slugs (the lifted GeoJSON's ids)
 * and already-prefixed ids (`seed:x`) both land on the same row, which is what
 * collapses the five places the two sources describe twice.
 */
export function placeIdFor(rawId: string): { id: string; slug: string } | null {
  const bare = rawId.startsWith('seed:') ? rawId.slice('seed:'.length) : rawId;
  const slug = slugify(bare);
  if (!slug) return null;
  return { id: `seed:${slug}`, slug };
}

/** externalId is the stable id minus its source prefix ("luma:abc" → "abc"). */
export function externalIdFor(id: string): string {
  const colon = id.indexOf(':');
  return colon === -1 ? id : id.slice(colon + 1);
}

/** When an event stops being live: the explicit expiry, else endsAt ‖ startsAt
 * + the 24h grace. Null when nothing is known — never guessed. */
export function bayExpiryAt(input: { endsAt?: Date | null; startsAt?: Date | null }): Date | null {
  const end = input.endsAt ?? input.startsAt;
  return end ? new Date(end.getTime() + EVENT_GRACE_MS) : null;
}

export interface BaySeedPlaceInput {
  id: string;
  name: string;
  note: string;
  category: string;
  lat: number;
  lng: number;
  /** Provenance kind ("seed" today) — not a url. */
  source?: string | null;
  fetchedAt?: string | null;
}

/** Validate and normalize one seed place against the ported contract: stable
 * id, mandatory first-person note, folded category, coordinate ranges. */
export function normalizeBayPlace(input: BaySeedPlaceInput, now = new Date()): NormalizeResult<NewPlace> {
  if (!ID_PATTERN.test(input.id)) return { ok: false, error: `id "${input.id}" is not a slug` };
  const ids = placeIdFor(input.id);
  if (!ids) return { ok: false, error: `id "${input.id}" slugifies to nothing` };
  const name = clampText(input.name, TEXT_MAX.title);
  if (!name) return { ok: false, error: `name is required (id "${input.id}")` };
  const note = clampText(input.note, TEXT_MAX.note);
  // never a bare pin: a place without its first-person note is a data bug
  if (!note) return { ok: false, error: `note is required (id "${input.id}")` };
  const category = canonicalCategory(input.category);
  if (!category) return { ok: false, error: `unknown category "${input.category}" (id "${input.id}")` };
  if (!Number.isFinite(input.lat) || Math.abs(input.lat) > 90) {
    return { ok: false, error: `lat out of range (id "${input.id}")` };
  }
  if (!Number.isFinite(input.lng) || Math.abs(input.lng) > 180) {
    return { ok: false, error: `lng out of range (id "${input.id}")` };
  }
  const fetchedAt = input.fetchedAt && isParseableDate(input.fetchedAt) ? toDate(input.fetchedAt) : now;
  return {
    ok: true,
    value: {
      id: ids.id,
      slug: ids.slug,
      name,
      note,
      category,
      lat: input.lat,
      lng: input.lng,
      source: input.source ?? null,
      embedding: null,
      fetchedAt,
      firstSeenAt: fetchedAt,
    },
  };
}

export interface BaySeedEventInput {
  id: string;
  title: string;
  category: string;
  source: string;
  url: string;
  externalId?: string | null;
  venue?: string | null;
  lat?: number | null;
  lng?: number | null;
  price?: string | null;
  note?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  expiresAt?: string | null;
  fetchedAt?: string | null;
}

/** Validate and normalize one seed event: https-only url, events need
 * startsAt, expiry computed at the boundary with the 24h grace. */
export function normalizeBayEvent(input: BaySeedEventInput, now = new Date()): NormalizeResult<NewBayEvent> {
  if (!ID_PATTERN.test(input.id)) return { ok: false, error: `id "${input.id}" is not a slug` };
  const title = clampText(input.title, TEXT_MAX.title);
  if (!title) return { ok: false, error: `title is required (id "${input.id}")` };
  const category = canonicalCategory(input.category);
  if (!category) return { ok: false, error: `unknown category "${input.category}" (id "${input.id}")` };
  if (!(BAY_EVENT_SOURCES as readonly string[]).includes(input.source)) {
    return { ok: false, error: `source must be one of ${BAY_EVENT_SOURCES.join('|')} (id "${input.id}")` };
  }
  if (!input.url) return { ok: false, error: `url is required (id "${input.id}")` };
  if (!isHttpUrl(input.url)) return { ok: false, error: `url must be https (id "${input.id}")` };
  if (input.venue && !clampText(input.venue, TEXT_MAX.venue)) {
    return { ok: false, error: `venue is blank (id "${input.id}")` };
  }
  for (const [key, value] of [['lat', input.lat], ['lng', input.lng]] as const) {
    if (value == null) continue;
    if (!Number.isFinite(value) || Math.abs(value) > (key === 'lat' ? 90 : 180)) {
      return { ok: false, error: `${key} out of range (id "${input.id}")` };
    }
  }
  if (!input.startsAt || !isParseableDate(input.startsAt)) {
    return { ok: false, error: `events need a parseable startsAt (id "${input.id}")` };
  }
  if (input.endsAt && !isParseableDate(input.endsAt)) {
    return { ok: false, error: `endsAt must be a parseable date (id "${input.id}")` };
  }
  const startsAt = toDate(input.startsAt);
  const endsAt = input.endsAt ? toDate(input.endsAt) : null;
  // an explicit expiry wins; otherwise the ported rule: endsAt ‖ startsAt + grace
  const expiresAt = input.expiresAt && isParseableDate(input.expiresAt)
    ? toDate(input.expiresAt)
    : bayExpiryAt({ endsAt, startsAt });
  const fetchedAt = input.fetchedAt && isParseableDate(input.fetchedAt) ? toDate(input.fetchedAt) : now;
  return {
    ok: true,
    value: {
      id: input.id,
      canonicalEventId: null,
      source: input.source as (typeof BAY_EVENT_SOURCES)[number],
      externalId: input.externalId ?? externalIdFor(input.id),
      title,
      venue: input.venue ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      price: input.price ?? null,
      category,
      url: input.url,
      note: input.note ? clampText(input.note, TEXT_MAX.note) : null,
      startsAt,
      endsAt,
      expiresAt,
      embedding: null,
      fetchedAt,
      firstSeenAt: fetchedAt,
    },
  };
}

function sameContent(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const va = a[key];
    const vb = b[key];
    if (va instanceof Date && vb instanceof Date) {
      if (va.getTime() !== vb.getTime()) return false;
      continue;
    }
    // a nullable F32_BLOB round-trips as [] — reads back as null
    const norm = (v: unknown) => (Array.isArray(v) && v.length === 0 ? null : v);
    if ((norm(va) ?? null) !== (norm(vb) ?? null)) return false;
  }
  return true;
}

export interface SeedMergeSummary {
  created: number;
  updated: number;
}

/**
 * Merge incoming rows over existing rows by stable id: update in place, never
 * duplicate, the earliest firstSeenAt survives. Sorted by id so the output —
 * and therefore what lands in the db — is deterministic across runs.
 */
export function mergeByStableId<T extends { id: string; firstSeenAt: Date }>(
  existing: readonly T[],
  incoming: readonly T[],
): { rows: T[]; summary: SeedMergeSummary } {
  const byId = new Map(existing.map((row) => [row.id, row]));
  let created = 0;
  let updated = 0;
  for (const row of incoming) {
    const prev = byId.get(row.id);
    if (!prev) {
      byId.set(row.id, row);
      created++;
      continue;
    }
    const firstSeenAt =
      row.firstSeenAt.getTime() < prev.firstSeenAt.getTime() ? row.firstSeenAt : prev.firstSeenAt;
    if (!sameContent(prev as unknown as Record<string, unknown>, row as unknown as Record<string, unknown>)) {
      updated++;
    }
    byId.set(row.id, { ...row, firstSeenAt });
  }
  const rows = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { rows, summary: { created, updated } };
}

export interface BaySeedData {
  places: NewPlace[];
  events: NewBayEvent[];
}

export interface SeedBayResult {
  places: SeedMergeSummary;
  events: SeedMergeSummary;
}

export async function seedBay(db: DB, data: BaySeedData): Promise<SeedBayResult> {
  return {
    places: await seedPlaces(db, data.places),
    events: await seedEvents(db, data.events),
  };
}

async function seedPlaces(db: DB, incoming: NewPlace[]): Promise<SeedMergeSummary> {
  // collapse same-id rows across the two source files before touching the db
  const deduped = mergeByStableId([], incoming).rows;
  if (deduped.length === 0) return { created: 0, updated: 0 };
  const existing = await db
    .select()
    .from(places)
    .where(inArray(places.id, deduped.map((row) => row.id)));
  const { rows, summary } = mergeByStableId(existing as NewPlace[], deduped);
  await db.insert(places).values(rows).onConflictDoUpdate({
    target: places.id,
    set: {
      slug: sql`excluded.slug`,
      name: sql`excluded.name`,
      note: sql`excluded.note`,
      category: sql`excluded.category`,
      lat: sql`excluded.lat`,
      lng: sql`excluded.lng`,
      source: sql`excluded.source`,
      // enrichment columns — the embedder owns these; a seed re-run never
      // nulls what another writer stored
      embedding: sql`coalesce(excluded.embedding, places.embedding)`,
      firstSeenAt: sql`excluded.first_seen_at`,
      fetchedAt: sql`excluded.fetched_at`,
    },
  });
  return summary;
}

async function seedEvents(db: DB, incoming: NewBayEvent[]): Promise<SeedMergeSummary> {
  const deduped = mergeByStableId([], incoming).rows;
  if (deduped.length === 0) return { created: 0, updated: 0 };
  const existing = await db
    .select()
    .from(bayEvents)
    .where(inArray(bayEvents.id, deduped.map((row) => row.id)));
  const { rows, summary } = mergeByStableId(existing as NewBayEvent[], deduped);
  await db.insert(bayEvents).values(rows).onConflictDoUpdate({
    target: bayEvents.id,
    set: {
      // canonicalEventId (promotion) and embedding (the embedder) are owned by
      // other writers — a re-ingest refreshes content, never blanks enrichment
      canonicalEventId: sql`coalesce(excluded.canonical_event_id, bay_events.canonical_event_id)`,
      source: sql`excluded.source`,
      externalId: sql`excluded.external_id`,
      title: sql`excluded.title`,
      venue: sql`excluded.venue`,
      lat: sql`excluded.lat`,
      lng: sql`excluded.lng`,
      price: sql`excluded.price`,
      category: sql`excluded.category`,
      url: sql`excluded.url`,
      note: sql`excluded.note`,
      startsAt: sql`excluded.starts_at`,
      endsAt: sql`excluded.ends_at`,
      expiresAt: sql`excluded.expires_at`,
      embedding: sql`coalesce(excluded.embedding, bay_events.embedding)`,
      firstSeenAt: sql`excluded.first_seen_at`,
      fetchedAt: sql`excluded.fetched_at`,
    },
  });
  return summary;
}

interface GeoPlaceFeature {
  geometry?: { coordinates?: number[] } | null;
  properties?: { id?: string; name?: string; cat?: string; note?: string; source?: string } | null;
}

interface SeedFilePlace {
  id: string;
  title: string;
  category: string;
  lat: number;
  lng: number;
  source?: string;
  fetchedAt?: string;
  note: string;
}

interface SeedFileEvent {
  id: string;
  title: string;
  category: string;
  source: string;
  venue?: string;
  lat?: number;
  lng?: number;
  sourceUrl?: string;
  startsAt: string;
  endsAt?: string;
  fetchedAt?: string;
  note?: string;
}

export class BaySeedError extends Error {
  constructor(readonly errors: readonly string[]) {
    super(`bay seed data rejected — ${errors.length} bad row(s):\n  ${errors.join('\n  ')}`);
  }
}

/**
 * Load and normalize the lifted seed files from a directory. GeoJSON features
 * come first so the store's deduped seed records merge over them where the
 * five places overlap. Any contract rejection fails the whole load — the seed
 * is curated data; a bad row is a repo bug worth surfacing, never a silent skip.
 */
export function loadBaySeedDir(dir: string, now = new Date()): BaySeedData {
  const errors: string[] = [];
  const placeRows: NewPlace[] = [];

  const geo = JSON.parse(readFileSync(join(dir, 'places-geo.json'), 'utf8')) as {
    features?: GeoPlaceFeature[];
  };
  for (const feature of geo.features ?? []) {
    const props = feature.properties ?? {};
    const coords = feature.geometry?.coordinates ?? [];
    // GeoJSON coordinates are [lng, lat]
    const result = normalizeBayPlace(
      {
        id: props.id ?? '',
        name: props.name ?? '',
        note: props.note ?? '',
        category: props.cat ?? '',
        lat: coords[1],
        lng: coords[0],
        source: 'seed',
      },
      now,
    );
    if (result.ok) placeRows.push(result.value);
    else errors.push(`places-geo.json: ${result.error}`);
  }

  const filePlaces = JSON.parse(readFileSync(join(dir, 'places.json'), 'utf8')) as SeedFilePlace[];
  for (const record of filePlaces) {
    const result = normalizeBayPlace(
      {
        id: record.id,
        name: record.title,
        note: record.note,
        category: record.category,
        lat: record.lat,
        lng: record.lng,
        source: record.source ?? 'seed',
        fetchedAt: record.fetchedAt ?? null,
      },
      now,
    );
    if (result.ok) placeRows.push(result.value);
    else errors.push(`places.json: ${result.error}`);
  }

  const eventRows: NewBayEvent[] = [];
  const fileEvents = JSON.parse(readFileSync(join(dir, 'events.json'), 'utf8')) as SeedFileEvent[];
  for (const record of fileEvents) {
    const result = normalizeBayEvent(
      {
        id: record.id,
        title: record.title,
        category: record.category,
        source: record.source,
        url: record.sourceUrl ?? '',
        venue: record.venue ?? null,
        lat: record.lat ?? null,
        lng: record.lng ?? null,
        startsAt: record.startsAt,
        endsAt: record.endsAt ?? null,
        fetchedAt: record.fetchedAt ?? null,
        note: record.note ?? null,
      },
      now,
    );
    if (result.ok) eventRows.push(result.value);
    else errors.push(`events.json: ${result.error}`);
  }

  if (errors.length > 0) throw new BaySeedError(errors);
  return { places: placeRows, events: eventRows };
}
