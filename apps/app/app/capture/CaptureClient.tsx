'use client';

// Canonical capture variant: A (chat-anchored). v17 lock 2026-05-26. See design/v2/library/lib-capture-variants.jsx CaptureVariantA for the reference layout. Variants B (centered orb) and C (slide-up sheet) are archived as visual reference only — see design/v2/library/lib-capture-variants.jsx.

/**
 * CaptureClient — chat-thread + push-to-talk capture UI.
 *
 * v0.1.1 "Hosted Capture" — Task H3 (v0.1.1a scope).
 *
 * Replaces the old tap-to-record screen with:
 *   - chat-thread of memo bubbles (status morphs in place)
 *   - hold-to-talk button floating above a 5-tab bottom nav (v8: home/chat/capture/graph/acts)
 *   - progressive bubble states: sending → transcribing → linking → done
 *   - inline failed-bubble recovery (no modals)
 *   - long-press menu (copy, delete with 30s undo)
 *   - graph card per committed bubble with person/company/event pills
 *
 * v0.1.1b scope (deferred — DO NOT implement here):
 *   - reply / parentInteractionId
 *   - audio retention / R2 / replay
 *   - real Settings / History / Entity pages
 *   - Recall cluster browser
 *   - per-Layer-source colored stripes (all stripes are accent for v0.1.1a)
 *
 * See: docs/superpowers/plans/2026-05-23-v0.1.1-hosted-capture.md §17.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useAudioRecorder } from './_components/useAudioRecorder';
import { micOrbStateFor, type MicOrbState } from './micOrbState';

// ── Constants ───────────────────────────────────────────────────────────
const HOLD_THRESHOLDS = {
  /** Pixels finger must travel from origin to ARM lock / discard (visual hint only) */
  armPx: 40,
  /** Pixels finger must travel from origin to COMMIT lock / discard */
  commitPx: 80,
} as const;

/** Soft-delete grace window before the memo is permanently dropped. */
const UNDO_WINDOW_MS = 30_000;
/** Vertical offset the dock button floats above the tab bar. */
const BUTTON_FLOAT_ABOVE_PX = 24;
/** Bottom-nav height — kept in sync with BottomTabBar style.height. */
const TAB_BAR_HEIGHT_PX = 56;
/** PrivacyAmbientLine sits above the dock button (88 = button height + breathing). */
const PRIVACY_LINE_BOTTOM_PX = TAB_BAR_HEIGHT_PX + BUTTON_FLOAT_ABOVE_PX + 88;
/** Watchdog: force-stop the recorder if no pointerup event arrives within 60s. */
const POINTER_WATCHDOG_MS = 60_000;

// ── Tokens ──────────────────────────────────────────────────────────────
const accent = '#FFC452';
const second = '#86efac';
const third = '#FF8FAB';
const violet = '#A78BFA';
const blue = '#7DD3FC';
const coral = '#FF6B6B';

// ── Types ───────────────────────────────────────────────────────────────
type BubbleStatus =
  | 'queued'
  | 'uploading'
  | 'transcribing'
  | 'linking'
  | 'committed'
  | 'failed'
  | 'deleted';

type FailureCode =
  | 'provider_error'
  | 'rate_limited'
  | 'too_big'
  | 'too_long'
  | 'transcript_empty'
  | 'NotAllowedError'
  | 'network'
  | 'commit_failed'
  | 'unknown_error';

interface GraphResult {
  extracted: {
    persons: Array<{
      name: string;
      role: string | null;
      companyHint: string | null;
      topics: string[];
    }>;
    companies: Array<{ name: string }>;
    events: Array<{ name: string }>;
    topics: string[];
    actions: Array<{ kind: string; body: string; whenHint: string | null }>;
  };
  newEntities: number;
  matchedEntities: number;
  interactionId: string;
}

interface ThreadMessage {
  id: string;
  status: BubbleStatus;
  audioBlob: Blob | null;
  transcript: string | null;
  /** recording duration in ms */
  duration: number;
  transcribeMs: number | null;
  commitMs: number | null;
  graphResult: GraphResult | null;
  error: { code: FailureCode; message: string } | null;
  createdAt: Date;
  /** when transcribing started — for live elapsed counter */
  transcribingStartedAt: number | null;
  /** local-only paste fallback flag */
  fromPaste: boolean;
}

