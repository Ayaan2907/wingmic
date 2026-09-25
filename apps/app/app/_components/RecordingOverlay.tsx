'use client';

// RecordingOverlay — global recording chrome (PR β₁-D).
//
// Rendered once in the root layout, alongside the page content. When the
// recorder is hot (recording / lock_armed / cancel_armed), this overlay
// covers the page with:
//   · a dim layer (opacity 0.4 over page content beneath)
//   · the phantom bubble (live duration + level meter), top-anchored above
//     the bottom nav so it never collides with the orb
//   · the lock-circle hint (↑ lock)
//   · the slide-cancel hint (← slide to cancel)
//
// The orb itself lives in BottomTabBar (the center "big" slot). This
// component does NOT render an orb — pointer handlers stay on the bar
// button so pointer-capture identity is preserved across the recording
// gesture.
//
// During `locked` state the locked pill takes over the bottom-nav area
// (rendered in BottomTabBar in-place, not here) — RecordingOverlay still
// shows the live transcript bubble above it but stops rendering the
// slide-cancel hint, which only applies to the held-finger gesture.

import { useCapture } from './CaptureProvider';

const accent = '#FFC452';
const coral = '#FF6B6B';

const PHANTOM_BOTTOM = 'calc(var(--chat-composer-bottom) + 88px)';

export function RecordingOverlay() {
  const { recorder } = useCapture();
  const status = recorder.status;
  const recording =
    status === 'recording' ||
    status === 'lock_armed' ||
    status === 'cancel_armed' ||
    status === 'locked';

  if (!recording) return null;

  const isHeld = status !== 'locked';

  return (
    <>
      {/* Dim layer — covers the page beneath but lets the bottom nav (and
          locked-pill) sit on top via its higher z-index. */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          pointerEvents: 'none',
          transition: 'opacity var(--dur-base, 240ms) var(--ease-relaxed, ease-out)',
          zIndex: 45,
        }}
      />

      {/* Phantom bubble — live duration + level meter. */}
      <PhantomBubble level={recorder.level} duration={recorder.duration} />

      {/* Tap-to-dictate hint. Shown while the mic is hot but not locked —
          i.e. after a tap on the orb, which is now the stop button. The
          locked path (spacebar hold) shows the locked-pill send/discard
          controls in BottomTabBar instead, so no hint is rendered there. */}
      {isHeld && <TapStopHint />}
    </>
  );
}

function PhantomBubble({ level, duration }: { level: number[]; duration: number }) {
  const sec = (duration / 1000).toFixed(1);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`recording, ${sec} seconds`}
      style={{
        position: 'fixed',
        left: '50%',
        bottom: PHANTOM_BOTTOM,
        transform: 'translateX(-50%)',
        maxWidth: 'min(560px, calc(100% - 32px))',
        width: '86%',
        padding: '16px 18px',
        borderRadius: 18,
        background: 'rgba(10,10,10,0.82)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        border: `1px solid ${accent}33`,
        boxShadow: shadows.raised,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        animation: 'wm-rise var(--dur-slow, 420ms) var(--ease-relaxed, ease-out) both',
        zIndex: 56,
        pointerEvents: 'none',
        contain: 'layout paint',
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 10,
          color: accent,
          letterSpacing: 2,
          textTransform: 'uppercase',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: 999,
            background: coral,
            animation: 'wm-pulse-d 1.5s ease-in-out infinite',
          }}
        />
        rec · {sec}s
      </div>
      <div
        aria-hidden="true"
        style={{ display: 'flex', gap: 3, alignItems: 'center', height: 40 }}
      >
        {level.map((v, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: 38,
              background: accent,
              borderRadius: 2,
              transform: `scaleY(${Math.max(0.1, (4 + v * 34) / 38)})`,
              transformOrigin: 'bottom',
              transition: 'transform 0.12s ease-out',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function TapStopHint() {
  // Centered just above the bottom-nav orb (which lives at top:-28 inside the
  // 56px-high nav). Points the user back at the orb to stop, and notes the
  // keyboard escape hatch for cancelling.
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(var(--nav-bar-height) + env(safe-area-inset-bottom, 0px) + 32px)',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        zIndex: 56,
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: 0.5,
          color: 'var(--text-55)',
          background: 'rgba(10,10,10,0.72)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--border-soft)',
          padding: '6px 12px',
          borderRadius: 999,
          whiteSpace: 'nowrap',
        }}
      >
        tap ◉ to stop · esc to cancel
      </span>
    </div>
  );
}
