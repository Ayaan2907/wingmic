// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

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

function walkToProfile() {
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
}

function fillProfile() {
  fireEvent.change(screen.getByPlaceholderText('Ada'), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByPlaceholderText('Lovelace'), { target: { value: 'Lovelace' } });
  fireEvent.change(screen.getByPlaceholderText('https://www.linkedin.com/in/you'), {
    target: { value: 'https://www.linkedin.com/in/ada-lovelace' },
  });
}

function walkProfileToLast() {
  walkToProfile();
  fillProfile();
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
}

describe('OnboardingClient', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    mutateAsyncSpy.mockClear();
  });
  afterEach(() => cleanup());

  it('renders step 1 (welcome) and advances next → you → mic → privacy', () => {
    render(<OnboardingClient />);
    expect(screen.getByText(/social ram/i)).toBeTruthy();
    expect(screen.getByText(/step 1 of 4/i)).toBeTruthy();

    walkToProfile();
    expect(screen.getByText(/step 2 of 4/i)).toBeTruthy();
    expect(screen.getByPlaceholderText('Ada')).toBeTruthy();

    fillProfile();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/step 3 of 4/i)).toBeTruthy();
    expect(screen.getByText(/press record/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/step 4 of 4/i)).toBeTruthy();
  });

  it('blocks next on the you-step until first and last name are filled', () => {
    render(<OnboardingClient />);
    walkToProfile();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/first and last name/i)).toBeTruthy();
    expect(screen.getByText(/step 2 of 4/i)).toBeTruthy();
    expect(mutateAsyncSpy).not.toHaveBeenCalled();
  });

  it('back from the you-step returns to welcome', () => {
    render(<OnboardingClient />);
    walkToProfile();
    expect(screen.getByText(/step 2 of 4/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText(/step 1 of 4/i)).toBeTruthy();
  });

  it('"get started" on the last step acknowledges with the profile then pushes /chat', async () => {
    render(<OnboardingClient />);
    walkProfileToLast();
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    await waitFor(() => expect(mutateAsyncSpy).toHaveBeenCalledTimes(1));
    expect(mutateAsyncSpy).toHaveBeenCalledWith({
      firstName: 'Ada',
      lastName: 'Lovelace',
      linkedinUrl: 'https://www.linkedin.com/in/ada-lovelace',
    });
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/chat'));
    expect(mutateAsyncSpy.mock.invocationCallOrder[0]).toBeLessThan(
      pushSpy.mock.invocationCallOrder[0],
    );
  });

  it('skip acknowledges without profile even if linkedin is invalid', async () => {
    render(<OnboardingClient />);
    walkToProfile();
    fireEvent.change(screen.getByPlaceholderText('https://www.linkedin.com/in/you'), {
      target: { value: 'not-a-url' },
    });
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    await waitFor(() => expect(mutateAsyncSpy).toHaveBeenCalledTimes(1));
    expect(mutateAsyncSpy).toHaveBeenCalledWith(undefined);
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/chat'));
  });

  it('acknowledge rejection re-enables buttons, shows error, and does NOT push', async () => {
    mutateAsyncSpy.mockRejectedValueOnce(new Error('network down'));
    render(<OnboardingClient />);
    walkProfileToLast();
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    await waitFor(() => expect(mutateAsyncSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/couldn't save/i)).toBeTruthy());
    const getStartedBtn = screen.getByRole('button', { name: /get started/i }) as HTMLButtonElement;
    const skipBtn = screen.getByRole('button', { name: /skip/i }) as HTMLButtonElement;
    expect(getStartedBtn.disabled).toBe(false);
    expect(skipBtn.disabled).toBe(false);
    expect(pushSpy).not.toHaveBeenCalled();
  });
});
