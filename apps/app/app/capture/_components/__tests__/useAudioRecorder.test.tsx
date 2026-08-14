// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── jsdom shims for MediaRecorder + getUserMedia + AudioContext ────────
class FakeMediaRecorder extends EventTarget {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType: string;
  ondataavailable: ((ev: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    super();
    this.mimeType = options?.mimeType ?? 'audio/webm';
  }
  static isTypeSupported(_t: string) {
    return true;
  }
  start(_ms?: number) {
    this.state = 'recording';
    // emit a chunk immediately so the blob is non-empty
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(['chunk'], { type: this.mimeType }) });
    });
  }
  stop() {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.onstop?.();
    });
  }
  requestData() {}
}

class FakeAnalyser {
  fftSize = 64;
  frequencyBinCount = 32;
  getByteFrequencyData(arr: Uint8Array) {
    for (let i = 0; i < arr.length; i++) arr[i] = 100;
  }
}

class FakeAudioContext {
  close() {
    return Promise.resolve();
  }
  createMediaStreamSource() {
    return { connect() {} } as unknown as MediaStreamAudioSourceNode;
  }
  createAnalyser() {
    return new FakeAnalyser() as unknown as AnalyserNode;
  }
}

function installAudioShims() {
  (globalThis as unknown as { MediaRecorder: typeof FakeMediaRecorder }).MediaRecorder =
    FakeMediaRecorder;
  (window as unknown as { MediaRecorder: typeof FakeMediaRecorder }).MediaRecorder = FakeMediaRecorder;
  (window as unknown as { AudioContext: typeof FakeAudioContext }).AudioContext = FakeAudioContext;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => ({
        getTracks: () => [{ stop: vi.fn() }],
      })),
    },
  });
}

