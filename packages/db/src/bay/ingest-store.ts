// packages/db/src/bay/ingest-store.ts
// the db side of the ingest job: core source records → bay rows through the
// SAME normalize → merge path the seed uses (one write path, one conflict
// policy — seedBay owns the upsert and never blanks another writer's columns).
// idempotent by construction: stable ids land on the same row, content updates
// in place, the earliest firstSeenAt survives (the db row's wins over a fresh
// run's stamp via mergeByStableId), expired rows are retained — nothing is
// silently deleted.

import type { BayRecord } from '@wingmic/bay';
import type { DB } from '../client';
import {
  normalizeBayEvent,
  normalizeBayPlace,
  seedBay,
  type BaySeedEventInput,
  type BaySeedPlaceInput,
} from './seed';
import type { NewBayEvent, NewPlace } from '../schema';

export interface BayApplySummary {
  events: { created: number; updated: number };
  places: { created: number; updated: number };
  /** Per-record rejections — surfaced to the summary line, never swallowed. */
  rejected: string[];
}

type Mapped<T> = { ok: true; input: T } | { ok: false; error: string };

/** core BayRecord (event) → the seed boundary's event input. The db requires a
 * url on bay_events; the core keeps whatever key the source spoke (url or
 * sourceUrl — the seed rows say sourceUrl), so accept either. A record with
 * neither is a rejection, not a null column. */
export function bayEventInputFor(record: BayRecord): Mapped<BaySeedEventInput> {
  if (record.type !== 'event') return { ok: false, error: `record "${record.id}" is not an event` };
  const url = record.url ?? record.sourceUrl;
  if (!url) return { ok: false, error: `event "${record.id}" has no url to store` };
  return {
    ok: true,
    input: {
      id: record.id,
      title: record.title,
      category: record.category,
      source: record.source,
      url,
      venue: record.venue ?? null,
      lat: record.lat ?? null,
      lng: record.lng ?? null,
      note: record.note ?? null,
      startsAt: record.startsAt ?? null,
      endsAt: record.endsAt ?? null,
      expiresAt: record.expiresAt ?? null,
      fetchedAt: record.fetchedAt,
    },
  };
}

/** core BayRecord (place) → the seed boundary's place input: mandatory
 * first-person note (never a bare pin) and coordinates (the db columns are
 * NOT NULL). */
export function bayPlaceInputFor(record: BayRecord): Mapped<BaySeedPlaceInput> {
  if (record.type !== 'place') return { ok: false, error: `record "${record.id}" is not a place` };
  if (!record.note) return { ok: false, error: `place "${record.id}" has no note — never a bare pin` };
  if (record.lat == null || record.lng == null) {
    return { ok: false, error: `place "${record.id}" needs lat/lng` };
  }
  return {
    ok: true,
    input: {
      id: record.id,
      name: record.title,
      note: record.note,
      category: record.category,
      lat: record.lat,
      lng: record.lng,
      source: record.source,
      fetchedAt: record.fetchedAt,
    },
  };
}

/** Apply one run's records: map, re-validate at the row boundary, merge into
 * the bay tables. Rejections are collected — one bad record never blocks the
 * rest of the run. */
export async function applyBayRecords(db: DB, records: readonly BayRecord[]): Promise<BayApplySummary> {
  const rejected: string[] = [];
  const placeRows: NewPlace[] = [];
  const eventRows: NewBayEvent[] = [];
  for (const record of records) {
    if (record.type === 'place') {
      const mapped = bayPlaceInputFor(record);
      if (!mapped.ok) {
        rejected.push(mapped.error);
        continue;
      }
      const normalized = normalizeBayPlace(mapped.input);
      if (!normalized.ok) {
        rejected.push(`${record.id}: ${normalized.error}`);
        continue;
      }
      placeRows.push(normalized.value);
    } else {
      const mapped = bayEventInputFor(record);
      if (!mapped.ok) {
        rejected.push(mapped.error);
        continue;
      }
      const normalized = normalizeBayEvent(mapped.input);
      if (!normalized.ok) {
        rejected.push(`${record.id}: ${normalized.error}`);
        continue;
      }
      eventRows.push(normalized.value);
    }
  }
  const result = await seedBay(db, { places: placeRows, events: eventRows });
  return { events: result.events, places: result.places, rejected };
}
