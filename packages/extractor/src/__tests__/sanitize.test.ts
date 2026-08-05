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

  it('does not touch topics or actions', () => {
    const r = sanitizeExtraction({
      ...empty(),
      topics: ['rust'],
      actions: [{ kind: 'email', body: 'send the deck', whenHint: null, targetPersonName: null }],
      persons: [{ name: 'Met', role: null, companyHint: null, topics: [], notes: null, email: null, linkedin: null, aliases: [] }],
    });
    expect(r.topics).toEqual(['rust']);
    expect(r.actions).toHaveLength(1);
    expect(r.persons).toHaveLength(0);
  });
});
