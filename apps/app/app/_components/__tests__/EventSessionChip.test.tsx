// @vitest-environment jsdom
// Chip rendering tests (spec D1 UI, AC2/AC3): the REAL EventSessionProvider
// drives the REAL EventSessionChip, with events.current controlled through a
// mutable module binding — the same data-identity contract react-query keeps
// per fetch, so rerendering after a swap triggers exactly one response.
//
// next/navigation usePathname is stubbed to a chrome'd route so the provider
// resolves instead of idling.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import * as React from 'react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/chat',
}));

const { eventsBindMutate, settingsIcsUrl } = vi.hoisted(() => ({
  eventsBindMutate: vi.fn(),
  settingsIcsUrl: { current: 'https://calendar.google.com/calendar/ical/x/public/basic.ics' },
}));

// Mutable per-test; identity swaps drive new responses (see header note).
let eventsCurrentData: { session: unknown; candidates: unknown[] } = { session: null, candidates: [] };

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    settings: {
      get: {
        useQuery: () => ({ data: { calendarIcsUrl: settingsIcsUrl.current }, isLoading: false }),
      },
    },
    events: {
      current: {
        useQuery: () => ({
          data: eventsCurrentData,
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        }),
      },
      bind: {
        useMutation: () => ({ mutateAsync: eventsBindMutate, isPending: false }),
      },
    },
  },
}));

import { EventSessionProvider } from '../EventSessionProvider';
import { EventSessionChip } from '../EventSessionChip';

function evt(name: string, id: string | null = null) {
  return {
    id,
    name,
    location: null,
    url: null,
    dateRangeStart: new Date('2026-09-24T10:00:00Z'),
    dateRangeEnd: new Date('2026-09-24T12:00:00Z'),
    allDay: false,
  };
}

function SessionSurface() {
  return (
    <EventSessionProvider>
      <EventSessionChip />
    </EventSessionProvider>
  );
}

function renderSurface() {
  const { rerender } = render(
    <div data-testid="session-harness">
      <SessionSurface />
    </div>,
  );
  return {
    /** Swap the events.current payload (new identity → one new response). */
    respond(session: unknown, candidates: unknown[]) {
      eventsCurrentData = { session, candidates };
      rerender(
        <div data-testid="session-harness">
          <SessionSurface />
        </div>,
      );
    },
  };
}

beforeEach(() => {
  eventsBindMutate.mockReset();
  eventsCurrentData = { session: null, candidates: [] };
  settingsIcsUrl.current = 'https://calendar.google.com/calendar/ical/x/public/basic.ics';
});

afterEach(() => {
  cleanup();
});

