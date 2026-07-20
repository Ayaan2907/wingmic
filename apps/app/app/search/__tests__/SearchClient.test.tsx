// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react';

// ── Mutable mock state (set per-test) ───────────────────────────────────
// next/navigation + tRPC closures read these module-level vars, so each
// `it` can drive a different `?q=` seed and a different query result without
// the resetModules/doMock dance (AppShell.test style is overkill here).
let searchQ: string | null = null;
type QueryState = {
  data: { entities: unknown[]; durationMs: number } | undefined;
  isFetching: boolean;
  error: { message: string } | null;
};
let queryResult: QueryState = { data: undefined, isFetching: false, error: null };

// Spy so the debounce test can assert the args/`enabled` flag the component
// actually passes (the seeded vs. live-typed term).
const useQuerySpy = vi.fn((_input?: unknown, _opts?: unknown) => queryResult);

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (_: string) => searchQ }),
}));

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    recall: {
      query: {
        useQuery: (input: unknown, opts: unknown) => useQuerySpy(input, opts),
      },
    },
  },
}));

import SearchClient from '../SearchClient';

function entity(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'e1',
    name: 'ada',
    aliases: [],
    score: 0.82,
    companies: [{ id: 'c1', name: 'acme', role: 'eng' }],
    events: [{ id: 'v1', name: 'devconnect' }],
    topics: [{ id: 't1', name: 'rust' }],
    facts: [],
    ...over,
  };
}

describe('SearchClient', () => {
  beforeEach(() => {
    searchQ = null;
    queryResult = { data: undefined, isFetching: false, error: null };
    useQuerySpy.mockClear();
  });
  afterEach(() => cleanup());

  it('seeds the query input from ?q= and queries that term immediately', () => {
    searchQ = 'rust';
    queryResult = { data: { entities: [entity()], durationMs: 12 }, isFetching: false, error: null };
    render(<SearchClient />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('rust');
    // seed must fire on mount — no timer advance needed
    expect(useQuerySpy).toHaveBeenCalledWith(
      { q: 'rust', limit: 20 },
      expect.objectContaining({ enabled: true }),
    );
  });

  it('renders all four segmented-control options and defaults to recent', () => {
    searchQ = 'rust';
    queryResult = { data: { entities: [entity()], durationMs: 12 }, isFetching: false, error: null };
    render(<SearchClient />);
    const recent = screen.getByRole('button', { name: /recent/i });
    expect(recent).toBeTruthy();
    expect(screen.getByRole('button', { name: /by company/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /by event/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /by topic/i })).toBeTruthy();
    expect(recent.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking by-company regroups under a company header', () => {
    searchQ = 'rust';
    queryResult = {
      data: {
        entities: [
          entity({ id: 'e1', name: 'ada' }),
          entity({ id: 'e2', name: 'grace', companies: [] }),
        ],
        durationMs: 12,
      },
      isFetching: false,
      error: null,
    };
    render(<SearchClient />);
    fireEvent.click(screen.getByRole('button', { name: /by company/i }));
    // company group header for the company the first entity belongs to
    expect(screen.getByRole('heading', { name: /acme/i })).toBeTruthy();
    // the company-less entity falls into an unsorted bucket
    expect(screen.getByRole('heading', { name: /unsorted/i })).toBeTruthy();
  });

  it('shows the empty prompt when ?q= is absent', () => {
    searchQ = null;
    queryResult = { data: undefined, isFetching: false, error: null };
    render(<SearchClient />);
    expect(screen.getByText(/search your graph/i)).toBeTruthy();
  });

  it('shows a no-results state when a query returns no entities', () => {
    searchQ = 'nobody';
    queryResult = { data: { entities: [], durationMs: 5 }, isFetching: false, error: null };
    render(<SearchClient />);
    expect(screen.getByText(/no matches/i)).toBeTruthy();
  });

  it('debounces live typing — the query stays disabled until ~350ms idle', () => {
    vi.useFakeTimers();
    try {
      searchQ = null;
      render(<SearchClient />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'rust' } });
      // input is instantly responsive…
      expect(input.value).toBe('rust');
      // …but the queried term hasn't caught up yet: still disabled/empty.
      expect(useQuerySpy).toHaveBeenLastCalledWith(
        { q: '', limit: 20 },
        expect.objectContaining({ enabled: false }),
      );

      // advance past the debounce window → the query fires for 'rust'.
      act(() => {
        vi.advanceTimersByTime(350);
      });
      expect(useQuerySpy).toHaveBeenLastCalledWith(
        { q: 'rust', limit: 20 },
        expect.objectContaining({ enabled: true }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
