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
import { useCapture } from './CaptureProvider';
import { micOrbStateFor, type MicOrbState } from '@/app/capture/micOrbState';
import { HOLD_THRESHOLDS, POINTER_WATCHDOG_MS } from '@/app/chat/_components/tokens';

const accent = '#FFC452';
const coral = '#FF6B6B';

/** Bottom-nav height — kept in sync with chat/_components/tokens.ts. */
export const TAB_BAR_HEIGHT_PX = 56;

export type BottomTabKey = 'home' | 'chat' | 'capture' | 'graph' | 'acts';

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
}

export function BottomTabBar({ active }: { active: BottomTabKey }) {
  const { recorder, beginCapture } = useCapture();
  const status = recorder.status;

  // Hide the regular bar content during `locked` — render the locked pill
  // chrome in its place, in the same DOM nav element (keeps button identity
  // stable for any post-locked pointer events).
  if (status === 'locked') {
    return <LockedBar onStop={() => recorder.stop()} onDiscard={() => recorder.discard()} duration={recorder.duration} />;
  }

  return <DefaultBar active={active} recorder={recorder} beginCapture={beginCapture} />;
}

interface DefaultBarProps {
  active: BottomTabKey;
  recorder: ReturnType<typeof useCapture>['recorder'];
  beginCapture: ReturnType<typeof useCapture>['beginCapture'];
}

