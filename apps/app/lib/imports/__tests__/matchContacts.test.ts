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

function setOwner(map: Map<string, Set<string>>, key: string, ...ids: string[]) {
  map.set(key, new Set(ids));
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
    setOwner(indexes.byEmail, 'ada@example.com', 'ent-a');
    setOwner(indexes.byName, 'ada lovelace', 'ent-a');
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
    setOwner(indexes.byEmail, 'ada@example.com', 'ent-a');
    setOwner(indexes.byLinkedIn, 'https://www.linkedin.com/in/byron', 'ent-b');
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

  it('returns ambiguous when one key is owned by multiple entities', () => {
    const indexes = emptyIndexes();
    setOwner(indexes.byEmail, 'shared@example.com', 'ent-a', 'ent-b');
    const res = resolveMatch(
      { name: 'Shared Person', email: 'shared@example.com' },
      indexes,
    );
    expect(res.kind).toBe('ambiguous');
    if (res.kind === 'ambiguous') {
      expect(res.candidates.map((c) => c.entityId).sort()).toEqual(['ent-a', 'ent-b']);
    }
  });

  it('demotes name-only hits to ambiguous', () => {
    const indexes = emptyIndexes();
    setOwner(indexes.byName, 'john smith', 'ent-a');
    const res = resolveMatch({ name: 'John Smith', email: null }, indexes);
    expect(res.kind).toBe('ambiguous');
    if (res.kind === 'ambiguous') {
      expect(res.candidates).toEqual([{ entityId: 'ent-a', reasons: ['name'] }]);
    }
  });
});

describe('registerIdentifiers', () => {
  it('unions owners when a key already belongs to another entity', () => {
    const indexes = emptyIndexes();
    setOwner(indexes.byLinkedIn, 'https://www.linkedin.com/in/byron', 'ent-b');
    registerIdentifiers(indexes, 'ent-a', {
      name: 'Ada Byron',
      email: 'ada@example.com',
      linkedinUrl: 'https://www.linkedin.com/in/byron',
    });
    expect([...indexes.byLinkedIn.get('https://www.linkedin.com/in/byron')!].sort()).toEqual([
      'ent-a',
      'ent-b',
    ]);
    expect([...indexes.byEmail.get('ada@example.com')!]).toEqual(['ent-a']);
    expect([...indexes.byName.get('ada byron')!]).toEqual(['ent-a']);
  });
});

describe('filterSafeIdentifierFacts', () => {
  it('drops identifier facts owned by another entity', () => {
    const indexes = emptyIndexes();
    setOwner(indexes.byLinkedIn, 'https://www.linkedin.com/in/byron', 'ent-b');
    const facts = filterSafeIdentifierFacts(indexes, 'ent-a', {
      name: 'Ada Byron',
      email: 'ada@example.com',
      linkedinUrl: 'https://www.linkedin.com/in/byron',
    });
    expect(facts).toEqual([{ key: 'email', value: 'ada@example.com' }]);
  });
});
