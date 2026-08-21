import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCalendarIcs,
  matchIcsEvent,
  parseCalendarIcsUrl,
  parseIcsEvents,
} from '../parseIcs';

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
});

describe('parseCalendarIcsUrl', () => {
  const pub =
    'https://calendar.google.com/calendar/ical/ada%40example.com/public/basic.ics';

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
    expect(parseCalendarIcsUrl('http://calendar.google.com/calendar/ical/x/public/basic.ics')).toBeNull();
    expect(
      parseCalendarIcsUrl(
        'https://evil@calendar.google.com/calendar/ical/x/public/basic.ics',
      ),
    ).toBeNull();
    expect(
      parseCalendarIcsUrl(`${pub}?token=1`),
    ).toBeNull();
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
    const body = new TextEncoder().encode('BEGIN:VCALENDAR\nEND:VCALENDAR');
    const spy = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => body.buffer,
    }));
    vi.stubGlobal('fetch', spy);
    const url =
      'https://calendar.google.com/calendar/ical/ada%40example.com/public/basic.ics';
    await expect(fetchCalendarIcs(url)).resolves.toContain('BEGIN:VCALENDAR');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ redirect: 'error' }),
    );
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
});
