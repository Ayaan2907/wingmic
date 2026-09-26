// @vitest-environment jsdom
// apps/app/app/bay/__tests__/scorePanel.test.tsx — the session-flip re-run and
// its staleness contract: when signedIn flips (the session resolves async),
// the auto-run resets and re-scores, and a late response from the superseded
// run owns nothing — no verdict, no emphasis repaint (runSeqRef guard).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { ScorePanel } from '../Cards';
import type { BayPick } from '../BayMap';
import type { ClientProfile } from '../clientProfile';

const PASTE = 'sam rivera — ml engineer at a small robotics lab. into drones, mapping, and evals.';

const PICK: BayPick = {
  kind: 'event',
  props: {
    id: 'luma:x',
    name: 'Demo Night',
    note: 'a note',
    cat: 'events',
    venue: '',
    url: '',
    sourceUrl: '',
    startsAt: '',
  },
  lng: -122.4,
  lat: 37.77,
} as unknown as BayPick;

function ok(go: number) {
  return {
    ok: true,
    event: { id: 'luma:x', title: 'Demo Night' },
    score: {
      go,
      verdict: go >= 0.6 ? ('go' as const) : ('maybe' as const),
      confidence: 0.9,
      outcome: 'worth it',
      reasons: ['close by'],
      meet: [],
      scorer: 'typed' as const,
    },
    fit: null,
    profile: { kind: 'pasted', quality: 'ok' },
    ai: false,
  };
}

const { mockScoreState, mockScoreAsync, mockClaimState, mockClaimMutate, mockSignOut } = vi.hoisted(
  () => ({
    mockScoreState: { isPending: false },
    mockScoreAsync: vi.fn(),
    mockClaimState: { isPending: false, isError: false, error: null as Error | null },
    mockClaimMutate: vi.fn(),
    mockSignOut: vi.fn(),
  }),
);

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    bay: {
      score: {
        useMutation: () => ({ mutateAsync: mockScoreAsync, isPending: mockScoreState.isPending }),
      },
      claim: {
        useMutation: () => ({
          mutate: mockClaimMutate,
          isPending: mockClaimState.isPending,
          isError: mockClaimState.isError,
          error: mockClaimState.error,
        }),
      },
    },
  },
}));

vi.mock('@/lib/auth-client', () => ({ signOut: mockSignOut }));

// next/link mounts the app router in real renders; a plain anchor keeps the
// unit focused on the panel's own contract
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderPanel(overrides: { clientProfile?: ClientProfile | null; signedIn?: boolean } = {}) {
  const props = {
    pick: PICK,
    clientProfile: { text: PASTE } as ClientProfile,
    personaId: null,
    signedIn: false,
    viewerEmail: null,
    onEmphasis: vi.fn(),
    onClosed: () => {},
    onCleared: () => {},
    ...overrides,
  };
  const view = render(<ScorePanel {...props} />);
  return {
    onEmphasis: props.onEmphasis,
    rerender: (o: { clientProfile?: ClientProfile | null; signedIn?: boolean } = {}) =>
      view.rerender(<ScorePanel {...{ ...props, ...o }} />),
  };
}

beforeEach(() => {
  mockScoreAsync.mockReset();
  mockClaimMutate.mockReset();
  mockSignOut.mockReset();
  mockScoreState.isPending = false;
  mockClaimState.isPending = false;
  mockClaimState.isError = false;
  mockClaimState.error = null;
});

afterEach(() => {
  cleanup();
});

describe('ScorePanel session flip', () => {
  it('the signedIn flip re-runs the score and a late superseded response owns nothing', async () => {
    let resolveAnonymous!: (v: unknown) => void;
    let resolveGraph!: (v: unknown) => void;
    mockScoreAsync
      // run 1: signed-out (or session still resolving) — anonymous basis
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolveAnonymous = r;
          }),
      )
      // run 2: after the flip — graph-aware
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolveGraph = r;
          }),
      );

    const { onEmphasis, rerender } = renderPanel();
    // first render: signed-out with a browser-held profile auto-runs
    await waitFor(() => expect(mockScoreAsync).toHaveBeenCalledTimes(1));
    expect(mockScoreAsync.mock.calls[0][0]).toMatchObject({ eventId: 'luma:x' });

    // the session resolves signed-in: the flip resets the auto-run and re-runs
    rerender({ signedIn: true });
    await waitFor(() => expect(mockScoreAsync).toHaveBeenCalledTimes(2));

    // the graph run wins the view
    resolveGraph(ok(0.9));
    await waitFor(() => {
      expect(screen.getByTestId('bay-score-verdict').textContent).toContain('go');
    });
    expect(onEmphasis).toHaveBeenCalledTimes(1);

    // the late anonymous response — same event id, older run — is discarded:
    // no second verdict, no second emphasis repaint
    resolveAnonymous(ok(0.1));
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByTestId('bay-score-verdict').textContent).toContain('go');
    expect(onEmphasis).toHaveBeenCalledTimes(1);
  });
});
