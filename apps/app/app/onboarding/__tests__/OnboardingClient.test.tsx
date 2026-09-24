// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

const pushSpy = vi.fn();
const mutateAsyncSpy = vi.fn().mockResolvedValue({ ok: true });
const trackStopSpy = vi.fn();
const gumSpy = vi.fn();
const permQuerySpy = vi.fn();

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

function walkToMic() {
  walkToProfile();
  fillProfile();
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
}

describe('OnboardingClient', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    mutateAsyncSpy.mockClear();
    trackStopSpy.mockClear();
    gumSpy.mockClear();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: gumSpy },
      configurable: true,
    });
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
    expect(screen.getByPlaceholderText(/public\/basic\.ics/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/step 3 of 4/i)).toBeTruthy();
    expect(screen.getByText(/never stops to ask/i)).toBeTruthy();

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
    expect(mutateAsyncSpy.mock.calls[0]?.[0]).not.toHaveProperty('calendarIcsUrl');
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/chat'));
    expect(mutateAsyncSpy.mock.invocationCallOrder[0]).toBeLessThan(
      pushSpy.mock.invocationCallOrder[0],
    );
  });

  it('sends a public calendar ics url when filled on the you-step', async () => {
    render(<OnboardingClient />);
    walkToProfile();
    fillProfile();
    fireEvent.change(screen.getByPlaceholderText(/public\/basic\.ics/i), {
      target: {
        value:
          'https://calendar.google.com/calendar/ical/ada%40example.com/public/basic.ics',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    await waitFor(() => expect(mutateAsyncSpy).toHaveBeenCalledTimes(1));
    expect(mutateAsyncSpy).toHaveBeenCalledWith({
      firstName: 'Ada',
      lastName: 'Lovelace',
      linkedinUrl: 'https://www.linkedin.com/in/ada-lovelace',
      calendarIcsUrl:
        'https://calendar.google.com/calendar/ical/ada%40example.com/public/basic.ics',
    });
  });

  it('blocks next on the you-step when the calendar url is present but not public ics', () => {
    render(<OnboardingClient />);
    walkToProfile();
    fillProfile();
    fireEvent.change(screen.getByPlaceholderText(/public\/basic\.ics/i), {
      target: { value: 'https://example.com/not-a-calendar' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/public google calendar ics/i)).toBeTruthy();
    expect(screen.getByText(/step 2 of 4/i)).toBeTruthy();
    expect(mutateAsyncSpy).not.toHaveBeenCalled();
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

describe('mic priming (spec D4, AC6)', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    mutateAsyncSpy.mockClear();
    trackStopSpy.mockClear();
    gumSpy.mockClear();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: gumSpy },
      configurable: true,
    });
    Object.defineProperty(navigator, 'permissions', {
      value: { query: permQuerySpy },
      configurable: true,
    });
    permQuerySpy.mockReset();
    permQuerySpy.mockResolvedValue({ state: 'granted' });
  });
  afterEach(() => cleanup());

  it('asks for real getUserMedia on tap, confirms readiness, and releases the stream', async () => {
    gumSpy.mockResolvedValue({ getTracks: () => [{ stop: trackStopSpy }] });
    render(<OnboardingClient />);
    walkToMic();

    expect(screen.getByRole('button', { name: /enable the mic/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /enable the mic/i }));

    await waitFor(() => expect(gumSpy).toHaveBeenCalledWith({ audio: true }));
    await waitFor(() => expect(screen.getByText(/mic ready/i)).toBeTruthy());
    expect(trackStopSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/mic blocked/i)).toBeNull();
  });

  it('surfaces denial honestly with a retry affordance — no fake ready state', async () => {
    gumSpy.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    render(<OnboardingClient />);
    walkToMic();
    fireEvent.click(screen.getByRole('button', { name: /enable the mic/i }));

    await waitFor(() => expect(screen.getByText(/mic blocked/i)).toBeTruthy());
    expect(screen.getByText(/holding the mic/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
    expect(screen.queryByText(/mic ready/i)).toBeNull();
  });

  it('retry after denial can still reach the granted state', async () => {
    gumSpy.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    gumSpy.mockResolvedValueOnce({ getTracks: () => [{ stop: trackStopSpy }] });
    render(<OnboardingClient />);
    walkToMic();
    fireEvent.click(screen.getByRole('button', { name: /enable the mic/i }));
    await waitFor(() => expect(screen.getByText(/mic blocked/i)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => expect(screen.getByText(/mic ready/i)).toBeTruthy());
  });

  it('renders the unavailable cause without the blocked prefix — nothing blocked a missing device', async () => {
    gumSpy.mockRejectedValue(Object.assign(new Error('no device'), { name: 'NotFoundError' }));
    render(<OnboardingClient />);
    walkToMic();
    fireEvent.click(screen.getByRole('button', { name: /enable the mic/i }));

    await waitFor(() => expect(screen.getByText(/mic unavailable/i)).toBeTruthy());
    expect(screen.queryByText(/mic blocked/i)).toBeNull();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
    expect(screen.queryByText(/mic ready/i)).toBeNull();
  });

  it('promises no permission sheet only when the browser reports a persisted grant', async () => {
    gumSpy.mockResolvedValue({ getTracks: () => [{ stop: trackStopSpy }] });
    permQuerySpy.mockResolvedValue({ state: 'granted' });
    render(<OnboardingClient />);
    walkToMic();
    fireEvent.click(screen.getByRole('button', { name: /enable the mic/i }));

    await waitFor(() => expect(screen.getByText(/won't stop to ask/i)).toBeTruthy());
  });

  it('keeps granted copy honest when the browser cannot report persistence (safari)', async () => {
    gumSpy.mockResolvedValue({ getTracks: () => [{ stop: trackStopSpy }] });
    permQuerySpy.mockRejectedValue(new Error('permissions unsupported'));
    render(<OnboardingClient />);
    walkToMic();
    fireEvent.click(screen.getByRole('button', { name: /enable the mic/i }));

    await waitFor(() => expect(screen.getByText(/may ask again next time/i)).toBeTruthy());
    expect(screen.queryByText(/won't stop to ask/i)).toBeNull();
  });

  it('denial does not trap — next still advances to the privacy step', async () => {
    gumSpy.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    render(<OnboardingClient />);
    walkToMic();
    fireEvent.click(screen.getByRole('button', { name: /enable the mic/i }));
    await waitFor(() => expect(screen.getByText(/mic blocked/i)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/step 4 of 4/i)).toBeTruthy();
  });

  it('skip from the mic step still acknowledges (loop guard intact)', async () => {
    render(<OnboardingClient />);
    walkToMic();
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    await waitFor(() => expect(mutateAsyncSpy).toHaveBeenCalledTimes(1));
    expect(mutateAsyncSpy).toHaveBeenCalledWith(undefined);
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/chat'));
  });
});
