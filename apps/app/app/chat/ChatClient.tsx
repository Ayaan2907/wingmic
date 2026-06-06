'use client';

// ChatClient — the chat surface (PR β₁-A).
//
// chat IS the capture surface. See design/v2/design.md §12 "one mic, one
// surface": every mic affordance lands here with the recorder engaged.
//
// Architecture (post-split, PR β₁-A):
//   ChatClient (this file) — owns the recorder hook, the pipeline state,
//     and the mutation. Hosts global keyframes via DesktopStyles.
//   ChatHeader — wordmark + recording counter.
//   ChatThread — message list + phantom bubble + thread dimming.
//   CaptureDock — push-to-talk button + composer pill + privacy line.
//
// β₁ behavior additions:
//   · server-prefetched committed memos seed the thread.
//   · ?armRecord=1 (set by the upcoming /capture redirect, β₁-B) starts
//     the capture pipeline on mount, mirroring the keyboard-Space path.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { useAudioRecorder } from '@/app/capture/_components/useAudioRecorder';
import { BottomTabBar } from '@/app/_components/BottomTabBar';
import { ChatHeader } from './_components/ChatHeader';
import { ChatThread, UndoChip } from './_components/ChatThread';
import { CaptureDock } from './_components/CaptureDock';
import { UNDO_WINDOW_MS } from './_components/tokens';
import type {
  ChatInitialItem,
  FailureCode,
  GraphResult,
  ThreadMessage,
} from './_components/types';

interface ChatClientProps {
  userName: string | null;
  /** Server-prefetched, oldest-first list of past committed memos. Defaults to []. */
  initialThread?: ChatInitialItem[];
}

