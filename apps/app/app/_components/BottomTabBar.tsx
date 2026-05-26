// BottomTabBar — shared 5-slot mobile bottom nav (PR α v8/v9).
//
// Source of truth: design/v2/library/lib-screens.jsx MobileNav.
// Extracted from capture/CaptureClient.tsx in v9 so both ScreenHome (/)
// and ScreenCapture (/capture) can consume the same chrome.
//
// Center "capture" slot is a brutal accent disc that breaks the bar plane —
// matches MobileNav `big: true` in the design lib.

'use client';

import * as React from 'react';

const accent = '#FFC452';

/** Bottom-nav height — kept in sync with capture/CaptureClient.tsx TAB_BAR_HEIGHT_PX. */
export const TAB_BAR_HEIGHT_PX = 56;

export type BottomTabKey = 'home' | 'chat' | 'capture' | 'graph' | 'acts';

export function BottomTabBar({ active }: { active: BottomTabKey }) {
  // v8 5-slot bottom nav (plan §18, design/v2/library/lib-screens.jsx MobileNav):
  //   home / chat / capture / graph / acts. The center capture slot breaks the
  //   bar plane — larger disc, accent fill, brutal shadow, lifts above the bar
  //   baseline. graph + acts routes ship empty in v11/v12; hrefs 404 until then.
  const tabs: Array<{ key: BottomTabKey; glyph: string; label: string; href: string; big?: boolean }> = [
    { key: 'home', glyph: '⌂', label: 'home', href: '/' },
    // TODO(v13): rename route from /recall to /chat once v13 lands. Label is
    // already 'chat' (locked v2 token re-skin, 2026-05-25).
    { key: 'chat', glyph: '⌕', label: 'chat', href: '/recall' },
    { key: 'capture', glyph: '◉', label: 'capture', href: '/capture', big: true },
    { key: 'graph', glyph: '◈', label: 'graph', href: '/graph' },
    { key: 'acts', glyph: '◬', label: 'acts', href: '/acts' },
  ];
  return (
    <nav
      aria-label="primary"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: TAB_BAR_HEIGHT_PX,
        // Padding-top lets the breakout capture button extend above the bar.
        paddingTop: 16,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(10,10,10,0.92)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-soft)',
        display: 'flex',
        alignItems: 'flex-start',
        zIndex: 50,
      }}
    >
      {tabs.map((t) => {
        const isActive = t.key === active;
        if (t.big) {
          // Center breakout slot — lifts above the bar plane (lib-screens.jsx
          // MobileNav `big: true`). 52px disc, accent fill, brutal shadow.
          return (
            <a
              key={t.key}
              href={t.href}
              aria-current={isActive ? 'page' : undefined}
              aria-label={t.label}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                textDecoration: 'none',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              <span
                style={{
                  position: 'relative',
                  top: -28,
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: accent,
                  border: '1.5px solid #000',
                  boxShadow: '3px 3px 0 #000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000',
                  fontSize: 22,
                  // Pulse the breakout when already on /capture (uses approved
                  // wm-pulse-s keyframe).
                  animation: isActive ? 'wm-pulse-s 1.4s ease-in-out infinite' : undefined,
                }}
              >
                {t.glyph}
                <span
                  // hidden text label for the breakout — keeps test parity
                  // (nav.textContent includes "capture") without visually
                  // duplicating the glyph.
                  style={{
                    position: 'absolute',
                    width: 1,
                    height: 1,
                    overflow: 'hidden',
                    clip: 'rect(0 0 0 0)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </span>
              </span>
            </a>
          );
        }
        return (
          <a
            key={t.key}
            href={t.href}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              textDecoration: 'none',
              position: 'relative',
              fontFamily: 'JetBrains Mono, monospace',
              // v2 Bottom nav (design-system.md L509): mono 9px/1 uppercase tracked 0.5 for labels.
              fontSize: 9,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            {isActive && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 18,
                  height: 2,
                  background: accent,
                  borderRadius: 999,
                }}
              />
            )}
            {/* v2 Bottom nav: icon 20 + active=accent / inactive=text-55. Decorative glyph,
                aria-hidden so SR only announces the visible label below (and the aria-current). */}
            <span
              aria-hidden="true"
              style={{ fontSize: 20, color: isActive ? accent : 'var(--text-55)' }}
            >
              {t.glyph}
            </span>
            {/* v2 Bottom nav: label active=accent / inactive=text-40 (one notch quieter than icon). */}
            <span style={{ color: isActive ? accent : 'var(--text-40)' }}>{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

export default BottomTabBar;
