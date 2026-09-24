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

type RruleParts = {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  until: Date | null;
  count: number | null;
  byday: number[];
  /** Week-start day (getUTCDay code) for weekly parity; null = RFC default MO. */
  wkst: number | null;
};

const BYDAY_CODES: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };

/** Rule parts this parser understands — anything else degrades to the base occurrence. */
const KNOWN_RRULE_PARTS = new Set(['FREQ', 'INTERVAL', 'UNTIL', 'COUNT', 'BYDAY', 'WKST']);

/**
 * Parse the RRULE forms worth expanding for a hallway-time-window match:
 * FREQ=DAILY/WEEKLY/MONTHLY with INTERVAL, UNTIL, COUNT, weekly BYDAY and
 * WKST. Anything else (YEARLY, ordinal BYDAY like 2MO, BYSETPOS, BYMONTH,
 * …) returns null and the event stays a single base occurrence — honest
 * degradation over a half-correct expansion. WKST shifts weekly parity
 * (Google Calendar exports WKST=SU); silently dropping it would bind
 * biweekly rules on the wrong alternating weeks.
 */
function parseRrule(value: string): RruleParts | null {
  const parts: Record<string, string> = {};
  for (const piece of value.toUpperCase().split(';')) {
    const eq = piece.indexOf('=');
    if (eq > 0) {
      const key = piece.slice(0, eq);
      if (!KNOWN_RRULE_PARTS.has(key)) return null;
      parts[key] = piece.slice(eq + 1);
    }
  }
  const freq = parts.FREQ;
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY') return null;
  const intervalRaw = Number(parts.INTERVAL ?? '1');
  const interval = Number.isInteger(intervalRaw) && intervalRaw >= 1 ? intervalRaw : 1;
  let until: Date | null = null;
  if (parts.UNTIL) {
    const m = parts.UNTIL.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
    // DATE-form UNTIL means the whole final day; floating (Z-less) times are
    // read as UTC — same canonical-time posture as all-day windows.
    until = m
      ? new Date(
          Date.UTC(
            Number(m[1]),
            Number(m[2]) - 1,
            Number(m[3]),
            m[4] ? Number(m[4]) : 23,
            m[5] ? Number(m[5]) : 59,
            m[6] ? Number(m[6]) : 59,
          ),
        )
      : null;
  }
  const countRaw = parts.COUNT ? Number(parts.COUNT) : null;
  const count = countRaw !== null && Number.isInteger(countRaw) && countRaw >= 1 ? countRaw : null;
  const byday: number[] = [];
  if (parts.BYDAY) {
    // BYDAY only carries weekday semantics for WEEKLY; MONTHLY ordinal
    // forms (2MO) are deliberately unsupported.
    if (freq === 'MONTHLY') return null;
    for (const token of parts.BYDAY.split(',')) {
      const day = BYDAY_CODES[token.trim()];
      if (day === undefined) return null;
      byday.push(day);
    }
  }
  let wkst: number | null = null;
  if (parts.WKST) {
    wkst = BYDAY_CODES[parts.WKST] ?? null;
    if (wkst === null) return null;
  }
  return { freq, interval, until, count, byday, wkst };
}

/** Hard generation cap — absurdly old DTSTARTs degrade to the base occurrence. */
const MAX_RULE_ITERATIONS = 600;

/**
 * Concrete occurrences of a recurring event whose occupancy could intersect
 * [horizonStart, horizonEnd]. The base DTSTART occurrence is occurrence #1
 * (RFC 5545). Synthesized occurrences carry convention-applied concrete
 * instants: all-day duration already includes the exclusive-DTEND day, so
 * the synth shifts dateRangeEnd back out to keep icsEventWindow correct.
 * All recurrence math is UTC — the same canonical-time limitation as
 * all-day windows (the server has no user timezone).
 *
 * Returns the base occurrence unchanged when the generation cap is hit
 * mid-horizon (incomplete scan) — never a partial occurrence list.
 */
