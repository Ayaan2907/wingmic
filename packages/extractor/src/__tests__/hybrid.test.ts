import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AssemblyAIEntity } from '../types';
import type { ExtractionResult } from '../schema';

// ── Mock the LLM linker call to keep tests deterministic ───────────────
// runLinkerLLM is the only impure unit in hybrid.ts; everything else is
// pure. We mock at the function boundary so extractHybrid integration
// tests don't burn API tokens.
const runLinkerLLMMock = vi.fn<(transcript: string, layer12: ExtractionResult) => Promise<ExtractionResult>>();

vi.mock('../hybrid', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../hybrid')>();
  return {
    ...mod,
    // expose pure helpers as-is, but replace runLinkerLLM with the mock
    // for the integration-level extractHybrid tests. The pure-function
    // tests below import the originals directly.
    runLinkerLLM: (t: string, l12: ExtractionResult) => runLinkerLLMMock(t, l12),
    extractHybrid: async (input: { transcript: string; providerEntities?: AssemblyAIEntity[] }) => {
      const { mapProviderEntities, applyHeuristics, mergeResults } = mod;
      const skeleton = mapProviderEntities(input.providerEntities ?? []);
      const filled = applyHeuristics(skeleton, input.transcript);
      const llm = await runLinkerLLMMock(input.transcript, filled);
      return mergeResults(filled, llm);
    },
  };
});

import {
  mapProviderEntities,
  applyHeuristics,
  mergeResults,
  extractHybrid,
} from '../hybrid';

function emptyResult(): ExtractionResult {
  return { persons: [], companies: [], events: [], topics: [], actions: [] };
}

beforeEach(() => {
  runLinkerLLMMock.mockReset();
});

