import { describe, it, expect } from 'vitest';
import { slugify, nameSimilarity, normalizePersonName, personNameEquals, entityMatchesPersonName } from '../slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Acme Corp')).toBe('acme-corp');
  });

  it('strips diacritics', () => {
    expect(slugify('Café')).toBe('cafe');
    expect(slugify('Naïve')).toBe('naive');
  });

  it('expands & to "and"', () => {
    expect(slugify('Smith & Jones')).toBe('smith-and-jones');
  });

  it('drops leading and trailing hyphens', () => {
    expect(slugify('--Acme--')).toBe('acme');
  });

  it('truncates to 80 chars', () => {
    const long = 'a'.repeat(120);
    expect(slugify(long).length).toBe(80);
  });

  it('returns empty string for non-letter input', () => {
    expect(slugify('!@#$%')).toBe('');
  });

  it('handles unicode names sensibly', () => {
    // Falls back to empty when the source has no representable letters,
    // which is fine — caller must validate.
    expect(slugify('  ')).toBe('');
    expect(slugify('Sara—Chen')).toBe('sara-chen');
  });
});

describe('normalizePersonName', () => {
  it('joins lowercase tokens for exact matching', () => {
    expect(normalizePersonName('Sarah Chen')).toBe('sarah chen');
    expect(personNameEquals('Sarah Chen', 'sarah chen')).toBe(true);
  });

  it('normalizes diacritics for exact matching', () => {
    expect(normalizePersonName('José Muñoz')).toBe('jose munoz');
    expect(personNameEquals('José Muñoz', 'Jose Munoz')).toBe(true);
  });

  it('does not treat partial names as equal', () => {
    expect(personNameEquals('Jordan', 'Jordan Lee')).toBe(false);
    expect(entityMatchesPersonName('Jordan', { name: 'Jordan Lee', aliases: [] })).toBe(false);
  });

  it('keeps non-latin combining marks so distinct names stay distinct', () => {
    const withVirama = 'मा\u094dन';
    const withoutVirama = 'मान';
    expect(normalizePersonName(withVirama)).not.toBe(normalizePersonName(withoutVirama));
  });

  it('matches via alias on the entity', () => {
    expect(
      entityMatchesPersonName('Ada', {
        name: 'Ada Lovelace',
        aliases: ['Ada'],
      }),
    ).toBe(true);
  });
});

describe('nameSimilarity', () => {
  it('returns 1 for identical names (modulo casing)', () => {
    expect(nameSimilarity('Sarah Chen', 'sarah chen')).toBe(1);
  });

  it('returns 0 for empty input', () => {
    expect(nameSimilarity('', 'Sarah')).toBe(0);
    expect(nameSimilarity('Sarah', '')).toBe(0);
  });

  it('handles word-order swaps via token-set Jaccard', () => {
    const score = nameSimilarity('Sarah Chen', 'Chen Sarah');
    expect(score).toBeGreaterThan(0.9);
  });

  it('rewards prefix matches', () => {
    const score = nameSimilarity('Sarah', 'Sarah Chen');
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns near-zero for totally different names', () => {
    const score = nameSimilarity('Sarah Chen', 'Marcus Webb');
    expect(score).toBeLessThan(0.3);
  });

  it('treats partial overlap as moderate', () => {
    const score = nameSimilarity('Sarah Chen', 'Sarah Smith');
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThan(0.8);
  });
});
