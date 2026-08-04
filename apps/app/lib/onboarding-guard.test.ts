import { describe, it, expect, vi, beforeEach } from 'vitest';

// requireOnboarded is the critical loop-guard correctness property: it reads
// the caller's own users row and redirects to /onboarding ONLY when the flag
// is false. When true, it is a no-op (home stays home — no loop). The
// "/onboarding does not redirect back" half is structural: that page never
// imports this helper (asserted by code, not a test).

const redirectSpy = vi.fn();
const findFirstSpy = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectSpy(...args),
}));

vi.mock('@wingmic/db', () => ({
  db: { query: { users: { findFirst: (...args: unknown[]) => findFirstSpy(...args) } } },
  schema: { users: { id: 'id' } },
}));

import { requireOnboarded } from './onboarding-guard';

describe('requireOnboarded', () => {
  beforeEach(() => {
    redirectSpy.mockClear();
    findFirstSpy.mockClear();
  });

  it('redirects to /onboarding when the user has not acknowledged privacy', async () => {
    findFirstSpy.mockResolvedValue({ id: 'user_a', acknowledgedPrivacy: false });
    await requireOnboarded('user_a');
    expect(redirectSpy).toHaveBeenCalledWith('/onboarding');
  });

  it('does NOT redirect when the user has acknowledged (no loop)', async () => {
    findFirstSpy.mockResolvedValue({ id: 'user_a', acknowledgedPrivacy: true });
    await requireOnboarded('user_a');
    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it('does NOT redirect when the user row is missing', async () => {
    findFirstSpy.mockResolvedValue(undefined);
    await requireOnboarded('ghost');
    expect(redirectSpy).not.toHaveBeenCalled();
  });
});
