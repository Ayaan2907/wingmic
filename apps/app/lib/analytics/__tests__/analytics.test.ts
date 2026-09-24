/**
 * Unit tests for the PostHog server module: the no-key no-op contract
 * (local dev and tests stay silent), bounded PII-free properties, and
 * fire-and-forget error handling.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mutable env override — the real env module parses defaults; only the
// PostHog fields flip between tests.
const mockEnv = vi.hoisted(() => ({
  POSTHOG_KEY: undefined as string | undefined,
  POSTHOG_HOST: undefined as string | undefined,
  NEXT_PUBLIC_POSTHOG_KEY: undefined as string | undefined,
}));

const ph = vi.hoisted(() => ({
  instances: 0,
  calls: [] as Array<{ distinctId: string; event: string; properties?: Record<string, unknown> }>,
  failCapture: false,
}));

vi.mock('@/lib/config/env', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/config/env')>();
  return {
    ...real,
    env: {
      ...real.env,
      // Live getters — the mock must see mutations between tests, not a
      // spread snapshot taken at module init.
      get POSTHOG_KEY() {
        return mockEnv.POSTHOG_KEY;
      },
      get POSTHOG_HOST() {
        return mockEnv.POSTHOG_HOST;
      },
      get NEXT_PUBLIC_POSTHOG_KEY() {
        return mockEnv.NEXT_PUBLIC_POSTHOG_KEY;
      },
    },
  };
});

vi.mock('posthog-node', () => ({
  PostHog: class {
    constructor() {
      ph.instances += 1;
    }
    capture(evt: { distinctId: string; event: string; properties?: Record<string, unknown> }) {
      if (ph.failCapture) throw new Error('ingest down');
      ph.calls.push(evt);
    }
  },
}));

import { trackAnalyticsEvent, sanitizeAnalyticsProperties } from '../server';
import { ANALYTICS_EVENTS } from '../events';

describe('analytics server module', () => {
  beforeEach(() => {
    ph.calls.length = 0;
    ph.instances = 0;
    ph.failCapture = false;
    mockEnv.POSTHOG_KEY = undefined;
    mockEnv.POSTHOG_HOST = undefined;
    mockEnv.NEXT_PUBLIC_POSTHOG_KEY = undefined;
  });

  it('is a silent no-op without a key (zero-secrets boot contract)', () => {
    expect(() =>
      trackAnalyticsEvent('user_1', ANALYTICS_EVENTS.signup, { method: 'magic_link' }),
    ).not.toThrow();
    expect(ph.instances).toBe(0);
    expect(ph.calls).toEqual([]);
  });

  it('captures events once a key is configured', () => {
    mockEnv.POSTHOG_KEY = 'phc_test_key';
    trackAnalyticsEvent('user_1', ANALYTICS_EVENTS.signup, { method: 'magic_link' });

    expect(ph.instances).toBe(1);
    expect(ph.calls).toHaveLength(1);
    expect(ph.calls[0]).toMatchObject({
      distinctId: 'user_1',
      event: 'signup',
      properties: { method: 'magic_link' },
    });
  });

  it('falls back to NEXT_PUBLIC_POSTHOG_KEY when the server key is unset', () => {
    mockEnv.NEXT_PUBLIC_POSTHOG_KEY = 'phc_public_fallback';
    trackAnalyticsEvent('user_2', ANALYTICS_EVENTS.searchRun, {
      mode: 'semantic',
      results: 3,
      durationMs: 12,
    });

    expect(ph.instances).toBe(1);
    expect(ph.calls[0]!.event).toBe('search_run');
  });

  it('drops empty-string, NaN, and non-primitive properties and caps/truncates the rest', () => {
    const out = sanitizeAnalyticsProperties({
      empty: '',
      notFinite: Number.NaN,
      mode: 'semantic',
      results: 3,
      // long route string gets truncated to the 64-char bound
      route: 'a'.repeat(200),
    } as Record<string, string | number>);

    expect(out).toMatchObject({ mode: 'semantic', results: 3 });
    expect(out!['route']).toBe('a'.repeat(64));
    expect(out).not.toHaveProperty('empty');
    expect(out).not.toHaveProperty('notFinite');
    expect(Object.keys(out!).length).toBeLessThanOrEqual(12);

    // Structural backstop: sanitizer drops whatever is not a primitive.
    expect(sanitizeAnalyticsProperties({ sneaky: undefined } as never)).toEqual({});
  });

  it('is fire-and-forget: a failing client logs but never throws', () => {
    mockEnv.POSTHOG_KEY = 'phc_test_key';
    ph.failCapture = true;
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      trackAnalyticsEvent('user_3', ANALYTICS_EVENTS.captureStarted, {
        hasAttachment: false,
        hasParent: false,
        hasTarget: false,
      }),
    ).not.toThrow();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
