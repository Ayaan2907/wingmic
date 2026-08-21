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
    {
      interactionId: 'it_photo',
      capturedAt: new Date('2026-08-20T17:24:00Z').toISOString(),
      transcript: 'attached a photo',
      eventName: 'DevConnect 26',
      jpegBase64: 'aGVsbG93aW5nbWljLXRlc3QtcGhvdG8tZGF0YQ==',
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
    const photo = getAllByTestId('entity-capture').find((el) =>
      el.textContent?.includes('attached a photo'),
    );
    expect(photo?.querySelector('img[alt="attached photo"]')?.getAttribute('src')).toContain(
      'data:image/jpeg;base64,aGVsbG93aW5nbWljLXRlc3QtcGhvdG8tZGF0YQ==',
    );
    const rows = getAllByTestId('entity-related-row');
    expect(rows[0]!.getAttribute('data-related-href')).toBe('/person/en_sarah');
  });

  it('links a public event page when url is set', () => {
    render(
      <EventDetailClient
        detail={{
          ...detail,
          sub: { ...detail.sub, url: 'https://devconnect.example/2026' },
        }}
      />,
    );
    const link = screen.getByTestId('event-public-url') as HTMLAnchorElement;
    expect(link.href).toContain('https://devconnect.example/2026');
  });

  it('generate recap creates an act and routes to /acts', () => {
    render(<EventDetailClient detail={detail} />);
    fireEvent.click(screen.getByRole('button', { name: /generate recap/i }));
    expect(createDraftMutate).toHaveBeenCalledWith({
      kind: 'todo',
      intent: 'recap',
      contextName: 'DevConnect 26',
    });
    expect(routerPush).toHaveBeenCalledWith('/acts');
  });

  it('check-ins CTA creates a reminder draft without person targetEntityId', () => {
    render(<EventDetailClient detail={detail} />);
    fireEvent.click(screen.getByRole('button', { name: /check-ins/i }));
    expect(createDraftMutate).toHaveBeenCalledWith({
      kind: 'reminder',
      intent: 'reminder',
      contextName: 'DevConnect 26',
      seedBody: 'send check-ins after DevConnect 26',
    });
    expect(routerPush).toHaveBeenCalledWith('/acts');
  });
});
