import { describe, expect, it } from 'vitest';
import { mergePhotoSignals, normalizePhotoSignals } from '../photoSignals';

const POSTER_DUMP = [
  'ETH Denver 2026',
  'Register now Early bird $99',
  'Presented by Superfluid',
  'Sponsors: Alchemy Chainlink Polygon',
  'Scan QR for tickets',
  'Feb 27 – Mar 1 Colorado Convention Center',
].join('\n');

describe('normalizePhotoSignals', () => {
  it('keeps a short person, company, event, and urls', () => {
    expect(
      normalizePhotoSignals({
        personName: 'Ada Lovelace',
        companyName: 'Analytical Engines',
        eventName: 'ETH Denver',
        linkedin: 'https://www.linkedin.com/in/ada-lovelace',
        eventUrl: 'https://lu.ma/ethdenver',
      }),
    ).toEqual({
      personName: 'Ada Lovelace',
      companyName: 'Analytical Engines',
      eventName: 'ETH Denver',
      linkedin: 'https://www.linkedin.com/in/ada-lovelace',
      eventUrl: 'https://lu.ma/ethdenver',
    });
  });

  it('drops poster body copy masquerading as a name', () => {
    expect(
      normalizePhotoSignals({
        personName: POSTER_DUMP,
        companyName: 'Sponsors: Alchemy Chainlink Polygon Labs and friends of the conference',
        eventName: POSTER_DUMP,
        linkedin: 'not a url',
        eventUrl: 'tickets at the door',
      }),
    ).toEqual({
      personName: null,
      companyName: null,
      eventName: null,
      linkedin: null,
      eventUrl: null,
    });
  });
});

describe('mergePhotoSignals', () => {
  it('appends only structured names and urls, never a poster dump', () => {
    const merged = mergePhotoSignals('attached a photo', {
      personName: 'Ada Lovelace',
      companyName: 'Analytical Engines',
      eventName: 'ETH Denver',
      linkedin: 'https://www.linkedin.com/in/ada-lovelace',
      eventUrl: 'https://lu.ma/ethdenver',
    });
    expect(merged).toBe(
      'attached a photo Ada Lovelace Analytical Engines ETH Denver https://www.linkedin.com/in/ada-lovelace https://lu.ma/ethdenver',
    );
    expect(merged).not.toMatch(/register now/i);
    expect(merged).not.toMatch(/sponsor/i);
  });

  it('does not dump raw poster text into the transcript', () => {
    const merged = mergePhotoSignals('attached a photo', {
      personName: POSTER_DUMP,
      companyName: null,
      eventName: POSTER_DUMP,
      linkedin: null,
      eventUrl: 'https://lu.ma/ethdenver',
    });
    expect(merged).toBe('attached a photo https://lu.ma/ethdenver');
    expect(merged).not.toMatch(/early bird/i);
    expect(merged).not.toMatch(/alchemy/i);
  });

  it('does not duplicate urls already spoken', () => {
    expect(
      mergePhotoSignals('https://lu.ma/ethdenver her luma', {
        personName: null,
        companyName: null,
        eventName: null,
        linkedin: null,
        eventUrl: 'https://lu.ma/ethdenver',
      }),
    ).toBe('https://lu.ma/ethdenver her luma');
  });
});