function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `bub_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function fmtMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtSec(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Component ───────────────────────────────────────────────────────────

export default function CaptureClient({ userName }: { userName: string | null }) {
  const recorder = useAudioRecorder();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [pasteOpenForId, setPasteOpenForId] = useState<string | null>(null);
  const [pasteDraft, setPasteDraft] = useState('');
  const activeIdRef = useRef<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  /** AbortController per in-flight pipeline (keyed by bubble id). */
  const pipelineControllersRef = useRef<Map<string, AbortController>>(new Map());
  /** setTimeout handles for soft-delete grace windows (keyed by bubble id). */
  const undoTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const commitMutation = trpc.capture.commit.useMutation();

  // Clear any pending soft-delete timers on unmount so they don't fire
  // after the component is gone (React warning + ghost state writes).
  useEffect(() => {
    const timers = undoTimersRef.current;
    const controllers = pipelineControllersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      for (const c of controllers.values()) c.abort();
      controllers.clear();
    };
  }, []);

  // mutate helpers
  const patch = useCallback((id: string, p: Partial<ThreadMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...p } : m)));
  }, []);

  // scroll to bottom on new message
  useEffect(() => {
    const el = threadEndRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length]);

  // — capture flow —
  const beginCapture = useCallback(async () => {
    const id = uid();
    activeIdRef.current = id;
    setMessages((prev) => [
      ...prev,
      {
        id,
        status: 'queued',
        audioBlob: null,
        transcript: null,
        duration: 0,
        transcribeMs: null,
        commitMs: null,
        graphResult: null,
        error: null,
        createdAt: new Date(),
        transcribingStartedAt: null,
        fromPaste: false,
      },
    ]);
    await recorder.start();
  }, [recorder]);

  // when recorder becomes ready, route the blob to the active bubble
  useEffect(() => {
    if (recorder.status === 'ready' && recorder.audioBlob && activeIdRef.current) {
      const id = activeIdRef.current;
      activeIdRef.current = null;
      const blob = recorder.audioBlob;
      const dur = recorder.duration;
      void runCapturePipeline(id, blob, dur);
      recorder.reset();
    }
    if (recorder.status === 'error' && activeIdRef.current) {
      const id = activeIdRef.current;
      activeIdRef.current = null;
      const err = recorder.error ?? { code: 'mic_unavailable', message: 'mic unavailable.' };
      patch(id, {
        status: 'failed',
        error: {
          code: (err.code === 'NotAllowedError'
            ? 'NotAllowedError'
            : 'unknown_error') as FailureCode,
          message: err.message,
        },
      });
      recorder.reset();
    }
    if (recorder.status === 'idle' && activeIdRef.current) {
      // user discarded mid-record; drop the queued bubble
      const id = activeIdRef.current;
      activeIdRef.current = null;
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.status]);

  async function runCapturePipeline(id: string, blob: Blob, recordingDuration: number) {
    // Each pipeline owns an AbortController so discardBubble() can cancel
    // the transcribe fetch + commit mutation mid-flight, sparing the paid
    // AssemblyAI call AND any silent backend writes.
    const controller = new AbortController();
    pipelineControllersRef.current.set(id, controller);
    const signal = controller.signal;
    const cleanupController = () => {
      if (pipelineControllersRef.current.get(id) === controller) {
        pipelineControllersRef.current.delete(id);
      }
    };

    patch(id, {
      status: 'uploading',
      audioBlob: blob,
      duration: recordingDuration,
    });

    // 1) upload to transcribe
    const fd = new FormData();
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    fd.append('audio', blob, `capture.${ext}`);

    const t0 = performance.now();
    let transcript = '';
    let transcribeMs = 0;
    try {
      patch(id, { status: 'transcribing', transcribingStartedAt: performance.now() });
      const res = await fetch('/api/capture/transcribe', {
        method: 'POST',
        body: fd,
        signal,
      });
      transcribeMs = Math.round(performance.now() - t0);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const code = (body?.error?.code ?? 'provider_error') as FailureCode;
        const message = body?.error?.message ?? 'transcribe failed upstream.';
        patch(id, { status: 'failed', transcribeMs, error: { code, message } });
        cleanupController();
        return;
      }
      const body = (await res.json()) as { transcript: string; durationMs?: number };
      transcript = (body.transcript ?? '').trim();
      if (!transcript) {
        patch(id, {
          status: 'failed',
          transcribeMs,
          error: { code: 'transcript_empty', message: 'mic didnt catch you. try again closer.' },
        });
        cleanupController();
        return;
      }
    } catch (err) {
      // Swallow AbortError silently — discardBubble already removed the row.
      if (err instanceof Error && err.name === 'AbortError') {
        cleanupController();
        return;
      }
      patch(id, {
        status: 'failed',
        transcribeMs: Math.round(performance.now() - t0),
        error: { code: 'network', message: 'the upload didnt finish. check your connection.' },
      });
      cleanupController();
      return;
    }

    // Check after async boundary: discard may have fired between fetch.json()
    // resolving and us reaching the commit call.
    if (signal.aborted) {
      cleanupController();
      return;
    }

    patch(id, { status: 'linking', transcript, transcribeMs });

    // 2) tRPC commit
    const c0 = performance.now();
    try {
      // tRPC v11 forwards `signal` through to the underlying fetch link;
      // even if the lib doesn't, we re-check aborted state after.
      const result = await commitMutation.mutateAsync(
        { transcript },
        { signal } as unknown as Parameters<typeof commitMutation.mutateAsync>[1],
      );
      if (signal.aborted) {
        cleanupController();
        return;
      }
      patch(id, {
        status: 'committed',
        commitMs: Math.round(performance.now() - c0),
        graphResult: result as GraphResult,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        cleanupController();
        return;
      }
      const message = err instanceof Error ? err.message : 'commit failed.';
      patch(id, {
        status: 'failed',
        commitMs: Math.round(performance.now() - c0),
        error: { code: 'commit_failed', message },
      });
    } finally {
      cleanupController();
    }
  }

  // — paste fallback for a failed bubble —
  function openPaste(id: string) {
    setPasteOpenForId(id);
    setPasteDraft('');
  }

  async function submitPaste(id: string) {
    const text = pasteDraft.trim();
    if (!text) return;
    setPasteOpenForId(null);
    setPasteDraft('');
    patch(id, {
      status: 'linking',
      transcript: text,
      transcribeMs: 0,
      fromPaste: true,
      error: null,
    });
    const c0 = performance.now();
    try {
      const result = await commitMutation.mutateAsync({ transcript: text });
      patch(id, {
        status: 'committed',
        commitMs: Math.round(performance.now() - c0),
        graphResult: result as GraphResult,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'commit failed.';
      patch(id, {
        status: 'failed',
        commitMs: Math.round(performance.now() - c0),
        error: { code: 'commit_failed', message },
      });
    }
  }

  // — retry a failed bubble (re-uses preserved audioBlob) —
  async function retryBubble(id: string) {
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;
    if (msg.error?.code === 'NotAllowedError') {
      // re-arm capture
      activeIdRef.current = id;
      patch(id, { status: 'queued', error: null });
      await recorder.start();
      return;
    }
    if (msg.audioBlob) {
      patch(id, { status: 'uploading', error: null });
      await runCapturePipeline(id, msg.audioBlob, msg.duration);
      return;
    }
    if (msg.transcript) {
      patch(id, { status: 'linking', error: null });
      const c0 = performance.now();
      try {
        const result = await commitMutation.mutateAsync({ transcript: msg.transcript });
        patch(id, {
          status: 'committed',
          commitMs: Math.round(performance.now() - c0),
          graphResult: result as GraphResult,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'commit failed.';
        patch(id, {
          status: 'failed',
          commitMs: Math.round(performance.now() - c0),
          error: { code: 'commit_failed', message },
        });
      }
    }
  }

  function discardBubble(id: string) {
    // Abort BEFORE the state filter so the in-flight transcribe fetch +
    // commit mutation reject cleanly with AbortError (handled in pipeline).
    const controller = pipelineControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      pipelineControllersRef.current.delete(id);
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  // — soft delete (30s undo) —
  const [undoQueue, setUndoQueue] = useState<{ id: string; until: number }[]>([]);

  function softDelete(id: string) {
    patch(id, { status: 'deleted' });
    const until = Date.now() + UNDO_WINDOW_MS;
    setUndoQueue((q) => [...q, { id, until }]);
    // Track the timer id so we can clear it on unmount or undo —
    // otherwise the callback fires after unmount and warns about
    // state updates on an unmounted component.
    const t = setTimeout(() => {
      undoTimersRef.current.delete(id);
      setUndoQueue((q) => q.filter((u) => u.id !== id || u.until !== until));
      // local-only soft delete for v0.1.1a — no backend cascade yet (v0.1.1b)
    }, UNDO_WINDOW_MS);
    // If a previous timer existed for this id (unlikely), clear it.
    const prev = undoTimersRef.current.get(id);
    if (prev) clearTimeout(prev);
    undoTimersRef.current.set(id, t);
  }

  function undoDelete(id: string) {
    const t = undoTimersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      undoTimersRef.current.delete(id);
    }
    patch(id, { status: 'committed' });
    setUndoQueue((q) => q.filter((u) => u.id !== id));
  }

  // — recorder gesture state for the dock —
  const recorderStatus = recorder.status;
  const isIdle = recorderStatus === 'idle' || recorderStatus === 'ready' || recorderStatus === 'error';

  // ── render ─────────────────────────────────────────────────────────
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-page)',
        color: 'var(--ink)',
      }}
    >
      <DesktopStyles />
      <Header userName={userName} recorder={recorder} />

      <ThreadView
        messages={messages.filter((m) => m.status !== 'deleted')}
        onRetry={retryBubble}
        onDiscard={discardBubble}
        onPaste={openPaste}
        onDelete={softDelete}
        pasteOpenForId={pasteOpenForId}
        pasteDraft={pasteDraft}
        setPasteDraft={setPasteDraft}
        onPasteSubmit={submitPaste}
        onPasteCancel={() => setPasteOpenForId(null)}
        threadEndRef={threadEndRef}
        recorder={recorder}
      />

      {undoQueue.length > 0 && <UndoChip queue={undoQueue} onUndo={undoDelete} />}

      <Dock
        recorder={recorder}
        isIdle={isIdle}
        onStart={beginCapture}
      />
      <BottomTabBar active="capture" />
    </main>
  );
}

// ─── Desktop adaptations (≥768px) ───────────────────────────────────────

function DesktopStyles() {
  // Per plan §17.3: on desktop ≥768px the tab bar moves to the top.
  // Inline media-query <style> avoids adding a CSS module just for this.
  //
  // Also declares the 9 named v2 motion cues from `design/design-system.md` §7
  // (`TokensMotion`). Scoped here so capture surfaces use the named cues
  // verbatim instead of the v1 globals.css aliases. Defined once.
  return (
    <style>{`
      @media (min-width: 768px) {
        nav[aria-label="primary"] {
          top: 0;
          bottom: auto !important;
          border-top: none !important;
          border-bottom: 1px solid var(--border-soft);
          height: 60px;
        }
      }

      @keyframes wm-blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
      @keyframes wm-pulse-d {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      @keyframes wm-pulse-s {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      @keyframes wm-drift {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
      @keyframes wm-ring {
        0% { transform: scale(1); opacity: 0.55; }
        100% { transform: scale(1.6); opacity: 0; }
      }
      @keyframes wm-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes wm-rise {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes wm-marquee {
        from { transform: translateX(0); }
        to { transform: translateX(-50%); }
      }
      @keyframes wm-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `}</style>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────

function Header({
  userName,
  recorder,
}: {
  userName: string | null;
  recorder: ReturnType<typeof useAudioRecorder>;
}) {
  // v17 item 4: header morphs while recording — brand avatar + "wingmic" word,
  // a pulsing "recording" indicator, and a live m:ss duration counter.
  //
  // Header recording-indicator stays on through `locked` state — the dock
  // chrome swaps to a stop button (see Dock.isLocked branch) but the header
  // keeps the pulse + counter so the user knows recording is still in flight.
  // This is the v2 variant-A locked-state layout.
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
        {/* Live region: SR announces state change on entry and counter ticks
            via the consolidated aria-label. Inner visual children are
            aria-hidden so SR reads the label only (no double-announce). */}
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
        capture · {userName ?? 'you'}
      </span>
    </header>
  );
}

// ─── Thread view ─────────────────────────────────────────────────────────

interface ThreadViewProps {
  messages: ThreadMessage[];
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onPaste: (id: string) => void;
  onDelete: (id: string) => void;
  pasteOpenForId: string | null;
  pasteDraft: string;
  setPasteDraft: (v: string) => void;
  onPasteSubmit: (id: string) => void;
  onPasteCancel: () => void;
  threadEndRef: React.RefObject<HTMLDivElement | null>;
  recorder: ReturnType<typeof useAudioRecorder>;
}

function ThreadView(props: ThreadViewProps) {
  const { messages, recorder, threadEndRef } = props;
  const recording =
    recorder.status === 'recording' ||
    recorder.status === 'lock_armed' ||
    recorder.status === 'cancel_armed' ||
    recorder.status === 'locked';

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 16px 200px',
        maxWidth: 640,
        width: '100%',
        margin: '0 auto',
        gap: 18,
      }}
    >
      {messages.length === 0 && !recording && <EmptyHero />}

      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          onRetry={() => props.onRetry(m.id)}
          onDiscard={() => props.onDiscard(m.id)}
          onPaste={() => props.onPaste(m.id)}
          onDelete={() => props.onDelete(m.id)}
          pasteOpen={props.pasteOpenForId === m.id}
          pasteDraft={props.pasteDraft}
          setPasteDraft={props.setPasteDraft}
          onPasteSubmit={() => props.onPasteSubmit(m.id)}
          onPasteCancel={props.onPasteCancel}
        />
      ))}

      {recording && <PhantomBubble recorder={recorder} />}

      <div ref={threadEndRef} />
    </div>
  );
}

function EmptyHero() {
  return (
    <div style={{ padding: '60px 8px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        className="mono"
        style={{ fontSize: 11, letterSpacing: 2, color: accent, textTransform: 'uppercase' }}
      >
        start here
      </div>
      <h1
        style={{
          // v2 H3 = 28px Inter 800 / -0.02em / 1.15. Nearest-down from v1's 30.
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
        }}
      >
        hold the button.{' '}
        <span className="serif" style={{ fontStyle: 'italic', color: accent, fontWeight: 400 }}>
          talk for thirty seconds about someone you just met.
        </span>
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-70)', lineHeight: 1.55, maxWidth: 520 }}>
        i&apos;ll sort the names, companies, follow-ups. you&apos;ll see it land below.
      </p>
      <p style={{ fontSize: 14.5, color: 'var(--text-40)', lineHeight: 1.55 }}>
        short is fine. ten seconds counts.
      </p>
    </div>
  );
}

// ─── Phantom (recording-in-progress) bubble ─────────────────────────────

function PhantomBubble({ recorder }: { recorder: ReturnType<typeof useAudioRecorder> }) {
  const sec = (recorder.duration / 1000).toFixed(1);
  return (
    <div
      style={{
        alignSelf: 'flex-end',
        maxWidth: '86%',
        padding: '14px 16px',
        borderRadius: 14,
        background: 'var(--surface-2)',
        border: `1.5px solid ${accent}50`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        animation: 'wm-rise 0.4s ease-out',
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
      <LevelMeter level={recorder.level} />
      {/* v17 item 3: the slide-up-to-lock floating circle (rendered by Dock)
          replaces the old text-hint that lived here. Phantom bubble is now
          the live transcription surface only. */}
    </div>
  );
}

function LevelMeter({ level }: { level: number[] }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="recording level"
      style={{
        display: 'flex',
        gap: 3,
        alignItems: 'center',
        height: 40,
      }}
    >
      {level.map((v, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            width: 3,
            height: Math.max(4, Math.round(4 + v * 34)),
            background: accent,
            borderRadius: 2,
            transition: 'height 0.12s ease-out',
          }}
        />
      ))}
    </div>
  );
}

// ─── Message bubble ──────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ThreadMessage;
  onRetry: () => void;
  onDiscard: () => void;
  onPaste: () => void;
  onDelete: () => void;
  pasteOpen: boolean;
  pasteDraft: string;
  setPasteDraft: (v: string) => void;
  onPasteSubmit: () => void;
  onPasteCancel: () => void;
}

function MessageBubble(props: MessageBubbleProps) {
  const { message: m } = props;

  if (m.status === 'failed') return <FailedBubble {...props} />;

  const showSkeleton = m.status === 'uploading' || m.status === 'transcribing';
  const showLinkSweep = m.status === 'linking';
  const isCommitted = m.status === 'committed';

  return (
    <div style={{ alignSelf: 'flex-end', maxWidth: '92%', width: '100%' }}>
      {/* v17 item 1: user-authored bubble chrome — accent fill, brutal shadow,
          asymmetric radii (sharp bottom-right corner). Matches CaptureVariantA. */}
      <div
        style={{
          alignSelf: 'flex-end',
          padding: '14px 16px',
          borderRadius: '18px 18px 4px 18px',
          background: accent,
          color: '#fff',
          border: '1.5px solid #000',
          boxShadow: '3px 3px 0 #000',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          position: 'relative',
        }}
      >
        <BubbleHeader m={m} onDelete={props.onDelete} />
        {showSkeleton ? (
          <Skeleton />
        ) : m.transcript ? (
          <p
            style={{
              fontSize: 15.5,
              lineHeight: 1.55,
              color: '#fff',
              whiteSpace: 'pre-wrap',
              margin: 0,
            }}
          >
            {m.transcript}
          </p>
        ) : null}
        {showLinkSweep && (
          // v17 item 1: bubble is now accent — sweep must contrast (white).
          <div
            aria-hidden="true"
            style={{
              height: 2,
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
              backgroundSize: '200% 100%',
              borderRadius: 2,
              animation: 'wm-shimmer 1.8s linear infinite',
            }}
          />
        )}
        <BubbleFooter m={m} />
      </div>
      {isCommitted && m.graphResult && <GraphCard message={m} result={m.graphResult} />}
    </div>
  );
}

function BubbleHeader({ m, onDelete }: { m: ThreadMessage; onDelete: () => void }) {
  const time = m.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let meta = '';
  if (m.status === 'uploading') meta = '↑ uploading';
  else if (m.status === 'transcribing') {
    const elapsed = m.transcribingStartedAt
      ? ((performance.now() - m.transcribingStartedAt) / 1000).toFixed(1)
      : '0.0';
    meta = `· transcribing ${elapsed}s`;
  } else if (m.status === 'linking') meta = '· linking entities';
  else if (m.status === 'committed') meta = `· ${time}`;

  // v17 item 1: meta on the accent bubble — white-translucent for legibility.
  return (
    <div
      className="mono"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 10,
        color: 'rgba(255,255,255,0.75)',
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      <span>{m.status === 'committed' ? time : meta}</span>
      {m.status === 'committed' && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="delete memo"
          style={{
            background: 'transparent',
            color: 'rgba(255,255,255,0.75)',
            border: 'none',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          ⋯
        </button>
      )}
    </div>
  );
}

function BubbleFooter({ m }: { m: ThreadMessage }) {
  // v17 item 1: footer meta lives on the accent bubble — white-translucent.
  const meta = 'rgba(255,255,255,0.65)';
  if (m.status === 'uploading' || m.status === 'transcribing') {
    const kb = m.audioBlob ? Math.round(m.audioBlob.size / 1024) : 0;
    const dur = (m.duration / 1000).toFixed(1);
    return (
      <div className="mono" style={{ fontSize: 10, color: meta }}>
        {kb}kb · {dur}s
      </div>
    );
  }
  if (m.status === 'linking') {
    return (
      <div className="mono" style={{ fontSize: 10, color: meta }}>
        transcribed in {fmtMs(m.transcribeMs)} · committing...
      </div>
    );
  }
  if (m.status === 'committed') {
    const g = m.graphResult;
    const newN = g?.newEntities ?? 0;
    const linkN = g?.matchedEntities ?? 0;
    const isEmpty =
      g != null &&
      g.extracted.persons.length === 0 &&
      g.extracted.companies.length === 0 &&
      g.extracted.events.length === 0 &&
      g.extracted.actions.length === 0;
    if (isEmpty) {
      return (
        <div className="mono" style={{ fontSize: 10, color: meta }}>
          no entities found · {fmtMs(m.transcribeMs)} transcribe · {fmtMs(m.commitMs)} commit
        </div>
      );
    }
    return (
      <div className="mono" style={{ fontSize: 10, color: meta }}>
        {fmtMs(m.transcribeMs)} transcribe · {fmtMs(m.commitMs)} commit · {newN} new ·{' '}
        {linkN} linked
      </div>
    );
  }
  return null;
}

function Skeleton() {
  // v2 §6 "Loading / skeleton": skeletons match real shape, animated with
  // `wm-shimmer 1.6s linear infinite` on a 3-stop linear gradient.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[0.85, 0.7, 0.55].map((w, i) => (
        <div
          key={i}
          style={{
            width: `${w * 100}%`,
            height: 10,
            borderRadius: 6,
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 100%)',
            backgroundSize: '200% 100%',
            animation: 'wm-shimmer 1.6s linear infinite',
            animationDelay: `${i * 120}ms`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Failed bubble ───────────────────────────────────────────────────────

function FailedBubble(props: MessageBubbleProps) {
  const { message: m } = props;
  const code = m.error?.code ?? 'unknown_error';

  const kind = failedKind(code);
  const actions = failedActions(code);

  return (
    <div
      role="alert"
      style={{
        alignSelf: 'flex-end',
        maxWidth: '92%',
        padding: '14px 16px',
        borderRadius: 14,
        background: 'rgba(255,107,107,0.06)',
        border: '1px solid rgba(255,107,107,0.25)',
        borderLeft: `3px solid ${coral}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 10,
          color: coral,
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        ! failed · {kind}
      </div>
      <p
        style={{
          fontSize: 14.5,
          lineHeight: 1.55,
          color: 'var(--text-85)',
          margin: 0,
        }}
      >
        {m.error?.message ?? 'something broke.'}
      </p>
      {props.pasteOpen ? (
        <PasteInline
          draft={props.pasteDraft}
          setDraft={props.setPasteDraft}
          onSubmit={props.onPasteSubmit}
          onCancel={props.onPasteCancel}
        />
      ) : (
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--text-70)',
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {actions.includes('retry') && (
            <InlineLink onClick={props.onRetry}>↻ retry</InlineLink>
          )}
          {actions.includes('retry-mic') && (
            <InlineLink onClick={props.onRetry}>↻ retry mic</InlineLink>
          )}
          {actions.includes('re-record') && (
            <InlineLink onClick={props.onRetry}>↻ re-record</InlineLink>
          )}
          {actions.includes('re-upload') && (
            <InlineLink onClick={props.onRetry}>↻ re-upload</InlineLink>
          )}
          {actions.includes('paste') && (
            <InlineLink onClick={props.onPaste}>✎ paste instead</InlineLink>
          )}
          {actions.includes('type') && (
            <InlineLink onClick={props.onPaste}>✎ type instead</InlineLink>
          )}
          {actions.includes('discard') && (
            <InlineLink onClick={props.onDiscard}>× discard</InlineLink>
          )}
          {actions.includes('start-over') && (
            <InlineLink onClick={props.onDiscard}>× start over</InlineLink>
          )}
        </div>
      )}
    </div>
  );
}

function failedKind(code: FailureCode): string {
  switch (code) {
    case 'provider_error':
      return 'transcribe';
    case 'rate_limited':
      return 'rate-limited';
    case 'too_big':
      return 'too big';
    case 'too_long':
      return 'too long';
    case 'transcript_empty':
      return 'silent';
    case 'NotAllowedError':
      return 'mic';
    case 'network':
      return 'upload';
    case 'commit_failed':
      return 'commit';
    default:
      return 'unknown';
  }
}

type FailedAction =
  | 'retry'
  | 'retry-mic'
  | 're-record'
  | 're-upload'
  | 'paste'
  | 'type'
  | 'discard'
  | 'start-over';

function failedActions(code: FailureCode): FailedAction[] {
  switch (code) {
    case 'provider_error':
    case 'rate_limited':
      return ['retry', 'paste', 'discard'];
    case 'too_big':
    case 'too_long':
      return ['re-record', 'paste', 'discard'];
    case 'network':
      return ['re-upload', 'start-over'];
    case 'transcript_empty':
      return ['retry', 'type'];
    case 'NotAllowedError':
      return ['retry-mic', 'type'];
    case 'commit_failed':
      return ['retry', 'paste', 'discard'];
    default:
      return ['retry', 'discard'];
  }
}

function InlineLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        color: accent,
        border: 'none',
        cursor: 'pointer',
        font: 'inherit',
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function PasteInline({
  draft,
  setDraft,
  onSubmit,
  onCancel,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="type the memo. entities get sorted on commit."
        rows={4}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--border-soft)',
          borderRadius: 10,
          color: 'var(--ink)',
          font: '14.5px Inter, system-ui, sans-serif',
          resize: 'vertical',
          outline: 'none',
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!draft.trim()}
          style={{
            // v2 sm button: 8/14 padding, 12.5px font. Sticker-shadow primary
            // (3px 3px 0 #000) is correct here per design-system §6 Buttons.
            padding: '8px 14px',
            borderRadius: 10,
            background: accent,
            color: '#000',
            fontWeight: 700,
            border: '1.5px solid #000',
            boxShadow: '3px 3px 0 #000',
            cursor: 'pointer',
            opacity: draft.trim() ? 1 : 0.5,
            font: '700 12.5px Inter, system-ui, sans-serif',
          }}
        >
          commit →
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            background: 'transparent',
            color: 'var(--ink)',
            border: '1.5px solid var(--border-mid)',
            cursor: 'pointer',
            font: '600 12.5px Inter, system-ui, sans-serif',
          }}
        >
          cancel
        </button>
      </div>
    </div>
  );
}

