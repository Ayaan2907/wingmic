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
