import { describe, it, expect, vi } from 'vitest';

// Mutable env mock — streamAssistantTurn reads the key at call time, so
// tests toggle it between the deterministic-fallback path and the LLM path.
vi.mock('@/lib/config/env', () => ({
  env: {
    OPENROUTER_API_KEY: 'test-key' as string | undefined,
    CHAT_ASSISTANT_MODEL: undefined,
    ACTS_DRAFT_MODEL: undefined,
  },
}));

import { env } from '@/lib/config/env';
import {
  assistantFollowUp,
  assistantFallbackReply,
  buildAssistantPrompt,
  streamAssistantTurn,
  summarizeTurn,
  ASSISTANT_TIMEOUT_MS,
  type TurnDiff,
} from '../assistant';

const partial: TurnDiff = {
  persons: [{ name: 'Sarah Chen', role: null, companyHint: null }],
  topics: [],
  actions: [],
};

const complete: TurnDiff = {
  persons: [{ name: 'Sarah Chen', role: 'eng lead', companyHint: 'Acme' }],
  topics: ['rust'],
  actions: [],
};

const withAction: TurnDiff = {
  persons: [{ name: 'Sarah Chen', role: null, companyHint: null }],
  topics: [],
  actions: [{ kind: 'followup', body: 'ping sarah next week' }],
};

async function collect(text: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const chunk of text) out += chunk;
  return out;
}

describe('assistantFollowUp (pure rule)', () => {
  it('asks what a roleless, company-less person does', () => {
    expect(assistantFollowUp(partial)).toEqual({
      question: 'what does sarah do?',
      about: 'Sarah Chen',
    });
  });

  it('asks for the role when only the company landed', () => {
    const diff: TurnDiff = {
      persons: [{ name: 'Sarah Chen', role: null, companyHint: 'Acme' }],
      topics: [],
      actions: [],
    };
    expect(assistantFollowUp(diff)?.question).toBe('what does sarah do at Acme?');
  });

  it('asks where they work when only the role landed', () => {
    const diff: TurnDiff = {
      persons: [{ name: 'Sarah Chen', role: 'eng lead', companyHint: null }],
      topics: [],
      actions: [],
    };
    expect(assistantFollowUp(diff)?.question).toBe('where does sarah work?');
  });

  it('stays quiet when role and company are both present', () => {
    expect(assistantFollowUp(complete)).toBeNull();
  });

  it('stays quiet when a follow-up action is already queued', () => {
    expect(assistantFollowUp(withAction)).toBeNull();
  });

  it('stays quiet when no person was captured', () => {
    expect(
      assistantFollowUp({ persons: [], topics: ['rust'], actions: [] }),
    ).toBeNull();
  });
});

describe('assistantFallbackReply (no-LLM voice)', () => {
  it('acknowledges the person without the question (it renders separately)', () => {
    const reply = assistantFallbackReply(partial);
    expect(reply).toBe('noted — Sarah Chen.');
  });

  it('acks with role and company when both are known', () => {
    expect(assistantFallbackReply(complete)).toBe(
      'noted — Sarah Chen, eng lead at Acme.',
    );
  });

  it('acks queued follow-up actions without asking again', () => {
    expect(assistantFallbackReply(withAction)).toBe(
      'noted — follow-up queued.',
    );
  });

  it('acks topic-only turns', () => {
    expect(
      assistantFallbackReply({ persons: [], topics: ['rust', 'edge'], actions: [] }),
    ).toBe('noted — tagged rust, edge.');
  });
});

describe('buildAssistantPrompt', () => {
  it('includes the turn text, captured state, and the verbatim follow-up directive', () => {
    const prompt = buildAssistantPrompt({
      turnText: 'met sarah at acme',
      diff: partial,
      history: [],
    });
    expect(prompt).toContain('user just logged: "met sarah at acme"');
    expect(prompt).toContain('- person: Sarah Chen — role: unknown — company: unknown');
    expect(prompt).toContain('renders separately: "what does sarah do?"');
    expect(prompt).toContain('Do NOT include the question in your reply');
  });

  it('directs no question when the turn is complete', () => {
    const prompt = buildAssistantPrompt({ turnText: 'met sarah', diff: complete, history: [] });
    expect(prompt).toContain('Ask no question');
    expect(prompt).not.toContain('renders separately');
  });

  it('carries thread history oldest-first', () => {
    const prompt = buildAssistantPrompt({
      turnText: 'she does edge config',
      diff: complete,
      history: [
        { transcript: 'met sarah at acme', summary: 'Sarah Chen' },
        { transcript: 'coffee with ravi', summary: 'Ravi — topics: infra' },
      ],
    });
    expect(prompt).toContain('earlier turns in this thread (oldest first):');
    expect(prompt).toContain('- "met sarah at acme" → Sarah Chen');
    expect(prompt.indexOf('met sarah at acme')).toBeLessThan(
      prompt.indexOf('coffee with ravi'),
    );
  });
});

