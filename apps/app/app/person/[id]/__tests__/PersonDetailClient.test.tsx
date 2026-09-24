// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, fireEvent, screen } from '@testing-library/react';

afterEach(() => cleanup());

// next/link → plain <a> for tests (typedRoutes adds runtime indirection
// we don't need; same pattern other apps/app tests follow implicitly).
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === 'string' ? href : String(href)} {...rest}>
      {children}
    </a>
  ),
}));

const routerPush = vi.fn();
const routerRefresh = vi.fn();
const createDraftMutate = vi.fn();
const mergeMutate = vi.fn();
const undoMergeMutate = vi.fn();
const enrichMutate = vi.fn();
const invalidateDetail = vi.fn();

// Mutable hook state the trpc mock reads per render — lets each test pick the
// enrich mutation's pending/data/error shape.
const enrichHook = vi.hoisted(() => ({
  isPending: false,
  data: undefined as Record<string, unknown> | undefined,
  error: undefined as unknown,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), refresh: routerRefresh }),
  usePathname: () => '/person/en_sarah',
  useParams: () => ({ id: 'en_sarah' }),
}));

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    useUtils: () => ({
      entity: {
        detail: { invalidate: invalidateDetail },
      },
    }),
    acts: {
      createDraft: {
        useMutation: (opts?: { onSuccess?: (r: { ok: boolean }) => void }) => ({
          mutate: (input: unknown) => {
            createDraftMutate(input);
            opts?.onSuccess?.({ ok: true });
          },
          isPending: false,
        }),
      },
    },
    entity: {
      listPeople: {
        useQuery: () => ({ data: { people: [] }, isLoading: false }),
      },
      merge: {
        useMutation: (opts?: {
          onMutate?: (input: { sourceId: string }) => void;
          onSuccess?: (res: { mergeId: string; sourceName: string }) => void;
          onSettled?: () => void;
        }) => ({
          mutate: (input: { sourceId: string; targetId: string }) => {
            opts?.onMutate?.({ sourceId: input.sourceId });
            mergeMutate(input);
            opts?.onSuccess?.({ mergeId: 'mg_1', sourceName: 'Sarah' });
            opts?.onSettled?.();
          },
          isPending: false,
        }),
      },
      undoMerge: {
        useMutation: (opts?: { onSuccess?: () => void }) => ({
          mutate: (input: { mergeId: string }) => {
            undoMergeMutate(input);
            opts?.onSuccess?.();
          },
          isPending: false,
        }),
      },
      enrich: {
        useMutation: (opts?: { onSuccess?: (r: unknown) => void }) => ({
          mutate: (input: unknown) => {
            enrichMutate(input);
            // server resolution: hand the (test-controlled) result back so
            // the client's conditional refresh logic runs as in prod
            if (enrichHook.data) opts?.onSuccess?.(enrichHook.data);
          },
          isPending: enrichHook.isPending,
          data: enrichHook.data,
          error: enrichHook.error,
        }),
      },
    },
  },
}));

// PR λ-shell: EntityDetailScaffold no longer renders BottomTabBar (the nav +
// orb live in AppShell, asserted in AppShell.test.tsx). No mock needed.

import PersonDetailClient from '../PersonDetailClient';

const detail = {
  kind: 'person' as const,
  id: 'en_sarah',
  name: 'Sarah Chen',
  sub: {
    role: 'Rust Lead',
    companyId: 'co_acme',
    companyName: 'Acme Corp',
    warmFollowup: false,
  },
  stats: [
    { key: 'edges', value: '5' },
    { key: 'commits', value: '3' },
    { key: 'since', value: '7d' },
  ],
  captures: [
    {
      interactionId: 'it_1',
      capturedAt: new Date('2026-05-30T14:32:00Z').toISOString(),
      transcript: 'met sarah at devconnect, rust lead at acme',
    },
  ],
  followups: [],
  related: [
    { kind: 'person' as const, id: 'en_marcus', name: 'Marcus Rivera', role: 'co-attended DevConnect' },
    { kind: 'company' as const, id: 'co_acme', name: 'Acme Corp', role: 'works at' },
  ],
  topics: [{ id: 'tp_rust', name: 'rust' }],
};

