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
// PR λ-shell: EntityDetailScaffold no longer renders BottomTabBar (nav + orb
// live in AppShell, asserted in AppShell.test.tsx). No mock needed.

import CompanyDetailClient from '../CompanyDetailClient';

const detail = {
  kind: 'company' as const,
  id: 'co_acme',
  name: 'Acme Corp',
  sub: { industry: 'infra', domain: 'acme.com' },
  stats: [
    { key: 'you know', value: '3' },
    { key: 'commits', value: '7' },
    { key: 'last touch', value: '5d' },
  ],
  captures: [
    {
      interactionId: 'it_1',
      capturedAt: new Date('2026-05-30T14:32:00Z').toISOString(),
      transcript: 'acme corp came up',
    },
  ],
  followups: [],
  related: [
    { kind: 'person' as const, id: 'en_sarah', name: 'Sarah Chen', role: 'Rust Lead' },
  ],
  topics: [],
};

describe('CompanyDetailClient', () => {
  it('renders the company tile, stats, captures, related person row', () => {
    const { getByTestId, getAllByTestId, getByRole } = render(
      <CompanyDetailClient detail={detail} />,
    );

    expect(getByTestId('entity-company').getAttribute('data-entity-kind')).toBe('company');
    expect(getByRole('heading', { level: 1 }).textContent).toBe('Acme Corp');
    expect(getByTestId('entity-stats').textContent).toContain('3');
    expect(getAllByTestId('entity-capture').length).toBeGreaterThan(0);
    const rows = getAllByTestId('entity-related-row');
    expect(rows.length).toBe(1);
    expect(rows[0]!.getAttribute('data-related-href')).toBe('/person/en_sarah');
  });
});
