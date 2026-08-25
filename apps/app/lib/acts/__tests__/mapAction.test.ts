import { describe, it, expect } from 'vitest';
import {
  toPendingAct,
  resolveTargetEntityId,
  resolveIntroEntityIds,
  buildIcs,
  mailtoHref,
  collapseActionsForCapture,
} from '../mapAction';

describe('toPendingAct', () => {
  it('maps email actions to amber UI with target name', () => {
    const pending = toPendingAct({
      kind: 'email',
      body: 'send the deck',
      whenHint: 'tomorrow',
      confidence: 88.4,
      targetName: 'Ada Lovelace',
      hasEmail: true,
    });
    expect(pending.kind).toBe('email');
    expect(pending.glyph).toBe('✉');
    expect(pending.name).toBe('Ada Lovelace');
    expect(pending.body).toContain('send the deck');
    expect(pending.whenHint).toBe('tomorrow');
    expect(pending.why).toBe('tomorrow');
    expect(pending.conf).toBe(88);
    expect(pending.actionKind).toBe('email');
    expect(pending.accent).toBe('amber');
    expect(pending.channel).toBe('email');
  });

  it('maps email without an address to a linkedin note when a profile exists', () => {
    const pending = toPendingAct({
      kind: 'email',
      body: 'talked rust at the booth',
      confidence: 80,
      targetName: 'Ada Lovelace',
      hasLinkedin: true,
    });
    expect(pending.channel).toBe('linkedin');
    expect(pending.kind).toBe('linkedin');
    expect(pending.glyph).toBe('in');
  });

  it('formats intro names as target → secondary', () => {
    const pending = toPendingAct({
      kind: 'intro',
      body: 'both work on voice',
      confidence: 74,
      targetName: 'Priya',
      secondaryName: 'Deepak',
    });
    expect(pending.name).toBe('Priya → Deepak');
    expect(pending.actionKind).toBe('intro');
    expect(pending.accent).toBe('violet');
  });

  it('falls back unknown kinds to todo', () => {
    const pending = toPendingAct({
      kind: 'weird',
      body: 'do a thing',
      confidence: 200,
    });
    expect(pending.actionKind).toBe('todo');
    expect(pending.channel).toBe('memo');
    expect(pending.kind).toBe('memo');
    expect(pending.conf).toBe(100);
    expect(pending.name).toBe('memo');
  });
});

describe('collapseActionsForCapture', () => {
  it('keeps one action per kind per person and skips undated meetings', () => {
    const persons = [{ name: 'Sagar' }];
    const collapsed = collapseActionsForCapture(
      [
        { kind: 'email', body: 'linkedin note one', whenHint: null, targetPersonName: 'Sagar' },
        { kind: 'email', body: 'linkedin note two', whenHint: null, targetPersonName: 'Sagar' },
        { kind: 'meeting', body: 'met with sagar', whenHint: null, targetPersonName: 'Sagar' },
        { kind: 'meeting', body: 'follow-up friday', whenHint: 'Friday', targetPersonName: 'Sagar' },
      ],
      persons,
    );
    expect(collapsed).toHaveLength(2);
    expect(collapsed.map((a) => a.kind).sort()).toEqual(['email', 'meeting']);
    expect(collapsed.find((a) => a.kind === 'meeting')?.whenHint).toBe('Friday');
  });

  it('fills a missing target from the first extracted person', () => {
    const collapsed = collapseActionsForCapture(
      [{ kind: 'todo', body: 'send the deck', whenHint: null, targetPersonName: null }],
      [{ name: 'Ada Lovelace' }],
    );
    expect(collapsed[0]?.targetPersonName).toBe('Ada Lovelace');
  });
});

describe('resolveTargetEntityId', () => {
  const persons = [{ name: 'Ada Lovelace' }, { name: 'Grace Hopper' }];
  const ids = ['e_ada', 'e_grace'];

  it('matches exact names case-insensitively', () => {
    expect(resolveTargetEntityId('ada lovelace', persons, ids)).toBe('e_ada');
  });

  it('soft-matches on whole name tokens', () => {
    expect(resolveTargetEntityId('Ada', persons, ids)).toBe('e_ada');
    expect(resolveTargetEntityId('Ann', [{ name: 'Joanne Smith' }], ['e_joanne'])).toBeNull();
  });

  it('matches unicode letter tokens', () => {
    expect(
      resolveTargetEntityId('佐藤', [{ name: '佐藤 花子' }], ['e_sato']),
    ).toBe('e_sato');
  });

  it('returns null when no person matches', () => {
    expect(resolveTargetEntityId('Unknown', persons, ids)).toBeNull();
    expect(resolveTargetEntityId(null, persons, ids)).toBeNull();
  });
});

describe('resolveIntroEntityIds', () => {
  it('does not pick a secondary when the target is unresolved', () => {
    const result = resolveIntroEntityIds(
      { kind: 'intro', targetPersonName: null },
      [{ name: 'Ada' }, { name: 'Grace' }],
      ['e_ada', 'e_grace'],
    );
    expect(result).toEqual({ targetEntityId: null, secondaryEntityId: null });
  });

  it('picks a different person as secondary when target resolves', () => {
    const result = resolveIntroEntityIds(
      { kind: 'intro', targetPersonName: 'Ada' },
      [{ name: 'Ada' }, { name: 'Grace' }],
      ['e_ada', 'e_grace'],
    );
    expect(result).toEqual({ targetEntityId: 'e_ada', secondaryEntityId: 'e_grace' });
  });
});

describe('buildIcs + mailtoHref', () => {
  it('builds a VEVENT with escaped body including CR/CRLF', () => {
    const ics = buildIcs({
      title: 'coffee',
      description: 'line1\r\nline2\rok',
      whenHint: '2026-08-10T15:00:00.000Z',
    });
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:coffee');
    expect(ics).toContain('DESCRIPTION:line1\\nline2\\nok');
    expect(ics).toContain('DTSTART:20260810T150000Z');
  });

  it('emits VALUE=DATE for date-only whenHint', () => {
    const ics = buildIcs({
      title: 'meetup',
      description: 'all day',
      whenHint: '2026-08-10',
    });
    expect(ics).toContain('DTSTART;VALUE=DATE:20260810');
    expect(ics).toContain('DTEND;VALUE=DATE:20260811');
    expect(ics).not.toContain('DTSTART:20260810T');
  });

  it('builds a mailto href with subject + body', () => {
    const href = mailtoHref({ subject: 'hi', body: 'hello world', to: 'ada@example.com' });
    expect(href.startsWith('mailto:')).toBe(true);
    expect(href).toContain('subject=hi');
    expect(href).toContain('body=hello');
  });
});