function DefaultBar({ active, recorder, beginCapture }: DefaultBarProps) {
  const tabs: Array<{ key: BottomTabKey; glyph: string; label: string; href: string; big?: boolean }> = [
    { key: 'home', glyph: '⌂', label: 'home', href: '/' },
    { key: 'chat', glyph: '⌕', label: 'chat', href: '/chat' },
    // capture slot: this is the orb itself, not a link. href kept for SR
    // semantics but the button intercepts pointer events.
    { key: 'capture', glyph: '◉', label: 'capture', href: '/chat', big: true },
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
          return (
            <CaptureOrb
              key={t.key}
              isActive={isActive}
              label={t.label}
              recorder={recorder}
              beginCapture={beginCapture}
            />
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
            <span
              aria-hidden="true"
              style={{ fontSize: 20, color: isActive ? accent : 'var(--text-55)' }}
            >
              {t.glyph}
            </span>
            <span style={{ color: isActive ? accent : 'var(--text-40)' }}>{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

interface CaptureOrbProps {
  isActive: boolean;
  label: string;
  recorder: ReturnType<typeof useCapture>['recorder'];
  beginCapture: ReturnType<typeof useCapture>['beginCapture'];
}

function CaptureOrb({ isActive, label, recorder, beginCapture }: CaptureOrbProps) {
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const originRef = React.useRef<{ x: number; y: number } | null>(null);
  const movedRef = React.useRef(false);
  const pointerIdRef = React.useRef<number | null>(null);
  const fallbackUpRef = React.useRef<((ev: PointerEvent) => void) | null>(null);
  const fallbackCancelRef = React.useRef<((ev: PointerEvent) => void) | null>(null);
  const watchdogRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHovered, setIsHovered] = React.useState(false);

  const status = recorder.status;
  const isIdle = status === 'idle' || status === 'ready' || status === 'error';
  const orbState: MicOrbState = micOrbStateFor(status, isHovered);
  const isActiveRec = orbState === 'recording';
  const isSending = orbState === 'sending';

  const clearFallbackListeners = React.useCallback(() => {
    if (fallbackUpRef.current) {
      window.removeEventListener('pointerup', fallbackUpRef.current);
      fallbackUpRef.current = null;
    }
    if (fallbackCancelRef.current) {
      window.removeEventListener('pointercancel', fallbackCancelRef.current);
      fallbackCancelRef.current = null;
    }
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      clearFallbackListeners();
    };
  }, [clearFallbackListeners]);

  const handleRelease = React.useCallback(
    (kind: 'up' | 'cancel') => {
      const s = recorder.status;
      const wasCancelArmed = s === 'cancel_armed';
      const wasLockArmed = s === 'lock_armed';
      originRef.current = null;
      pointerIdRef.current = null;
      if (kind === 'cancel') {
        if (s === 'recording' || s === 'lock_armed' || s === 'cancel_armed' || s === 'arming') {
          recorder.discard();
        }
        return;
      }
      if (wasCancelArmed) {
        vibrate([30, 20, 30]);
        recorder.discard();
        return;
      }
      if (wasLockArmed || s === 'locked') {
        return;
      }
      if (s === 'recording' || s === 'arming') {
        vibrate(12);
        recorder.stop();
      }
    },
    [recorder],
  );

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!isIdle) return;
    if (pointerIdRef.current !== null) return;
    originRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    pointerIdRef.current = e.pointerId;
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // jsdom — fall through to window fallback.
      }
    }
    const onWinUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerIdRef.current) return;
      clearFallbackListeners();
      handleRelease('up');
    };
    const onWinCancel = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerIdRef.current) return;
      clearFallbackListeners();
      handleRelease('cancel');
    };
    fallbackUpRef.current = onWinUp;
    fallbackCancelRef.current = onWinCancel;
    window.addEventListener('pointerup', onWinUp);
    window.addEventListener('pointercancel', onWinCancel);
    watchdogRef.current = setTimeout(() => {
      clearFallbackListeners();
      const s = recorder.status;
      if (s === 'recording' || s === 'lock_armed' || s === 'cancel_armed' || s === 'arming') {
        recorder.stop();
      }
      pointerIdRef.current = null;
      originRef.current = null;
    }, POINTER_WATCHDOG_MS);
    vibrate(8);
    void beginCapture();
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!originRef.current) return;
    if (e.pointerId !== pointerIdRef.current) return;
    const dx = e.clientX - originRef.current.x;
    const dy = e.clientY - originRef.current.y;
    movedRef.current = true;

    if (dy < -HOLD_THRESHOLDS.commitPx) {
      vibrate([15, 40, 15]);
      recorder.lock();
      originRef.current = null;
      return;
    }
    if (dx < -HOLD_THRESHOLDS.commitPx) {
      vibrate([30, 20, 30]);
      recorder.discard();
      originRef.current = null;
      return;
    }
    if (dy < -HOLD_THRESHOLDS.armPx) {
      recorder.setLockArmed(true);
      recorder.setCancelArmed(false);
    } else if (dx < -HOLD_THRESHOLDS.armPx) {
      recorder.setCancelArmed(true);
      recorder.setLockArmed(false);
    } else {
      recorder.setLockArmed(false);
      recorder.setCancelArmed(false);
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.pointerId !== pointerIdRef.current) return;
    if (!originRef.current && recorder.status !== 'locked') {
      pointerIdRef.current = null;
      clearFallbackListeners();
      return;
    }
    clearFallbackListeners();
    handleRelease('up');
  }

  function onPointerCancel(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.pointerId !== pointerIdRef.current) return;
    clearFallbackListeners();
    handleRelease('cancel');
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={
          isActiveRec
            ? 'recording — release to send, swipe up to lock, swipe left to cancel'
            : isSending
              ? 'sending recording'
              : 'hold to record voice memo, tap to use lock mode'
        }
        aria-keyshortcuts="Space"
        aria-pressed={isActiveRec}
        aria-current={isActive ? 'page' : undefined}
        data-orb-state={orbState}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
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
          background: isSending ? 'rgba(255,255,255,0.06)' : accent,
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
        ) : isSending ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z"
              stroke="var(--text-70)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 11a7 7 0 0 0 14 0M12 18v3"
              stroke="var(--text-70)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
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

function LockedBar({ onStop, onDiscard, duration }: LockedBarProps) {
  const totalSec = Math.floor(duration / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = (totalSec % 60).toString().padStart(2, '0');
  return (
    <nav
      aria-label="primary"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: TAB_BAR_HEIGHT_PX,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(10,10,10,0.92)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-soft)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 12px',
        zIndex: 50,
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

export default BottomTabBar;
