import { describe, expect, it } from 'vitest';
import { icsEventWindow, matchIcsWindow } from '../icsWindow';
import { parseIcsEvents, type ParsedIcsEvent } from '../parseIcs';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function ics(overrides: Partial<ParsedIcsEvent> = {}): ParsedIcsEvent {
  return {
    summary: 'NEXA Summit',
    location: null,
    url: null,
    dateRangeStart: null,
    dateRangeEnd: null,
    allDay: false,
    ...overrides,
  };
}

// A 17:00–18:00Z event on Sep 24 2026.
const START = Date.UTC(2026, 8, 24, 17, 0, 0);
const END = START + HOUR;

describe('icsEventWindow', () => {
  it('passes timed start/end through as-is', () => {
    const window = icsEventWindow(
      ics({ dateRangeStart: new Date(START), dateRangeEnd: new Date(END) }),
    );
    expect(window).toEqual({ start: new Date(START), end: new Date(END) });
  });

  it('treats a timed event without DTEND as instantaneous', () => {
    const window = icsEventWindow(ics({ dateRangeStart: new Date(START) }));
    expect(window).toEqual({ start: new Date(START), end: new Date(START) });
  });

  it('extends an all-day event back out to the exclusive end', () => {
    // parseIcsEvents normalizes all-day DTEND to the inclusive last-day
    // midnight — here a single-day event reads start == end.
    const dayStart = Date.UTC(2026, 8, 24);
    const window = icsEventWindow(
      ics({ dateRangeStart: new Date(dayStart), dateRangeEnd: new Date(dayStart), allDay: true }),
    );
    expect(window).toEqual({ start: new Date(dayStart), end: new Date(dayStart + DAY) });
  });

  it('spans a multi-day all-day event to midnight after the last day', () => {
    const dayStart = Date.UTC(2026, 8, 24);
    const lastDay = Date.UTC(2026, 8, 26); // inclusive last-day midnight
    const window = icsEventWindow(
      ics({ dateRangeStart: new Date(dayStart), dateRangeEnd: new Date(lastDay), allDay: true }),
    );
    expect(window).toEqual({ start: new Date(dayStart), end: new Date(lastDay + DAY) });
  });

  it('treats an all-day event without DTEND as its single start day', () => {
    const dayStart = Date.UTC(2026, 8, 24);
    const window = icsEventWindow(ics({ dateRangeStart: new Date(dayStart), allDay: true }));
    expect(window).toEqual({ start: new Date(dayStart), end: new Date(dayStart + DAY) });
  });

  it('returns null when the event has no start', () => {
    expect(icsEventWindow(ics())).toBeNull();
  });
});

describe('matchIcsWindow — ongoing', () => {
  const event = ics({ dateRangeStart: new Date(START), dateRangeEnd: new Date(END) });
  const opts = { pastBufferMin: 15 };

  it('matches at the exact start instant', () => {
    const { ongoing } = matchIcsWindow([event], new Date(START), opts);
    expect(ongoing).toHaveLength(1);
  });

  it('matches mid-event', () => {
    const { ongoing } = matchIcsWindow([event], new Date(START + 30 * MIN), opts);
    expect(ongoing).toHaveLength(1);
  });

  it('matches at the exact end instant', () => {
    const { ongoing } = matchIcsWindow([event], new Date(END), opts);
    expect(ongoing).toHaveLength(1);
  });

  it('matches at the past-buffer boundary (end + 15 min, inclusive)', () => {
    const { ongoing } = matchIcsWindow([event], new Date(END + 15 * MIN), opts);
    expect(ongoing).toHaveLength(1);
  });

  it('does not match one millisecond past the past buffer', () => {
    const { ongoing, upcoming } = matchIcsWindow([event], new Date(END + 15 * MIN + 1), opts);
    expect(ongoing).toHaveLength(0);
    expect(upcoming).toHaveLength(0);
  });

  it('never matches an event that has not started when no future buffer is set', () => {
    const { ongoing, upcoming } = matchIcsWindow([event], new Date(START - 1), opts);
    expect(ongoing).toHaveLength(0);
    expect(upcoming).toHaveLength(0);
  });
});

describe('matchIcsWindow — upcoming', () => {
  const event = ics({ dateRangeStart: new Date(START), dateRangeEnd: new Date(END) });
  const opts = { futureBufferMin: 90 };

  it('matches at the future-buffer boundary (start − 90 min, inclusive)', () => {
    const { upcoming } = matchIcsWindow([event], new Date(START - 90 * MIN), opts);
    expect(upcoming).toHaveLength(1);
  });

  it('does not match one millisecond past the future buffer', () => {
    const { ongoing, upcoming } = matchIcsWindow([event], new Date(START - 90 * MIN - 1), opts);
    expect(ongoing).toHaveLength(0);
    expect(upcoming).toHaveLength(0);
  });

  it('matches one millisecond before the start', () => {
    const { ongoing, upcoming } = matchIcsWindow([event], new Date(START - 1), opts);
    expect(ongoing).toHaveLength(0);
    expect(upcoming).toHaveLength(1);
  });

  it('keeps an ongoing event out of the upcoming list — phases stay disjoint', () => {
    const result = matchIcsWindow([event], new Date(START + 10 * MIN), {
      pastBufferMin: 15,
      futureBufferMin: 90,
    });
    expect(result.ongoing).toHaveLength(1);
    expect(result.upcoming).toHaveLength(0);
  });
});

