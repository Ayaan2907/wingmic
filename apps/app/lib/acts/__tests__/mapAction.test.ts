import { describe, it, expect } from 'vitest';
import {
  toPendingAct,
  resolveTargetEntityId,
  buildIcs,
  mailtoHref,
} from '../mapAction';

describe('toPendingAct', () => {
  it('maps email actions to amber UI with target name', () => {
    const pending = toPendingAct({
      kind: 'email',
      body: 'send the deck',
      whenHint: 'tomorrow',
      confidence: 88.4,
      targetName: 'Ada Lovelace',
    });
    expect(pending.kind).toBe('email');
    expect(pending.glyph).toBe('↗');
    expect(pending.name).toBe('Ada Lovelace');
    expect(pending.why).toContain('send the deck');
    expect(pending.why).toContain('tomorrow');
    expect(pending.conf).toBe(88);
    expect(pending.actionKind).toBe('email');
    expect(pending.accent).toBe('amber');
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
    expect(pending.conf).toBe(100);
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

  it('returns null when no person matches', () => {
    expect(resolveTargetEntityId('Unknown', persons, ids)).toBeNull();
    expect(resolveTargetEntityId(null, persons, ids)).toBeNull();
  });
});

describe('buildIcs + mailtoHref', () => {
  it('builds a VEVENT with escaped body', () => {
    const ics = buildIcs({
      title: 'coffee',
      description: 'line1\nline2, ok',
      whenHint: '2026-08-10T15:00:00.000Z',
    });
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:coffee');
    expect(ics).toContain('DESCRIPTION:line1\\nline2\\, ok');
    expect(ics).toContain('DTSTART:20260810T150000Z');
  });

  it('builds a mailto href with subject + body', () => {
    const href = mailtoHref({ subject: 'hi', body: 'hello world', to: 'ada@example.com' });
    expect(href.startsWith('mailto:')).toBe(true);
    expect(href).toContain('subject=hi');
    expect(href).toContain('body=hello');
  });
});