// ─── Graph card ──────────────────────────────────────────────────────────

function GraphCard({ message, result }: { message: ThreadMessage; result: GraphResult }) {
  const { extracted } = result;
  const isEmpty =
    extracted.persons.length === 0 &&
    extracted.companies.length === 0 &&
    extracted.events.length === 0 &&
    extracted.actions.length === 0;

  if (isEmpty) return null; // footer in bubble covers the empty-state copy

  return (
    <div
      style={{
        marginTop: 8,
        padding: 14,
        borderRadius: 14,
        background: 'var(--surface-1)',
        border: '1px solid var(--border-soft)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        animation: 'wm-rise 0.4s ease-out',
      }}
    >
      {extracted.persons.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            className="mono"
            style={{ fontSize: 9.5, color: 'var(--text-40)', letterSpacing: 2, textTransform: 'uppercase' }}
          >
            people
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {extracted.persons.map((p, i) => (
              <PersonPill key={`${p.name}-${i}`} person={p} />
            ))}
          </div>
        </div>
      )}

      {(extracted.companies.length > 0 || extracted.events.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {extracted.companies.map((c) => (
            <TagPill key={`co-${c.name}`} color={blue}>
              {c.name}
            </TagPill>
          ))}
          {extracted.events.map((e) => (
            <TagPill key={`ev-${e.name}`} color={third}>
              {e.name}
            </TagPill>
          ))}
        </div>
      )}

      {extracted.actions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            className="mono"
            style={{ fontSize: 9.5, color: 'var(--text-40)', letterSpacing: 2, textTransform: 'uppercase' }}
          >
            follow-ups
          </div>
          {extracted.actions.slice(0, 2).map((a, i) => (
            <ActionCard key={i} action={a} />
          ))}
          {extracted.actions.length > 2 && (
            <div className="mono" style={{ fontSize: 11, color: accent }}>
              +{extracted.actions.length - 2} more →
            </div>
          )}
        </div>
      )}

      {extracted.topics.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {extracted.topics.map((t) => (
            <TagPill key={t} color={violet}>
              {t}
            </TagPill>
          ))}
        </div>
      )}

      <div
        className="mono"
        style={{
          fontSize: 9.5,
          color: 'var(--text-30)',
          letterSpacing: 1,
          paddingTop: 6,
          borderTop: '1px solid var(--border-soft)',
        }}
      >
        {fmtMs(message.transcribeMs)} transcribe · {fmtMs(message.commitMs)} commit ·{' '}
        {result.newEntities} new · {result.matchedEntities} linked
      </div>
    </div>
  );
}

