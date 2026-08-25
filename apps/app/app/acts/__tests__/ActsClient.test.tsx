// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';

type ActsListState = {
  data: { acts: Array<Record<string, unknown>> } | undefined;
  isLoading: boolean;
  lastFilter?: string;
};

let listState: ActsListState = { data: undefined, isLoading: false };
const markSentMutate = vi.fn();
const snoozeMutate = vi.fn();
const dismissMutate = vi.fn();
const updateMutate = vi.fn();
let snoozeOnError: ((err: unknown, vars: { id: string }) => void) | undefined;
let dismissOnError: ((err: unknown, vars: { id: string }) => void) | undefined;

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    acts: {
      list: {
        useQuery: (input?: { filter?: string }) => {
          listState.lastFilter = input?.filter;
          return listState;
        },
      },
      markSent: {
        useMutation: () => ({ mutate: markSentMutate, isPending: false }),
      },
      snooze: {
        useMutation: (opts?: {
          onError?: (err: unknown, vars: { id: string }) => void;
        }) => {
          snoozeOnError = opts?.onError;
          return { mutate: snoozeMutate, isPending: false };
        },
      },
      dismiss: {
        useMutation: (opts?: {
          onError?: (err: unknown, vars: { id: string }) => void;
        }) => {
          dismissOnError = opts?.onError;
          return { mutate: dismissMutate, isPending: false };
        },
      },
      update: {
        useMutation: () => ({
          mutate: updateMutate,
          mutateAsync: async (input: unknown) => {
            updateMutate(input);
            return { ok: true };
          },
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      acts: { list: { invalidate: vi.fn() } },
    }),
  },
}));

import { ActsClient } from '../ActsClient';

const sampleAct = {
  id: 'act_1',
  kind: 'reminder',
  glyph: '◷',
  name: 'Ada Lovelace',
  why: 'coffee mon · no invite sent',
  conf: 88,
  accent: 'blue' as const,
  color: '#7DD3FC',
  actionKind: 'reminder' as const,
  subject: null,
  whenHint: 'monday',
  body: 'coffee mon',
  status: 'drafted',
  createdAt: new Date(),
};

afterEach(cleanup);

describe('ActsClient', () => {
  beforeEach(() => {
    listState = { data: { acts: [sampleAct] }, isLoading: false };
    markSentMutate.mockClear();
  });

  it('shows the permission-first banner (no v0.3 preview copy)', () => {
    render(<ActsClient />);
    expect(screen.getByTestId('acts-banner').textContent?.toLowerCase()).toContain(
      'nothing auto-sends',
    );
    expect(screen.queryByText(/v0\.3/i)).toBeNull();
  });

  it('renders pending/sent/all filter chips', () => {
    render(<ActsClient />);
    expect(screen.getByTestId('acts-filter-pending').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('acts-filter-sent'));
    expect(listState.lastFilter).toBe('sent');
  });

  it('renders live draft cards with enabled send CTAs', () => {
    render(<ActsClient />);
    const sends = screen.getAllByRole('button', { name: /add to cal/i });
    expect(sends.length).toBe(1);
    expect((sends[0] as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByTestId('act-body').textContent).toMatch(/coffee mon/);
  });

  it('shows empty state when there are no drafts', () => {
    listState = { data: { acts: [] }, isLoading: false };
    render(<ActsClient />);
    expect(screen.getByTestId('acts-empty').textContent).toMatch(/no drafts yet/);
  });

  it('snoozes a draft for 24h', () => {
    render(<ActsClient />);
    fireEvent.click(screen.getByTestId('act-snooze'));
    expect(snoozeMutate).toHaveBeenCalledWith({ id: 'act_1', hours: 24 });
  });

  it('dismisses a draft', () => {
    render(<ActsClient />);
    fireEvent.click(screen.getByTestId('act-dismiss'));
    expect(dismissMutate).toHaveBeenCalledWith({ id: 'act_1' });
  });

  it('surfaces snooze/dismiss errors on the card like markSent', async () => {
    render(<ActsClient />);
    await act(async () => {
      snoozeOnError?.(new Error('fail'), { id: 'act_1' });
    });
    await waitFor(() => {
      expect(screen.getByText(/could not snooze/i)).toBeTruthy();
    });
    await act(async () => {
      dismissOnError?.(new Error('fail'), { id: 'act_1' });
    });
    await waitFor(() => {
      expect(screen.getByText(/could not dismiss/i)).toBeTruthy();
    });
  });

  it('uses correct header plural for pending drafts', () => {
    render(<ActsClient />);
    expect(screen.getByText('1 draft')).toBeTruthy();
  });

  it('does not mark sent when opening a reminder calendar file', () => {
    const createObjectURL = vi.fn(() => 'blob:act');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    render(<ActsClient />);
    fireEvent.click(screen.getByRole('button', { name: /add to cal/i }));
    expect(markSentMutate).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
