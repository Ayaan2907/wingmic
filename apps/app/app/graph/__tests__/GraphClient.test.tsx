import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock the dynamic force-graph: render a button per node that fires onNodeClick,
// so jsdom never touches a real canvas / window.
vi.mock('next/dynamic', () => ({
  default: () =>
    function MockGraph(props: any) {
      return (
        <div data-testid="force-graph">
          {props.graphData.nodes.map((n: any) => (
            <button key={n.id} onClick={() => props.onNodeClick?.(n)}>
              {n.label}
            </button>
          ))}
        </div>
      );
    },
}));

import { GraphClient } from '../GraphClient';

const DATA = {
  nodes: [
    { id: 'p1', kind: 'person' as const, label: 'Ada' },
    { id: 'c1', kind: 'company' as const, label: 'Acme' },
  ],
  links: [{ source: 'p1', target: 'c1', rel: 'works_at' as const }],
};

describe('GraphClient', () => {
  afterEach(cleanup);

  it('renders a node per graph node', () => {
    render(<GraphClient data={DATA} />);
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('Acme')).toBeTruthy();
  });

  it('tapping a node shows a card linking to its entity page', () => {
    render(<GraphClient data={DATA} />);
    fireEvent.click(screen.getByText('Ada'));
    const open = screen.getByRole('link', { name: /open/i });
    expect(open.getAttribute('href')).toBe('/person/p1');
  });

  it('shows an empty state with no nodes', () => {
    render(<GraphClient data={{ nodes: [], links: [] }} />);
    expect(screen.getByText(/no connections yet/i)).toBeTruthy();
  });
});