function PersonPill({
  person,
}: {
  person: {
    name: string;
    role: string | null;
    companyHint: string | null;
    topics: string[];
  };
}) {
  const monogram = person.name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  // v0.1.1a: layer-source stripe is hardcoded accent. v0.1.1b: per-entity layer source.
  return (
    <a
      href={`/entity/${encodeURIComponent(person.name)}`}
      style={{
        display: 'flex',
        gap: 10,
        padding: '8px 12px 8px 8px',
        borderRadius: 999,
        background: 'var(--surface-2)',
        border: '1px solid var(--border-soft)',
        borderLeft: `2px solid ${accent}`,
        textDecoration: 'none',
        color: 'inherit',
        alignItems: 'center',
        minHeight: 32,
      }}
    >
      <span
        // v2 §6 Avatars: initial in Inter 800 black, sized ~0.4 × size (28 → 11).
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          background: accent,
          color: '#000',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 11,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {monogram}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>{person.name}</span>
        {(person.role || person.companyHint) && (
          <span style={{ fontSize: 11, color: 'var(--text-55)' }}>
            {person.role}
            {person.role && person.companyHint && ' · '}
            {person.companyHint && <span style={{ color: blue }}>{person.companyHint}</span>}
          </span>
        )}
      </span>
    </a>
  );
}

