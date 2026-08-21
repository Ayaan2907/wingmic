import { describe, expect, it } from 'vitest';
import { mergePhotoSignals } from '../photoSignals';

describe('mergePhotoSignals', () => {
  it('appends visible text and urls that are not already in the transcript', () => {
    expect(
      mergePhotoSignals('attached a photo', {
        visibleText: 'Ada Lovelace',
        linkedin: 'https://www.linkedin.com/in/ada-lovelace',
        eventUrl: 'https://lu.ma/ethdenver',
      }),
    ).toBe(
      'attached a photo Ada Lovelace https://www.linkedin.com/in/ada-lovelace https://lu.ma/ethdenver',
    );
  });

  it('does not duplicate urls already spoken', () => {
    expect(
      mergePhotoSignals('https://lu.ma/ethdenver her luma', {
        visibleText: null,
        linkedin: null,
        eventUrl: 'https://lu.ma/ethdenver',
      }),
    ).toBe('https://lu.ma/ethdenver her luma');
  });
});
