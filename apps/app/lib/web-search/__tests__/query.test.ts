import { describe, expect, it } from 'vitest';
import { buildWebSearchQuery, isBlockedExtractUrl } from '../query';

describe('buildWebSearchQuery', () => {
  it('quotes a person name with company', () => {
    const q = buildWebSearchQuery({
      intent: 'person',
      name: 'Ada Lovelace',
      company: 'Analytical Engines',
    });
    expect(q.intent).toBe('person');
    expect(q.q).toBe('"Ada Lovelace" Analytical Engines');
  });

  it('uses the LinkedIn URL for profile lookup', () => {
    const q = buildWebSearchQuery({
      intent: 'profile',
      linkedinUrl: 'https://www.linkedin.com/in/ada-lovelace',
    });
    expect(q.intent).toBe('profile');
    expect(q.q).toBe('https://www.linkedin.com/in/ada-lovelace');
  });

  it('builds event and company queries without a second vendor', () => {
    expect(
      buildWebSearchQuery({ intent: 'event', event: 'ETH Denver', year: '2026' }).q,
    ).toBe('ETH Denver 2026');
    expect(buildWebSearchQuery({ intent: 'company', company: 'Acme' }).q).toBe(
      'Acme official site',
    );
  });
});

describe('isBlockedExtractUrl', () => {
  it('blocks LinkedIn hosts so we never extract profile HTML', () => {
    expect(isBlockedExtractUrl('https://www.linkedin.com/in/ada-lovelace')).toBe(true);
    expect(isBlockedExtractUrl('https://lnkd.in/abc')).toBe(true);
    expect(isBlockedExtractUrl('https://www.analytical-engines.example/')).toBe(false);
  });
});
