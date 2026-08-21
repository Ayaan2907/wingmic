import { describe, expect, it } from 'vitest';
import { matchIcsEvent, parseIcsEvents } from '../parseIcs';

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
