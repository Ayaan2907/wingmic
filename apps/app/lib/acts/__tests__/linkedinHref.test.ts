import { describe, it, expect } from 'vitest';
import { linkedinProfileHref } from '../linkedinHref';

describe('linkedinProfileHref', () => {
  it('canonicalizes a profile url and a handle', () => {
    expect(linkedinProfileHref('https://www.linkedin.com/in/ada-lovelace/?trk=foo')).toBe(
      'https://www.linkedin.com/in/ada-lovelace',
    );
    expect(linkedinProfileHref('ada-lovelace')).toBe('https://www.linkedin.com/in/ada-lovelace');
    expect(linkedinProfileHref('in/ada-lovelace')).toBe('https://www.linkedin.com/in/ada-lovelace');
    expect(linkedinProfileHref('in/ada-lovelace/')).toBe('https://www.linkedin.com/in/ada-lovelace');
  });

  it('rejects company pages, extra path, foreign hosts, and blank values', () => {
    expect(linkedinProfileHref('https://linkedin.com/company/analytical-engines')).toBeNull();
    expect(linkedinProfileHref('https://www.linkedin.com/in/ada-lovelace/details')).toBeNull();
    expect(linkedinProfileHref('https://example.com/in/ada-lovelace')).toBeNull();
    expect(linkedinProfileHref('   ')).toBeNull();
  });
});
