import { describe, expect, it } from 'vitest';
import {
  canonicalizeEmail,
  canonicalizeLinkedin,
  fingerprint,
  isStrongFingerprint,
  personaDraftFromPerson,
} from '../fingerprint';
import type { PersonCandidate } from '../schema';

const ada: PersonCandidate = {
  name: 'Ada Lovelace',
  aliases: ['Ada'],
  role: 'analyst',
  companyHint: 'Analytical Engines',
  topics: ['math'],
  notes: 'Met over tea.',
  email: 'Ada@Example.com',
  linkedin: 'https://www.linkedin.com/in/ada-lovelace/?trk=foo',
};

describe('canonicalizeLinkedin', () => {
  it('collapses www, query params, and trailing slash', () => {
    expect(canonicalizeLinkedin('https://www.linkedin.com/in/ada-lovelace/?trk=foo')).toBe(
      'https://www.linkedin.com/in/ada-lovelace',
    );
    expect(canonicalizeLinkedin('LINKEDIN.COM/in/ada-lovelace/')).toBe(
      'https://www.linkedin.com/in/ada-lovelace',
    );
  });

  it('accepts a bare handle', () => {
    expect(canonicalizeLinkedin('ada-lovelace')).toBe('https://www.linkedin.com/in/ada-lovelace');
    expect(canonicalizeLinkedin('@ada-lovelace')).toBe('https://www.linkedin.com/in/ada-lovelace');
    expect(canonicalizeLinkedin('in/ada-lovelace')).toBe('https://www.linkedin.com/in/ada-lovelace');
    expect(canonicalizeLinkedin('in/ada-lovelace/')).toBe('https://www.linkedin.com/in/ada-lovelace');
  });

  it('rejects non-profile URLs', () => {
    expect(canonicalizeLinkedin('https://linkedin.com/company/analytical-engines')).toBeNull();
    expect(canonicalizeLinkedin('https://example.com/in/ada-lovelace')).toBeNull();
    expect(canonicalizeLinkedin('https://linkedin.com/company/foo/in/ada-lovelace')).toBeNull();
    expect(canonicalizeLinkedin('https://www.linkedin.com/in/ada-lovelace/details')).toBeNull();
    expect(canonicalizeLinkedin('')).toBeNull();
  });

  it('accepts country LinkedIn hosts as the same profile', () => {
    expect(canonicalizeLinkedin('https://uk.linkedin.com/in/ada-lovelace')).toBe(
      'https://www.linkedin.com/in/ada-lovelace',
    );
    expect(canonicalizeLinkedin('https://de.linkedin.com/in/ada-lovelace/')).toBe(
      'https://www.linkedin.com/in/ada-lovelace',
    );
  });
});

describe('canonicalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(canonicalizeEmail('  Ada@Example.com ')).toBe('ada@example.com');
  });

  it('rejects implausible strings', () => {
    expect(canonicalizeEmail('ada@')).toBeNull();
    expect(canonicalizeEmail('@example.com')).toBeNull();
    expect(canonicalizeEmail('ada@@example.com')).toBeNull();
    expect(canonicalizeEmail('not-an-email')).toBeNull();
    expect(canonicalizeEmail('ada lovelace@example.com')).toBeNull();
    expect(canonicalizeEmail('ada@example..com')).toBeNull();
  });
});

describe('fingerprint', () => {
  it('ranks LinkedIn above email', () => {
    const fp = fingerprint(personaDraftFromPerson(ada));
    expect(fp).not.toBeNull();
    expect(fp!.kind).toBe('linkedin_url_normalized');
    expect(fp!.key).toBe('https://www.linkedin.com/in/ada-lovelace');
    expect(fp!.id).toMatch(/^fp:v1:linkedin_url_normalized:[a-f0-9]{64}$/);
    expect(isStrongFingerprint(fp!.kind)).toBe(true);
  });

  it('uses email when LinkedIn is missing or unusable', () => {
    const fp = fingerprint({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      linkedin: 'https://linkedin.com/company/acme',
    });
    expect(fp!.kind).toBe('email_lower');
    expect(fp!.key).toBe('ada@example.com');
    expect(isStrongFingerprint(fp!.kind)).toBe(true);
  });

  it('uses name+company when no strong key exists', () => {
    const fp = fingerprint({
      name: 'Ada Lovelace',
      companyHint: 'Analytical Engines',
    });
    expect(fp!.kind).toBe('name_company');
    expect(fp!.key).toBe('ada-lovelace|analytical-engines');
    expect(isStrongFingerprint(fp!.kind)).toBe(false);
  });

  it('falls back to name_lower and marks it weak', () => {
    const fp = fingerprint({ name: 'Ada Lovelace' });
    expect(fp!.kind).toBe('name_lower');
    expect(fp!.key).toBe('ada-lovelace');
    expect(isStrongFingerprint(fp!.kind)).toBe(false);
  });

  it('is stable across LinkedIn URL noise', () => {
    const a = fingerprint({ name: 'Ada', linkedin: 'https://linkedin.com/in/ada-lovelace?trk=1' });
    const b = fingerprint({ name: 'Ada Lovelace', linkedin: 'www.linkedin.com/in/ada-lovelace/' });
    expect(a!.id).toBe(b!.id);
  });

  it('returns null when the name cannot slugify', () => {
    expect(fingerprint({ name: '!!!' })).toBeNull();
  });
});
