'use client';

// CaptureDock — the push-to-talk dock + PrivacyAmbientLine.
//
// Extracted from CaptureClient (PR β₁-A) verbatim. The recorder hook is
// hoisted into ChatClient and passed in as `recorder`, so this component
// owns gesture handlers + pointer-capture + watchdog only — no recorder
// lifecycle.
//
// The single <button> below MUST keep its tree position across idle ↔
// active ↔ sending so setPointerCapture(pointerId) keeps targeting the
// same element. Do not introduce wrapper divs between the dock root and
// this <button> without re-validating pointer capture.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioRecorder } from '@/app/capture/_components/useAudioRecorder';
import { micOrbStateFor, type MicOrbState } from '@/app/capture/micOrbState';
import {
  accent,
  coral,
  BUTTON_FLOAT_ABOVE_PX,
  HOLD_THRESHOLDS,
  PRIVACY_LINE_BOTTOM_PX,
  POINTER_WATCHDOG_MS,
  TAB_BAR_HEIGHT_PX,
} from './tokens';

export function CaptureDock({
  recorder,
  isIdle,
  onStart,
}: {
  recorder: ReturnType<typeof useAudioRecorder>;
  isIdle: boolean;
  onStart: () => void | Promise<void>;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  /** Currently-tracked primary pointer id — guards against second-finger touch. */
  const pointerIdRef = useRef<number | null>(null);
  /** Window-level pointerup/cancel fallback listeners (used if setPointerCapture fails). */
  const fallbackUpRef = useRef<((ev: PointerEvent) => void) | null>(null);
  const fallbackCancelRef = useRef<((ev: PointerEvent) => void) | null>(null);
  /** Watchdog timer — force-stops recorder if no release event arrives. */
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function vibrate(pattern: number | number[]) {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // ignore
      }
    }
  }

  const beginHold = useCallback(async () => {
    vibrate(8);
    await onStart();
  }, [onStart]);

  function clearFallbackListeners() {
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
  }

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
        // jsdom etc. — fall through; window fallback handles release.
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
      if (
        recorder.status === 'recording' ||
        recorder.status === 'lock_armed' ||
        recorder.status === 'cancel_armed' ||
        recorder.status === 'arming'
      ) {
        recorder.stop();
      }
      pointerIdRef.current = null;
      originRef.current = null;
    }, POINTER_WATCHDOG_MS);
    void beginHold();
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

  function handleRelease(kind: 'up' | 'cancel') {
    const status = recorder.status;
    const wasCancelArmed = status === 'cancel_armed';
    const wasLockArmed = status === 'lock_armed';
    originRef.current = null;
    pointerIdRef.current = null;
    if (kind === 'cancel') {
      if (
        status === 'recording' ||
        status === 'lock_armed' ||
        status === 'cancel_armed' ||
        status === 'arming'
      ) {
        recorder.discard();
      }
      return;
    }
    if (wasCancelArmed) {
      vibrate([30, 20, 30]);
      recorder.discard();
      return;
    }
    if (wasLockArmed || status === 'locked') {
      return;
    }
    if (status === 'recording' || status === 'arming') {
      vibrate(12);
      recorder.stop();
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

  useEffect(() => {
    return () => {
      clearFallbackListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // — keyboard equivalent: Space hold-to-talk + Escape discard —
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName ?? '';
      const isInField = tag === 'INPUT' || tag === 'TEXTAREA';
      if (isInField) return;

      if (e.code === 'Space' && e.type === 'keydown' && !e.repeat) {
        if (
          recorder.status === 'idle' ||
          recorder.status === 'ready' ||
          recorder.status === 'error'
        ) {
          e.preventDefault();
          void (async () => {
            await beginHold();
            recorder.lock();
          })();
        }
      }
      if (e.code === 'Space' && e.type === 'keyup') {
        if (
          recorder.status === 'recording' ||
          recorder.status === 'locked' ||
          recorder.status === 'lock_armed'
        ) {
          e.preventDefault();
          recorder.stop();
        }
      }
      if (e.code === 'Escape' && e.type === 'keydown') {
        if (
          recorder.status === 'recording' ||
          recorder.status === 'locked' ||
          recorder.status === 'lock_armed' ||
          recorder.status === 'cancel_armed'
        ) {
          recorder.discard();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [recorder, beginHold]);

  const [isHovered, setIsHovered] = useState(false);
  const orbState: MicOrbState = micOrbStateFor(recorder.status, isHovered);
  const isLocked = orbState === 'locked';
  const isActive = orbState === 'recording';
  const isSending = orbState === 'sending';

  return (
    <>
      {isIdle && <PrivacyAmbientLine />}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: TAB_BAR_HEIGHT_PX,
          paddingBottom: 'env(safe-area-inset-bottom)',
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 55,
        }}
      >
        {isLocked ? (
          <button
            type="button"
            onClick={() => recorder.stop()}
            aria-label="Stop locked recording"
            style={{
              pointerEvents: 'auto',
              width: 88,
              height: 88,
              borderRadius: 14,
              background: coral,
              color: '#000',
              fontSize: 22,
              fontWeight: 800,
              border: '1.5px solid #000',
              boxShadow: '4px 4px 0 #000',
              cursor: 'pointer',
              transform: `translateY(-${BUTTON_FLOAT_ABOVE_PX}px)`,
            }}
          >
            ■
          </button>
        ) : (
          <div
            style={{
              position: 'relative',
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              transform: `translateY(-${BUTTON_FLOAT_ABOVE_PX}px)`,
              ...(isActive
                ? {
                    width: 'min(560px, calc(100% - 32px))',
                    background: 'var(--surface-1)',
                    border: '1.5px solid #000',
                    borderRadius: 999,
                    padding: '8px 16px',
                    boxShadow: '3px 3px 0 #000',
                    gap: 12,
                  }
                : {}),
            }}
          >
            {isActive && (
              <>
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: accent,
                    animation: 'wm-pulse-s 1s ease-in-out infinite',
                    flexShrink: 0,
                  }}
                />
                <div
                  aria-hidden="true"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    height: 18,
                    flexShrink: 0,
                  }}
                >
                  {[0, 80, 160, 240, 320].map((d, i) => (
                    <span
                      key={i}
                      style={{
                        width: 3,
                        height: i % 2 === 0 ? 14 : 10,
                        background: accent,
                        borderRadius: 1,
                        animation: 'wm-pulse-s 0.9s ease-in-out infinite',
                        animationDelay: `${d}ms`,
                      }}
                    />
                  ))}
                </div>
                <span
                  className="mono"
                  style={{
                    flex: 1,
                    fontSize: 11,
                    letterSpacing: 0.5,
                    color: 'var(--text-55)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  ← slide to cancel
                </span>
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 8px)',
                    right: 15,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    pointerEvents: 'none',
                  }}
                >
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      background: 'var(--surface-1)',
                      border: `1.5px solid ${accent}`,
                      boxShadow: '2px 2px 0 #000',
                      color: accent,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      animation: 'wm-pulse-s 1.4s ease-in-out infinite',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect
                        x="5"
                        y="11"
                        width="14"
                        height="9"
                        rx="2"
                        stroke={accent}
                        strokeWidth="1.8"
                      />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={accent} strokeWidth="1.8" />
                    </svg>
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 9,
                      letterSpacing: 0.5,
                      color: 'var(--text-55)',
                      textTransform: 'uppercase',
                    }}
                  >
                    ↑ lock
                  </span>
                </div>
              </>
            )}
            <button
              ref={buttonRef}
              type="button"
              aria-label={isActive ? 'recording — release to send, swipe up to lock, swipe left to cancel' : isSending ? 'sending recording' : 'hold to record voice memo, tap to use lock mode'}
              aria-keyshortcuts="Space"
              aria-pressed={isActive}
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
                pointerEvents: 'auto',
                position: 'relative',
                width: isActive || isSending ? 46 : 88,
                height: isActive || isSending ? 46 : 88,
                borderRadius: 999,
                background: isSending
                  ? 'rgba(255,255,255,0.06)'
                  : accent,
                color: isActive ? '#fff' : '#000',
                fontWeight: 800,
                border: '1.5px solid #000',
                boxShadow: isActive
                  ? '0 0 30px rgba(255,69,0,0.5), 3px 3px 0 #000'
                  : isSending
                    ? '3px 3px 0 #000'
                    : orbState === 'hover'
                      ? '5px 5px 0 #000'
                      : '4px 4px 0 #000',
                transform: orbState === 'hover' ? 'translateY(-1px)' : undefined,
                cursor: 'pointer',
                fontSize: 11,
                letterSpacing: 1,
                fontFamily: 'JetBrains Mono, monospace',
                textTransform: 'uppercase',
                transition:
                  'width 0.18s ease-out, height 0.18s ease-out, box-shadow 0.12s ease-out, transform 0.12s ease-out, background 0.18s ease-out',
                touchAction: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {isSending && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: -3,
                    borderRadius: 999,
                    border: `1.5px solid ${accent}80`,
                    borderTopColor: 'transparent',
                    borderLeftColor: 'transparent',
                    animation: 'wm-spin 1.1s linear infinite',
                    pointerEvents: 'none',
                  }}
                />
              )}
              {isActive ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z"
                    stroke="#fff"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="#fff"
                  />
                  <path
                    d="M5 11a7 7 0 0 0 14 0M12 18v3"
                    stroke="#fff"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
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
                'hold'
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function PrivacyAmbientLine() {
  return (
    <aside
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: PRIVACY_LINE_BOTTOM_PX,
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 40,
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 10.5,
          letterSpacing: 0.5,
          background: 'rgba(10,10,10,0.6)',
          padding: '4px 10px',
          borderRadius: 999,
          pointerEvents: 'auto',
        }}
      >
        <span style={{ color: 'var(--text-55)' }}>audio → assemblyai. </span>
        <span style={{ color: 'var(--text-70)' }}>transcript stays with you. </span>
        <a href="/privacy" style={{ color: accent, textDecoration: 'none' }}>
          read the note →
        </a>
      </span>
    </aside>
  );
}
