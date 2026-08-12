import { describe, it, expect } from 'vitest';
import {
  resolveMatch,
  registerIdentifiers,
  filterSafeIdentifierFacts,
  type MatchIndexes,
} from '../matchContacts';

function emptyIndexes(): MatchIndexes {
  return {
    byEmail: new Map(),
    byLinkedIn: new Map(),
    byName: new Map(),
  };
}

describe('resolveMatch', () => {
  it('returns none when no indexes hit', () => {
    const res = resolveMatch(
      { name: 'Ada Lovelace', email: 'ada@example.com' },
      emptyIndexes(),
    );
    expect(res.kind).toBe('none');
  });

  it('returns match when all hits agree', () => {
    const indexes = emptyIndexes();
    indexes.byEmail.set('ada@example.com', 'ent-a');
    indexes.byName.set('ada lovelace', 'ent-a');
    const res = resolveMatch(
      { name: 'Ada Lovelace', email: 'ada@example.com' },
      indexes,
    );
    expect(res).toEqual({
      kind: 'match',
      entityId: 'ent-a',
      reasons: ['email', 'name'],
    });
  });

  it('returns ambiguous when email and linkedin point at different entities', () => {
    const indexes = emptyIndexes();
    indexes.byEmail.set('ada@example.com', 'ent-a');
    indexes.byLinkedIn.set('https://www.linkedin.com/in/byron', 'ent-b');
    const res = resolveMatch(
      {
        name: 'Ada Byron',
        email: 'ada@example.com',
        linkedinUrl: 'https://www.linkedin.com/in/byron',
      },
      indexes,
    );
    expect(res.kind).toBe('ambiguous');
    if (res.kind === 'ambiguous') {
      expect(res.candidates.map((c) => c.entityId).sort()).toEqual(['ent-a', 'ent-b']);
    }
  });
});

describe('registerIdentifiers', () => {
  it('does not overwrite a mapping that belongs to another entity', () => {
    const indexes = emptyIndexes();
    indexes.byLinkedIn.set('https://www.linkedin.com/in/byron', 'ent-b');
    registerIdentifiers(indexes, 'ent-a', {
      name: 'Ada Byron',
      email: 'ada@example.com',
      linkedinUrl: 'https://www.linkedin.com/in/byron',
    });
    expect(indexes.byLinkedIn.get('https://www.linkedin.com/in/byron')).toBe('ent-b');
    expect(indexes.byEmail.get('ada@example.com')).toBe('ent-a');
    expect(indexes.byName.get('ada byron')).toBe('ent-a');
  });
});

describe('filterSafeIdentifierFacts', () => {
  it('drops identifier facts owned by another entity', () => {
    const indexes = emptyIndexes();
    indexes.byLinkedIn.set('https://www.linkedin.com/in/byron', 'ent-b');
    const facts = filterSafeIdentifierFacts(indexes, 'ent-a', {
      name: 'Ada Byron',
      email: 'ada@example.com',
      linkedinUrl: 'https://www.linkedin.com/in/byron',
    });
    expect(facts).toEqual([{ key: 'email', value: 'ada@example.com' }]);
  });
});
