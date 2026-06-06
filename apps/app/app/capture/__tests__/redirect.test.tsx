// @vitest-environment node
//
// PR β₁-D rolled back the armRecord URL-param approach: the /capture
// route now plain-redirects to /chat, and the global CaptureProvider
// owns the recorder. Recording starts via the orb in the bottom nav
// (live on every route), not via a deep-link param. This test guards
// the redirect target.

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
  it('permanently redirects to /chat (no armRecord param)', () => {
    try {
      Page();
    } catch (e) {
      // permanentRedirect throws by design — we just want to capture the call.
      expect((e as Error).message).toBe('NEXT_REDIRECT');
    }
    expect(permanentRedirectMock).toHaveBeenCalledTimes(1);
    expect(permanentRedirectMock).toHaveBeenCalledWith('/chat');
  });
});
