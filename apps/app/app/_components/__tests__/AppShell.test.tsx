import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function mockPath(path: string) {
  vi.doMock('next/navigation', () => ({
    usePathname: () => path,
    useRouter: () => ({ push: vi.fn() }),
  }));
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    cleanup();
    vi.doUnmock('next/navigation');
  });

  it('renders the primary nav with the capture orb on an app route', async () => {
    mockPath('/');
    const { AppShell: Shell } = await import('../AppShell');
    render(<Shell><div>page</div></Shell>);
    expect(screen.getByLabelText('primary')).toBeTruthy();
    expect(screen.getByRole('button', { name: /hold to record/i })).toBeTruthy();
    expect(screen.getByText('page')).toBeTruthy();
  });

  it('marks the active tab from the pathname', async () => {
    mockPath('/graph');
    const { AppShell: Shell } = await import('../AppShell');
    render(<Shell><div>g</div></Shell>);
    const graph = screen.getByText('graph').closest('a');
    expect(graph?.getAttribute('aria-current')).toBe('page');
  });

  it('renders NO nav chrome on /signin and /onboarding', async () => {
    mockPath('/signin');
    const { AppShell: Shell } = await import('../AppShell');
    render(<Shell><div>auth</div></Shell>);
    expect(screen.queryByLabelText('primary')).toBeNull();
    expect(screen.getByText('auth')).toBeTruthy();
  });
});
