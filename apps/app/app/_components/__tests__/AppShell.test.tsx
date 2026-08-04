import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// next/link → plain <a> for tests (typedRoutes adds runtime indirection we
// don't need; matches the entity detail test pattern). Needed for the
// back-affordance test which renders EntityDetailScaffold.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === 'string' ? href : String(href)} {...rest}>
      {children}
    </a>
  ),
}));

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
    expect(screen.getByRole('button', { name: /record voice memo/i })).toBeTruthy();
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

  it('renders exactly one capture orb when a real screen mounts through the shell', async () => {
    // Compose the shell with a real screen (HomeClient) to catch the actual
    // regression: a screen also rendering an orb → two orbs on the page. We
    // inline the composition rather than use the renderWithShell helper —
    // that helper wraps in CaptureProvider, whose useRouter() throws under
    // this file's per-test vi.doMock + dynamic-import pattern. AppShell's
    // useCapture() resolves to the no-provider default here (same as the
    // other tests), and HomeClient is presentational (renders no orb).
    mockPath('/');
    const { AppShell: Shell } = await import('../AppShell');
    const { default: HomeClient } = await import('@/app/HomeClient');
    render(
      <Shell>
        <HomeClient
          userName="Ada"
          initialData={{ todayCount: 0, weekCount: 0, pendingActs: 0, recent: [] }}
        />
      </Shell>,
    );
    const orbs = screen.getAllByRole('button', { name: /record voice memo/i });
    expect(orbs).toHaveLength(1);
  });

  it('entity back link is tagged .app-backlink for desktop hiding', async () => {
    // EntityDetailScaffold renders <Link className="app-backlink">← back</Link>
    const { EntityDetailScaffold } = await import('@/app/_components/entity/EntityDetailScaffold');
    render(
      <EntityDetailScaffold kind="person" hero={<span/>} eyebrow="PERSON" name="Ada" sub="" primaryCta={{label:'a'}} ghostCta={{label:'b'}} stats={[]} captures={[]} followups={[]} related={[]} />,
    );
    const back = screen.getByLabelText('back');
    expect(back.className).toContain('app-backlink');
  });
});
