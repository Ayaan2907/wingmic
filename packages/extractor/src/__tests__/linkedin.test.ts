import { describe, expect, it } from 'vitest';
import {
  canonicalizeLinkedin,
  harvestLinkedinFromTranscript,
  isLinkedinUrlDebrisTopic,
  linkedinHandle,
} from '../linkedin';

describe('harvestLinkedinFromTranscript', () => {
  it('canonicalizes a country-subdomain profile URL', () => {
    expect(
      harvestLinkedinFromTranscript(
        'https://in.linkedin.com/in/tanzeela-sameen her linkedin',
      ),
    ).toBe('https://www.linkedin.com/in/tanzeela-sameen');
  });

  it('finds /in/handle shorthand in a follow-up sentence', () => {
    expect(harvestLinkedinFromTranscript('her linkedin is /in/gracehopper')).toBe(
      'https://www.linkedin.com/in/gracehopper',
    );
  });

  it('does not harvest /in/ paths from unrelated urls', () => {
    expect(
      harvestLinkedinFromTranscript('notes at https://example.com/in/gracehopper'),
    ).toBeNull();
  });

  it('returns the profile that appears earliest in the transcript', () => {
    expect(
      harvestLinkedinFromTranscript(
        '/in/gracehopper then https://www.linkedin.com/in/ada-lovelace',
      ),
    ).toBe('https://www.linkedin.com/in/gracehopper');
  });

  it('returns null when no profile URL is present', () => {
    expect(harvestLinkedinFromTranscript('met grace hopper at the navy booth')).toBeNull();
  });
});

describe('isLinkedinUrlDebrisTopic', () => {
  const url = 'https://www.linkedin.com/in/tanzeela-sameen';

  it('drops url tokens that used to become topics', () => {
    expect(isLinkedinUrlDebrisTopic('https', url)).toBe(true);
    expect(isLinkedinUrlDebrisTopic('linkedin', url)).toBe(true);
    expect(isLinkedinUrlDebrisTopic('tanzeela-sameen', url)).toBe(true);
    expect(isLinkedinUrlDebrisTopic('ai agents', url)).toBe(false);
  });
});

describe('linkedinHandle', () => {
  it('reads the /in/ handle', () => {
    expect(linkedinHandle('https://www.linkedin.com/in/ada-lovelace')).toBe('ada-lovelace');
  });
});

describe('canonicalizeLinkedin', () => {
  it('accepts in.linkedin.com profiles', () => {
    expect(canonicalizeLinkedin('https://in.linkedin.com/in/tanzeela-sameen')).toBe(
      'https://www.linkedin.com/in/tanzeela-sameen',
    );
  });
});
