// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

afterEach(() => cleanup());

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === 'string' ? href : String(href)} {...rest}>
      {children}
    </a>
  ),
}));

const routerPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/topic/tp_rust',
}));

import TopicDetailClient from '../TopicDetailClient';

const detail = {
  kind: 'topic' as const,
  id: 'tp_rust',
  name: 'rust',
  sub: { slug: 'rust' },
  stats: [
    { key: 'people', value: '2' },
    { key: 'commits', value: '2' },
    { key: 'last touch', value: '3d' },
  ],
  captures: [
    {
      interactionId: 'it_1',
      capturedAt: new Date('2026-05-30T14:32:00Z').toISOString(),
      transcript: 'talked rust with sarah',
      topics: ['rust'],
    },
  ],
  followups: [],
  related: [
    { kind: 'person' as const, id: 'en_sarah', name: 'Sarah Chen', role: 'Acme Corp · Rust Lead' },
    { kind: 'company' as const, id: 'co_acme', name: 'Acme Corp', role: 'shared topic' },
    { kind: 'event' as const, id: 'ev_dc', name: 'DevConnect 26', role: 'shared topic' },
  ],
  topics: [],
};

describe('TopicDetailClient', () => {
  it('renders topic hero, stats, captures, and related graph nodes', () => {
    const { getByTestId, getAllByTestId, getByRole } = render(
      <TopicDetailClient detail={detail} />,
    );

    expect(getByTestId('entity-topic').getAttribute('data-entity-kind')).toBe('topic');
    expect(getByRole('heading', { level: 1 }).textContent).toBe('rust');
    expect(getByTestId('entity-stats').textContent).toContain('2');
    expect(getAllByTestId('entity-capture').length).toBe(1);
    const rows = getAllByTestId('entity-related-row');
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.getAttribute('data-related-href'))).toEqual([
      '/person/en_sarah',
      '/company/co_acme',
      '/event/ev_dc',
    ]);
  });
});
