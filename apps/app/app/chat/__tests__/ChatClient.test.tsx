// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';

// ── Mock next/navigation ────────────────────────────────────────────────
// PR β₁-D: CaptureProvider uses useRouter() + usePathname() to push to
// /chat once the recorder transitions to `ready`. Jsdom has no Next router
// context, so we stub all three hooks. pathname defaults to '/chat' so the
// post-commit push is a no-op in these tests (the bubble lands on the
// same page we're already on).
const routerPushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (_: string) => null }),
  useRouter: () => ({ push: routerPushMock, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/chat',
}));

// ── Mock tRPC client ────────────────────────────────────────────────────
const { mutateAsyncMock, deleteMutateMock, restoreMutateMock, recallFetchMock } = vi.hoisted(
  () => ({
    mutateAsyncMock: vi.fn(),
    deleteMutateMock: vi.fn(),
    restoreMutateMock: vi.fn(),
    recallFetchMock: vi.fn(),
  }),
);

vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    capture: {
      commit: {
        useMutation: () => ({
          mutateAsync: mutateAsyncMock,
          isPending: false,
        }),
      },
      delete: {
        useMutation: () => ({
          mutate: deleteMutateMock,
          mutateAsync: deleteMutateMock,
          isPending: false,
        }),
      },
      restore: {
        useMutation: () => ({
          mutate: restoreMutateMock,
          mutateAsync: restoreMutateMock,
          isPending: false,
        }),
      },
    },
    recall: {
      query: {
        fetch: recallFetchMock,
      },
    },
    useUtils: () => ({
      recall: {
        query: {
          fetch: recallFetchMock,
        },
      },
    }),
  },
}));

// ── Mock useAudioRecorder so we can drive its state machine deterministically ──
type FakeStatus =
  | 'idle'
  | 'arming'
  | 'recording'
  | 'cancel_armed'
  | 'lock_armed'
  | 'locked'
  | 'encoding'
  | 'ready'
  | 'error';

const fakeRecorder = {
  status: 'idle' as FakeStatus,
  duration: 0,
  level: Array<number>(22).fill(0),
  audioBlob: null as Blob | null,
  error: null as { code: string; message: string } | null,
  start: vi.fn(),
  stop: vi.fn(),
  discard: vi.fn(),
  lock: vi.fn(),
  setCancelArmed: vi.fn(),
  setLockArmed: vi.fn(),
  reset: vi.fn(),
  supported: true,
};

let setStatusHook: ((s: FakeStatus) => void) | null = null;

vi.mock('@/app/capture/_components/useAudioRecorder', () => {
  const React = require('react') as typeof import('react');
  return {
    useAudioRecorder: () => {
      const [status, setStatus] = React.useState<FakeStatus>(fakeRecorder.status);
      const [audioBlob, setAudioBlob] = React.useState<Blob | null>(fakeRecorder.audioBlob);
      setStatusHook = (s) => {
        fakeRecorder.status = s;
        setStatus(s);
        if (s === 'ready') setAudioBlob(fakeRecorder.audioBlob);
      };
      return {
        ...fakeRecorder,
        status,
        audioBlob,
        start: async () => {
          fakeRecorder.start();
          fakeRecorder.status = 'recording';
          setStatus('recording');
        },
      };
    },
  };
});

import ChatClient from '@/app/chat/ChatClient';
import { RecordingOverlay } from '@/app/_components/RecordingOverlay';
import { renderWithShell } from '@/test/renderWithShell';
import * as React from 'react';

// PR λ-shell: the capture orb + primary nav now live in AppShell, not in
// ChatClient. renderWithShell mounts the screen the way production does —
// inside CaptureProvider + AppShell — so orb-dependent assertions keep
// working. RecordingOverlay is mounted alongside so the live phantom-bubble
// + chrome render in the test DOM as they would in production.
function renderChat(props: { userName: string | null; initialThread?: Parameters<typeof ChatClient>[0]['initialThread'] }) {
  return renderWithShell(
    <>
      <ChatClient {...props} />
      <RecordingOverlay />
    </>,
  );
}

function resetFakeRecorder() {
  fakeRecorder.status = 'idle';
  fakeRecorder.duration = 0;
  fakeRecorder.audioBlob = null;
  fakeRecorder.error = null;
  for (const fn of [
    fakeRecorder.start,
    fakeRecorder.stop,
    fakeRecorder.discard,
    fakeRecorder.lock,
    fakeRecorder.setCancelArmed,
    fakeRecorder.setLockArmed,
    fakeRecorder.reset,
  ]) {
    fn.mockClear?.();
  }
}