describe('PersonDetailClient', () => {
  beforeEach(() => {
    routerPush.mockClear();
    routerRefresh.mockClear();
    createDraftMutate.mockClear();
    enrichMutate.mockClear();
    invalidateDetail.mockClear();
    enrichHook.isPending = false;
    enrichHook.data = undefined;
    enrichHook.error = undefined;
  });

  it('renders the person hero, stats, captures, related rows', () => {
    const { getByTestId, getAllByTestId, getByRole } = render(
      <PersonDetailClient detail={detail} />,
    );

    // hero atom (look inside entity-hero, since related rows also include PersonAvatars)
    const hero = getByTestId('entity-hero');
    expect(hero.querySelector('[data-entity-kind="person"]')).not.toBeNull();
    // name in heading
    expect(getByRole('heading', { level: 1 }).textContent).toBe('Sarah Chen');
    // stats trio
    const stats = getByTestId('entity-stats');
    expect(stats.textContent).toContain('5');
    expect(stats.textContent).toContain('3');
    expect(stats.textContent).toContain('7d');
    // at least one capture
    const caps = getAllByTestId('entity-capture');
    expect(caps.length).toBeGreaterThan(0);
    expect(caps[0]!.textContent).toContain('met sarah at devconnect');
    // related rows wired to the right hrefs
    const rows = getAllByTestId('entity-related-row');
    expect(rows.length).toBe(2);
    expect(rows[0]!.getAttribute('data-related-href')).toBe('/person/en_marcus');
    expect(rows[1]!.getAttribute('data-related-href')).toBe('/company/co_acme');
    expect(getByTestId('entity-not-enriched').textContent).toMatch(/not enriched yet/i);
  });

  it('renders possible-match cards so the user can pick who they met', () => {
    render(
      <PersonDetailClient
        detail={{
          ...detail,
          possibleMatches: [
            { id: 'en_sarah_b', name: 'Sarah', companyName: 'Acme Corp' },
          ],
          publicProfile: {
            linkedin: 'https://www.linkedin.com/in/ada-lovelace',
            url: null,
            sourceUrl: null,
          },
        }}
      />,
    );
    expect(screen.getByTestId('entity-possible-match')).toBeTruthy();
    expect(screen.getByRole('link', { name: /open/i }).getAttribute('href')).toBe(
      '/person/en_sarah_b',
    );
    expect(screen.getByTestId('entity-public-profile-card').textContent).toMatch(
      /show their linkedin/i,
    );
  });

  it('draft check-in creates an act and routes to /acts', () => {
    render(<PersonDetailClient detail={detail} />);
    fireEvent.click(screen.getByRole('button', { name: /draft check-in/i }));
    expect(createDraftMutate).toHaveBeenCalledWith({
      kind: 'email',
      intent: 'check-in',
      targetEntityId: 'en_sarah',
      contextName: 'Acme Corp',
    });
    expect(routerPush).toHaveBeenCalledWith('/acts');
  });

  it('shows a linkedin import badge when importSource is set', () => {
    render(
      <PersonDetailClient
        detail={{ ...detail, importSource: 'linkedin:batch123' }}
      />,
    );
    const tags = screen.getByTestId('entity-tags');
    expect(tags.textContent?.toLowerCase()).toContain('linkedin');
  });

  it('offers a one-tap web fetch on the not-enriched card', () => {
    render(<PersonDetailClient detail={detail} />);
    const btn = screen.getByTestId('entity-enrich-retry');
    expect(btn.textContent).toMatch(/fetch from the web/i);
    fireEvent.click(btn);
    expect(enrichMutate).toHaveBeenCalledWith({ entityId: 'en_sarah' });
  });

  it('keeps the retry affordance in the honest no-provider state', () => {
    render(<PersonDetailClient detail={{ ...detail, webSearchConfigured: false }} />);
    const state = screen.getByTestId('entity-not-enriched');
    expect(state.textContent).toMatch(/not enriched — web search isn.t configured/i);
    expect(screen.getByTestId('entity-enrich-retry')).toBeTruthy();
  });

  it('shows quiet enriching… while the fetch runs', () => {
    enrichHook.isPending = true;
    render(<PersonDetailClient detail={detail} />);
    expect(screen.queryByTestId('entity-not-enriched')).toBeNull();
    expect(screen.getByTestId('entity-enriching').textContent).toMatch(/enriching…/);
  });

  it('shows the empty-search result on the honest card and keeps retry', () => {
    enrichHook.data = { ok: true, wroteFactKeys: [] };
    render(<PersonDetailClient detail={detail} />);
    const state = screen.getByTestId('entity-not-enriched');
    expect(state.textContent).toMatch(/nothing solid found/i);
    expect(screen.getByTestId('entity-enrich-retry').textContent).toMatch(/retry/i);
  });

  it('shows the failure reason and relabels the button to retry after a failed fetch', () => {
    enrichHook.data = { ok: false, reason: 'failed', message: 'tavily down' };
    render(<PersonDetailClient detail={{ ...detail, webSearchConfigured: true }} />);
    const state = screen.getByTestId('entity-not-enriched');
    expect(state.textContent).toMatch(/not enriched — the web fetch failed/i);
    const btn = screen.getByTestId('entity-enrich-retry');
    expect(btn.textContent).toMatch(/retry →/);
    fireEvent.click(btn);
    expect(enrichMutate).toHaveBeenCalledWith({ entityId: 'en_sarah' });
  });

  it('does not refetch the page when the retry lands nothing new', () => {
    enrichHook.data = { ok: false, reason: 'no_provider' };
    render(<PersonDetailClient detail={detail} />);
    fireEvent.click(screen.getByTestId('entity-enrich-retry'));
    expect(invalidateDetail).not.toHaveBeenCalled();
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it('invalidates the detail and refreshes when enrichment writes facts', () => {
    enrichHook.data = { ok: true, wroteFactKeys: ['source_url', 'url'] };
    render(<PersonDetailClient detail={detail} />);
    fireEvent.click(screen.getByTestId('entity-enrich-retry'));
    expect(invalidateDetail).toHaveBeenCalledWith({ kind: 'person', id: 'en_sarah' });
    expect(routerRefresh).toHaveBeenCalled();
  });

  it('renders fetched source links on the enriched card (no retry shown)', () => {
    render(
      <PersonDetailClient
        detail={{
          ...detail,
          publicProfile: {
            linkedin: null,
            url: 'https://glowlabs.dev/people/nadia',
            sourceUrl: 'https://glowlabs.dev/people/nadia',
          },
          webSearchConfigured: true,
        }}
      />,
    );
    expect(screen.getByTestId('entity-public-profile-links').textContent).toMatch(
      /press mention → glowlabs\.dev/i,
    );
    expect(screen.queryByTestId('entity-not-enriched')).toBeNull();
    expect(screen.queryByTestId('entity-enrich-retry')).toBeNull();
  });
});
