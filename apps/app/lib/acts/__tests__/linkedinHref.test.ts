import { describe, it, expect } from 'vitest';
import { linkedinProfileHref } from '../linkedinHref';

describe('linkedinProfileHref', () => {
  it('keeps a linkedin https url', () => {
    expect(linkedinProfileHref('https://www.linkedin.com/in/ada')).toBe(
      'https://www.linkedin.com/in/ada',
    );
  });

  it('upgrades http and rejects non-linkedin hosts', () => {
    expect(linkedinProfileHref('http://linkedin.com/in/ada')).toBe(
      'https://linkedin.com/in/ada',
    );
    expect(linkedinProfileHref('https://evil.example/in/ada')).toBeNull();
  });

  it('builds a profile url from a handle', () => {
    expect(linkedinProfileHref('ada-lovelace')).toBe(
      'https://www.linkedin.com/in/ada-lovelace',
    );
    expect(linkedinProfileHref('in/ada')).toBe('https://www.linkedin.com/in/ada');
  });

  it('rejects blank and junk values', () => {
    expect(linkedinProfileHref('   ')).toBeNull();
    expect(linkedinProfileHref('javascript:alert(1)')).toBeNull();
  });
});
