'use client';

// AppShell — the one shared chrome (PR λ-shell). Mounted once in layout.tsx
// inside CaptureProvider + TRPCProvider. Renders a single nav whose layout
// CSS-swaps bottom-bar (≤1119) ↔ left rail (≥1120) via .app-nav. The capture
// orb is never unmounted across a viewport crossing 1120px (CSS repositions
// the same element, so setPointerCapture and in-flight recordings survive
// resize — eng-review D1=A). It is intentionally swapped for LockedBar only
// during a locked recording, where capture state lives in CaptureProvider and
// survives the swap.

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCapture } from './CaptureProvider';
import {
  NAV_TABS,
  NavLink,
  CaptureOrb,
  LockedBar,
  type BottomTabKey,
} from './BottomTabBar';
import { CommandPalette } from './CommandPalette';
import { trpc } from '@/lib/trpc/client';

// Routes that own their full viewport — no app chrome.
const CHROMELESS = ['/signin', '/onboarding'];

function activeFor(pathname: string): BottomTabKey | null {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/chat')) return 'chat';
  if (pathname.startsWith('/graph')) return 'graph';
  if (pathname.startsWith('/acts')) return 'acts';
  return null; // entity / search / settings — no tab highlighted
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const { recorder, beginCapture } = useCapture();

  const chromeless = CHROMELESS.some((p) => pathname.startsWith(p));
  const settings = trpc.settings.get.useQuery(undefined, {
    enabled: !chromeless && !pathname.startsWith('/settings'),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  if (chromeless) return <>{children}</>;

  const active = activeFor(pathname);
  const locked = recorder.status === 'locked';
  const showCalendarNudge =
    !pathname.startsWith('/settings') &&
    settings.data !== undefined &&
    !settings.data.calendarIcsUrl;

  return (
    <>
      <a href="#main-content" className="skip-link">
        skip to content
      </a>
      <main className="app-content" id="main-content">
        {showCalendarNudge ? <CalendarSettingsNudge /> : null}
        {children}
      </main>
      {locked ? (
        <LockedBar onStop={() => recorder.stop()} onDiscard={() => recorder.discard()} duration={recorder.duration} />
      ) : (
        <nav aria-label="primary" className="app-nav">
          <NavLink tab={NAV_TABS[0]} active={active === 'home'} />
          <NavLink tab={NAV_TABS[1]} active={active === 'chat'} />
          <CaptureOrb isActive={active === 'capture'} label="capture" recorder={recorder} beginCapture={beginCapture} />
          <NavLink tab={NAV_TABS[3]} active={active === 'graph'} />
          <NavLink tab={NAV_TABS[4]} active={active === 'acts'} />
        </nav>
      )}
      <CommandPalette />
    </>
  );
}

export default AppShell;

function CalendarSettingsNudge() {
  return (
    <Link
      href="/settings#calendars"
      data-testid="calendar-settings-nudge"
      style={{
        display: 'block',
        margin: '12px auto 0',
        padding: '14px',
        maxWidth: 720,
        width: 'calc(100% - 32px)',
        borderRadius: 12,
        border: '1.5px dashed rgba(255,196,82,0.4)',
        background: 'rgba(255,196,82,0.05)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
        add a public calendar in settings →
      </div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-55)', lineHeight: 1.4 }}>
        we only fetch events that calendar already publishes.
      </div>
    </Link>
  );
}
