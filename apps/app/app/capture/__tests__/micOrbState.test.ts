import { describe, expect, it } from 'vitest';
import { micOrbStateFor } from '../micOrbState';

describe('micOrbStateFor (PR α v15 — 9→7 mapping)', () => {
  it('idle without hover → idle', () => {
    expect(micOrbStateFor('idle', false)).toBe('idle');
  });

  it('idle with hover → hover', () => {
    expect(micOrbStateFor('idle', true)).toBe('hover');
  });

  it('arming → recording (mic prepping, visually live)', () => {
    expect(micOrbStateFor('arming', false)).toBe('recording');
  });

  it('recording → recording', () => {
    expect(micOrbStateFor('recording', false)).toBe('recording');
  });

  it('cancel_armed → recording (orb steady; chrome shows slide hint)', () => {
    expect(micOrbStateFor('cancel_armed', false)).toBe('recording');
  });

  it('lock_armed → recording', () => {
    expect(micOrbStateFor('lock_armed', false)).toBe('recording');
  });

  it('locked → locked', () => {
    expect(micOrbStateFor('locked', false)).toBe('locked');
  });

  it('encoding → sending (blob finalizing for upload)', () => {
    expect(micOrbStateFor('encoding', false)).toBe('sending');
  });

  it('ready without hover → idle (transient pre-reset frame)', () => {
    expect(micOrbStateFor('ready', false)).toBe('idle');
  });

  it('error → idle (failure surfaces in the failed-bubble, not the orb)', () => {
    expect(micOrbStateFor('error', false)).toBe('idle');
  });

  it('hover wins on idle/ready/error', () => {
    expect(micOrbStateFor('ready', true)).toBe('hover');
    expect(micOrbStateFor('error', true)).toBe('hover');
  });

  it('hover does NOT override an active recorder state', () => {
    expect(micOrbStateFor('recording', true)).toBe('recording');
    expect(micOrbStateFor('locked', true)).toBe('locked');
    expect(micOrbStateFor('encoding', true)).toBe('sending');
  });
});
