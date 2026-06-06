'use client';

// ChatHeader — header chrome for the chat surface (PR β₁-A split).
//
// Idle: wingmic.xyz wordmark + "chat · <userName>" caption.
// Recording: brand avatar + "wingmic" + pulsing recording dot + live m:ss
// counter. Stays on through `locked` state — the dock chrome swaps to a
// stop button but the header keeps the pulse + counter so the user knows
// recording is still in flight.

import type { useAudioRecorder } from '@/app/capture/_components/useAudioRecorder';
import { accent } from './tokens';

export function ChatHeader({
  userName,
  recorder,
}: {
  userName: string | null;
  recorder: ReturnType<typeof useAudioRecorder>;
}) {
  const recording =
    recorder.status === 'recording' ||
    recorder.status === 'lock_armed' ||
    recorder.status === 'cancel_armed' ||
    recorder.status === 'locked';

  const shell: React.CSSProperties = {
    padding: '14px 20px',
    borderBottom: '1px solid var(--border-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    background: 'rgba(10,10,10,0.85)',
    backdropFilter: 'blur(20px)',
    zIndex: 30,
    gap: 12,
  };

  if (recording) {
    const totalSec = Math.floor(recorder.duration / 1000);
    const mm = Math.floor(totalSec / 60);
    const ss = (totalSec % 60).toString().padStart(2, '0');
    return (
      <header style={shell} data-recording="true">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              width: 24,
              height: 24,
              background: accent,
              border: '1.5px solid #000',
              boxShadow: '2px 2px 0 #000',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontFamily: 'Newsreader, Georgia, serif',
              fontStyle: 'italic',
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            W
          </span>
          <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-100, var(--ink))' }}>
            wingmic
          </span>
        </div>
        <span
          role="status"
          aria-live="polite"
          aria-label={`recording, ${mm}:${ss}`}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: accent,
              display: 'inline-block',
              animation: 'wm-pulse-s 1s ease-in-out infinite',
            }}
          />
          <span
            aria-hidden="true"
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: 0.5,
              color: 'var(--text-55)',
              textTransform: 'uppercase',
            }}
          >
            recording
          </span>
        </span>
        <span
          aria-hidden="true"
          className="mono"
          style={{ fontSize: 12, color: accent, fontVariantNumeric: 'tabular-nums' }}
        >
          {mm}:{ss}
        </span>
      </header>
    );
  }

  return (
    <header style={shell}>
      <a
        href="/"
        className="mono"
        style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.5, color: 'var(--ink)' }}
      >
        wingmic<span style={{ color: 'var(--text-30)' }}>.xyz</span>
      </a>
      <span
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: 1,
          color: 'var(--text-40)',
          textTransform: 'uppercase',
        }}
      >
        chat · {userName ?? 'you'}
      </span>
    </header>
  );
}
