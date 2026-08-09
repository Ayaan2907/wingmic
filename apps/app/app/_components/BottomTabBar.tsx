'use client';

// BottomTabBar — shared 5-slot mobile bottom nav (PR α v8/v9, β₁-D rewrite).
//
// Source of truth: design/v2/library/lib-screens.jsx MobileNav.
//
// PR β₁-D pivot: the center "capture" slot is no longer a link to /chat —
// it IS the real push-to-talk orb. The pointer-capture handlers that used
// to live in CaptureDock now live on this button. Recording happens in
// place on whatever page is mounted; the commit pipeline (provider) routes
// to /chat once the recorder transitions to `ready`.
//
// The single orb <button> below MUST keep its tree position across idle →
// arming → recording → lock_armed → cancel_armed so setPointerCapture
// keeps targeting the same element. The locked-pill (which renders in
// place of the bar's regular content during status==='locked') uses a
// different button — finger is already up by then so pointer-capture
// identity no longer matters.

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useCapture } from './CaptureProvider';
import { micOrbStateFor, type MicOrbState } from '@/app/capture/micOrbState';

const accent = '#FFC452';
const coral = '#FF6B6B';

/** localStorage key — first-run teaching beat for the capture orb (U5). */
export const ORB_HINT_STORAGE_KEY = 'wingmic.orb-hint-seen';

/** Session fallback when localStorage is blocked (private browsing). */
let orbHintSessionSeen = false;

/** @internal Vitest-only — module session flag survives across cases. */
export function resetOrbHintSessionState() {
  orbHintSessionSeen = false;
}

function useOrbHint() {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (orbHintSessionSeen) return;
    try {
      if (localStorage.getItem(ORB_HINT_STORAGE_KEY) !== '1') setShow(true);
    } catch {
      if (!orbHintSessionSeen) setShow(true);
    }
  }, []);

  const dismiss = React.useCallback(() => {
    orbHintSessionSeen = true;
    setShow(false);
    try {
      localStorage.setItem(ORB_HINT_STORAGE_KEY, '1');
    } catch {
      // session flag covers private browsing
    }
  }, []);

  return { show, dismiss };
}

/** Bottom-nav height — kept in sync with chat/_components/tokens.ts. */
export const TAB_BAR_HEIGHT_PX = 56;

export type BottomTabKey = 'home' | 'chat' | 'capture' | 'graph' | 'search' | 'acts';

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
}

// Tab arrangement (PDF + design/v2): acts on the fifth slot. Search stays
// reachable via ⌘K / header affordances — not a bottom-nav verb.
export const NAV_TABS: Array<{ key: BottomTabKey; glyph: string; label: string; href: string; big?: boolean }> = [
  { key: 'home', glyph: '⌂', label: 'home', href: '/' },
  { key: 'chat', glyph: '≡', label: 'chat', href: '/chat' },
  { key: 'capture', glyph: '◉', label: 'capture', href: '/chat', big: true },
  { key: 'graph', glyph: '◈', label: 'graph', href: '/graph' },
  { key: 'acts', glyph: '☑', label: 'acts', href: '/acts' },
];

export function NavLink({ tab, active }: { tab: (typeof NAV_TABS)[number]; active: boolean }) {
  return (
    <Link
      href={tab.href as Route}
      aria-current={active ? 'page' : undefined}
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
        fontSize: 9,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}
    >
      {active && (
        <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 18, height: 2, background: accent, borderRadius: 999 }} />
      )}
      <span aria-hidden="true" style={{ fontSize: 20, color: active ? accent : 'var(--text-55)' }}>{tab.glyph}</span>
      <span style={{ color: active ? accent : 'var(--text-40)' }}>{tab.label}</span>
    </Link>
  );
}

interface CaptureOrbProps {
  isActive: boolean;
  label: string;
  recorder: ReturnType<typeof useCapture>['recorder'];
  beginCapture: ReturnType<typeof useCapture>['beginCapture'];
}