function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `bub_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function seedMessages(initialThread: ChatInitialItem[]): ThreadMessage[] {
  return initialThread.map((item) => ({
    id: item.id,
    status: 'committed',
    audioBlob: null,
    transcript: item.transcript,
    duration: 0,
    transcribeMs: null,
    commitMs: null,
    graphResult: null,
    error: null,
    createdAt: new Date(item.capturedAt),
    transcribingStartedAt: null,
    fromPaste: false,
  }));
}

function ChatClientInner({ userName, initialThread = [] }: ChatClientProps) {
  const recorder = useAudioRecorder();
  // useAudioRecorder returns a fresh object literal every render, so
  // `recorder` has a new identity each pass. We pin the latest value in
  // a ref so callbacks that need its methods/state can read them without
  // listing `recorder` in their dep arrays — otherwise every useCallback
  // that closes over it would be recreated each render, defeating the
  // React.memo equality checks in ChatThread + CaptureDock (PR β₁-C, D5).
  // Pattern: https://react.dev/learn/separating-events-from-effects
  const recorderRef = useRef(recorder);
  useEffect(() => {
    recorderRef.current = recorder;
  }, [recorder]);
  const [messages, setMessages] = useState<ThreadMessage[]>(() => seedMessages(initialThread));
  const [pasteOpenForId, setPasteOpenForId] = useState<string | null>(null);
  const [pasteDraft, setPasteDraft] = useState('');
  const activeIdRef = useRef<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  /** AbortController per in-flight pipeline (keyed by bubble id). */
  const pipelineControllersRef = useRef<Map<string, AbortController>>(new Map());
  /** setTimeout handles for soft-delete grace windows (keyed by bubble id). */
  const undoTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** Guard so the armRecord param fires exactly once on mount. */
  const armedOnceRef = useRef(false);

  const commitMutation = trpc.capture.commit.useMutation();

  // useSearchParams() returns null when no router context is present (e.g.
  // jsdom tests without a Next provider). Null-guard the read so the
  // existing CaptureClient test suite keeps passing.
  const searchParams = useSearchParams();
  const armRecord = searchParams?.get('armRecord') ?? null;

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

  const patch = useCallback((id: string, p: Partial<ThreadMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...p } : m)));
  }, []);

  useEffect(() => {
    const el = threadEndRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length]);

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
    await recorderRef.current.start();
  }, []);

  // armRecord=1 — set by the upcoming /capture → /chat redirect (β₁-B).
  // Mirror the keyboard-Space path so the queued bubble is created AND
  // the recording auto-locks (no held pointer to release).
  useEffect(() => {
    if (armRecord !== '1') return;
    if (armedOnceRef.current) return;
    if (recorder.status !== 'idle') return;
    armedOnceRef.current = true;
    void (async () => {
      await beginCapture();
      recorder.lock();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armRecord]);

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
      const id = activeIdRef.current;
      activeIdRef.current = null;
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.status]);

  async function runCapturePipeline(id: string, blob: Blob, recordingDuration: number) {
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

    if (signal.aborted) {
      cleanupController();
      return;
    }

    patch(id, { status: 'linking', transcript, transcribeMs });

    const c0 = performance.now();
    try {
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

  const openPaste = useCallback((id: string) => {
    setPasteOpenForId(id);
    setPasteDraft('');
  }, []);

  const closePaste = useCallback(() => {
    setPasteOpenForId(null);
  }, []);

  const submitPaste = useCallback(
    async (id: string) => {
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
    },
    [pasteDraft, patch, commitMutation],
  );

  const retryBubble = useCallback(async (id: string) => {
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;
    if (msg.error?.code === 'NotAllowedError') {
      activeIdRef.current = id;
      patch(id, { status: 'queued', error: null });
      await recorderRef.current.start();
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
  }, [messages, patch, commitMutation]);

  const discardBubble = useCallback((id: string) => {
    const controller = pipelineControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      pipelineControllersRef.current.delete(id);
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const [undoQueue, setUndoQueue] = useState<{ id: string; until: number }[]>([]);

  const softDelete = useCallback((id: string) => {
    patch(id, { status: 'deleted' });
    const until = Date.now() + UNDO_WINDOW_MS;
    setUndoQueue((q) => [...q, { id, until }]);
    const t = setTimeout(() => {
      undoTimersRef.current.delete(id);
      setUndoQueue((q) => q.filter((u) => u.id !== id || u.until !== until));
    }, UNDO_WINDOW_MS);
    const prev = undoTimersRef.current.get(id);
    if (prev) clearTimeout(prev);
    undoTimersRef.current.set(id, t);
  }, [patch]);

  const undoDelete = useCallback((id: string) => {
    const t = undoTimersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      undoTimersRef.current.delete(id);
    }
    patch(id, { status: 'committed' });
    setUndoQueue((q) => q.filter((u) => u.id !== id));
  }, [patch]);

  const recorderStatus = recorder.status;
  const isIdle = recorderStatus === 'idle' || recorderStatus === 'ready' || recorderStatus === 'error';

  // Memoized so the filtered array reference is stable when no message
  // status flips between 'deleted' ↔ other. ChatThread's React.memo
  // equality compares messages by reference (PR β₁-C, D5).
  const visibleMessages = useMemo(
    () => messages.filter((m) => m.status !== 'deleted'),
    [messages],
  );

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
      <ChatHeader userName={userName} recorder={recorder} />

      <ChatThread
        messages={visibleMessages}
        onRetry={retryBubble}
        onDiscard={discardBubble}
        onPaste={openPaste}
        onDelete={softDelete}
        pasteOpenForId={pasteOpenForId}
        pasteDraft={pasteDraft}
        setPasteDraft={setPasteDraft}
        onPasteSubmit={submitPaste}
        onPasteCancel={closePaste}
        threadEndRef={threadEndRef}
        recorder={recorder}
      />

      {undoQueue.length > 0 && <UndoChip queue={undoQueue} onUndo={undoDelete} />}

      <CaptureDock recorder={recorder} isIdle={isIdle} onStart={beginCapture} />
      <BottomTabBar active="capture" />
    </main>
  );
}

// useSearchParams() requires a Suspense boundary in Next.js 15. Wrapping
// at the export keeps /chat, the /capture shim, and the existing test
// inheriting it from one place. Both pages are already dynamic via
// headers(), so this is belt-and-braces for the build gate.
export default function ChatClient(props: ChatClientProps) {
  return (
    <Suspense fallback={null}>
      <ChatClientInner {...props} />
    </Suspense>
  );
}

// ─── Desktop adaptations (≥768px) + global keyframes ────────────────────
//
// The 9 named v2 motion cues (design/v2/design.md §7) plus the desktop
// nav layout swap. Inline <style> avoids adding a CSS module just for
// this. Stays here at the ChatClient top level so all descendants —
// ChatThread, CaptureDock, ChatHeader — share one keyframe registration.

function DesktopStyles() {
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
