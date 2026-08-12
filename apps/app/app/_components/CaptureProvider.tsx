'use client';

// CaptureProvider — global capture state, mounted once in the root layout
// (PR β₁-D). The breakthrough vs PR β₁-A/B/C: the bottom-nav orb IS the dock.
// Recording happens in place on whatever page the user is currently on.
// On commit, route to /chat so the user sees the bubble land in the thread.
//
// Architecture:
//   layout.tsx → <CaptureProvider> wraps the whole subtree.
//     · owns the useAudioRecorder hook (one instance per session).
//     · owns messages[] + the capture pipeline + paste + soft-delete state.
//     · owns the global Space/Escape keyboard shortcuts.
//     · on recorder.status === 'ready', runs the pipeline + router.push('/chat').
//   BottomTabBar consumes useCapture() — the center "orb" button is the
//     real push-to-talk element with pointer-capture handlers.
//   RecordingOverlay consumes useCapture() — renders dim + transcript +
//     lock circle + slide-cancel chrome whenever the recorder is hot.
//   ChatClient consumes useCapture() — renders the thread + header from
//     the provider's messages/recorder.
//
// useCapture() returns a safe "uninitialized" default when called outside
// a provider, so unit tests that mount HomeClient or BottomTabBar without
// the provider keep working with no behavioral change.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { useAudioRecorder, type UseAudioRecorder } from '@/app/capture/_components/useAudioRecorder';
import type {
  ChatInitialItem,
  FailureCode,
  GraphResult,
  ThreadMessage,
  AskResult,
} from '@/app/chat/_components/types';
import { classifyIntent } from '@/app/chat/_components/intent';
import { UNDO_WINDOW_MS } from '@/app/chat/_components/tokens';

export interface UndoEntry {
  id: string;
  until: number;
}

export interface CaptureContextValue {
  recorder: UseAudioRecorder;
  messages: ThreadMessage[];
  visibleMessages: ThreadMessage[];
  undoQueue: UndoEntry[];
  pasteOpenForId: string | null;
  pasteDraft: string;
  setPasteDraft: (v: string) => void;
  beginCapture: () => void | Promise<void>;
  retryBubble: (id: string) => void | Promise<void>;
  discardBubble: (id: string) => void;
  softDelete: (id: string) => void;
  undoDelete: (id: string) => void;
  openPaste: (id: string) => void;
  closePaste: () => void;
  submitPaste: (id: string) => void | Promise<void>;
  submitText: (text: string) => void | Promise<void>;
  saveAskAsMemo: (id: string) => void | Promise<void>;
  /** Seed the thread from server-prefetched committed memos. Idempotent
   *  across route changes — calling repeatedly is a no-op after the first
   *  call. Merge-prepends so a live-recorded bubble created BEFORE the
   *  /chat mount survives the seed (critical: record-on-/home → push → /chat). */
  seedThreadOnce: (initial: ChatInitialItem[]) => void;
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
    graphResult: item.graphResult ?? null,
    error: null,
    createdAt: new Date(item.capturedAt),
    transcribingStartedAt: null,
    fromPaste: false,
  }));
}

// ── No-op default for outside-provider consumers (tests, isolated mounts) ──
//
// HomeClient.test mounts <HomeClient> with no <CaptureProvider>, and
// HomeClient renders <BottomTabBar> which calls useCapture(). Rather than
// wrap every test, useCapture returns a static idle bag when no provider
// is mounted. Behavioral tests (record → commit) still must wrap in
// <CaptureProvider> because the recorder hook only exists inside it.
const NOOP_RECORDER: UseAudioRecorder = {
  status: 'idle',
  duration: 0,
  level: Array<number>(22).fill(0),
  audioBlob: null,
  error: null,
  start: async () => {},
  stop: () => {},
  discard: () => {},
  lock: () => {},
  setCancelArmed: () => {},
  setLockArmed: () => {},
  reset: () => {},
  supported: false,
};

