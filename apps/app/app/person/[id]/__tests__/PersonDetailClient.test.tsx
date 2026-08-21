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
const createDraftMutate = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/person/en_sarah',
  useParams: () => ({ id: 'en_sarah' }),
}));

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
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
    createDraftMutate.mockClear();
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
    expect(getByTestId('entity-public-profile').textContent).toMatch(/no public sources yet/i);
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
    expect(screen.getByTestId('entity-possible-match').getAttribute('href')).toBe(
      '/person/en_sarah_b',
    );
    expect(screen.getByTestId('entity-public-profile-links').textContent).toMatch(/in\/ada-lovelace/i);
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
});