export function CaptureOrb({ isActive, label, recorder, beginCapture }: CaptureOrbProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const { show: showHint, dismiss: dismissHint } = useOrbHint();

  const status = recorder.status;
  const orbState: MicOrbState = micOrbStateFor(status, isHovered);
  const isActiveRec = orbState === 'recording';

  // Tap-to-dictate: one tap starts recording, the next tap stops + sends.
  // Replaces the old press-and-hold gesture — its release relied on a
  // pointerup/pointercancel that could be dropped on touch (or handled by a
  // stale closure), leaving the recorder running with no way to stop. A plain
  // toggle reads the live status on each tap, so it can't get stuck.
  function onOrbClick() {
    dismissHint();
    const s = recorder.status;
    if (s === 'idle' || s === 'ready' || s === 'error' || s === 'encoding') {
      vibrate(8);
      void beginCapture();
      return;
    }
    // Any hot state (arming/recording/locked/…) → stop and hand off to commit.
    vibrate(12);
    recorder.stop();
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        fontFamily: 'JetBrains Mono, monospace',
        position: 'relative',
      }}
    >
      {showHint && !isActiveRec && !isSending ? (
        <div
          role="status"
          data-testid="orb-hint"
          className="mono"
          style={{
            position: 'absolute',
            top: -52,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 10px',
            borderRadius: 8,
            background: accent,
            color: '#000',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: 'lowercase',
            border: '1.5px solid #000',
            boxShadow: '2px 2px 0 #000',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          tap to talk
        </div>
      ) : null}
      <button
        type="button"
        aria-label={
          isActiveRec ? 'recording — tap to stop and send' : 'tap to record voice memo'
        }
        aria-keyshortcuts="Space"
        aria-pressed={isActiveRec}
        aria-current={isActive ? 'page' : undefined}
        data-orb-state={orbState}
        onClick={onOrbClick}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        style={{
          position: 'relative',
          top: -28,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: accent,
          color: isActiveRec ? '#fff' : '#000',
          fontSize: 22,
          fontWeight: 800,
          border: '1.5px solid #000',
          boxShadow: isActiveRec
            ? '0 0 30px rgba(255,69,0,0.5), 3px 3px 0 #000'
            : orbState === 'hover'
              ? '5px 5px 0 #000'
              : '3px 3px 0 #000',
          cursor: 'pointer',
          touchAction: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation:
            isActive && !isActiveRec ? 'wm-pulse-s 1.4s ease-in-out infinite' : undefined,
          transition:
            'box-shadow 0.12s ease-out, transform 0.12s ease-out, background 0.18s ease-out',
        }}
      >
        {isActiveRec ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z"
              stroke="#fff"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="#fff"
            />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ) : (
          <>
            <span aria-hidden="true">◉</span>
            <span
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          </>
        )}
      </button>
    </div>
  );
}

interface LockedBarProps {
  onStop: () => void;
  onDiscard: () => void;
  duration: number;
}

export function LockedBar({ onStop, onDiscard, duration }: LockedBarProps) {
  const totalSec = Math.floor(duration / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = (totalSec % 60).toString().padStart(2, '0');
  return (
    <nav
      aria-label="primary"
      className="app-nav"
      style={{
        alignItems: 'center',
        gap: 10,
        padding: '0 12px',
        paddingTop: 0,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: accent,
          border: '1.5px solid #000',
          boxShadow: '2px 2px 0 #000',
          color: '#000',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="2" stroke="#000" strokeWidth="1.8" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="#000" strokeWidth="1.8" />
        </svg>
      </span>
      <span
        className="mono"
        aria-live="polite"
        aria-label={`recording locked, ${mm}:${ss}`}
        style={{
          flex: 1,
          fontSize: 12,
          color: accent,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: 0.5,
        }}
      >
        ● rec · {mm}:{ss}
      </span>
      <button
        type="button"
        onClick={onDiscard}
        aria-label="discard recording"
        style={{
          padding: '6px 10px',
          borderRadius: 8,
          background: 'transparent',
          color: coral,
          border: `1.5px solid ${coral}`,
          cursor: 'pointer',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        × discard
      </button>
      <button
        type="button"
        onClick={onStop}
        aria-label="send recording"
        style={{
          padding: '6px 14px',
          borderRadius: 8,
          background: accent,
          color: '#000',
          border: '1.5px solid #000',
          boxShadow: '3px 3px 0 #000',
          cursor: 'pointer',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        send →
      </button>
    </nav>
  );
}
