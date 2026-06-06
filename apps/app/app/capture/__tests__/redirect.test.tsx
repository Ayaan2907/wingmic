// @vitest-environment node
//
// PR β₁-B installed permanentRedirect('/chat?armRecord=1') at /capture so
// the legacy bookmark + nav target funnels into /chat with the recorder
// armed. This test is a regression guard: if anyone tweaks the redirect
// target (drops the armRecord param, or swaps permanentRedirect → redirect)
// the CI gate fires. Locked decision D3 from PR β₁ /plan-eng-review.

import { describe, it, expect, vi } from 'vitest';

// vi.mock factory is hoisted above imports, so the mock fn has to be too.
// vi.hoisted is the idiomatic escape hatch.
const { permanentRedirectMock } = vi.hoisted(() => ({
  permanentRedirectMock: vi.fn(() => {
    // Real next/navigation throws to abort the render — mirror that so callers
    // that do `permanentRedirect(...)` (no return) still terminate cleanly.
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: permanentRedirectMock,
}));

import Page from '../page';

describe('/capture redirect', () => {
  it('permanently redirects to /chat?armRecord=1', () => {
    try {
      Page();
    } catch (e) {
      // permanentRedirect throws by design — we just want to capture the call.
      expect((e as Error).message).toBe('NEXT_REDIRECT');
    }
    expect(permanentRedirectMock).toHaveBeenCalledTimes(1);
    expect(permanentRedirectMock).toHaveBeenCalledWith('/chat?armRecord=1');
  });
});
