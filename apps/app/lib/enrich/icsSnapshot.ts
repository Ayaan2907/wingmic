import { eq } from 'drizzle-orm';
import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import { fetchCalendarIcs, parseIcsEvents, type ParsedIcsEvent } from './parseIcs';

export const ICS_SNAPSHOT_TTL_MS = 10 * 60_000;

type CacheEntry = { url: string; events: ParsedIcsEvent[]; fetchedAt: number };

/**
 * Per-user in-memory snapshot — the first of the two fallback layers. Keyed
 * by user id and invalidated by a changed calendar URL so a settings edit
 * never serves the previous calendar's events.
 */
const cache = new Map<string, CacheEntry>();

/** Test-only visibility into retention (see cacheSet). */
export function __icsSnapshotCacheSizeForTests(): number {
  return cache.size;
}

/** Test-only: the module cache outlives individual test databases. */
export function __resetIcsSnapshotCacheForTests(): void {
  cache.clear();
}

/**
 * Retention, not just freshness: an entry past the TTL is dead weight (its
 * next read refetches anyway), so it is evicted here. Without the sweep a
 * user who set an ICS URL once and churned pins their parsed feed in
 * memory for the process lifetime.
 */
function cacheSet(userId: string, entry: CacheEntry): void {
  const now = Date.now();
  for (const [id, cached] of cache) {
    if (now - cached.fetchedAt >= ICS_SNAPSHOT_TTL_MS) cache.delete(id);
  }
  cache.set(userId, entry);
}

export function serializeIcsEvents(events: ParsedIcsEvent[]): schema.IcsSnapshotEvent[] {
  return events.map((event) => ({
    summary: event.summary,
    location: event.location,
    url: event.url,
    dateRangeStart: event.dateRangeStart?.toISOString() ?? null,
    dateRangeEnd: event.dateRangeEnd?.toISOString() ?? null,
    allDay: event.allDay,
  }));
}

export function deserializeIcsEvents(payload: schema.IcsSnapshotEvent[]): ParsedIcsEvent[] {
  return payload.map((event) => ({
    summary: event.summary,
    location: event.location,
    url: event.url,
    dateRangeStart: event.dateRangeStart ? new Date(event.dateRangeStart) : null,
    dateRangeEnd: event.dateRangeEnd ? new Date(event.dateRangeEnd) : null,
    allDay: event.allDay,
    // The fallback payload predates recurrence support and doesn't persist
    // RRULE/EXDATE/RDATE — fallback rows match on their base occurrence only.
    rrule: null,
    exdates: [],
    rdates: [],
  }));
}

async function writeFallbackRow(
  db: DB,
  userId: string,
  events: ParsedIcsEvent[],
): Promise<void> {
  const payload = serializeIcsEvents(events);
  const fetchedAt = new Date();
  await db
    .insert(schema.icsSnapshots)
    .values({ ownerUserId: userId, payload, fetchedAt })
    .onConflictDoUpdate({
      target: schema.icsSnapshots.ownerUserId,
      set: { payload, fetchedAt },
    });
}

/**
 * The user's parsed calendar events, in three layers: an in-memory cache
 * (10-minute TTL, per user + url), a live fetch of their ICS feed, and a DB
 * row holding the last-good fetch for when the feed is unreachable — flaky
 * venue wifi is exactly when event binding matters. Window matching against
 * `now` naturally filters stale fallback rows, so no separate staleness
 * check is needed. No URL set → no snapshot.
 */
export async function getIcsSnapshot(
  db: DB,
  userId: string,
  calendarIcsUrl: string | null | undefined,
): Promise<ParsedIcsEvent[]> {
  if (!calendarIcsUrl) return [];

  const cached = cache.get(userId);
  if (
    cached &&
    cached.url === calendarIcsUrl &&
    Date.now() - cached.fetchedAt < ICS_SNAPSHOT_TTL_MS
  ) {
    return cached.events;
  }

  const text = await fetchCalendarIcs(calendarIcsUrl);
  if (text) {
    const events = parseIcsEvents(text);
    cacheSet(userId, { url: calendarIcsUrl, events, fetchedAt: Date.now() });
    // The fallback row is an availability net, not a correctness record —
    // a failed write degrades to memory-only caching, so warn and continue.
    try {
      await writeFallbackRow(db, userId, events);
    } catch (err) {
      console.warn('[icsSnapshot] fallback row write failed:', err);
    }
    return events;
  }

  const row = await db.query.icsSnapshots.findFirst({
    where: eq(schema.icsSnapshots.ownerUserId, userId),
  });
  const events = row ? deserializeIcsEvents(row.payload) : [];
  // Cache the fallback too, so a failing feed is not re-fetched on every
  // request; the TTL bounds how long until the live fetch is retried.
  cacheSet(userId, { url: calendarIcsUrl, events, fetchedAt: Date.now() });
  return events;
}
