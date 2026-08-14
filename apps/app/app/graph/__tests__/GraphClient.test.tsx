import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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
    { id: 'e1', kind: 'event' as const, label: 'DevConnect' },
    { id: 't1', kind: 'topic' as const, label: 'rust' },
  ],
  links: [
    { source: 'p1', target: 'c1', rel: 'works_at' as const },
    { source: 'p1', target: 'e1', rel: 'attended' as const },
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
    // p1→c1 works_at + p1→e1 attended.
    expect(screen.getByText(/edges · 2/i)).toBeTruthy();
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
});