function withReducedMotion(value: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({
      matches: q.includes('reduce') ? value : false,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

import { useAudioRecorder } from '../useAudioRecorder';

describe('useAudioRecorder', () => {
  beforeEach(() => {
    installAudioShims();
    withReducedMotion(false);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts at idle and supports MediaRecorder', () => {
    const { result } = renderHook(() => useAudioRecorder());
    expect(result.current.status).toBe('idle');
    expect(result.current.supported).toBe(true);
  });

  it('transitions idle → recording → ready with audioBlob populated on stop', async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('recording');

    await act(async () => {
      // let the queued microtask deliver the data chunk
      await Promise.resolve();
      result.current.stop();
      await Promise.resolve();
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.audioBlob).toBeInstanceOf(Blob);
    expect(result.current.audioBlob!.size).toBeGreaterThan(0);
  });

  it('discard() returns to idle and drops the blob', async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('recording');
    await act(async () => {
      await Promise.resolve();
      result.current.discard();
      await Promise.resolve();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.audioBlob).toBeNull();
  });

  it('lock() moves recording → locked, recorder still active', async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      result.current.lock();
    });
    expect(result.current.status).toBe('locked');
  });

  it('lock() is a no-op when not recording (functional setStatus)', async () => {
    const { result } = renderHook(() => useAudioRecorder());
    act(() => {
      result.current.lock();
    });
    expect(result.current.status).toBe('idle');
  });

  it('stale onstop releases old stream tracks without clobbering a new session', async () => {
    // Capture each MediaRecorder so we can fire a stale onstop after restart.
    const recorders: FakeMediaRecorder[] = [];
    class TrackingMediaRecorder extends FakeMediaRecorder {
      constructor(stream: MediaStream, options?: MediaRecorderOptions) {
        super(stream, options);
        recorders.push(this);
      }
    }
    (globalThis as unknown as { MediaRecorder: typeof TrackingMediaRecorder }).MediaRecorder =
      TrackingMediaRecorder;
    (window as unknown as { MediaRecorder: typeof TrackingMediaRecorder }).MediaRecorder =
      TrackingMediaRecorder;

    const trackStop1 = vi.fn();
    const trackStop2 = vi.fn();
    let gumCalls = 0;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => {
          gumCalls += 1;
          const stop = gumCalls === 1 ? trackStop1 : trackStop2;
          return { getTracks: () => [{ stop }] };
        }),
      },
    });

    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(recorders).toHaveLength(1);

    // Begin a second take while the first is still "recording" conceptually —
    // reset bumps sessionId; then start a fresh session.
    act(() => {
      result.current.reset();
    });
    await act(async () => {
      await result.current.start();
    });
    expect(recorders).toHaveLength(2);
    expect(result.current.status).toBe('recording');

    // Fire the FIRST recorder's onstop as if it finalized late.
    await act(async () => {
      recorders[0]!.onstop?.();
      await Promise.resolve();
    });

    // Stale onstop must stop the old stream's tracks, not tear down the new take.
    expect(trackStop1).toHaveBeenCalled();
    expect(result.current.status).toBe('recording');
    expect(result.current.audioBlob).toBeNull();
  });

  it('stale ondataavailable does not mix chunks into a newer take', async () => {
    const recorders: FakeMediaRecorder[] = [];
    class TrackingMediaRecorder extends FakeMediaRecorder {
      constructor(stream: MediaStream, options?: MediaRecorderOptions) {
        super(stream, options);
        recorders.push(this);
      }
      start(_ms?: number) {
        this.state = 'recording';
        // no auto-chunk — tests push data manually
      }
    }
    (globalThis as unknown as { MediaRecorder: typeof TrackingMediaRecorder }).MediaRecorder =
      TrackingMediaRecorder;
    (window as unknown as { MediaRecorder: typeof TrackingMediaRecorder }).MediaRecorder =
      TrackingMediaRecorder;

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });

    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });

    act(() => {
      result.current.reset();
    });
    await act(async () => {
      await result.current.start();
    });

    // Stale chunk from session 1, then a real chunk from session 2.
    await act(async () => {
      recorders[0]!.ondataavailable?.({
        data: new Blob(['STALE'], { type: 'audio/webm' }),
      });
      recorders[1]!.ondataavailable?.({
        data: new Blob(['FRESH'], { type: 'audio/webm' }),
      });
      recorders[1]!.stop();
      await Promise.resolve();
    });

    expect(result.current.status).toBe('ready');
    const text = await result.current.audioBlob!.text();
    expect(text).toBe('FRESH');
    expect(text).not.toContain('STALE');
  });

  it('auto-stops at 90 000 ms hard cap', async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('recording');

    await act(async () => {
      vi.advanceTimersByTime(90_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    // hard cap calls stopInternal('encoding') → MediaRecorder.onstop → status 'ready'
    expect(['encoding', 'ready']).toContain(result.current.status);
  });

  it('returns static level array under prefers-reduced-motion', async () => {
    withReducedMotion(true);
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    // 22 bars, all === 0.5
    expect(result.current.level).toHaveLength(22);
    expect(result.current.level.every((v) => v === 0.5)).toBe(true);
  });

  it('discard during arming kills the mic stream when getUserMedia resolves late', async () => {
    // Deferred getUserMedia: we control when it resolves. The test calls
    // start(), then discard() before the promise resolves, then resolves
    // it. The track's stop() must have been invoked and recorder must
    // remain idle with no MediaRecorder constructed.
    let resolveGum: (s: MediaStream) => void = () => {};
    const trackStop = vi.fn();
    const fakeStream = {
      getTracks: () => [{ stop: trackStop }],
    } as unknown as MediaStream;
    const gumMock = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveGum = resolve;
        }),
    );
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: gumMock },
    });

    const { result } = renderHook(() => useAudioRecorder());
    // Kick off start; do NOT await — we want the arming state mid-flight.
    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.start();
    });
    // status should be arming while gum hangs
    expect(result.current.status).toBe('arming');

    // user discards mid-arming
    act(() => {
      result.current.discard();
    });

    // now resolve getUserMedia AFTER discard
    await act(async () => {
      resolveGum(fakeStream);
      await startPromise;
    });

    expect(trackStop).toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('reports mic-denied as an error state', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => {
          const err = new Error('denied');
          err.name = 'NotAllowedError';
          throw err;
        }),
      },
    });
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error?.code).toBe('NotAllowedError');
  });
});
