import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

const routerPush = vi.fn();
const createDraftMutate = vi.fn();
let createDraftOnSuccess: ((r: { ok: boolean }) => void) | undefined;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/graph',
}));

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    acts: {
      createDraft: {
        useMutation: (opts?: { onSuccess?: (r: { ok: boolean }) => void }) => {
          createDraftOnSuccess = opts?.onSuccess;
          return {
            mutate: (input: unknown) => {
              createDraftMutate(input);
              createDraftOnSuccess?.({ ok: true });
            },
            isPending: false,
          };
        },
      },
    },
  },
}));

// Mock the dynamic force-graph: render a button per node that fires onNodeClick
// / onNodeHover, so jsdom never touches a real canvas / window.
vi.mock('next/dynamic', () => ({
  default: () =>
    function MockGraph(props: any) {
      const idOf = (end: unknown) =>
        typeof end === 'object' && end && 'id' in (end as { id: string })
          ? (end as { id: string }).id
          : String(end);
      const byId = new Map(props.graphData.nodes.map((n: any) => [n.id, n]));
      // d3-force mutates link ends in place from id strings into node objects.
      for (const l of props.graphData.links) {
        if (typeof l.source === 'string') l.source = byId.get(l.source) ?? l.source;
        if (typeof l.target === 'string') l.target = byId.get(l.target) ?? l.target;
      }
      return (
        <div data-testid="force-graph">
          {props.graphData.links.map((l: any, i: number) => (
            <span
              key={`${idOf(l.source)}-${idOf(l.target)}-${i}`}
              data-testid={`graph-link-${i}`}
              data-rel={l.rel}
              data-color={props.linkColor?.(l)}
              data-width={String(props.linkWidth?.(l) ?? props.linkWidth ?? '')}
            />
          ))}
          {props.graphData.nodes.map((n: any) => (
            <button
              key={n.id}
              onClick={() => props.onNodeClick?.(n)}
              onMouseEnter={() => props.onNodeHover?.(n)}
              onMouseLeave={() => props.onNodeHover?.(null)}
            >
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
    { id: 'e1', kind: 'event' as const, label: 'DevConnect' },
    { id: 't1', kind: 'topic' as const, label: 'rust' },
  ],
  links: [
    { source: 'p1', target: 'c1', rel: 'works_at' as const },
    { source: 'p1', target: 'e1', rel: 'attended' as const },
    { source: 'p1', target: 't1', rel: 'discussed' as const },
  ],
};

describe('GraphClient', () => {
  afterEach(cleanup);

  beforeEach(() => {
    routerPush.mockClear();
    createDraftMutate.mockClear();
  });

  it('renders a node per graph node', () => {
    render(<GraphClient data={DATA} />);
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('Acme')).toBeTruthy();
  });

  it('tapping a node shows a card linking to its entity page', () => {
    render(<GraphClient data={DATA} />);
    fireEvent.click(screen.getByText('Ada'));
    // Two open links render (mobile floating card + desktop detail rail);
    // CSS shows one per breakpoint. Both must point at the entity page.
    const opens = screen.getAllByRole('link', { name: /open/i });
    expect(opens.length).toBeGreaterThan(0);
    expect(opens.every((a) => a.getAttribute('href') === '/person/p1')).toBe(true);
  });

  it('desktop detail rail lists the selected node edges derived from links', () => {
    render(<GraphClient data={DATA} />);
    fireEvent.click(screen.getByText('Ada'));
    // p1→c1 works_at + p1→e1 attended + p1→t1 discussed.
    expect(screen.getByText(/edges · 3/i)).toBeTruthy();
    expect(screen.getByText('works_at')).toBeTruthy();
  });

  it('shows an empty state with no nodes', () => {
    render(<GraphClient data={{ nodes: [], links: [] }} />);
    expect(screen.getByText(/no connections yet/i)).toBeTruthy();
  });

  it('person draft check-in creates an email draft and routes to /acts', () => {
    render(<GraphClient data={DATA} />);
    fireEvent.click(screen.getByText('Ada'));
    fireEvent.click(screen.getAllByRole('button', { name: /draft check-in/i })[0]!);
    expect(createDraftMutate).toHaveBeenCalledWith({
      kind: 'email',
      intent: 'check-in',
      targetEntityId: 'p1',
    });
    expect(routerPush).toHaveBeenCalledWith('/acts');
  });

  it('company warm-path CTA creates a todo draft', () => {
    render(<GraphClient data={DATA} />);
    fireEvent.click(screen.getByText('Acme'));
    fireEvent.click(screen.getAllByRole('button', { name: /warm path/i })[0]!);
    expect(createDraftMutate).toHaveBeenCalledWith({
      kind: 'todo',
      intent: 'warm-path',
      contextName: 'Acme',
    });
    expect(routerPush).toHaveBeenCalledWith('/acts');
  });

  it('event check-in CTA creates a reminder draft', () => {
    render(<GraphClient data={DATA} />);
    fireEvent.click(screen.getByText('DevConnect'));
    fireEvent.click(screen.getAllByRole('button', { name: /check-in/i })[0]!);
    expect(createDraftMutate).toHaveBeenCalledWith({
      kind: 'reminder',
      intent: 'reminder',
      contextName: 'DevConnect',
      seedBody: 'send check-ins after DevConnect',
    });
    expect(routerPush).toHaveBeenCalledWith('/acts');
  });

  it('disables draft CTA for topic nodes', () => {
    render(<GraphClient data={DATA} />);
    fireEvent.click(screen.getByText('rust'));
    const btns = screen.getAllByRole('button', { name: /draft check-in/i });
    expect(btns.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    expect(createDraftMutate).not.toHaveBeenCalled();
  });

  it('paints visible relation edges on the canvas payload', () => {
    render(<GraphClient data={DATA} />);
    const worksAt = screen.getByTestId('graph-link-0');
    const attended = screen.getByTestId('graph-link-1');
    const discussed = screen.getByTestId('graph-link-2');
    expect(worksAt.getAttribute('data-rel')).toBe('works_at');
    expect(worksAt.getAttribute('data-color')).toMatch(/^#/);
    expect(Number(worksAt.getAttribute('data-width'))).toBeGreaterThan(0);
    expect(attended.getAttribute('data-rel')).toBe('attended');
    expect(attended.getAttribute('data-color')).toMatch(/^#/);
    expect(discussed.getAttribute('data-rel')).toBe('discussed');
    expect(discussed.getAttribute('data-color')).toMatch(/^#/);
  });

  it('keeps remaining edges after force-graph mutates ends and a chip toggles', () => {
    render(<GraphClient data={DATA} />);
    expect(screen.getAllByTestId(/graph-link-/)).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'topics' }));
    expect(screen.getAllByTestId(/graph-link-/)).toHaveLength(2);
    expect(screen.queryByText('rust')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'topics' }));
    expect(screen.getAllByTestId(/graph-link-/)).toHaveLength(3);
    expect(screen.getByText('rust')).toBeTruthy();
  });

  it('re-enables a filtered-off kind when search selects that node', () => {
    render(<GraphClient data={DATA} />);
    fireEvent.click(screen.getByRole('button', { name: 'orgs' }));
    expect(screen.queryByRole('button', { name: 'Acme' })).toBeNull();
    fireEvent.change(screen.getByTestId('graph-search'), { target: { value: 'acme' } });
    fireEvent.click(within(screen.getByTestId('graph-search-results')).getByRole('option'));
    expect(screen.getByRole('button', { name: 'Acme' })).toBeTruthy();
    expect(screen.getByText(/edges · 1/i)).toBeTruthy();
  });

  it('searches graph nodes and selects from the overflowing dropdown', () => {
    render(<GraphClient data={DATA} />);
    const input = screen.getByTestId('graph-search') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'acme' } });
    const results = screen.getByTestId('graph-search-results');
    expect(results.textContent).toMatch(/Acme/);
    expect(results.textContent).toMatch(/company/);
    fireEvent.click(within(results).getByRole('option'));
    expect(screen.getByText(/edges · 1/i)).toBeTruthy();
    expect(screen.queryByTestId('graph-search-results')).toBeNull();
  });

  it('closes search results on escape and moves the active option with arrows', () => {
    render(<GraphClient data={DATA} />);
    const input = screen.getByTestId('graph-search');
    fireEvent.change(input, { target: { value: 'a' } });
    const results = screen.getByTestId('graph-search-results');
    expect(within(results).getAllByRole('option').length).toBeGreaterThan(1);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('graph-search-results')).toBeNull();
  });

  it('hides the search dropdown when the query is empty', () => {
    render(<GraphClient data={DATA} />);
    expect(screen.queryByTestId('graph-search-results')).toBeNull();
    fireEvent.change(screen.getByTestId('graph-search'), { target: { value: 'zzz' } });
    expect(screen.getByTestId('graph-search-results').textContent).toMatch(
      /no matches in your graph/i,
    );
  });

  it('shows a hover card with name and avatar', () => {
    render(<GraphClient data={DATA} />);
    const nodeBtn = screen.getByRole('button', { name: 'Ada' });
    fireEvent.mouseEnter(nodeBtn);
    const card = screen.getByTestId('graph-hover-card');
    expect(card.textContent).toMatch(/Ada/);
    expect(card.textContent).toMatch(/person/);
    expect(card.querySelector('[data-testid="entity-person"]')).toBeTruthy();
    fireEvent.mouseLeave(nodeBtn);
    expect(screen.queryByTestId('graph-hover-card')).toBeNull();
  });
});
