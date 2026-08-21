import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCalendarIcs, matchIcsEvent, parseCalendarIcsUrl, parseIcsEvents } from '../parseIcs';

const ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:ETH Denver
DTSTART:20260227T150000Z
DTEND:20260301T220000Z
LOCATION:Denver
URL:https://www.ethdenver.com
END:VEVENT
BEGIN:VEVENT
SUMMARY:Office hours
DTSTART:20260820T180000Z
DTEND:20260820T190000Z
LOCATION:Zoom
END:VEVENT
END:VCALENDAR`;

describe('parseIcsEvents', () => {
  it('reads summary, dates, location, and url from vevents', () => {
    const events = parseIcsEvents(ICS);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      summary: 'ETH Denver',
      location: 'Denver',
      url: 'https://www.ethdenver.com',
    });
    expect(events[0]!.dateRangeStart?.toISOString().startsWith('2026-02-27')).toBe(true);
    expect(events[0]!.dateRangeEnd?.toISOString().startsWith('2026-03-01')).toBe(true);
  });

  it('honors TZID on local date-times', () => {
    const [event] = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Evening meetup
DTSTART;TZID=America/New_York:20260820T180000
DTEND;TZID=America/New_York:20260820T190000
END:VEVENT
END:VCALENDAR`);

    expect(event?.dateRangeStart?.toISOString()).toBe('2026-08-20T22:00:00.000Z');
    expect(event?.dateRangeEnd?.toISOString()).toBe('2026-08-20T23:00:00.000Z');
  });

  it('makes an all-day DTEND inclusive in the stored range', () => {
    const [event] = parseIcsEvents(`BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Two-day summit
DTSTART;VALUE=DATE:20260820
DTEND;VALUE=DATE:20260822
END:VEVENT
END:VCALENDAR`);

    expect(event?.dateRangeStart?.toISOString()).toBe('2026-08-20T00:00:00.000Z');
    expect(event?.dateRangeEnd?.toISOString()).toBe('2026-08-21T00:00:00.000Z');
  });
});

describe('parseCalendarIcsUrl', () => {
  const pub = 'https://calendar.google.com/calendar/ical/ada%40example.com/public/basic.ics';

  it('accepts a public google calendar ics feed', () => {
    expect(parseCalendarIcsUrl(pub)).toBe(pub);
  });

  it('rejects a secret private-token ics address', () => {
    expect(
      parseCalendarIcsUrl(
        'https://calendar.google.com/calendar/ical/ada%40example.com/private-abc/basic.ics',
      ),
    ).toBeNull();
  });

  it('rejects off-host, http, and credentialed urls', () => {
    expect(parseCalendarIcsUrl('https://example.com/calendar/ical/x/public/basic.ics')).toBeNull();
    expect(
      parseCalendarIcsUrl('http://calendar.google.com/calendar/ical/x/public/basic.ics'),
    ).toBeNull();
    expect(
      parseCalendarIcsUrl('https://evil@calendar.google.com/calendar/ical/x/public/basic.ics'),
    ).toBeNull();
    expect(parseCalendarIcsUrl(`${pub}?token=1`)).toBeNull();
    expect(parseCalendarIcsUrl(`${pub}#x`)).toBeNull();
    expect(
      parseCalendarIcsUrl('https://calendar.google.com.evil.com/calendar/ical/x/public/basic.ics'),
    ).toBeNull();
  });
});

describe('fetchCalendarIcs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not fetch a secret private-token address', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    await expect(
      fetchCalendarIcs(
        'https://calendar.google.com/calendar/ical/ada%40example.com/private-abc/basic.ics',
      ),
    ).resolves.toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('fetches only the reconstructed public url with redirects disabled', async () => {
    const spy = vi.fn(async () => new Response('BEGIN:VCALENDAR\nEND:VCALENDAR'));
    vi.stubGlobal('fetch', spy);
    const url = 'https://calendar.google.com/calendar/ical/ada%40example.com/public/basic.ics';
    await expect(fetchCalendarIcs(url)).resolves.toContain('BEGIN:VCALENDAR');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: 'error' }));
  });

  it('rejects an oversized Content-Length before reading the body', async () => {
    const getReader = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: new Headers({ 'content-length': String(512 * 1024 + 1) }),
        body: { getReader },
      })),
    );

    await expect(
      fetchCalendarIcs(
        'https://calendar.google.com/calendar/ical/ada%40example.com/public/basic.ics',
      ),
    ).resolves.toBeNull();
    expect(getReader).not.toHaveBeenCalled();
  });

  it('stops streaming once the response exceeds 512 KiB', async () => {
    const cancel = vi.fn(async () => undefined);
    const chunks = [new TextEncoder().encode('BEGIN:VCALENDAR\n'), new Uint8Array(512 * 1024)];
    const read = vi.fn(async () => {
      const value = chunks.shift();
      return value ? { done: false, value } : { done: true, value: undefined };
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: new Headers(),
        body: { getReader: () => ({ read, cancel }) },
      })),
    );

    await expect(
      fetchCalendarIcs(
        'https://calendar.google.com/calendar/ical/ada%40example.com/public/basic.ics',
      ),
    ).resolves.toBeNull();
    expect(cancel).toHaveBeenCalled();
  });
});

describe('matchIcsEvent', () => {
  it('matches by overlapping summary tokens', () => {
    const hit = matchIcsEvent('ETH Denver 2026', parseIcsEvents(ICS));
    expect(hit?.summary).toBe('ETH Denver');
    expect(hit?.url).toBe('https://www.ethdenver.com');
  });

  it('returns null when nothing overlaps', () => {
    expect(matchIcsEvent('RustConf', parseIcsEvents(ICS))).toBeNull();
  });

  it('matches exact Unicode and short tokens', () => {
    const [event] = parseIcsEvents(`BEGIN:VEVENT
SUMMARY:東京 AI
END:VEVENT`);

    expect(matchIcsEvent('東京 AI', [event!])?.summary).toBe('東京 AI');
  });

  it('returns null for a single-token fuzzy overlap', () => {
    const [event] = parseIcsEvents(`BEGIN:VEVENT
SUMMARY:Denver Summit
END:VEVENT`);

    expect(matchIcsEvent('Denver Meetup', [event!])).toBeNull();
  });

  it('returns null when the best score is tied', () => {
    const events = parseIcsEvents(`BEGIN:VEVENT
SUMMARY:ETH Denver Summit
END:VEVENT
BEGIN:VEVENT
SUMMARY:ETH Denver Meetup
END:VEVENT`);

    expect(matchIcsEvent('ETH Denver', events)).toBeNull();
  });

  it('returns null when an exact summary is repeated', () => {
    const events = parseIcsEvents(`BEGIN:VEVENT
SUMMARY:Office Hours
LOCATION:Room A
END:VEVENT
BEGIN:VEVENT
SUMMARY:Office Hours
LOCATION:Room B
END:VEVENT`);

    expect(matchIcsEvent('Office Hours', events)).toBeNull();
  });
});