const DEFAULT_VALUE: CaptureContextValue = {
  recorder: NOOP_RECORDER,
  messages: [],
  visibleMessages: [],
  undoQueue: [],
  pasteOpenForId: null,
  pasteDraft: '',
  setPasteDraft: () => {},
  beginCapture: () => {},
  retryBubble: () => {},
  discardBubble: () => {},
  softDelete: () => {},
  undoDelete: () => {},
  openPaste: () => {},
  closePaste: () => {},
  submitPaste: () => {},
  submitText: () => {},
  saveAskAsMemo: () => {},
  seedThreadOnce: () => {},
};

const CaptureContext = createContext<CaptureContextValue>(DEFAULT_VALUE);

export function useCapture(): CaptureContextValue {
  return useContext(CaptureContext);
}

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const recorder = useAudioRecorder();
  const recorderRef = useRef(recorder);
  useEffect(() => {
    recorderRef.current = recorder;
  }, [recorder]);

  const router = useRouter();
  const pathname = usePathname();

  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [pasteOpenForId, setPasteOpenForId] = useState<string | null>(null);
  const [pasteDraft, setPasteDraft] = useState('');
  const [undoQueue, setUndoQueue] = useState<UndoEntry[]>([]);

  const activeIdRef = useRef<string | null>(null);
  /** Bubble id handed off when recorder enters encoding — frees the orb for the next take. */
  const handoffBubbleIdRef = useRef<string | null>(null);
  /** Tap during encoding/ready queues the next take after the prior blob finalizes. */
  const pendingBeginRef = useRef(false);
  const pipelineControllersRef = useRef<Map<string, AbortController>>(new Map());
  const undoTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** Bumped on undo so a late delete response cannot win over restore. */
  const deleteGenerationRef = useRef<Map<string, number>>(new Map());
  const seededRef = useRef(false);

  const commitMutation = trpc.capture.commit.useMutation();
  const deleteMutation = trpc.capture.delete.useMutation();
  const restoreMutation = trpc.capture.restore.useMutation();
  const utils = trpc.useUtils();

  const patch = useCallback((id: string, p: Partial<ThreadMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...p } : m)));
  }, []);

  /** Map bubble id → interactions.id for persist. Live commits stash it on
   *  graphResult; server-seeded rows use the interaction id as the bubble id. */
  const interactionIdFor = useCallback((msg: ThreadMessage | undefined): string | null => {
    if (!msg) return null;
    if (msg.graphResult?.interactionId) return msg.graphResult.interactionId;
    if (msg.status === 'committed' || msg.status === 'deleted') return msg.id;
    return null;
  }, []);

  const runAskPipeline = useCallback(
    async (id: string, q: string) => {
      try {
        const res = await utils.recall.query.fetch({ q, limit: 5 });
        const ask: AskResult = {
          matches: res.entities.map((e) => ({
            id: e.id,
            name: e.name,
            role: e.companies[0]?.role ?? '',
            company: e.companies[0]?.name ?? '',
            topics: e.topics.map((t) => t.name),
            score: e.score,
          })),
          durationMs: res.durationMs,
          mode: res.mode,
        };
        patch(id, { status: 'answered', ask, error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'search failed.';
        patch(id, {
          status: 'failed',
          error: { code: 'ask_failed', message },
        });
      }
    },
    [patch, utils],
  );
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

  const beginCapture = useCallback(async () => {
    const status = recorderRef.current.status;
    if (status === 'encoding' || status === 'ready') {
      pendingBeginRef.current = true;
      return;
    }
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

  const runCapturePipeline = useCallback(
    async (id: string, blob: Blob, recordingDuration: number) => {
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

      if (classifyIntent(transcript) === 'ask') {
        patch(id, { status: 'answering', transcript, transcribeMs, intent: 'ask' });
        await runAskPipeline(id, transcript);
        cleanupController();
        return;
      }

      patch(id, { status: 'linking', transcript, transcribeMs, intent: 'memo' });

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
    },
    [patch, commitMutation, runAskPipeline],
  );

  // Pathname is stale-closure-prone inside the status effect (recorder.status
  // is the only dep we want to react to). Pin the latest pathname in a ref so
  // the effect reads it fresh without re-firing on every route change.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Recorder lifecycle → pipeline + post-commit routing.
  // When recorder reaches `ready`, kick the pipeline and (if user is not
  // already on /chat) push to /chat so the bubble + extraction render in
  // the thread. The pipeline runs in parallel with the route change.
  // On `encoding`, detach the bubble id so a second take can arm while the
  // prior blob finalizes (U3 — non-blocking record loop).
  useEffect(() => {
    if (recorder.status === 'encoding' && activeIdRef.current) {
      handoffBubbleIdRef.current = activeIdRef.current;
      activeIdRef.current = null;
    }
    if (recorder.status === 'ready' && recorder.audioBlob) {
      const fromHandoff = handoffBubbleIdRef.current;
      const id = fromHandoff ?? activeIdRef.current;
      if (!id) return;
      if (fromHandoff) {
        handoffBubbleIdRef.current = null;
      } else {
        activeIdRef.current = null;
      }
      const blob = recorder.audioBlob;
      const dur = recorder.duration;
      void runCapturePipeline(id, blob, dur);
      recorder.reset();
      if (pendingBeginRef.current) {
        pendingBeginRef.current = false;
        void Promise.resolve().then(() => beginCapture());
      }
      if (pathnameRef.current !== '/chat') {
        try {
          router.push('/chat');
        } catch {
          // jsdom / test router may throw — non-fatal.
        }
      }
    }
    if (recorder.status === 'error') {
      const fromHandoff = handoffBubbleIdRef.current;
      const id = fromHandoff ?? activeIdRef.current;
      if (!id) return;
      if (fromHandoff) {
        handoffBubbleIdRef.current = null;
      } else {
        activeIdRef.current = null;
      }
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
      if (pendingBeginRef.current) {
        pendingBeginRef.current = false;
        void Promise.resolve().then(() => beginCapture());
      }
    }
    if (recorder.status === 'idle' && activeIdRef.current) {
      const id = activeIdRef.current;
      activeIdRef.current = null;
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.status]);

  // ── Keyboard shortcut: Space hold-to-talk + Escape discard ──
  // Lifted from CaptureDock so the shortcut works on every route, not just
  // /chat. Same behavior, same guards (ignored when focus is in INPUT/TEXTAREA).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName ?? '';
      const isInField = tag === 'INPUT' || tag === 'TEXTAREA';
      if (isInField) return;

      if (e.code === 'Space' && e.type === 'keydown' && !e.repeat) {
        if (
          recorder.status === 'idle' ||
          recorder.status === 'ready' ||
          recorder.status === 'error' ||
          recorder.status === 'encoding'
        ) {
          e.preventDefault();
          void (async () => {
            await beginCapture();
            recorderRef.current.lock();
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
          recorderRef.current.stop();
        }
      }
      if (e.code === 'Escape' && e.type === 'keydown') {
        if (
          recorder.status === 'recording' ||
          recorder.status === 'locked' ||
          recorder.status === 'lock_armed' ||
          recorder.status === 'cancel_armed'
        ) {
          recorderRef.current.discard();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [recorder.status, beginCapture]);

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

  const retryBubble = useCallback(
    async (id: string) => {
      const msg = messages.find((m) => m.id === id);
      if (!msg) return;
      if (msg.intent === 'ask' && msg.transcript) {
        patch(id, { status: 'answering', error: null });
        await runAskPipeline(id, msg.transcript);
        return;
      }
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
    },
    [messages, patch, commitMutation, runCapturePipeline, runAskPipeline],
  );

  const submitText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const intent = classifyIntent(trimmed);
      const id = uid();
      if (intent === 'ask') {
        setMessages((prev) => [
          ...prev,
          {
            id,
            status: 'answering',
            audioBlob: null,
            transcript: trimmed,
            duration: 0,
            transcribeMs: 0,
            commitMs: null,
            graphResult: null,
            error: null,
            createdAt: new Date(),
            transcribingStartedAt: null,
            fromPaste: false,
            intent: 'ask',
            ask: null,
          },
        ]);
        await runAskPipeline(id, trimmed);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id,
          status: 'linking',
          audioBlob: null,
          transcript: trimmed,
          duration: 0,
          transcribeMs: 0,
          commitMs: null,
          graphResult: null,
          error: null,
          createdAt: new Date(),
          transcribingStartedAt: null,
          fromPaste: false,
          intent: 'memo',
        },
      ]);
      const c0 = performance.now();
      try {
        const result = await commitMutation.mutateAsync({ transcript: trimmed });
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
    [commitMutation, patch, runAskPipeline],
  );

  const saveAskAsMemo = useCallback(
    async (id: string) => {
      const msg = messages.find((m) => m.id === id);
      if (!msg?.transcript) return;
      patch(id, { status: 'linking', intent: 'memo', error: null, ask: null });
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
    },
    [messages, patch, commitMutation],
  );

  const discardBubble = useCallback((id: string) => {
    const controller = pipelineControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      pipelineControllersRef.current.delete(id);
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const softDelete = useCallback(
    (id: string) => {
      const msg = messages.find((m) => m.id === id);
      const interactionId = interactionIdFor(msg);
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
      if (interactionId) {
        const genAtDelete = deleteGenerationRef.current.get(interactionId) ?? 0;
        void deleteMutation
          .mutateAsync({ id: interactionId })
          .then(() => {
            if ((deleteGenerationRef.current.get(interactionId) ?? 0) !== genAtDelete) {
              void restoreMutation.mutateAsync({ id: interactionId });
            }
          })
          .catch(() => {
            const timer = undoTimersRef.current.get(id);
            if (timer) {
              clearTimeout(timer);
              undoTimersRef.current.delete(id);
            }
            patch(id, { status: 'committed' });
            setUndoQueue((q) => q.filter((u) => u.id !== id));
          });
      }
    },
    [messages, interactionIdFor, patch, deleteMutation],
  );

  const undoDelete = useCallback(
    (id: string) => {
      const msg = messages.find((m) => m.id === id);
      const interactionId = interactionIdFor(msg);
      const t = undoTimersRef.current.get(id);
      if (t) {
        clearTimeout(t);
        undoTimersRef.current.delete(id);
      }
      patch(id, { status: 'committed' });
      setUndoQueue((q) => q.filter((u) => u.id !== id));
      if (interactionId) {
        deleteGenerationRef.current.set(
          interactionId,
          (deleteGenerationRef.current.get(interactionId) ?? 0) + 1,
        );
        void restoreMutation.mutateAsync({ id: interactionId }).catch(() => {
          patch(id, { status: 'deleted' });
          setUndoQueue((q) => [...q, { id, until: Date.now() + UNDO_WINDOW_MS }]);
        });
      }
    },
    [messages, interactionIdFor, patch, restoreMutation],
  );

  // Idempotent seed. Merge-prepends server-prefetched committed memos so any
  // bubble the user *already created* in this session (e.g. recorded on /home
  // and we just routed to /chat) survives the mount. Guarded by a ref so
  // remounts of /chat (route navigation) don't re-seed.
  const seedThreadOnce = useCallback((initial: ChatInitialItem[]) => {
    if (seededRef.current) return;
    seededRef.current = true;
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const seeded = seedMessages(initial).filter((m) => !ids.has(m.id));
      return [...seeded, ...prev];
    });
  }, []);

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.status !== 'deleted'),
    [messages],
  );

  const value = useMemo<CaptureContextValue>(
    () => ({
      recorder,
      messages,
      visibleMessages,
      undoQueue,
      pasteOpenForId,
      pasteDraft,
      setPasteDraft,
      beginCapture,
      retryBubble,
      discardBubble,
      softDelete,
      undoDelete,
      openPaste,
      closePaste,
      submitPaste,
      submitText,
      saveAskAsMemo,
      seedThreadOnce,
    }),
    [
      recorder,
      messages,
      visibleMessages,
      undoQueue,
      pasteOpenForId,
      pasteDraft,
      beginCapture,
      retryBubble,
      discardBubble,
      softDelete,
      undoDelete,
      openPaste,
      closePaste,
      submitPaste,
      submitText,
      saveAskAsMemo,
      seedThreadOnce,
    ],
  );

  return <CaptureContext.Provider value={value}>{children}</CaptureContext.Provider>;
}