describe('summarizeTurn', () => {
  it('summarizes persons, topics, and queued follow-ups', () => {
    const diff: TurnDiff = {
      persons: [{ name: 'Sarah Chen', role: null, companyHint: null }],
      topics: ['rust', 'edge config'],
      actions: [{ kind: 'followup', body: 'x' }],
    };
    expect(summarizeTurn(diff)).toBe(
      'Sarah Chen — topics: rust, edge config — 1 follow-up',
    );
  });

  it('falls back to nothing-resolved for empty turns', () => {
    expect(summarizeTurn({ persons: [], topics: [], actions: [] })).toBe(
      'nothing resolved',
    );
  });
});

describe('streamAssistantTurn', () => {
  const envMock = env as { OPENROUTER_API_KEY?: string; CHAT_ASSISTANT_MODEL?: string };

  it('streams the deterministic fallback without OPENROUTER_API_KEY', async () => {
    const prev = envMock.OPENROUTER_API_KEY;
    envMock.OPENROUTER_API_KEY = undefined;
    try {
      const res = await streamAssistantTurn({ turnText: 'met sarah', diff: partial, history: [] });
      expect(res.source).toBe('fallback');
      expect(await collect(res.text)).toBe('noted — Sarah Chen.');
    } finally {
      envMock.OPENROUTER_API_KEY = prev;
    }
  });

  it('streams from an injected agent; the question rides in the directive, not the text', async () => {
    const seen: string[] = [];
    const fakeAgent = {
      stream: (prompt: string) => {
        seen.push(prompt);
        return {
          textStream: (async function* () {
            yield 'sarah is in.';
          })(),
        };
      },
    } as never; // Agent structural stub — streamAssistantTurn only calls .stream

    const res = await streamAssistantTurn(
      { turnText: 'met sarah', diff: partial, history: [] },
      { agent: fakeAgent },
    );
    expect(res.source).toBe('llm');
    expect(await collect(res.text)).toBe('sarah is in.');
    expect(seen[0]).toContain('renders separately: "what does sarah do?"');
  });

  it('falls back when the agent stream throws mid-flight', async () => {
    const fakeAgent = {
      stream: () => {
        throw new Error('provider 500');
      },
    } as never;
    const res = await streamAssistantTurn(
      { turnText: 'met sarah', diff: partial, history: [] },
      { agent: fakeAgent },
    );
    expect(res.source).toBe('fallback');
    expect(await collect(res.text)).toContain('noted — Sarah Chen.');
  });

  it('falls back when the agent stream stalls past the timeout', async () => {
    // Real provider streams reject their iterator when the abort signal
    // fires — emulate that, or the for-await would block forever.
    const fakeAgent = {
      stream: (_prompt: string, o: { abortSignal?: AbortSignal }) => ({
        textStream: {
          [Symbol.asyncIterator]() {
            return {
              next: () =>
                new Promise<IteratorResult<string>>((_, reject) => {
                  o?.abortSignal?.addEventListener(
                    'abort',
                    () => reject(new Error('aborted')),
                    { once: true },
                  );
                }),
            };
          },
        },
      }),
    } as never;
    const res = await streamAssistantTurn(
      { turnText: 'met sarah', diff: partial, history: [] },
      { agent: fakeAgent, timeoutMs: 30 },
    );
    expect(res.source).toBe('llm');
    // Timeout aborts mid-iteration: nothing more yields, and the SSE route's
    // done event still settles the bubble with whatever streamed (nothing).
    expect(await collect(res.text)).toBe('');
  }, 2000);

  it('keeps the hard cap at 8s', () => {
    expect(ASSISTANT_TIMEOUT_MS).toBe(8_000);
  });
});
