// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

type ActsListState = {
  data: { acts: Array<Record<string, unknown>> } | undefined;
  isLoading: boolean;
};

let listState: ActsListState = { data: undefined, isLoading: false };
const markSentMutate = vi.fn();

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    acts: {
      list: {
        useQuery: () => listState,
      },
      markSent: {
        useMutation: () => ({ mutate: markSentMutate, isPending: false }),
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

  it('renders live draft cards with enabled send CTAs', () => {
    render(<ActsClient />);
    const sends = screen.getAllByRole('button', { name: /send/i });
    expect(sends.length).toBe(1);
    expect((sends[0] as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
  });

  it('shows empty state when there are no drafts', () => {
    listState = { data: { acts: [] }, isLoading: false };
    render(<ActsClient />);
    expect(screen.getByTestId('acts-empty').textContent).toMatch(/no drafts yet/);
  });

  it('calls markSent when send is clicked', () => {
    // reminder path downloads .ics — stub URL.createObjectURL for jsdom
    const createObjectURL = vi.fn(() => 'blob:act');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    render(<ActsClient />);
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(markSentMutate).toHaveBeenCalledWith({ id: 'act_1' });
    vi.unstubAllGlobals();
  });
});