function TagPill({ color, children }: { color: string; children: React.ReactNode }) {
  // v2 tag-pill recipe (design-system §2 "Tag-pill recipe"): ${color}1f fill
  // + ${color}40 border + full-color text. Replaces v1's `${color}20`/`22`.
  return (
    <span
      className="mono"
      style={{
        padding: '3px 9px',
        borderRadius: 999,
        background: `${color}1f`,
        color,
        border: `1px solid ${color}40`,
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

function ActionCard({
  action,
}: {
  action: { kind: string; body: string; whenHint: string | null };
}) {
  const glyph =
    action.kind === 'reminder'
      ? '◷'
      : action.kind === 'intro'
        ? '⇌'
        : action.kind === 'check-in'
          ? '↗'
          : '→';
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid var(--border-soft)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div
        className="mono"
        style={{ fontSize: 10, color: accent, letterSpacing: 1, textTransform: 'uppercase' }}
      >
        {glyph} {action.kind}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-85)' }}>{action.body}</div>
      {action.whenHint && (
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-40)' }}>
          due: {action.whenHint}
        </div>
      )}
    </div>
  );
}

// ─── Undo chip ──────────────────────────────────────────────────────────

function UndoChip({
  queue,
  onUndo,
}: {
  queue: { id: string; until: number }[];
  onUndo: (id: string) => void;
}) {
  const latest = queue[queue.length - 1];
  if (!latest) return null;
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 180,
        transform: 'translateX(-50%)',
        padding: '8px 14px',
        background: 'rgba(255,107,107,0.12)',
        border: `1px solid ${coral}40`,
        borderRadius: 999,
        color: 'var(--ink)',
        fontSize: 12,
        zIndex: 60,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
      className="mono"
    >
      memo removed ·{' '}
      <button
        type="button"
        onClick={() => onUndo(latest.id)}
        style={{
          color: accent,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        ↶ undo
      </button>
    </div>
  );
}

// ─── Dock (push-to-talk button + ambient privacy line) ──────────────────

function Dock({
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

  // helper: haptic
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

  // pointer events
  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!isIdle) return;
    // Reject second-finger touches mid-record. Without this guard the second
    // pointerdown overwrites pointerIdRef + activeIdRef and the first
    // capture's blob lands in the wrong bubble.
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
    // Window-level release fallback. If the finger lifts outside the button
    // bounds (or setPointerCapture failed), the button's onPointerUp never
    // fires and the mic would stay hot. These listeners cover that case and
    // remove themselves once they trigger.
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
    // 60s watchdog — if neither button nor window release fires, force-stop.
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

  // Shared release logic — invoked by button-bound pointer events AND the
  // window-level fallback listeners. Idempotent: clears pointer state first.
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
    // up
    if (wasCancelArmed) {
      vibrate([30, 20, 30]);
      recorder.discard();
      return;
    }
    if (wasLockArmed || status === 'locked') {
      // keep recording — user must tap stop pill
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
      // already handled by lock/discard via threshold cross
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

  // Cleanup any dangling listeners + watchdog on unmount.
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
          // keyboard goes straight to LOCKED (no slide gestures)
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

  // v0.1.2 PR α v15 — drive dock visuals from the 7-state MicOrb mapping.
  // `isHovered` is :hover/:focus-visible bookkeeping on the orb button itself.
  // `orbState` is the single source of truth for which visual recipe runs
  // (see lib-voice.jsx `VoiceMicStates`). The old `isLocked` / `isActive`
  // booleans are derived from `orbState` so the surrounding chrome (pill,
  // coral stop) still gates correctly without re-walking RecorderStatus.
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
              // v2 radii ladder: 6/10/14/18/36/999. Nearest-down from 16 = 14.
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
          // v17 items 2 + 3: when recording, the dock morphs into a horizontal
          // pill (composer chrome) with the SAME <button> shrunk to 46px and
          // moved to the right edge. We keep the original button element across
          // idle↔active so pointer capture, listeners, and gesture state stay
          // attached — only the surrounding chrome + styles swap.
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
                {/* pulsing alarm dot */}
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
                {/* 5-bar voice meter, accent, staggered */}
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
                {/* slide-to-cancel hint */}
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
                {/* v17 item 3: slide-up-to-lock floating circle, above the mic. */}
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
            {/*
              v0.1.2 PR α v15 — visual variants per `orbState` (lib-voice.jsx).
                · idle      → 88px, surface-1, t70 'hold' label, 4px brutal shadow
                · hover     → 88px, lifted (-1px) w/ 5px shadow & subtle tint
                · recording → 46px, accent fill, 30px accent glow, mic glyph
                · sending   → 46px, muted (rgba 0.06) fill, t70 mic glyph,
                              wm-spin sweep ring around the orb
                · locked    → handled by the outer coral stop button branch
                · thinking  → reserved (see micOrbState.ts) — not currently
                              produced because the recorder hook completes at
                              'ready' before the LLM-extraction phase begins
                · done      → reserved (see micOrbState.ts) — commit success
                              currently surfaces via the GraphCard, not the orb
              Only the 9 named keyframes from DesktopStyles are used.
            */}
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
              {/* sending: thin sweep ring around the orb (wm-spin). */}
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
                // white mic glyph (CaptureVariantA uses Icon name="mic")
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
                // muted mic glyph (text-70) — uploading the blob.
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

// ─── Bottom tab bar ──────────────────────────────────────────────────────

function BottomTabBar({ active }: { active: 'home' | 'chat' | 'capture' | 'graph' | 'acts' }) {
  // v8 5-slot bottom nav (plan §18, design/v2/library/lib-screens.jsx MobileNav):
  //   home / chat / capture / graph / acts. The center capture slot breaks the
  //   bar plane — larger disc, accent fill, brutal shadow, lifts above the bar
  //   baseline. graph + acts routes ship empty in v11/v12; hrefs 404 until then.
  const tabs: Array<{ key: typeof active; glyph: string; label: string; href: string; big?: boolean }> = [
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
            {/* v2 Bottom nav: icon 20 + active=accent / inactive=text-55. */}
            <span style={{ fontSize: 20, color: isActive ? accent : 'var(--text-55)' }}>
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
