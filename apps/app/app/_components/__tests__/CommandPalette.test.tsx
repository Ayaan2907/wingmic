import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => cleanup());

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock('@/lib/trpc/client', () => ({
  trpc: { recall: { query: { useQuery: () => ({ data: [], isFetching: false }) } } },
}));

import { CommandPalette } from '../CommandPalette';

describe('CommandPalette', () => {
  it('opens on Meta+K and closes on Escape', () => {
    render(<CommandPalette />);
    expect(screen.queryByPlaceholderText(/search your graph/i)).toBeNull();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByPlaceholderText(/search your graph/i)).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByPlaceholderText(/search your graph/i)).toBeNull();
  });

  it('submitting a query routes to /search', async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const input = screen.getByPlaceholderText(/search your graph/i);
    fireEvent.change(input, { target: { value: 'rust at acme' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(expect.stringContaining('/search?q=')));
  });
});
