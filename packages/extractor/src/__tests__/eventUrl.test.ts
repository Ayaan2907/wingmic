import { describe, expect, it } from 'vitest';
import {
  applyHarvestedEvent,
  harvestEventFromTranscript,
  isEventUrlDebrisTopic,
  parseEventExternal,
} from '../eventUrl';

describe('parseEventExternal', () => {
  it('reads lu.ma, partiful, and google calendar event urls', () => {
    expect(parseEventExternal('https://lu.ma/abc123')).toEqual({
      source: 'luma',
      id: 'abc123',
    });
    expect(parseEventExternal('https://partiful.com/e/xyz')).toEqual({
      source: 'partiful',
      id: 'xyz',
    });
    expect(
      parseEventExternal('https://calendar.google.com/calendar/event?eid=YWJjMTIz'),
    ).toEqual({
      source: 'web',
      id: 'gcal:YWJjMTIz',
    });
    expect(parseEventExternal('https://www.ethdenver.com')).toBeNull();
  });
});

describe('harvestEventFromTranscript', () => {
  it('returns the luma url and a name from the slug', () => {
    const harvested = harvestEventFromTranscript(
      'https://lu.ma/ethdenver she is speaking tomorrow',
    );
    expect(harvested).toEqual({
      source: 'luma',
      id: 'ethdenver',
      url: 'https://lu.ma/ethdenver',
      name: 'ethdenver',
    });
  });

  it('returns null when no event url is present', () => {
    expect(harvestEventFromTranscript('met grace at the navy booth')).toBeNull();
  });
});

describe('applyHarvestedEvent', () => {
  it('injects a luma event when none were extracted', () => {
    const next = applyHarvestedEvent(
      {
        persons: [],
        companies: [],
        events: [],
        topics: ['https', 'luma', 'ethdenver'],
        actions: [],
      },
      'https://lu.ma/ethdenver',
    );
    expect(next.events).toEqual([
      { name: 'ethdenver', dateHint: null, location: null, url: 'https://lu.ma/ethdenver' },
    ]);
    expect(next.topics).toEqual([]);
  });

  it('stamps the url onto the first extracted event', () => {
    const next = applyHarvestedEvent(
      {
        persons: [],
        companies: [],
        events: [{ name: 'ETH Denver', dateHint: null, location: null }],
        topics: [],
        actions: [],
      },
      'tickets https://lu.ma/ethdenver',
    );
    expect(next.events[0]).toMatchObject({
      name: 'ETH Denver',
      url: 'https://lu.ma/ethdenver',
    });
  });
});

describe('isEventUrlDebrisTopic', () => {
  it('drops host and slug tokens', () => {
    const harvested = harvestEventFromTranscript('https://lu.ma/ethdenver')!;
    expect(isEventUrlDebrisTopic('https', harvested)).toBe(true);
    expect(isEventUrlDebrisTopic('luma', harvested)).toBe(true);
    expect(isEventUrlDebrisTopic('ethdenver', harvested)).toBe(true);
    expect(isEventUrlDebrisTopic('rust', harvested)).toBe(false);
  });
});
