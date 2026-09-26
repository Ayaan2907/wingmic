// apps/app/app/bay/__tests__/copy.test.ts — the honesty gates on visitor
// copy: the UNSLOP banned-words scan (ported from ayaan-site's check) and the
// "a fit weight is not a probability" rule — no copy implies scores are
// percentages or odds.

import { describe, expect, it } from 'vitest';
import { BANNED_WORDS, COPY, findBannedCopy } from '../copy';

describe('COPY banned-words gate', () => {
  it('no visitor-facing string contains a banned word', () => {
    const offenders: string[] = [];
    for (const [key, value] of Object.entries(COPY)) {
      for (const hit of findBannedCopy(value)) {
        offenders.push(`${key}: ${hit}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the banned list itself keeps the ported minimum', () => {
    for (const word of ['seamless', 'delve', 'robust', 'elevate']) {
      expect(BANNED_WORDS).toContain(word);
    }
  });

  it('flags slop in new copy', () => {
    expect(findBannedCopy('a seamless experience')).toEqual(['seamless']);
    expect(findBannedCopy('a calm map')).toEqual([]);
  });
});

describe('honesty invariants', () => {
  it('never frames fit as probability or odds', () => {
    const all = Object.values(COPY).join(' ').toLowerCase();
    expect(all).not.toMatch(/%|\bpercent\b|\bodds\b|\bprobability\b/);
  });

  it('unknowns say unknown: no-read, ended, missing all have copy', () => {
    expect(COPY.noReadOnRoom).toMatch(/no read/);
    expect(COPY.scoreExpired).toBeTruthy();
    expect(COPY.scoreMissing).toBeTruthy();
  });

  it('scoring needs a profile and says so before the ask', () => {
    expect(COPY.scoreNeeded).toMatch(/paste/i);
    expect(COPY.answerNeedsProfile).toMatch(/paste/i);
  });
});