function expandOccurrences(
  event: ParsedIcsEvent,
  window: IcsEventWindow,
  horizonStartMs: number,
  horizonEndMs: number,
): ParsedIcsEvent[] {
  if (!event.rrule) return [event];
  const rule = parseRrule(event.rrule);
  if (!rule) return [event];

  const startMs = window.start.getTime();
  const durationMs = window.end.getTime() - startMs;
  const backshift = event.allDay ? DAY_MS : 0;
  const synth = (occStart: number): ParsedIcsEvent => ({
    ...event,
    dateRangeStart: new Date(occStart),
    dateRangeEnd: new Date(occStart + durationMs - backshift),
  });

  const untilMs = rule.until?.getTime() ?? null;
  const out: ParsedIcsEvent[] = [];
  const exdateSet = new Set(event.exdates);
  let emitted = 0; // rule occurrences seen so far, DTSTART's included
  let capHit = false;
  // Returns false once no further occurrence can matter.
  const consider = (occStartMs: number): boolean => {
    if (occStartMs < startMs) return true; // pre-DTSTART pad in BYDAY weeks
    emitted += 1;
    if (rule.count !== null && emitted > rule.count) return false;
    // EXDATE removes the instance after it consumed its COUNT slot (RFC
    // gathers rule + RDATEs, then subtracts EXDATEs) — exact-instant match
    // against the feed's canonicalized EXDATE values.
    if (exdateSet.has(occStartMs)) return true;
    if (untilMs !== null && occStartMs > untilMs) return false;
    if (occStartMs > horizonEndMs) return false;
    if (occStartMs + durationMs >= horizonStartMs) out.push(synth(occStartMs));
    return true;
  };

  if (rule.freq === 'DAILY' || (rule.freq === 'WEEKLY' && rule.byday.length === 0)) {
    const step = rule.interval * (rule.freq === 'WEEKLY' ? 7 : 1) * DAY_MS;
    // Jump straight to the first occurrence whose occupancy can reach the
    // horizon; earlier occurrences still count toward COUNT via the seed.
    const firstRelevant = Math.max(
      0,
      Math.ceil((horizonStartMs - durationMs - startMs) / step),
    );
    emitted = firstRelevant;
    let index = firstRelevant;
    while (index < firstRelevant + MAX_RULE_ITERATIONS) {
      if (!consider(startMs + index * step)) break;
      index += 1;
    }
    capHit = index >= firstRelevant + MAX_RULE_ITERATIONS;
  } else if (rule.freq === 'WEEKLY') {
    const anchorDow = rule.wkst ?? 1; // RFC default: weeks start Monday.
    const baseMidnight = Math.floor(startMs / DAY_MS) * DAY_MS;
    const timeOfDay = startMs - baseMidnight;
    const daysSinceAnchor = (new Date(startMs).getUTCDay() - anchorDow + 7) % 7;
    const anchor0 = baseMidnight - daysSinceAnchor * DAY_MS;
    const days = [...new Set(rule.byday)].sort((a, b) => a - b);
    // getUTCDay codes → offsets from the WKST-anchored week start.
    const anchorOffsets = days.map((day) => (day - anchorDow + 7) % 7);
    let week = 0;
    for (; week < MAX_RULE_ITERATIONS; week += 1) {
      const weekStart = anchor0 + week * rule.interval * 7 * DAY_MS;
      if (weekStart > horizonEndMs) break;
      let stopped = false;
      for (const offset of anchorOffsets) {
        if (!consider(weekStart + offset * DAY_MS + timeOfDay)) {
          stopped = true;
          break;
        }
      }
      if (stopped) break;
    }
    capHit = week >= MAX_RULE_ITERATIONS;
  } else {
    // MONTHLY (no BYDAY — parseRrule rejects that combination): same UTC
    // day-of-month and time; months lacking the day are skipped.
    const d0 = new Date(startMs);
    const dom = d0.getUTCDate();
    const timeOfDay = startMs - Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate());
    let monthIndex = 0;
    for (; monthIndex < MAX_RULE_ITERATIONS; monthIndex += 1) {
      const totalMonths = d0.getUTCMonth() + monthIndex * rule.interval;
      const year = d0.getUTCFullYear() + Math.floor(totalMonths / 12);
      const month = totalMonths % 12;
      const monthStart = Date.UTC(year, month, 1);
      if (monthStart > horizonEndMs) break;
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      if (dom <= daysInMonth) {
        if (!consider(Date.UTC(year, month, dom) + timeOfDay)) break;
      }
    }
    capHit = monthIndex >= MAX_RULE_ITERATIONS;
  }

  // RDATE adds concrete occurrences outside the rule (EXDATE never
  // excludes them); unsupported RDATE forms already degraded in
  // parseIcsEvents. Cap-hit degrades the whole event to its base
  // occurrence, so added instants share that fate by construction.
  for (const rdateMs of event.rdates) {
    if (rdateMs > horizonEndMs || rdateMs + durationMs < horizonStartMs) continue;
    out.push(synth(rdateMs));
  }

  return capHit ? [event] : out;
}

/**
 * Classify parsed calendar events against `now`. Recurring events expand
 * into concrete occurrences first (bounded — see expandOccurrences). The
 * two phases are disjoint by construction — ongoing requires now >= start,
 * upcoming requires now < start — so an event never appears in both lists
 * and the merged candidate list needs no dedupe. Input order is preserved
 * within each phase.
 */
export function matchIcsWindow(
  events: ParsedIcsEvent[],
  now: Date,
  options: IcsWindowOptions = {},
): IcsWindowResult {
  const pastMs = (options.pastBufferMin ?? 0) * MINUTE_MS;
  const futureMs = (options.futureBufferMin ?? 0) * MINUTE_MS;
  const t = now.getTime();
  // Margin for occurrences that started before the horizon but still
  // overlap it (e.g. week-long recurring blocks).
  const horizonStartMs = t - pastMs - 7 * DAY_MS;
  const horizonEndMs = t + futureMs;
  const ongoing: ParsedIcsEvent[] = [];
  const upcoming: ParsedIcsEvent[] = [];
  for (const event of events) {
    const window = icsEventWindow(event);
    if (!window) continue;
    for (const occurrence of expandOccurrences(event, window, horizonStartMs, horizonEndMs)) {
      const occWindow = icsEventWindow(occurrence);
      if (!occWindow) continue;
      const start = occWindow.start.getTime();
      const end = occWindow.end.getTime();
      if (t >= start && t <= end + pastMs) {
        ongoing.push(occurrence);
      } else if (t < start && t >= start - futureMs) {
        upcoming.push(occurrence);
      }
    }
  }
  return { ongoing, upcoming };
}
