// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// ── Mocks ───────────────────────────────────────────────────────────────
const pushSpy = vi.fn();
const mutateAsyncSpy = vi.fn().mockResolvedValue({ ok: true });

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
}));

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    onboarding: {
      acknowledge: {
        useMutation: () => ({ mutateAsync: mutateAsyncSpy, isPending: false }),
      },
    },
  },
}));

import OnboardingClient from '../OnboardingClient';

describe('OnboardingClient', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    mutateAsyncSpy.mockClear();
  });
  afterEach(() => cleanup());

  it('renders step 1 (welcome) and advances next → step 2 → step 3', () => {
    render(<OnboardingClient />);
    // step 1
    expect(screen.getByText(/social ram/i)).toBeTruthy();
    // dot progress: step 1 of 3
    expect(screen.getByText(/step 1 of 3/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/step 2 of 3/i)).toBeTruthy();
    // step 2 is the mic-permission explainer (mock, no getUserMedia)
    expect(screen.getByText(/press record/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/step 3 of 3/i)).toBeTruthy();
  });

  it('back from step 2 returns to step 1', () => {
    render(<OnboardingClient />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/step 2 of 3/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText(/step 1 of 3/i)).toBeTruthy();
  });

  it('"get started" on step 3 acknowledges then pushes /', async () => {
    render(<OnboardingClient />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    await waitFor(() => expect(mutateAsyncSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/'));
    // acknowledge resolves BEFORE the push
    expect(mutateAsyncSpy.mock.invocationCallOrder[0]).toBeLessThan(
      pushSpy.mock.invocationCallOrder[0],
    );
  });

  it('skip acknowledges then pushes / (skip still acknowledges → no re-trigger)', async () => {
    render(<OnboardingClient />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    await waitFor(() => expect(mutateAsyncSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/'));
    expect(mutateAsyncSpy.mock.invocationCallOrder[0]).toBeLessThan(
      pushSpy.mock.invocationCallOrder[0],
    );
  });
});