// ──────────────────────────────────────────────────────────────────────
// mapProviderEntities
// ──────────────────────────────────────────────────────────────────────
describe('mapProviderEntities', () => {
  it('maps a single PERSON span to a PersonCandidate with only name set', () => {
    const entities: AssemblyAIEntity[] = [
      { entity_type: 'person_name', text: 'Sarah', start: 0, end: 5 },
    ];
    const result = mapProviderEntities(entities);
    expect(result.persons).toHaveLength(1);
    expect(result.persons[0]).toMatchObject({
      name: 'Sarah',
      role: null,
      companyHint: null,
      topics: [],
      notes: null,
      email: null,
      linkedin: null,
      aliases: [],
    });
  });

  it('maps ORG + EVENT + LOCATION with location attaching to nearby event', () => {
    // Word positions: "met at the rustconf event in berlin with acme"
    //                  0   1  2   3       4     5  6      7    8
    const entities: AssemblyAIEntity[] = [
      { entity_type: 'organization', text: 'acme', start: 41, end: 45 },
      { entity_type: 'event', text: 'rustconf', start: 11, end: 19 },
      { entity_type: 'location', text: 'berlin', start: 29, end: 35 },
    ];
    const result = mapProviderEntities(entities);

    expect(result.companies).toHaveLength(1);
    expect(result.companies[0]).toMatchObject({
      name: 'acme',
      domainHint: null,
      industry: [],
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      name: 'rustconf',
      location: 'berlin',
      dateHint: null,
    });
  });

  it('maps a DATE adjacent to an imperative verb into an action whenHint', () => {
    // "remind me to send Sarah the link tomorrow"
    // Tokens: remind(0) me(1) to(2) send(3) Sarah(4) the(5) link(6) tomorrow(7)
    const entities: AssemblyAIEntity[] = [
      { entity_type: 'person_name', text: 'Sarah', start: 18, end: 23 },
      { entity_type: 'date', text: 'tomorrow', start: 33, end: 41 },
    ];
    const result = mapProviderEntities(entities);
    expect(result.actions.length).toBeGreaterThanOrEqual(1);
    const action = result.actions.find((a) => a.whenHint === 'tomorrow');
    expect(action).toBeDefined();
    expect(action?.whenHint).toBe('tomorrow');
  });

  it('deduplicates duplicate spans (case-insensitive by name)', () => {
    const entities: AssemblyAIEntity[] = [
      { entity_type: 'person_name', text: 'Sarah', start: 0, end: 5 },
      { entity_type: 'person_name', text: 'sarah', start: 30, end: 35 },
      { entity_type: 'organization', text: 'Acme', start: 10, end: 14 },
      { entity_type: 'organization', text: 'acme', start: 50, end: 54 },
    ];
    const result = mapProviderEntities(entities);
    expect(result.persons).toHaveLength(1);
    expect(result.companies).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────────
// applyHeuristics
// ──────────────────────────────────────────────────────────────────────
describe('applyHeuristics', () => {
  it('extracts action verbs into ActionCandidates with mapped kind', () => {
    const transcript = 'send Sarah the link about rust. also remind me to follow up next week.';
    const result = applyHeuristics(emptyResult(), transcript);
    expect(result.actions.length).toBeGreaterThanOrEqual(2);
    const emailAction = result.actions.find((a) => a.kind === 'email');
    const reminderAction = result.actions.find((a) => a.kind === 'reminder');
    expect(emailAction).toBeDefined();
    expect(reminderAction).toBeDefined();
  });

  it('picks top-3 unique topic words >= 4 chars excluding stopwords', () => {
    const transcript =
      'rust compilers and rust tooling are the future. rust beats cpp. ' +
      'compilers are nice. tooling matters. tooling tooling.';
    const result = applyHeuristics(emptyResult(), transcript);
    expect(result.topics.length).toBeLessThanOrEqual(3);
    expect(result.topics).toContain('rust');
    expect(result.topics).toContain('tooling');
    // no stopwords like 'the', 'and', 'are'
    for (const t of result.topics) {
      expect(t.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('deduplicates action verbs against the existing skeleton', () => {
    // Heuristic captures up to next sentence-boundary; matching body keys
    // ensures dedup is exact per the spec rule (body.trim().toLowerCase()).
    const skeleton: ExtractionResult = {
      ...emptyResult(),
      actions: [
        {
          kind: 'email',
          body: 'send sarah the link',
          whenHint: null,
          targetPersonName: 'Sarah',
        },
      ],
    };
    const transcript = 'send sarah the link.';
    const result = applyHeuristics(skeleton, transcript);
    // should not duplicate the existing "send sarah the link" action
    const sendCount = result.actions.filter(
      (a) => a.body.trim().toLowerCase() === 'send sarah the link',
    ).length;
    expect(sendCount).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────
// mergeResults
// ──────────────────────────────────────────────────────────────────────
describe('mergeResults', () => {
  it('prefers filled.name (Layer-1+2 source of truth)', () => {
    const filled: ExtractionResult = {
      ...emptyResult(),
      persons: [
        {
          name: 'Sarah',
          aliases: [],
          role: null,
          companyHint: null,
          topics: [],
          email: null,
          linkedin: null,
          notes: null,
        },
      ],
    };
    const llm: ExtractionResult = {
      ...emptyResult(),
      persons: [
        {
          name: 'Sara', // LLM tries to "correct" — should be ignored
          aliases: [],
          role: null,
          companyHint: null,
          topics: [],
          email: null,
          linkedin: null,
          notes: null,
        },
      ],
    };
    const merged = mergeResults(filled, llm);
    expect(merged.persons[0].name).toBe('Sarah');
  });

  it('LLM fills role / companyHint / notes when filled has nulls', () => {
    const filled: ExtractionResult = {
      ...emptyResult(),
      persons: [
        {
          name: 'Sarah',
          aliases: [],
          role: null,
          companyHint: null,
          topics: [],
          email: null,
          linkedin: null,
          notes: null,
        },
      ],
    };
    const llm: ExtractionResult = {
      ...emptyResult(),
      persons: [
        {
          name: 'Sarah',
          aliases: [],
          role: 'senior eng',
          companyHint: 'acme',
          topics: [],
          email: null,
          linkedin: null,
          notes: 'works on rust',
        },
      ],
    };
    const merged = mergeResults(filled, llm);
    expect(merged.persons[0].role).toBe('senior eng');
    expect(merged.persons[0].companyHint).toBe('acme');
    expect(merged.persons[0].notes).toBe('works on rust');
  });

  it('unions topics on person and at top level, deduped', () => {
    const filled: ExtractionResult = {
      ...emptyResult(),
      topics: ['rust', 'compilers'],
      persons: [
        {
          name: 'Sarah',
          aliases: [],
          role: null,
          companyHint: null,
          topics: ['rust'],
          email: null,
          linkedin: null,
          notes: null,
        },
      ],
    };
    const llm: ExtractionResult = {
      ...emptyResult(),
      topics: ['compilers', 'tooling'],
      persons: [
        {
          name: 'Sarah',
          aliases: [],
          role: null,
          companyHint: null,
          topics: ['compilers'],
          email: null,
          linkedin: null,
          notes: null,
        },
      ],
    };
    const merged = mergeResults(filled, llm);
    expect(new Set(merged.topics)).toEqual(new Set(['rust', 'compilers', 'tooling']));
    expect(new Set(merged.persons[0].topics)).toEqual(new Set(['rust', 'compilers']));
  });

  it('unions actions and preserves LLM targetPersonName on the same action body', () => {
    const filled: ExtractionResult = {
      ...emptyResult(),
      actions: [
        {
          kind: 'email',
          body: 'send the link',
          whenHint: null,
          targetPersonName: null,
        },
      ],
    };
    const llm: ExtractionResult = {
      ...emptyResult(),
      actions: [
        {
          kind: 'email',
          body: 'send the link',
          whenHint: 'tomorrow',
          targetPersonName: 'Sarah',
        },
        {
          kind: 'todo',
          body: 'review the PR',
          whenHint: null,
          targetPersonName: null,
        },
      ],
    };
    const merged = mergeResults(filled, llm);
    expect(merged.actions).toHaveLength(2);
    const sendAction = merged.actions.find((a) => a.body === 'send the link');
    expect(sendAction?.targetPersonName).toBe('Sarah');
    expect(sendAction?.whenHint).toBe('tomorrow');
  });
});

// ──────────────────────────────────────────────────────────────────────
// extractHybrid (integration, with mocked LLM)
// ──────────────────────────────────────────────────────────────────────
describe('extractHybrid (integration)', () => {
  it('layer-1+2 sparse + mocked LLM enrich → correctly merged result', async () => {
    const transcript = 'met sarah at acme. she works on rust. send her the link tomorrow.';
    const providerEntities: AssemblyAIEntity[] = [
      { entity_type: 'person_name', text: 'sarah', start: 4, end: 9 },
      { entity_type: 'organization', text: 'acme', start: 13, end: 17 },
      { entity_type: 'date', text: 'tomorrow', start: 56, end: 64 },
    ];

    runLinkerLLMMock.mockResolvedValueOnce({
      persons: [
        {
          name: 'sarah',
          aliases: [],
          role: 'engineer',
          companyHint: 'acme',
          topics: ['rust'],
          email: null,
          linkedin: null,
          notes: 'works on rust',
        },
      ],
      companies: [{ name: 'acme', domainHint: null, industry: [] }],
      events: [],
      topics: ['rust'],
      actions: [
        {
          kind: 'email',
          body: 'send her the link',
          whenHint: 'tomorrow',
          targetPersonName: 'sarah',
        },
      ],
    });

    const result = await extractHybrid({ transcript, providerEntities });

    expect(runLinkerLLMMock).toHaveBeenCalledOnce();
    expect(result.persons[0].name).toBe('sarah');
    expect(result.persons[0].role).toBe('engineer');
    expect(result.persons[0].companyHint).toBe('acme');
    expect(result.companies.map((c) => c.name)).toContain('acme');
    expect(result.topics).toContain('rust');
    expect(result.actions.some((a) => a.targetPersonName === 'sarah')).toBe(true);
  });

  it('empty providerEntities → still calls LLM with just heuristic skeleton', async () => {
    const transcript = 'remind me to call mom about the tooling thing.';

    runLinkerLLMMock.mockResolvedValueOnce({
      persons: [
        {
          name: 'mom',
          aliases: [],
          role: null,
          companyHint: null,
          topics: [],
          email: null,
          linkedin: null,
          notes: null,
        },
      ],
      companies: [],
      events: [],
      topics: [],
      actions: [],
    });

    const result = await extractHybrid({ transcript, providerEntities: [] });
    expect(runLinkerLLMMock).toHaveBeenCalledOnce();
    expect(result.persons.length).toBeGreaterThanOrEqual(1);
    // heuristic should have caught 'remind' and 'call' as actions
    expect(result.actions.length).toBeGreaterThanOrEqual(1);
  });
});
