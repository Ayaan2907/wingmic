import { describe, it, expect } from 'vitest';
import { templateDraft } from '../draftAgent';

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
});
