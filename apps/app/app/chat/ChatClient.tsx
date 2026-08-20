'use client';

// ChatClient — chat surface (PR β₁-D rewrite).
//
// Post-pivot: the recorder + pipeline state lives in the global
// CaptureProvider (mounted at the root layout). ChatClient is now a thin
// view: it seeds the thread from the server prefetch, then renders the
// header + thread + nav. The dock chrome (orb, lock circle, transcript
// card) lives in the BottomTabBar and the global RecordingOverlay.
//
// chat IS still the capture surface in the sense that completed memos
// land here — but recording itself can begin from any route (the orb in
// the bottom nav is global). On `recorder.ready`, the provider pushes
// /chat so the user sees the bubble + extraction in the thread.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useCapture } from '@/app/_components/CaptureProvider';
import { ChatHeader } from './_components/ChatHeader';
import { ChatThread, UndoChip } from './_components/ChatThread';
import { ChatEntityRail } from './_components/ChatEntityRail';
import { TAB_BAR_HEIGHT_PX, accent } from './_components/tokens';
import type { ChatInitialItem } from './_components/types';

interface ChatClientProps {
  userName: string | null;
  /** Server-prefetched, oldest-first list of past committed memos. Defaults to []. */
  initialThread?: ChatInitialItem[];
}

function ChatComposer() {
  const { recorder, submitText, openTarget, setOpenTarget } = useCapture();
  const [text, setText] = useState('');
  const hot =
    recorder.status === 'arming' ||
    recorder.status === 'recording' ||
    recorder.status === 'lock_armed' ||
    recorder.status === 'cancel_armed' ||
    recorder.status === 'locked';

  if (hot) return null;

  const micUnavailable = !recorder.supported;
  const placeholder = micUnavailable
    ? 'log a memo or ask — mic unavailable'
    : openTarget
      ? `add to ${openTarget.name.toLowerCase()} · or start a new memo`
      : 'log a memo or ask — "who was the rust person?"';

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    void submitText(trimmed);
    setText('');
  }

  return (
    <form
      onSubmit={onSubmit}
      data-testid="chat-composer"
      style={{
        position: 'fixed',
        bottom: TAB_BAR_HEIGHT_PX + 14,
        left: 0,
        right: 0,
        maxWidth: 640,
        margin: '0 auto',
        padding: '10px 16px 0',
        zIndex: 40,
        boxSizing: 'border-box',
        background:
          'linear-gradient(180deg, rgba(10,10,10,0) 0%, var(--bg-page) 28%, var(--bg-page) 100%)',
        pointerEvents: 'none',
      }}
    >
      {openTarget ? (
        <div
          data-testid="open-capture-chip"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 8,
            padding: '6px 10px',
            borderRadius: 8,
            border: `1px solid ${accent}66`,
            background: `${accent}14`,
            pointerEvents: 'auto',
          }}
        >
          <span className="mono" style={{ fontSize: 11, color: accent, letterSpacing: 0.3 }}>
            adding to {openTarget.name.toLowerCase()}
          </span>
          <button
            type="button"
            aria-label="clear selected person"
            onClick={() => setOpenTarget(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-55)',
              cursor: 'pointer',
              font: '700 12px Inter, system-ui, sans-serif',
            }}
          >
            ×
          </button>
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderRadius: 999,
          background: '#141414',
          border: '1px solid var(--border-mid)',
          pointerEvents: 'auto',
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label="chat composer"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'var(--ink)',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          className="mono"
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            background: accent,
            border: '1.5px solid #000',
            boxShadow: '2px 2px 0 #000',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          commit →
        </button>
      </div>
    </form>
  );
}

export default function ChatClient({ userName, initialThread = [] }: ChatClientProps) {
  const { seedThreadOnce } = useCapture();
  // Seed once on first ChatClient mount in the session. The seed lives in
  // the provider and is guarded by a ref there — so re-mounts of /chat
  // (e.g. record on /home → push to /chat) merge-prepend the prefetch
  // without clobbering the in-flight bubble. The ref here is belt-and-
  // braces in case React StrictMode double-invokes the effect.
  const localSeededRef = useRef(false);
  useEffect(() => {
    if (localSeededRef.current) return;
    localSeededRef.current = true;
    seedThreadOnce(initialThread);
  }, [initialThread, seedThreadOnce]);

  return (
    // Desktop (≥1120px) splits into [thread | entity rail]; on mobile the
    // rail is display:none and the thread is the full-width column.
    <div className="surface-split">
      <main
        className="surface-primary"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-page)',
          color: 'var(--ink)',
        }}
      >
        <ChatHeader userName={userName} />
        <ChatThread />
        <UndoChip />
        <ChatComposer />
      </main>
      <ChatEntityRail />
    </div>
  );
}
