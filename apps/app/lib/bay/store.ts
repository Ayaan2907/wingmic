import { inArray } from 'drizzle-orm';
import type { BayCategory, BayRecord, BaySource } from '@wingmic/bay';
import { BAY_CATEGORIES, liveFilter } from '@wingmic/bay';
import * as schema from '@wingmic/db/schema';
import type { TRPCContext } from '@/lib/trpc/context';

type Db = TRPCContext['db'];

/**
 * The db read side of the bay contract. Rows map to the pure core's BayRecord,
 * validated at the boundary — the old flat-file store's read discipline: rows
 * that fail the contract surface as readErrors, never silently swallowed.
 *
 * liveFilter stays the only expiry rule (events die at endsAt || startsAt + 24h
 * grace; places only when they carry an explicit expiresAt). Loads return the
 * unfiltered set so the score pipeline can answer 410 for a known-but-over
 * event; reads apply liveOf at serve time.
 */

export type PlaceRecord = BayRecord & { type: 'place' };
export type EventRecord = BayRecord & { type: 'event'; price?: string };

export interface BayRawLoad {
  places: PlaceRecord[];
  events: EventRecord[];
  /** boundary rejections and field omissions, with reasons — surfaced, never swallowed */
  readErrors: string[];
  asOf: string;
}

/** Serve-time expiry through the contract's rule — the one expiry home. */
export function liveOf(
  records: BayRecord[],
  now: number,
): { live: BayRecord[]; expired: number } {
  const { live, expiredCount } = liveFilter(records, now);
  return { live, expired: expiredCount };
}

const isHttps = (v: string | null | undefined): v is string =>
  typeof v === 'string' && /^https:\/\//.test(v);
const coordOk = (v: number | null, max: number): boolean =>
  v == null || (Number.isFinite(v) && Math.abs(v) <= max);

function validCategory(
  category: string,
  id: string,
  readErrors: string[],
): category is BayCategory {
  if ((BAY_CATEGORIES as readonly string[]).includes(category)) return true;
  readErrors.push(`${id}: category "${category}" is not a bay layer — row excluded`);
  return false;
}

function placeToRecord(
  row: typeof schema.places.$inferSelect,
  readErrors: string[],
): PlaceRecord | null {
  if (!validCategory(row.category, row.id, readErrors)) return null;
  // the places.source column is a provenance LINK (the old geojson's `source?`
  // property), not the ingest enum — it maps to sourceUrl. ingest provenance
  // for the curated seed is 'seed', which the id prefix already says.
  let sourceUrl: string | undefined;
  if (row.source) {
    if (isHttps(row.source)) sourceUrl = row.source;
    else readErrors.push(`${row.id}: non-https source link omitted`);
  }
  return {
    id: row.id,
    type: 'place',
    category: row.category,
    title: row.name,
    source: 'seed',
    note: row.note,
    sourceUrl,
    lat: row.lat,
    lng: row.lng,
    fetchedAt: row.fetchedAt.toISOString(),
    firstSeenAt: row.firstSeenAt.toISOString(),
  };
}

function eventToRecord(
  row: typeof schema.bayEvents.$inferSelect,
  readErrors: string[],
): EventRecord | null {
  if (!validCategory(row.category, row.id, readErrors)) return null;
  if (!row.startsAt) {
    readErrors.push(`${row.id}: live event has no startsAt — row excluded`);
    return null;
  }
  if (!isHttps(row.url)) {
    readErrors.push(`${row.id}: url must be https — row excluded`);
    return null;
  }
  if (!coordOk(row.lat, 90) || !coordOk(row.lng, 180)) {
    readErrors.push(`${row.id}: coordinates out of range — row excluded`);
    return null;
  }
  return {
    id: row.id,
    type: 'event',
    category: row.category,
    title: row.title,
    // the db enum is wider than the core's launch set (migration 0015 added
    // meetup|ics|submitted|web) — the value is kept verbatim
    source: row.source as BaySource,
    venue: row.venue ?? undefined,
    note: row.note ?? undefined,
    url: row.url,
    sourceUrl: undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString(),
    expiresAt: row.expiresAt?.toISOString(),
    fetchedAt: row.fetchedAt.toISOString(),
    firstSeenAt: row.firstSeenAt.toISOString(),
    price: row.price ?? undefined,
  };
}

/** One load, both tables; place categories pre-filtered for the places read. */
export async function loadBayRecords(
  db: Db,
  opts: { placeCategories?: string[]; now?: number } = {},
): Promise<BayRawLoad> {
  const readErrors: string[] = [];
  const [placeRows, eventRows] = await Promise.all([
    db.query.places.findMany({
      where: opts.placeCategories?.length
        ? inArray(schema.places.category, opts.placeCategories)
        : undefined,
    }),
    db.query.bayEvents.findMany(),
  ]);
  const places = placeRows
    .map((row) => placeToRecord(row, readErrors))
    .filter((r): r is PlaceRecord => r !== null);
  const events = eventRows
    .map((row) => eventToRecord(row, readErrors))
    .filter((r): r is EventRecord => r !== null);
  return { places, events, readErrors, asOf: new Date(opts.now ?? Date.now()).toISOString() };
}
