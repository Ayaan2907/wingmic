// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { PersonListRail } from '../PersonListRail';

let listState: {
  data: { people: Array<{ id: string; name: string; importSource: string | null }> } | undefined;
  isLoading: boolean;
} = { data: undefined, isLoading: false };

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'e1' }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    entity: {
      listPeople: {
        useQuery: () => listState,
      },
    },
  },
}));

afterEach(() => {
  cleanup();
  listState = { data: undefined, isLoading: false };
});

describe('PersonListRail', () => {
  it('shows empty copy when the user has no people', () => {
    listState = { data: { people: [] }, isLoading: false };
    render(<PersonListRail />);
    expect(screen.getByTestId('person-list-rail').className).toContain('desktop-pane');
    expect(screen.getByTestId('person-list-rail').className).toContain('people-rail');
    expect(screen.getByText(/no people yet/i)).toBeTruthy();
    expect(screen.queryByText(/sarah chen/i)).toBeNull();
  });

  it('lists live people and highlights the active id', () => {
    listState = {
      data: {
        people: [
          { id: 'e1', name: 'Ada Lovelace', importSource: null },
          { id: 'e2', name: 'Grace Hopper', importSource: 'vcard:batch' },
        ],
      },
      isLoading: false,
    };
    render(<PersonListRail />);
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('Grace Hopper')).toBeTruthy();
    const active = screen.getByTestId('person-rail-row-e1');
    expect(active.getAttribute('href')).toBe('/person/e1');
  });
});