describe('EventSessionChip', () => {
  it('renders nothing while loading and on none without an ICS url', () => {
    settingsIcsUrl.current = '';
    renderSurface();
    expect(screen.queryByTestId('event-session-chip')).toBeNull();
    expect(screen.queryByTestId('event-session-ghost')).toBeNull();
  });

  it('renders the honest ghost when none matches but a calendar is set', () => {
    renderSurface(); // session: null, calendar set
    expect(screen.getByTestId('event-session-ghost').textContent).toContain('not at an event');
  });

  it('silently auto-binds a single ongoing match and canonicalizes via events.bind', async () => {
    eventsBindMutate.mockResolvedValue({ session: { state: 'bound', event: evt('nexa summit', 'ev_1'), source: 'ics-auto' } });
    const harness = renderSurface();
    harness.respond({ state: 'bound', event: evt('nexa summit'), source: 'ics-auto' }, [evt('nexa summit')]);
    const chip = await screen.findByTestId('event-session-chip');
    expect(chip.textContent).toContain('at');
    expect(chip.textContent).toContain('nexa summit');
    // The id-less wire event triggers the canonical-row bind with ics-auto provenance.
    await waitFor(() => {
      expect(eventsBindMutate).toHaveBeenCalledWith(
        expect.objectContaining({ event: expect.objectContaining({ name: 'nexa summit' }), source: 'ics-auto' }),
      );
    });
  });

  it('keeps a resolved bind quiet — no churn on the same event across polls', async () => {
    const harness = renderSurface();
    harness.respond({ state: 'bound', event: evt('nexa summit', 'ev_1'), source: 'ics-auto' }, [evt('nexa summit', 'ev_1')]);
    await screen.findByTestId('event-session-chip');
    // Server already had the row → no bind call.
    expect(eventsBindMutate).not.toHaveBeenCalled();

    // Poll returns the same event → chip persists, still no bind.
    harness.respond({ state: 'bound', event: evt('nexa summit', 'ev_1'), source: 'ics-auto' }, [evt('nexa summit', 'ev_1')]);
    expect(screen.getByTestId('event-session-chip')).toBeTruthy();
    expect(eventsBindMutate).not.toHaveBeenCalled();
  });

  it('auto-opens the picker on ambiguity and binds in one tap', async () => {
    const a = evt('nexa summit');
    const b = evt('web summit');
    eventsBindMutate.mockResolvedValue({ session: { state: 'bound', event: { ...b, id: 'ev_ws' }, source: 'picked' } });
    const harness = renderSurface();
    harness.respond({ state: 'ambiguous', candidates: [a, b] }, [a, b]);

    // One-time bottom sheet opens by itself.
    const picker = await screen.findByTestId('event-session-picker');
    expect(picker.textContent).toContain('are you at?');
    expect(screen.getAllByTestId('event-session-option')).toHaveLength(2);

    // One tap binds.
    fireEvent.click(screen.getAllByTestId('event-session-option')[1]);
    await waitFor(() => {
      expect(eventsBindMutate).toHaveBeenCalledWith(
        expect.objectContaining({ event: expect.objectContaining({ name: 'web summit' }), source: 'picked' }),
      );
    });
    const chip = await screen.findByTestId('event-session-chip');
    expect(chip.textContent).toContain('web summit');
  });

  it('the picker sheet dismisses on Escape and restores focus', async () => {
    const a = evt('nexa summit');
    const b = evt('web summit');
    const harness = renderSurface();
    harness.respond({ state: 'ambiguous', candidates: [a, b] }, [a, b]);
    await screen.findByTestId('event-session-picker');

    // aria-modal semantics: focus moves into the sheet on open…
    expect(document.activeElement?.getAttribute('data-testid')).toBe('event-session-picker');

    // …and Escape dismisses it.
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('event-session-picker')).toBeNull();
    });
    expect(document.activeElement).toBe(document.body);
  });

  it('the ambiguous chip surfaces the question before the sheet is answered', async () => {
    const a = evt('nexa summit');
    const b = evt('web summit');
    const harness = renderSurface();
    harness.respond({ state: 'ambiguous', candidates: [a, b] }, [a, b]);
    const chip = await screen.findByTestId('event-session-chip');
    expect(chip.textContent).toContain('which event is this?');
  });

  it('review sheet unbinds and the same event stays suppressed on the next poll', async () => {
    const a = evt('nexa summit', 'ev_1');
    const harness = renderSurface();
    harness.respond({ state: 'bound', event: a, source: 'ics-auto' }, [a]);
    const chip = await screen.findByTestId('event-session-chip');

    fireEvent.click(chip);
    const review = await screen.findByTestId('event-session-review');
    expect(review.textContent).toContain('nexa summit');
    expect(review.textContent).toContain('from your calendar');

    fireEvent.click(screen.getByTestId('event-session-unbind'));
    await waitFor(() => expect(screen.queryByTestId('event-session-chip')).toBeNull());
    expect(screen.getByTestId('event-session-ghost')).toBeTruthy();

    // Next poll: same ongoing event must NOT silently re-bind.
    harness.respond({ state: 'bound', event: a, source: 'ics-auto' }, [a]);
    expect(screen.queryByTestId('event-session-chip')).toBeNull();
    expect(eventsBindMutate).not.toHaveBeenCalled();
  });

  it('expiry auto-clears with a quiet toast, then the ghost returns', async () => {
    const a = evt('nexa summit', 'ev_1');
    const harness = renderSurface();
    harness.respond({ state: 'bound', event: a, source: 'ics-auto' }, [a]);
    await screen.findByTestId('event-session-chip');

    // Window closed: session null + empty candidates.
    harness.respond(null, []);
    const toast = await screen.findByTestId('event-session-toast');
    expect(toast.textContent).toContain('left nexa summit');
    await waitFor(() => expect(screen.getByTestId('event-session-ghost')).toBeTruthy());
  });
});
