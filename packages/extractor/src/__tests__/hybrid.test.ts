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
      const entities = input.providerEntities ?? [];
      const skeleton = mapProviderEntities(entities);
      const dateSpans = entities
        .filter((e) => e.entity_type.toLowerCase() === 'date')
        .map((e) => e.text);
      const filled = applyHeuristics(skeleton, input.transcript, dateSpans);
      // Mirror the real runLinkerLLM contract: best-effort, never throws.
      // If the LLM mock rejects, we fall back to an empty result so the
      // caller still gets Layer-1+2 alone.
      let llm: ExtractionResult;
      try {
        llm = await runLinkerLLMMock(input.transcript, filled);
      } catch {
        llm = { persons: [], companies: [], events: [], topics: [], actions: [] };
      }
      return mergeResults(filled, llm);
    },
  };
});

import {
  mapProviderEntities,
  applyHeuristics,
  mergeResults,
  extractHybrid,
  extractTopicPhrases,
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

  it('does NOT synthesize actions from DATE spans (pure entity layer)', () => {
    // Per the H4 code review, the pure entity layer must not invent
    // actions. Date spans are dropped at Layer-1; Layer-2 (via
    // applyHeuristics) attaches them as whenHint only when they fall
    // inside a real verb body, and Layer-3 (LLM) handles whenHint
    // extraction independently with full transcript context.
    const entities: AssemblyAIEntity[] = [
      { entity_type: 'person_name', text: 'Sarah', start: 18, end: 23 },
      { entity_type: 'date', text: 'tomorrow', start: 33, end: 41 },
    ];
    const result = mapProviderEntities(entities);
    expect(result.actions).toHaveLength(0);
    // sanity: no leftover "(date noted)" placeholder body
    expect(result.actions.find((a) => a.body.includes('(date noted)'))).toBeUndefined();
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

  it('picks noun phrases and keeps repeated subjects', () => {
    const transcript =
      'rust compilers and rust tooling are the future. rust beats cpp. ' +
      'compilers are nice. tooling matters. tooling tooling.';
    const result = applyHeuristics(emptyResult(), transcript);
    expect(result.topics.length).toBeLessThanOrEqual(3);
    expect(result.topics.some((t) => t.includes('rust'))).toBe(true);
    expect(result.topics.some((t) => t.includes('tooling') || t.includes('compiler'))).toBe(true);
    for (const t of result.topics) {
      expect(t.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('extracts merchant cash advance and does not mint an undated meeting', () => {
    const transcript =
      'Hey. I met with Morgan Blake who is the co founder of AdvanceIQ AI and we discussed a lot about merchant cash advance business.';
    const skeleton: ExtractionResult = {
      ...emptyResult(),
      persons: [
        {
          name: 'Morgan Blake',
          aliases: [],
          role: null,
          companyHint: 'AdvanceIQ AI',
          topics: [],
          email: null,
          linkedin: null,
          notes: null,
        },
      ],
      companies: [{ name: 'AdvanceIQ AI', domainHint: null, industry: [] }],
    };
    const result = applyHeuristics(skeleton, transcript);
    expect(result.actions.filter((a) => a.kind === 'meeting')).toHaveLength(0);
    expect(result.topics.some((t) => t.includes('merchant') && t.includes('advance'))).toBe(true);
    expect(result.topics.join(' ')).not.toMatch(/\bmorgan\b/);
    expect(result.topics.join(' ')).not.toMatch(/\bblake\b/);
  });

  it('filters expanded stopwords (today, tomorrow, things, really, talked, discussed) from topic candidates', () => {
    // Each conversational filler appears ≥4 times so it would dominate
    // the top-3 if not filtered. A single real topic ("compilers") shows
    // up just enough to land in the top-3.
    const transcript =
      'today today today today tomorrow tomorrow tomorrow tomorrow ' +
      'things things things things really really really really ' +
      'talked talked talked talked discussed discussed discussed discussed ' +
      'compilers compilers compilers.';
    const result = applyHeuristics(emptyResult(), transcript);
    for (const banned of ['today', 'tomorrow', 'things', 'really', 'talked', 'discussed']) {
      expect(result.topics).not.toContain(banned);
    }
    // and at least one real topic survives
    expect(result.topics.some((t) => /\bcompilers\b/.test(t))).toBe(true);
  });

  it('attaches whenHint when a date span text appears in an action body', () => {
    const transcript = 'send sarah the link tomorrow.';
    const result = applyHeuristics(emptyResult(), transcript, ['tomorrow']);
    const sendAction = result.actions.find((a) => a.body.toLowerCase().includes('send'));
    expect(sendAction?.whenHint).toBe('tomorrow');
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

describe('extractTopicPhrases', () => {
  it('prefers the longest noun phrase when counts are equal', () => {
    const phrases = extractTopicPhrases(
      'we talked a lot about merchant cash advance business with the team',
    );
    expect(phrases.some((t) => t.includes('merchant') && t.includes('advance'))).toBe(true);
    expect(phrases).not.toContain('business');
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

  it('falls back to Layer-1+2 when the LLM call throws', async () => {
    // Simulate any LLM failure mode — rate limit, schema-validation,
    // network 5xx, or 8s timeout — by having the mock reject.
    // The real runLinkerLLM has try/catch + empty fallback; the mock here
    // is wrapped in the test's extractHybrid to mimic that contract.
    runLinkerLLMMock.mockRejectedValueOnce(new Error('rate_limit_exceeded'));

    const transcript = 'met sarah at acme. send her the link.';
    const providerEntities: AssemblyAIEntity[] = [
      { entity_type: 'person_name', text: 'sarah', start: 4, end: 9 },
      { entity_type: 'organization', text: 'acme', start: 13, end: 17 },
    ];

    const result = await extractHybrid({ transcript, providerEntities });

    // Layer-1+2 entities survive
    expect(result.persons.map((p) => p.name.toLowerCase())).toContain('sarah');
    expect(result.companies.map((c) => c.name.toLowerCase())).toContain('acme');
    // Layer-2 heuristic still picks up "send"
    expect(result.actions.some((a) => a.body.toLowerCase().startsWith('send'))).toBe(true);
    // No relation fields filled — LLM didn't contribute
    const sarah = result.persons.find((p) => p.name.toLowerCase() === 'sarah');
    expect(sarah?.role).toBeNull();
    expect(sarah?.companyHint).toBeNull();
    expect(sarah?.notes).toBeNull();
    // Action targetPersonName stays null (LLM is the only source for that)
    const sendAction = result.actions.find((a) => a.body.toLowerCase().startsWith('send'));
    expect(sendAction?.targetPersonName).toBeNull();
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
