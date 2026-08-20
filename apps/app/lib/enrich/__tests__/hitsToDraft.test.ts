import { describe, it, expect } from 'vitest';
import { hitsToPersonaDraft } from '../hitsToDraft';

describe('hitsToPersonaDraft', () => {
  it('takes homepage url from a non-linkedin hit and never stores vendor json', () => {
    const draft = hitsToPersonaDraft(
      { name: 'Ada Lovelace', companyHint: 'Analytical Engines' },
      [
        {
          title: 'Ada Lovelace — Analytical Engines',
          url: 'https://www.analytical-engines.example/people/ada',
          snippet: 'Ada Lovelace, mathematician at Analytical Engines.',
        },
        {
          title: 'Ada | LinkedIn',
          url: 'https://www.linkedin.com/in/ada-lovelace',
          snippet: 'View Ada Lovelace’s profile',
        },
      ],
    );
    expect(draft.name).toBe('Ada Lovelace');
    expect(draft.companyHint).toBe('Analytical Engines');
    expect(draft.sourceUrl).toBe('https://www.analytical-engines.example/people/ada');
    expect(draft.linkedin).toBe('https://www.linkedin.com/in/ada-lovelace');
    expect(JSON.stringify(draft).includes('View Ada')).toBe(false);
  });
});
