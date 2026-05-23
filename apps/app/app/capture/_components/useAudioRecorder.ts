'use client';

/**
 * useAudioRecorder — MediaRecorder + push-to-talk state machine.
 *
 * v0.1.1 "Hosted Capture" — Task H3 (UI rebuild).
 *
 * Replaces the deleted `useSpeechRecognition` hook (locked decision #2).
 * Audio captured here is uploaded to /api/capture/transcribe; transcript
 * comes back, the consumer feeds it into the tRPC capture.commit mutation.
 *
 * State diagram (per docs/superpowers/plans/2026-05-23-v0.1.1-hosted-capture.md §17):
 *   idle → arming → recording → encoding → ready
 *   recording → locked (slide-up commit)
 *   recording → idle (discard)
 *   * → error (mic denied or recorder throws)
 *
 * Honors `prefers-reduced-motion`: when set, the level array is static
 * so consumers can still render the meter without animation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderStatus =
  | 'idle'
  | 'arming'
  | 'recording'
  | 'cancel_armed'
  | 'lock_armed'
  | 'locked'
  | 'encoding'
  | 'ready'
  | 'error';

export interface UseAudioRecorder {
  status: RecorderStatus;
  /** Recording duration in ms — updates ~10x/s while recording. */
  duration: number;
  /** 22-bar normalized level meter (each value 0–1). RAF-driven, paused when hidden. */
  level: number[];
  audioBlob: Blob | null;
  error: { code: string; message: string } | null;
  start: () => Promise<void>;
  /** In-bounds release — finalizes recording, transitions through encoding to ready. */
  stop: () => void;
  /** Slide-left release OR explicit × — drops the audio, returns to idle. */
  discard: () => void;
  /** Slide-up release — keep recording without sustained press. */
  lock: () => void;
  /** Visual hint only — armed state, not committed yet. */
  setCancelArmed: (armed: boolean) => void;
  setLockArmed: (armed: boolean) => void;
  reset: () => void;
  supported: boolean;
}

const BARS = 22;
const STATIC_LEVEL = Array<number>(BARS).fill(0.5);
const FLAT_LEVEL = Array<number>(BARS).fill(0);
const HARD_CAP_MS = 90_000; // locked decision #13 — 90s hard auto-stop

function isMediaRecorderSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function useAudioRecorder(): UseAudioRecorder {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [duration, setDuration] = useState(0);
  const [level, setLevel] = useState<number[]>(FLAT_LEVEL);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const supportedRef = useRef<boolean>(isMediaRecorderSupported());
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const reducedMotionRef = useRef<boolean>(prefersReducedMotion());
  const discardedRef = useRef<boolean>(false);
  const hardCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set true when discard()/reset() is called mid-arming; checked after getUserMedia resolves. */
  const armingAbortedRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (hardCapTimerRef.current) {
      clearTimeout(hardCapTimerRef.current);
      hardCapTimerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
  }

  function startLevelMeter(stream: MediaStream) {
    if (reducedMotionRef.current) {
      setLevel(STATIC_LEVEL);
      return;
    }
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      // Throttle setLevel to ~20fps (50ms). RAF fires at ~60Hz but a 22-bar
      // meter doesn't read smoother above 20fps, and parent re-renders at
      // 60Hz tank mid-range Android during recording.
      const EMIT_INTERVAL_MS = 50;
      let lastEmit = 0;
      const tick = () => {
        if (!analyserRef.current) return;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        const now =
          typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();
        if (now - lastEmit < EMIT_INTERVAL_MS) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        lastEmit = now;
        analyserRef.current.getByteFrequencyData(data);
        const next: number[] = new Array(BARS);
        const stride = data.length / BARS;
        for (let i = 0; i < BARS; i++) {
          const s = Math.floor(i * stride);
          const e = Math.floor((i + 1) * stride);
          let sum = 0;
          for (let j = s; j < e; j++) sum += data[j] ?? 0;
          const avg = sum / Math.max(1, e - s);
          next[i] = Math.min(1, avg / 220);
        }
        setLevel(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // analyser is decorative; failure shouldn't break recording
      setLevel(STATIC_LEVEL);
    }
  }

  const start = useCallback(async (): Promise<void> => {
    if (!supportedRef.current) {
      setError({ code: 'unsupported', message: 'your browser does not support audio recording.' });
      setStatus('error');
      return;
    }
    if (status !== 'idle' && status !== 'ready' && status !== 'error') return;

    setError(null);
    setAudioBlob(null);
    chunksRef.current = [];
    discardedRef.current = false;
    armingAbortedRef.current = false;
    setDuration(0);
    setStatus('arming');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const code =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'NotAllowedError'
          : 'mic_unavailable';
      const message =
        code === 'NotAllowedError'
          ? 'your browser is holding the mic. unlock it, or type the memo.'
          : 'mic unavailable. plug one in or type the memo.';
      setError({ code, message });
      setStatus('error');
      return;
    }
    // discard()/reset() may have fired while getUserMedia was in flight.
    // If so, kill the freshly-granted stream before it goes hot.
    if (armingAbortedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      armingAbortedRef.current = false;
      setStatus('idle');
      return;
    }
    streamRef.current = stream;

    let recorder: MediaRecorder;
    try {
      const mimeType = pickMimeType();
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (err) {
      const code = err instanceof Error ? err.name : 'recorder_unavailable';
      setError({ code, message: 'recorder failed to start.' });
      setStatus('error');
      cleanup();
      return;
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    recorder.onerror = () => {
      setError({ code: 'recorder_error', message: 'recorder crashed mid-take.' });
      setStatus('error');
      cleanup();
    };
    recorder.onstop = () => {
      if (discardedRef.current) {
        setAudioBlob(null);
        setStatus('idle');
        setLevel(FLAT_LEVEL);
        cleanup();
        return;
      }
      const type = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      setAudioBlob(blob);
      setStatus('ready');
      setLevel(FLAT_LEVEL);
      cleanup();
    };

    startedAtRef.current = performance.now();
    try {
      recorder.start(250);
    } catch (err) {
      const code = err instanceof Error ? err.name : 'recorder_unavailable';
      setError({ code, message: 'recorder failed to start.' });
      setStatus('error');
      cleanup();
      return;
    }

    setStatus('recording');
    startLevelMeter(stream);

    tickRef.current = setInterval(() => {
      setDuration(Math.round(performance.now() - startedAtRef.current));
    }, 100);

    // hard cap (locked decision #13)
    hardCapTimerRef.current = setTimeout(() => {
      stopInternal('encoding');
    }, HARD_CAP_MS);
  }, [status]);

  function stopInternal(toStatus: 'encoding' | 'idle') {
    const recorder = recorderRef.current;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (hardCapTimerRef.current) {
      clearTimeout(hardCapTimerRef.current);
      hardCapTimerRef.current = null;
    }
    if (toStatus === 'idle') {
      discardedRef.current = true;
    }
    setStatus(toStatus);
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        cleanup();
        setStatus('idle');
      }
    } else {
      // nothing to stop; force cleanup
      if (toStatus === 'idle') {
        setAudioBlob(null);
        setLevel(FLAT_LEVEL);
        cleanup();
        setStatus('idle');
      }
    }
  }

  const stop = useCallback(() => {
    if (
      status !== 'recording' &&
      status !== 'lock_armed' &&
      status !== 'cancel_armed' &&
      status !== 'locked'
    )
      return;
    stopInternal('encoding');
  }, [status]);

  const discard = useCallback(() => {
    // If discard runs mid-arming, signal the in-flight getUserMedia handler
    // to drop the stream when it resolves.
    armingAbortedRef.current = true;
    stopInternal('idle');
  }, []);

  const lock = useCallback(() => {
    if (status !== 'recording' && status !== 'lock_armed') return;
    setStatus('locked');
  }, [status]);

  const setCancelArmed = useCallback(
    (armed: boolean) => {
      setStatus((s) => {
        if (armed && s === 'recording') return 'cancel_armed';
        if (!armed && s === 'cancel_armed') return 'recording';
        return s;
      });
    },
    [],
  );

  const setLockArmed = useCallback(
    (armed: boolean) => {
      setStatus((s) => {
        if (armed && s === 'recording') return 'lock_armed';
        if (!armed && s === 'lock_armed') return 'recording';
        return s;
      });
    },
    [],
  );

  const reset = useCallback(() => {
    // Same race as discard(): reset may fire mid-arming.
    armingAbortedRef.current = true;
    cleanup();
    chunksRef.current = [];
    discardedRef.current = false;
    setStatus('idle');
    setDuration(0);
    setLevel(FLAT_LEVEL);
    setAudioBlob(null);
    setError(null);
  }, []);

  return {
    status,
    duration,
    level,
    audioBlob,
    error,
    start,
    stop,
    discard,
    lock,
    setCancelArmed,
    setLockArmed,
    reset,
    supported: supportedRef.current,
  };
}
