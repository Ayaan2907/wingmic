// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

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

// BottomTabBar pulls in useCapture context; stub so the scaffold mounts
// without a provider for these focused tests.
vi.mock('@/app/_components/BottomTabBar', () => ({
  BottomTabBar: () => <nav data-testid="bottom-tab-bar" />,
  TAB_BAR_HEIGHT_PX: 56,
}));

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
  });
});
