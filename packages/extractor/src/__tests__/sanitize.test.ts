import { describe, it, expect } from 'vitest';
import { sanitizeExtraction } from '../hybrid';
import type { ExtractionResult } from '../schema';

const empty = (): ExtractionResult => ({
  persons: [],
  companies: [],
  events: [],
  topics: [],
  actions: [],
});

describe('sanitizeExtraction', () => {
  it('drops junk person names', () => {
    const r = sanitizeExtraction({
      ...empty(),
      persons: [
        { name: 'Met', role: null, companyHint: null, topics: [], notes: null, email: null, linkedin: null, aliases: [] },
        { name: 'him', role: null, companyHint: null, topics: [], notes: null, email: null, linkedin: null, aliases: [] },
        { name: 'There', role: null, companyHint: null, topics: [], notes: null, email: null, linkedin: null, aliases: [] },
        { name: 'The Guy', role: null, companyHint: null, topics: [], notes: null, email: null, linkedin: null, aliases: [] },
        { name: 'Sarah Chen', role: null, companyHint: null, topics: [], notes: null, email: null, linkedin: null, aliases: [] },
        { name: 'priya', role: null, companyHint: null, topics: [], notes: null, email: null, linkedin: null, aliases: [] },
      ],
    });
    expect(r.persons.map((p) => p.name)).toEqual(['Sarah Chen', 'priya']);
  });

  it('drops junk companies/events but keeps real ones', () => {
    const r = sanitizeExtraction({
      ...empty(),
      companies: [
        { name: 'Met', domainHint: null, industry: [] },
        { name: 'Acme', domainHint: null, industry: [] },
      ],
      events: [
        { name: 'him', dateHint: null, location: null },
        { name: 'DevConnect 26', dateHint: null, location: null },
      ],
    });
    expect(r.companies.map((c) => c.name)).toEqual(['Acme']);
    expect(r.events.map((e) => e.name)).toEqual(['DevConnect 26']);
  });

  it('drops names shorter than 2 chars', () => {
    const r = sanitizeExtraction({
      ...empty(),
      persons: [
        { name: 'A', role: null, companyHint: null, topics: [], notes: null, email: null, linkedin: null, aliases: [] },
      ],
    });
    expect(r.persons).toHaveLength(0);
  });

  it('passes multi-word names when any token is real', () => {
    const r = sanitizeExtraction({
      ...empty(),
      persons: [
        { name: 'Guy Fieri', role: null, companyHint: null, topics: [], notes: null, email: null, linkedin: null, aliases: [] },
      ],
    });
    expect(r.persons.map((p) => p.name)).toEqual(['Guy Fieri']);
  });

  it('does not touch actions but filters junk topics', () => {
    const r = sanitizeExtraction({
      ...empty(),
      topics: ['rust', 'discussed', 'Lucas'],
      actions: [{ kind: 'email', body: 'send the deck', whenHint: null, targetPersonName: null }],
      persons: [
        { name: 'Met', role: null, companyHint: null, topics: [], notes: null, email: null, linkedin: null, aliases: [] },
        { name: 'Lucas', role: null, companyHint: null, topics: [], notes: null, email: null, linkedin: null, aliases: [] },
      ],
    });
    expect(r.topics).toEqual(['rust']);
    expect(r.actions).toHaveLength(1);
    expect(r.persons.map((p) => p.name)).toEqual(['Lucas']);
  });

  it('drops verb topics and entity-name echoes', () => {
    const r = sanitizeExtraction({
      ...empty(),
      topics: ['discussed', 'relocation', 'francisco', 'San Francisco', 'lucas', 'co-working'],
      persons: [
        {
          name: 'Lucas',
          role: null,
          companyHint: 'Trillers',
          topics: [],
          notes: null,
          email: null,
          linkedin: null,
          aliases: [],
        },
      ],
      companies: [{ name: 'Trillers', domainHint: null, industry: [] }],
    });
    expect(r.topics).toEqual(['relocation', 'San Francisco', 'co-working']);
  });

  it('sanitizes person-scoped topics the same way as canonical topics', () => {
    const r = sanitizeExtraction({
      ...empty(),
      persons: [
        {
          name: 'Lucas',
          role: null,
          companyHint: null,
          topics: ['discussed', 'rust', 'lucas', 'AI'],
          notes: null,
          email: null,
          linkedin: null,
          aliases: [],
        },
      ],
      topics: ['discussed'],
    });
    expect(r.persons[0]!.topics).toEqual(['rust', 'AI']);
    expect(r.topics).toEqual([]);
  });

  it('keeps short subjects like AI and Go', () => {
    const r = sanitizeExtraction({
      ...empty(),
      topics: ['AI', 'Go', 'a', 'rust'],
    });
    expect(r.topics).toEqual(['AI', 'Go', 'rust']);
  });

  it('does not erase one-word topics that share a token with a multi-word entity', () => {
    const r = sanitizeExtraction({
      ...empty(),
      topics: ['research', 'rust'],
      companies: [{ name: 'Research Labs', domainHint: null, industry: [] }],
      persons: [
        {
          name: 'Lucas',
          role: null,
          companyHint: null,
          topics: [],
          notes: null,
          email: null,
          linkedin: null,
          aliases: [],
        },
      ],
    });
    expect(r.topics).toEqual(['research', 'rust']);
  });

  it('drops unigram topics that are tokens of a person name', () => {
    const r = sanitizeExtraction({
      ...empty(),
      topics: ['tomo', 'merchant cash advance'],
      persons: [
        {
          name: 'Tomo Matsuo',
          role: null,
          companyHint: null,
          topics: [],
          notes: null,
          email: null,
          linkedin: null,
          aliases: [],
        },
      ],
    });
    expect(r.topics).toEqual(['merchant cash advance']);
  });
});