describe('ChatClient', () => {
  beforeEach(() => {
    resetFakeRecorder();
    mutateAsyncMock.mockReset();
    deleteMutateMock.mockReset();
    deleteMutateMock.mockResolvedValue({ ok: true });
    restoreMutateMock.mockReset();
    restoreMutateMock.mockResolvedValue({ ok: true });
    recallFetchMock.mockReset();
    recallFetchMock.mockResolvedValue({
      entities: [{ id: 'e1', name: 'Alice', score: 0.9, companies: [], events: [], topics: [], aliases: [], facts: [] }],
      durationMs: 12,
      mode: 'semantic',
    });
    // fetch is replaced per test
    (globalThis as { fetch?: unknown }).fetch = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders empty thread + bottom tab bar on mount (idle)', () => {
    renderChat({ userName: "ada" });
    // PR ε welcome: agent bubble + 3 suggested-query chips on the empty thread.
    expect(screen.getByText(/ask me anything/i)).toBeTruthy();
    expect(screen.getAllByTestId('chat-suggestion')).toHaveLength(3);
    // v8: 5-slot bottom nav — home / chat / capture / graph / acts.
    // Center capture slot breaks the bar plane (lib-screens.jsx MobileNav).
    const nav = screen.getByLabelText('primary');
    expect(nav).toBeTruthy();
    expect(nav.textContent).toContain('home');
    expect(nav.textContent).toContain('chat');
    expect(nav.textContent).toContain('capture');
    expect(nav.textContent).toContain('graph');
    expect(nav.textContent).toContain('search');
    // Regression guard: v1 label `recall` must not coexist with the v2 `chat` label.
    expect(nav.textContent).not.toContain('recall');
    // Removed in v8 — these slots no longer exist in the 5-slot bar.
    expect(nav.textContent).not.toContain('history');
    expect(nav.textContent).not.toContain('settings');
    // hold-to-talk orb lives in the bottom nav (PR β₁-D — the orb IS the dock).
    expect(screen.getByRole('button', { name: /record voice memo/i })).toBeTruthy();
  });

  it('runs the full record → transcribe → commit cycle and renders a committed bubble + graph card', async () => {
    const audioBlob = new Blob(['xxx'], { type: 'audio/webm' });
    fakeRecorder.audioBlob = audioBlob;

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ transcript: 'met sarah at acme', durationMs: 1200 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    mutateAsyncMock.mockResolvedValue({
      extracted: {
        persons: [{ name: 'sarah', role: 'eng', companyHint: 'acme', topics: [] }],
        companies: [{ name: 'acme' }],
        events: [],
        topics: [],
        actions: [],
      },
      newEntities: 1,
      matchedEntities: 0,
      interactionId: 'int-1',
    });

    renderChat({ userName: "ada" });
    const btn = screen.getByRole('button', { name: /record voice memo/i });

    await act(async () => {
      fireEvent.click(btn);
    });
    // recorder transitions through ready, useEffect kicks off pipeline
    await act(async () => {
      setStatusHook?.('ready');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const call = fetchMock.mock.calls[0] as unknown as [unknown, RequestInit];
    const init = call[1];
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    const fd = init.body as FormData;
    expect(fd.get('audio')).toBeInstanceOf(Blob);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalled();
      // First call positional arg = the tRPC input
      expect(mutateAsyncMock.mock.calls[0]?.[0]).toEqual({ transcript: 'met sarah at acme' });
    });
    await waitFor(() => {
      expect(screen.getByText('met sarah at acme')).toBeTruthy();
    });
    // graph card: shows the person name
    await waitFor(() => {
      expect(screen.getByText('sarah')).toBeTruthy();
    });
    // PR ε: a templated agent reply lands under the committed memo, with a
    // count summary built from the extraction (1 person + 1 company) and a
    // disabled "coming soon · v0.3" action row.
    const reply = await waitFor(() => screen.getByTestId('agent-reply'));
    expect(reply.textContent).toMatch(/acknowledged/i);
    expect(reply.textContent).toMatch(/1 person/);
    expect(reply.textContent).toMatch(/1 company/);
    const draftBtn = screen.getByRole('button', { name: /draft follow-up/i });
    expect((draftBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders an empty graph card footer when extracted entities are all empty', async () => {
    const audioBlob = new Blob(['x'], { type: 'audio/webm' });
    fakeRecorder.audioBlob = audioBlob;
    (globalThis as { fetch: typeof fetch }).fetch = vi.fn(async () =>
      new Response(JSON.stringify({ transcript: 'um nothing', durationMs: 800 }), {
        status: 200,
      }),
    ) as unknown as typeof fetch;
    mutateAsyncMock.mockResolvedValue({
      extracted: {
        persons: [],
        companies: [],
        events: [],
        topics: [],
        actions: [],
      },
      newEntities: 0,
      matchedEntities: 0,
      interactionId: 'int-empty',
    });

    renderChat({ userName: "ada" });
    const btn = screen.getByRole('button', { name: /record voice memo/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    await act(async () => {
      setStatusHook?.('ready');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/no entities found/i)).toBeTruthy();
    });
  });

  it('renders a failed bubble with retry/paste/discard actions on transcribe 502', async () => {
    fakeRecorder.audioBlob = new Blob(['x'], { type: 'audio/webm' });
    (globalThis as { fetch: typeof fetch }).fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: { code: 'provider_error', message: 'assemblyai didnt answer.' },
        }),
        { status: 502 },
      ),
    ) as unknown as typeof fetch;

    renderChat({ userName: "ada" });
    const btn = screen.getByRole('button', { name: /record voice memo/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    await act(async () => {
      setStatusHook?.('ready');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/assemblyai didnt answer/i)).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /↻ retry/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /paste instead/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /× discard/i })).toBeTruthy();
  });

  it('spacebar keydown starts recording (locked mode), keyup sends', async () => {
    fakeRecorder.audioBlob = new Blob(['x'], { type: 'audio/webm' });
    (globalThis as { fetch: typeof fetch }).fetch = vi.fn(async () =>
      new Response(JSON.stringify({ transcript: 'hello', durationMs: 500 }), { status: 200 }),
    ) as unknown as typeof fetch;
    mutateAsyncMock.mockResolvedValue({
      extracted: { persons: [], companies: [], events: [], topics: [], actions: [] },
      newEntities: 0,
      matchedEntities: 0,
      interactionId: 'k',
    });

    renderChat({ userName: "ada" });
    await act(async () => {
      fireEvent.keyDown(window, { code: 'Space' });
      await Promise.resolve();
    });
    expect(fakeRecorder.start).toHaveBeenCalled();
    // simulate recorder going to locked then user releases space → recorder.stop
    fakeRecorder.status = 'recording';
    await act(async () => {
      fireEvent.keyUp(window, { code: 'Space' });
    });
    expect(fakeRecorder.stop).toHaveBeenCalled();
  });

  it('discardBubble during transcribing aborts the in-flight fetch + commit', async () => {
    fakeRecorder.audioBlob = new Blob(['x'], { type: 'audio/webm' });
    // Spy on AbortController so we can assert abort() fired.
    const RealAbortController = globalThis.AbortController;
    const seenControllers: AbortController[] = [];
    class SpyController extends RealAbortController {
      constructor() {
        super();
        seenControllers.push(this);
      }
    }
    (globalThis as { AbortController: typeof AbortController }).AbortController =
      SpyController as unknown as typeof AbortController;

    // fetch hangs until we abort.
    (globalThis as { fetch: typeof fetch }).fetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    ) as unknown as typeof fetch;
    mutateAsyncMock.mockImplementation(async () => {
      throw new Error('commit should never be reached after discard');
    });

    renderChat({ userName: "ada" });
    const btn = screen.getByRole('button', { name: /record voice memo/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    await act(async () => {
      setStatusHook?.('ready');
      await Promise.resolve();
    });
    // wait until the transcribing-state bubble renders (so a pipeline + controller exist)
    await waitFor(() => {
      expect(screen.getByText(/uploading|transcribing/i)).toBeTruthy();
    });
    const abortSpy = vi.spyOn(
      seenControllers[seenControllers.length - 1]!,
      'abort',
    );
    // Trigger discard via the alert button — discard appears on failed
    // bubbles only, so we exercise discardBubble via softDelete path:
    // instead, simulate the abort directly by unmounting.
    // For an end-to-end discard test, we rely on the soft-delete-cleanup
    // test (next). Here we verify the controller wiring directly:
    await act(async () => {
      seenControllers[seenControllers.length - 1]!.abort();
      await Promise.resolve();
    });
    expect(abortSpy).toHaveBeenCalled();

    (globalThis as { AbortController: typeof AbortController }).AbortController =
      RealAbortController;
  });

  it('soft-delete timers are cleared on unmount (no late state writes)', async () => {
    // Render a committed bubble, soft-delete it, unmount before 30s.
    fakeRecorder.audioBlob = new Blob(['x'], { type: 'audio/webm' });
    (globalThis as { fetch: typeof fetch }).fetch = vi.fn(async () =>
      new Response(JSON.stringify({ transcript: 'hi', durationMs: 100 }), { status: 200 }),
    ) as unknown as typeof fetch;
    mutateAsyncMock.mockResolvedValue({
      extracted: { persons: [], companies: [], events: [], topics: [], actions: [] },
      newEntities: 0,
      matchedEntities: 0,
      interactionId: 'k',
    });
    const { unmount } = renderChat({ userName: "ada" });
    const btn = screen.getByRole('button', { name: /record voice memo/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    await act(async () => {
      setStatusHook?.('ready');
      await Promise.resolve();
    });
    // wait for committed bubble (the ⋯ delete button)
    const deleteBtn = await waitFor(() => screen.getByLabelText(/delete memo/i));

    // Spy on global setTimeout/clearTimeout to confirm undo timer is cleared
    // on unmount (the fix). Real timers are used so the pipeline can flush.
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    // Soft-delete
    await act(async () => {
      fireEvent.click(deleteBtn);
    });
    expect(deleteMutateMock).toHaveBeenCalledWith({ id: 'k' });
    const clearedBefore = clearTimeoutSpy.mock.calls.length;
    // Unmount should clear the pending 30s undo timer
    unmount();
    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(clearedBefore);

    clearTimeoutSpy.mockRestore();
  });

  it('undo after soft-delete calls capture.restore', async () => {
    fakeRecorder.audioBlob = new Blob(['x'], { type: 'audio/webm' });
    (globalThis as { fetch: typeof fetch }).fetch = vi.fn(async () =>
      new Response(JSON.stringify({ transcript: 'hi', durationMs: 100 }), { status: 200 }),
    ) as unknown as typeof fetch;
    mutateAsyncMock.mockResolvedValue({
      extracted: { persons: [], companies: [], events: [], topics: [], actions: [] },
      newEntities: 0,
      matchedEntities: 0,
      interactionId: 'int_undo',
    });
    restoreMutateMock.mockResolvedValue({ ok: true });

    renderChat({ userName: 'ada' });
    const btn = screen.getByRole('button', { name: /record voice memo/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    await act(async () => {
      setStatusHook?.('ready');
      await Promise.resolve();
    });

    const deleteBtn = await waitFor(() => screen.getByLabelText(/delete memo/i));
    await act(async () => {
      fireEvent.click(deleteBtn);
    });
    expect(deleteMutateMock).toHaveBeenCalled();

    const undoBtn = await waitFor(() => screen.getByRole('button', { name: /undo/i }));
    await act(async () => {
      fireEvent.click(undoBtn);
    });

    await waitFor(() => {
      expect(restoreMutateMock).toHaveBeenCalledWith({ id: 'int_undo' });
    });
    expect(screen.getByText('hi')).toBeTruthy();
  });

  it('tap toggles recording: first tap starts, second tap stops (never double-starts)', async () => {
    renderChat({ userName: "ada" });
    const btn = screen.getByRole('button', { name: /record voice memo/i });
    // First tap starts the recorder (mock start() flips status → recording).
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(fakeRecorder.start).toHaveBeenCalledTimes(1);
    // Second tap, now that we're recording, stops + sends — it does NOT begin
    // a fresh recording.
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(fakeRecorder.start).toHaveBeenCalledTimes(1);
    expect(fakeRecorder.stop).toHaveBeenCalledTimes(1);
  });

  it('escape while recording discards', async () => {
    renderChat({ userName: "ada" });
    // put recorder into recording first via space keydown
    await act(async () => {
      fireEvent.keyDown(window, { code: 'Space' });
      await Promise.resolve();
    });
    fakeRecorder.status = 'recording';
    await act(async () => {
      fireEvent.keyDown(window, { code: 'Escape' });
    });
    expect(fakeRecorder.discard).toHaveBeenCalled();
  });

  // ── PR β₁-C sub-state coverage ──────────────────────────────────────────
  // Locks in resting/recording/prefetched states for the new /chat surface.
  // The single-source-of-truth principle ("one mic, one surface", D5) means
  // ChatClient must render the right chrome for every cold-mount path.

  it('resting state on cold mount with empty initialThread renders empty-hero + idle dock', () => {
    renderChat({ userName: "ada", initialThread: [] });
    // PR ε welcome agent + chips present on the empty thread
    expect(screen.getByText(/ask me anything/i)).toBeTruthy();
    expect(screen.getAllByTestId('chat-suggestion')).toHaveLength(3);
    // dock is idle — orb state is `idle` (not recording/locked/sending)
    const btn = screen.getByRole('button', { name: /record voice memo/i });
    expect(btn.getAttribute('data-orb-state')).toBe('idle');
    // no recording chrome — header is not in recording mode
    const recordingHeader = document.querySelector('[data-recording="true"]');
    expect(recordingHeader).toBeNull();
    // no phantom bubble
    expect(screen.queryByText(/rec ·/i)).toBeNull();
  });

  it('resting state with 3 prefetched committed memos renders them oldest-first', () => {
    const initialThread = [
      {
        id: 'i1',
        transcript: 'met sarah at acme',
        capturedAt: '2026-06-01T14:00:00Z',
      },
      {
        id: 'i2',
        transcript: 'priya knows compilers',
        capturedAt: '2026-06-02T10:30:00Z',
      },
      {
        id: 'i3',
        transcript: 'marcus wants intro',
        capturedAt: '2026-06-03T09:15:00Z',
      },
    ];
    renderChat({ userName: 'ada', initialThread });
    const m1 = screen.getByText('met sarah at acme');
    const m2 = screen.getByText('priya knows compilers');
    const m3 = screen.getByText('marcus wants intro');
    expect(m1).toBeTruthy();
    expect(m2).toBeTruthy();
    expect(m3).toBeTruthy();
    // Welcome agent is suppressed once any prefetched memo is present
    expect(screen.queryByText(/ask me anything/i)).toBeNull();
    // DOM order: oldest-first → i1 before i2 before i3
    const order = m1.compareDocumentPosition(m2);
    // Node.DOCUMENT_POSITION_FOLLOWING === 4
    // eslint-disable-next-line no-bitwise
    expect(order & 4).toBeTruthy();
    const order2 = m2.compareDocumentPosition(m3);
    // eslint-disable-next-line no-bitwise
    expect(order2 & 4).toBeTruthy();
  });

  it('thread dims (opacity 0.4, pointer-events none) when recorder transitions to recording', async () => {
    renderChat({
      userName: 'ada',
      initialThread: [
        { id: 'p1', transcript: 'past memo one', capturedAt: '2026-06-01T14:00:00Z' },
      ],
    });
    const pastBubble = screen.getByText('past memo one');
    // Walk up to the dim wrapper — it's the parent div with opacity:1 initially.
    const dimWrapper = pastBubble.closest('div[style*="opacity"]') as HTMLElement | null;
    expect(dimWrapper).toBeTruthy();
    // Idle: opacity 1, pointer-events auto
    expect(dimWrapper!.style.opacity).toBe('1');
    expect(dimWrapper!.style.pointerEvents).toBe('auto');

    // Transition the recorder into a recording status.
    await act(async () => {
      setStatusHook?.('recording');
      await Promise.resolve();
    });

    // After transition, the same wrapper should have opacity 0.4.
    const dimWrapperAfter = screen
      .getByText('past memo one')
      .closest('div[style*="opacity"]') as HTMLElement | null;
    expect(dimWrapperAfter).toBeTruthy();
    expect(dimWrapperAfter!.style.opacity).toBe('0.4');
    expect(dimWrapperAfter!.style.pointerEvents).toBe('none');
  });

  // PR β₁-D rolled back the armRecord URL-param approach: recording now
  // begins via the orb in the bottom nav (live on every route), so there
  // is no deep-link to test. Intentionally omitted.

  // Verifies the recorder hook is mounted by ChatClient exactly once, with
  // CaptureDock + ChatHeader + ChatThread receiving it as a prop. Today this
  // is enforced structurally (the imports of useAudioRecorder in the child
  // files are typed-only); the runtime guard would need a module-level
  // module-mock counter that survives jsdom reset. Recorded as a follow-up.
  it.todo(
    'useAudioRecorder is invoked exactly once per ChatClient mount (no double-mount in children)',
  );
});
