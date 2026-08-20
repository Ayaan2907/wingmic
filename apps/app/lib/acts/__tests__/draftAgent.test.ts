import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/config/env', () => ({
  env: {
    OPENROUTER_API_KEY: 'test-key',
    ACTS_DRAFT_MODEL: undefined,
    LINKER_MODEL: undefined,
  },
}));

import { templateDraft, polishDraft, POLISH_TIMEOUT_MS } from '../draftAgent';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('templateDraft', () => {
  it('builds a check-in template with the target first name in subject', () => {
    const draft = templateDraft({
      kind: 'email',
      intent: 'check-in',
      targetName: 'Ada Lovelace',
    });
    expect(draft.subject.toLowerCase()).toContain('ada');
    expect(draft.body.toLowerCase()).toContain('ada lovelace');
  });

  it('builds an intro template with both names', () => {
    const draft = templateDraft({
      kind: 'intro',
      intent: 'intro',
      targetName: 'Ada Lovelace',
      secondaryName: 'Grace Hopper',
      contextName: 'Acme',
    });
    expect(draft.subject).toContain('Ada Lovelace');
    expect(draft.body).toContain('Grace Hopper');
    expect(draft.body).toContain('Acme');
  });

  it('weaves seed into a sendable email instead of returning the seed alone', () => {
    const draft = templateDraft({
      kind: 'email',
      intent: 'follow-up',
      targetName: 'Ada',
      seedBody: 'send the deck tomorrow',
      transcript: 'met Ada Lovelace at Analytical Engines, she asked for the rust deck',
    });
    expect(draft.body.toLowerCase()).toContain('send the deck tomorrow');
    expect(draft.body.toLowerCase()).toContain('hey ada');
    expect(draft.body).not.toBe('send the deck tomorrow');
    expect(draft.body.toLowerCase()).toContain('analytical engines');
  });

  it('prefers the committed memo over the extractor seed as the story', () => {
    const draft = templateDraft({
      kind: 'email',
      intent: 'follow-up',
      targetName: 'Ada',
      seedBody: 'send the deck tomorrow',
      transcript: 'met Ada Lovelace at Analytical Engines, she asked for the rust deck',
    });
    const firstMention = draft.body.toLowerCase().indexOf('analytical engines');
    const seedMention = draft.body.toLowerCase().indexOf('send the deck tomorrow');
    expect(firstMention).toBeGreaterThanOrEqual(0);
    expect(seedMention).toBeGreaterThan(firstMention);
  });

  it('frames a meeting fallback as a meeting, not a reminder title', () => {
    const draft = templateDraft({
      kind: 'meeting',
      intent: 'reminder',
      channel: 'meeting',
      targetName: 'Ada Lovelace',
      contextName: 'Analytical Engines',
      seedBody: 'coffee next week',
    });
    expect(draft.subject.toLowerCase()).toContain('meet');
    expect(draft.subject.toLowerCase()).not.toContain('coffee next week');
    expect(draft.body.toLowerCase()).toContain('meeting with');
  });

  it('clamps long template subjects and seed bodies', () => {
    const longCtx = 'x'.repeat(200);
    const draft = templateDraft({
      kind: 'todo',
      intent: 'recap',
      contextName: longCtx,
      seedBody: 'y'.repeat(3000),
    });
    expect(draft.subject.length).toBeLessThanOrEqual(60);
    expect(draft.body.length).toBeLessThanOrEqual(2000);
  });

  it('writes a linkedin note without an email greeting block', () => {
    const draft = templateDraft({
      kind: 'email',
      intent: 'linkedin-note',
      channel: 'linkedin',
      targetName: 'Ada Lovelace',
      seedBody: 'talked rust at the booth',
    });
    expect(draft.subject.toLowerCase()).toContain('linkedin');
    expect(draft.body.toLowerCase()).toContain('talked rust');
    expect(draft.body.toLowerCase()).not.toContain('ping me if useful');
  });

  it('falls back whitespace-only context to the event / this company', () => {
    const recap = templateDraft({
      kind: 'todo',
      intent: 'recap',
      contextName: '   ',
    });
    expect(recap.body).toContain('the event');
    const warm = templateDraft({
      kind: 'todo',
      intent: 'warm-path',
      contextName: '   ',
    });
    expect(warm.body).toContain('this company');
  });
});

describe('polishDraft timeout', () => {
  it('returns the template when generate hangs past the timeout', async () => {
    const hanging = {
      generate: vi.fn((_prompt: string, opts?: { abortSignal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          opts?.abortSignal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        });
      }),
    };
    const started = Date.now();
    const draft = await polishDraft(
      {
        kind: 'email',
        intent: 'check-in',
        targetName: 'Ada Lovelace',
      },
      { agent: hanging as never, timeoutMs: 40 },
    );
    expect(Date.now() - started).toBeLessThan(POLISH_TIMEOUT_MS);
    expect(draft.body.toLowerCase()).toContain('ada lovelace');
    expect(hanging.generate).toHaveBeenCalled();
    const opts = hanging.generate.mock.calls[0]?.[1] as { abortSignal?: AbortSignal };
    expect(opts.abortSignal?.aborted).toBe(true);
  });
});
