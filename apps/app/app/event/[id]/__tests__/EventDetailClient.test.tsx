// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, fireEvent, screen } from '@testing-library/react';

afterEach(() => cleanup());

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
  usePathname: () => '/event/ev_dc',
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
  },
}));

// PR λ-shell: EntityDetailScaffold no longer renders BottomTabBar (nav + orb
// live in AppShell, asserted in AppShell.test.tsx). No mock needed.

import EventDetailClient from '../EventDetailClient';

const detail = {
  kind: 'event' as const,
  id: 'ev_dc',
  name: 'DevConnect 26',
  sub: {
    date: new Date('2026-05-22T00:00:00Z').toISOString(),
    location: 'sf',
    durationDays: 2,
  },
  stats: [
    { key: 'people met', value: '4' },
    { key: 'commits', value: '12' },
    { key: 'topics', value: '7' },
  ],
  captures: [
    {
      interactionId: 'it_1',
      capturedAt: new Date('2026-05-22T14:32:00Z').toISOString(),
      transcript: 'devconnect day one, met sarah',
      eventName: 'DevConnect 26',
    },
  ],
  followups: [],
  related: [
    { kind: 'person' as const, id: 'en_sarah', name: 'Sarah Chen', role: 'Acme · Rust Lead' },
  ],
  topics: [{ id: 'tp_rust', name: 'rust' }],
};

describe('EventDetailClient', () => {
  beforeEach(() => {
    routerPush.mockClear();
    createDraftMutate.mockClear();
  });

  it('renders the event diamond, stats, captures, related row', () => {
    const { getByTestId, getAllByTestId, getByRole } = render(
      <EventDetailClient detail={detail} />,
    );

    expect(getByTestId('entity-event').getAttribute('data-entity-kind')).toBe('event');
    expect(getByRole('heading', { level: 1 }).textContent).toBe('DevConnect 26');
    expect(getByTestId('entity-stats').textContent).toContain('4');
    expect(getAllByTestId('entity-capture').length).toBeGreaterThan(0);
    const rows = getAllByTestId('entity-related-row');
    expect(rows[0]!.getAttribute('data-related-href')).toBe('/person/en_sarah');
  });

  it('generate recap creates an act and routes to /acts', () => {
    render(<EventDetailClient detail={detail} />);
    fireEvent.click(screen.getByRole('button', { name: /generate recap/i }));
    expect(createDraftMutate).toHaveBeenCalledWith({
      kind: 'todo',
      intent: 'recap',
      targetEntityId: 'en_sarah',
      contextName: 'DevConnect 26',
    });
    expect(routerPush).toHaveBeenCalledWith('/acts');
  });

  it('check-ins CTA creates a reminder draft and routes to /acts', () => {
    render(<EventDetailClient detail={detail} />);
    fireEvent.click(screen.getByRole('button', { name: /check-ins/i }));
    expect(createDraftMutate).toHaveBeenCalledWith({
      kind: 'reminder',
      intent: 'reminder',
      targetEntityId: 'en_sarah',
      contextName: 'DevConnect 26',
      seedBody: 'check in with Sarah Chen after DevConnect 26',
    });
    expect(routerPush).toHaveBeenCalledWith('/acts');
  });
});
