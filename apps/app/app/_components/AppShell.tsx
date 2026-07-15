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

// Routes that own their full viewport — no app chrome.
const CHROMELESS = ['/signin', '/onboarding'];

function activeFor(pathname: string): BottomTabKey | null {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/chat')) return 'capture';
  if (pathname.startsWith('/graph')) return 'graph';
  if (pathname.startsWith('/acts')) return 'acts';
  return null; // entity / search / etc — no tab highlighted
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const { recorder, beginCapture } = useCapture();

  const chromeless = CHROMELESS.some((p) => pathname.startsWith(p));
  if (chromeless) return <>{children}</>;

  const active = activeFor(pathname);
  const locked = recorder.status === 'locked';

  return (
    <>
      <div className="app-content">{children}</div>
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
