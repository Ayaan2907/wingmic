// @vitest-environment jsdom
// apps/app/app/bay/__tests__/claimPane.test.tsx — the claim UI's cooperation
// contract: the button disables and the submitting ref guards the same tick,
// so a double-click fires one mutation carrying the sha256 captureId; the
// server-side dedupe (lib/bay/wingmic.ts) is pinned by the router tests.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { createHash, webcrypto } from 'node:crypto';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { ClaimPane, errorCodeOf } from '../Cards';

const PASTE = 'sam rivera — ml engineer at a small robotics lab. into drones, mapping, and evals.';
const CLAIM_ID = `bay-claim-${createHash('sha256').update(PASTE).digest('hex').slice(0, 16)}`;

// the shared stub handles live in vi.hoisted: vi.mock factories are hoisted
// above module-level consts, so the handles must be hoisted even higher.
// claimState is read at render time, so a test can flip it and rerender to
// simulate react-query's error state
const { mockClaimState, mockMutate, mockSignOut } = vi.hoisted(() => {
  return {
    mockClaimState: {
      isPending: false,
      isError: false,
      error: null as (Error & { data?: { code?: string } }) | null,
    },
    mockMutate: vi.fn(),
    mockSignOut: vi.fn(),
  };
});

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    bay: {
      claim: {
        useMutation: () => ({
          mutate: mockMutate,
          isPending: mockClaimState.isPending,
          isError: mockClaimState.isError,
          error: mockClaimState.error,
        }),
      },
    },
  },
}));

vi.mock('@/lib/auth-client', () => ({
  signOut: mockSignOut,
}));

// next/link mounts the app router in real renders; a plain anchor keeps the
// unit focused on the claim flow's own contract
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderPane(overrides: {
  clientProfile?: { text: string } | null;
  signedIn?: boolean;
  viewerEmail?: string | null;
} = {}) {
  const props = {
    clientProfile: { text: PASTE },
    signedIn: true,
    viewerEmail: 'sam@wingmic.test',
    onCleared: () => {},
    ...overrides,
  };
  const view = render(<ClaimPane {...props} />);
  const rerenderPane = () => view.rerender(<ClaimPane {...props} />);
  return { rerenderPane };
}

beforeEach(() => {
  mockMutate.mockReset();
  mockSignOut.mockReset();
  mockClaimState.isPending = false;
  mockClaimState.isError = false;
  mockClaimState.error = null;
  // the real WebCrypto — the UI's hash must equal the node derivation the
  // dedupe fixtures use (pinned again in captureId.test.ts)
  vi.stubGlobal('crypto', webcrypto);
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('ClaimPane', () => {
  it('a double-click submits once and carries the sha256 captureId', async () => {
    mockMutate.mockImplementation((_input, cbs) => {
      cbs?.onSettled?.();
      return undefined;
    });
    renderPane();
    const cta = screen.getByTestId('bay-claim-cta');
    fireEvent.click(cta);
    fireEvent.click(cta);
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate.mock.calls[0][0]).toEqual({
      clientProfile: { text: PASTE },
      captureId: CLAIM_ID,
    });
  });

  it('a successful claim marks saved and redirects into onboarding', async () => {
    mockMutate.mockImplementation((input, cbs) => {
      cbs?.onSuccess?.({
        captured: true,
        captureId: input.captureId,
        identityClaim: null,
        next: '/onboarding',
      });
      cbs?.onSettled?.();
      return undefined;
    });
    renderPane();
    fireEvent.click(screen.getByTestId('bay-claim-cta'));
    await waitFor(() => expect(screen.getByTestId('bay-claim-sent')).toBeDefined());
  });

  it('omits the captureId when WebCrypto is unavailable — the router derives it', async () => {
    vi.stubGlobal('crypto', {} as typeof crypto);
    mockMutate.mockImplementation((_input, cbs) => {
      cbs?.onSettled?.();
      return undefined;
    });
    renderPane();
    fireEvent.click(screen.getByTestId('bay-claim-cta'));
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate.mock.calls[0][0]).toEqual({ clientProfile: { text: PASTE } });
  });

  it('an expired session renders the re-auth prompt with the prefilled bay link — never a raw error', () => {
    mockClaimState.isError = true;
    mockClaimState.error = Object.assign(new Error('sign in required'), {
      data: { code: 'UNAUTHORIZED' },
    });
    const { rerenderPane } = renderPane();
    rerenderPane();
    expect(screen.getByTestId('bay-reauth')).toBeDefined();
    const link = screen.getByTestId('bay-reauth-link');
    expect(link.getAttribute('href')).toBe(
      `/signin?next=${encodeURIComponent('/bay')}&email=${encodeURIComponent('sam@wingmic.test')}`,
    );
    expect(screen.queryByTestId('bay-claim-error')).toBeNull();
  });

  it('a non-auth error renders the honest error line, no re-auth block', () => {
    mockClaimState.isError = true;
    mockClaimState.error = Object.assign(new Error('capture failed'), {
      data: { code: 'INTERNAL_SERVER_ERROR' },
    });
    const { rerenderPane } = renderPane();
    rerenderPane();
    expect(screen.getByTestId('bay-claim-error')).toBeDefined();
    expect(screen.queryByTestId('bay-reauth')).toBeNull();
  });

  it('sign-out replaces unlink for a session', () => {
    renderPane();
    expect(screen.getByTestId('bay-signout')).toBeDefined();
    expect(screen.queryByTestId('bay-claim-email')).toBeNull();
    fireEvent.click(screen.getByTestId('bay-signout'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('signed-out asks for the email and gates the CTA on it', () => {
    renderPane({ signedIn: false, viewerEmail: null });
    expect(screen.getByTestId('bay-claim-email')).toBeDefined();
    expect((screen.getByTestId('bay-claim-cta') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId('bay-signout')).toBeNull();
  });
});

describe('errorCodeOf', () => {
  it('reads the tRPC error code off the data envelope, tolerating junk', () => {
    expect(errorCodeOf(Object.assign(new Error('x'), { data: { code: 'UNAUTHORIZED' } }))).toBe(
      'UNAUTHORIZED',
    );
    expect(errorCodeOf(new Error('no envelope'))).toBeNull();
    expect(errorCodeOf(null)).toBeNull();
    expect(errorCodeOf({ data: { code: 42 } })).toBeNull();
  });
});
