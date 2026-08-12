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

  it('prefers seed body when provided', () => {
    const draft = templateDraft({
      kind: 'email',
      intent: 'follow-up',
      targetName: 'Ada',
      seedBody: 'send the deck tomorrow',
    });
    expect(draft.body).toBe('send the deck tomorrow');
  });

  it('clamps long template subjects and seed bodies', () => {
    const longCtx = 'x'.repeat(200);
    const draft = templateDraft({
      kind: 'todo',
      intent: 'recap',
      contextName: longCtx,
      seedBody: 'y'.repeat(3000),
    });
    expect(draft.subject.length).toBeLessThanOrEqual(120);
    expect(draft.body.length).toBeLessThanOrEqual(2000);
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
