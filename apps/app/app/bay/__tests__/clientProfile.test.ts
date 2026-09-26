// apps/app/app/bay/__tests__/clientProfile.test.ts — the browser-held
// profile: local validation (bad pastes fail before a request), localStorage
// round-trip, clear, and the session-scoped ask history. Nothing here ever
// touches the network — locked decision 3.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearClientProfile,
  loadClientProfile,
  noteAskRun,
  profileFromText,
  recentAsks,
  saveClientProfile,
} from '../clientProfile';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('profileFromText', () => {
  it('accepts a few honest lines', () => {
    const profile = profileFromText('sam rivera — ml engineer at a small robotics lab. into drones and mapping.');
    expect(profile).not.toBeNull();
    expect(profile?.text).toContain('sam rivera');
  });

  it('rejects emptiness before a request is ever built', () => {
    expect(profileFromText('')).toBeNull();
    expect(profileFromText('   \n  ')).toBeNull();
  });
});

describe('save / load / clear round-trip', () => {
  it('keeps the profile in localStorage only', () => {
    const profile = { text: 'sam rivera, ml engineer' };
    saveClientProfile(profile);
    expect(loadClientProfile()).toEqual(profile);
    expect(window.localStorage.getItem('bay.clientProfile.v1')).toContain('sam rivera');
  });

  it('round-trips structured profiles without loss', () => {
    const profile = {
      name: 'sam rivera',
      roles: ['ml engineer'],
      topics: ['drones', 'mapping'],
      goals: ['meet hardware founders'],
    };
    saveClientProfile(profile);
    expect(loadClientProfile()).toEqual(profile);
  });

  it('clear wipes it', () => {
    saveClientProfile({ text: 'someone' });
    clearClientProfile();
    expect(loadClientProfile()).toBeNull();
  });
});

describe('ask history (session only)', () => {
  it('records recent asks newest-first, capped at five', () => {
    for (const q of ['one', 'two', 'three', 'four', 'five', 'six']) noteAskRun(q);
    expect(recentAsks()).toEqual(['six', 'five', 'four', 'three', 'two']);
  });

  it('storage failure is silent-but-honest (never throws)', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => recentAsks()).not.toThrow();
    expect(recentAsks()).toEqual([]);
    get.mockRestore();
  });
});