describe('matchIcsWindow — ambiguous and none', () => {
  it('returns both overlapping ongoing matches in input order', () => {
    const first = ics({
      summary: 'Morning talk',
      dateRangeStart: new Date(START),
      dateRangeEnd: new Date(END),
    });
    const second = ics({
      summary: 'Hallway sessions',
      dateRangeStart: new Date(START + 30 * MIN),
      dateRangeEnd: new Date(END + HOUR),
    });
    const result = matchIcsWindow([first, second], new Date(START + 45 * MIN), {
      pastBufferMin: 15,
      futureBufferMin: 90,
    });
    expect(result.ongoing.map((e) => e.summary)).toEqual(['Morning talk', 'Hallway sessions']);
  });

  it('merges ongoing and upcoming into their own lists without overlap', () => {
    const ongoing = ics({
      summary: 'Happening now',
      dateRangeStart: new Date(START),
      dateRangeEnd: new Date(END),
    });
    const onDeck = ics({
      summary: 'Next up',
      dateRangeStart: new Date(END + 30 * MIN),
      dateRangeEnd: new Date(END + 90 * MIN),
    });
    const result = matchIcsWindow([ongoing, onDeck], new Date(START + 10 * MIN), {
      pastBufferMin: 15,
      futureBufferMin: 90,
    });
    expect(result.ongoing.map((e) => e.summary)).toEqual(['Happening now']);
    expect(result.upcoming.map((e) => e.summary)).toEqual(['Next up']);
  });

  it('returns empty lists for no events', () => {
    expect(matchIcsWindow([], new Date(), { pastBufferMin: 15, futureBufferMin: 90 })).toEqual({
      ongoing: [],
      upcoming: [],
    });
  });

  it('skips events without a start', () => {
    const result = matchIcsWindow([ics()], new Date(START), {
      pastBufferMin: 15,
      futureBufferMin: 90,
    });
    expect(result.ongoing).toHaveLength(0);
    expect(result.upcoming).toHaveLength(0);
  });

  it('ignores long-past and far-future events', () => {
    const past = ics({ dateRangeStart: new Date(START - 2 * DAY), dateRangeEnd: new Date(END - 2 * DAY) });
    const farFuture = ics({ dateRangeStart: new Date(START + 5 * DAY), dateRangeEnd: new Date(END + 5 * DAY) });
    const result = matchIcsWindow([past, farFuture], new Date(START), {
      pastBufferMin: 15,
      futureBufferMin: 90,
    });
    expect(result.ongoing).toHaveLength(0);
    expect(result.upcoming).toHaveLength(0);
  });
});

describe('matchIcsWindow — parsed ICS feeds', () => {
  it('classifies timezone-bearing DTSTART after the parser resolves it to UTC', () => {
    // 18:00–19:00 America/New_York on Aug 20 2026 = 22:00–23:00Z (EDT).
    const feed = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Evening meetup
DTSTART;TZID=America/New_York:20260820T180000
DTEND;TZID=America/New_York:20260820T190000
END:VEVENT
END:VCALENDAR`);
    const opts = { pastBufferMin: 15, futureBufferMin: 90 };

    const during = matchIcsWindow(feed, new Date(Date.UTC(2026, 7, 20, 22, 30)), opts);
    expect(during.ongoing.map((e) => e.summary)).toEqual(['Evening meetup']);

    const justBefore = matchIcsWindow(feed, new Date(Date.UTC(2026, 7, 20, 21, 59)), opts);
    expect(justBefore.ongoing).toHaveLength(0);
    expect(justBefore.upcoming.map((e) => e.summary)).toEqual(['Evening meetup']);
  });

  it('matches an all-day event across its whole UTC day', () => {
    const feed = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:NEXA Summit
DTSTART;VALUE=DATE:20260924
DTEND;VALUE=DATE:20260925
END:VEVENT
END:VCALENDAR`);
    expect(feed[0]!.allDay).toBe(true);
    const opts = { pastBufferMin: 15, futureBufferMin: 90 };

    const morning = matchIcsWindow(feed, new Date(Date.UTC(2026, 8, 24, 12)), opts);
    expect(morning.ongoing.map((e) => e.summary)).toEqual(['NEXA Summit']);

    // Midnight plus the 15-min past buffer is still the overrun window;
    // one millisecond past it, the day is over.
    const afterBuffer = matchIcsWindow(feed, new Date(Date.UTC(2026, 8, 25, 0, 15, 0, 1)), opts);
    expect(afterBuffer.ongoing).toHaveLength(0);
  });

  it('matches a multi-day all-day event through its last day', () => {
    const feed = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:ETH Denver
DTSTART;VALUE=DATE:20260924
DTEND;VALUE=DATE:20260926
END:VEVENT
END:VCALENDAR`);
    // Sep 24–25 (DTEND exclusive). 23:59Z on the 25th is still inside.
    const lastMoment = matchIcsWindow(feed, new Date(Date.UTC(2026, 8, 25, 23, 59)), {
      pastBufferMin: 15,
      futureBufferMin: 90,
    });
    expect(lastMoment.ongoing.map((e) => e.summary)).toEqual(['ETH Denver']);
  });
});
