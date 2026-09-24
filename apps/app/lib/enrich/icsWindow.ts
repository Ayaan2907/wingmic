import type { ParsedIcsEvent } from './parseIcs';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type IcsEventWindow = { start: Date; end: Date };

/**
 * True occupancy [start, end) of a parsed ICS event, with RFC 5545 DTEND
 * conventions applied. Returns null for events without a usable start.
 *
 * - All-day: DTEND is exclusive and parseIcsEvents already normalized it to
 *   the inclusive last-day midnight, so matching shifts one day back out; a
 *   missing DTEND means the event occupies its single start day. The window
 *   is a UTC day — the parser reads timezone-less DATE values as UTC
 *   midnights, and the server has no user timezone to localize them with.
 * - Timed without DTEND: instantaneous (end == start).
 * - Timed with DTEND: the end instant as parsed (TZID already resolved).
 */
export function icsEventWindow(event: ParsedIcsEvent): IcsEventWindow | null {
  const start = event.dateRangeStart;
  if (!start) return null;
  if (event.allDay) {
    const lastDay = event.dateRangeEnd ?? start;
    return { start, end: new Date(lastDay.getTime() + DAY_MS) };
  }
  return { start, end: event.dateRangeEnd ?? start };
}

export type IcsWindowOptions = {
  /** Minutes past the scheduled end an event still counts as ongoing (overruns). */
  pastBufferMin?: number;
  /** Minutes before the scheduled start an event is surfaced as on-deck. */
  futureBufferMin?: number;
};

export type IcsWindowResult = {
  /** Events that have begun and sit within the past buffer: now ∈ [start, end + past]. */
  ongoing: ParsedIcsEvent[];
  /** Events that have not begun and start within the lookahead: now ∈ [start − future, start). */
  upcoming: ParsedIcsEvent[];
};

/**
 * Classify parsed calendar events against `now`. The two phases are
 * disjoint by construction — ongoing requires now >= start, upcoming
 * requires now < start — so an event never appears in both lists and the
 * merged candidate list needs no dedupe. Input order is preserved within
 * each phase.
 */
export function matchIcsWindow(
  events: ParsedIcsEvent[],
  now: Date,
  options: IcsWindowOptions = {},
): IcsWindowResult {
  const pastMs = (options.pastBufferMin ?? 0) * MINUTE_MS;
  const futureMs = (options.futureBufferMin ?? 0) * MINUTE_MS;
  const t = now.getTime();
  const ongoing: ParsedIcsEvent[] = [];
  const upcoming: ParsedIcsEvent[] = [];
  for (const event of events) {
    const window = icsEventWindow(event);
    if (!window) continue;
    const start = window.start.getTime();
    const end = window.end.getTime();
    if (t >= start && t <= end + pastMs) {
      ongoing.push(event);
    } else if (t < start && t >= start - futureMs) {
      upcoming.push(event);
    }
  }
  return { ongoing, upcoming };
}
