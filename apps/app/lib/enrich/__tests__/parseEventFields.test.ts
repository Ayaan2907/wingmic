import { describe, it, expect } from 'vitest';
import { parseEventFields } from '../parseEventFields';

describe('parseEventFields', () => {
  it('prefers the snippet platform link over an article url that only mentions it', () => {
    const parsed = parseEventFields([
      {
        title: 'ETH Denver side events roundup',
        url: 'https://blog.example.com/ethdenver-side-events',
        snippet: 'rsvp for the rooftop mixer at https://lu.ma/rooftop-mixer, doors at 7.',
      },
    ]);
    expect(parsed.external).toEqual({ source: 'luma', id: 'rooftop-mixer' });
    expect(parsed.url).toBe('https://lu.ma/rooftop-mixer');
  });

  it('fills official url, location, and date range from public hits', () => {
    const parsed = parseEventFields([
      {
        title: 'ETH Denver 2026',
        url: 'https://www.ethdenver.com',
        snippet: 'Feb 27 – Mar 1, 2026 · Denver',
      },
    ]);
    expect(parsed.url).toBe('https://www.ethdenver.com');
    expect(parsed.location).toBe('Denver');
    expect(parsed.dateRangeStart?.toISOString().startsWith('2026-02-27')).toBe(true);
    expect(parsed.dateRangeEnd?.toISOString().startsWith('2026-03-01')).toBe(true);
  });

  it('reads a luma url as both official url and external id', () => {
    const parsed = parseEventFields([
      {
        title: 'ETH Denver',
        url: 'https://lu.ma/ethdenver',
        snippet: 'tickets',
      },
    ]);
    expect(parsed.url).toBe('https://lu.ma/ethdenver');
    expect(parsed.external).toEqual({ source: 'luma', id: 'ethdenver' });
  });

  it('returns blanks when hits are unrelated', () => {
    const parsed = parseEventFields([
      {
        title: 'Weekly standup notes',
        url: 'https://internal.example/standup',
        snippet: 'same as last week',
      },
    ]);
    expect(parsed.dateRangeStart).toBeNull();
    expect(parsed.external).toBeNull();
  });

  it('does not treat ISO dates inside result URLs as the event date', () => {
    const parsed = parseEventFields([
      {
        title: 'ETH Denver',
        url: 'https://archive.example/events/2024-01-01/ethdenver',
        snippet: 'Feb 27 – Mar 1, 2026 · Denver',
      },
    ]);
    expect(parsed.dateRangeStart?.toISOString().startsWith('2026-02-27')).toBe(true);
    expect(parsed.dateRangeEnd?.toISOString().startsWith('2026-03-01')).toBe(true);
  });

  it('prefers the platform URL over an earlier generic hit', () => {
    const parsed = parseEventFields([
      {
        title: 'ETH Denver coverage',
        url: 'https://news.example/eth-denver',
        snippet: 'a recap',
      },
      {
        title: 'ETH Denver',
        url: 'https://lu.ma/ethdenver',
        snippet: 'tickets',
      },
    ]);
    expect(parsed.url).toBe('https://lu.ma/ethdenver');
    expect(parsed.external).toEqual({ source: 'luma', id: 'ethdenver' });
  });

  it('strips trailing punctuation from a snippet event URL', () => {
    const parsed = parseEventFields([
      {
        title: 'ETH Denver',
        url: 'https://linkedin.com/company/ethdenver',
        snippet: 'grab tickets at https://lu.ma/ethdenver.',
      },
    ]);
    expect(parsed.url).toBe('https://lu.ma/ethdenver');
  });
});
