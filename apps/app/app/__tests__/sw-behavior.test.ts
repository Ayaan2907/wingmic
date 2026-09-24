import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// Evaluates the real service worker source (packages/brand/src/sw.js, copied
// to public/ by prebuild) inside a sandboxed `self`, then exercises the
// fetch handler against the caching contract:
//   /api/**  → never intercepted (transcription + tRPC must hit the network)
//   static   → cache-first
//   navigate → network-first, cached root shell as offline fallback
//
// Turbo executes package tests with apps/app as the cwd, so the shared
// package lives two levels up.
const SW_PATH = resolve(process.cwd(), '../../packages/brand/src/sw.js');

interface FakeResponseInit {
  status?: number;
  url?: string;
}

class FakeResponse {
  status: number;
  ok: boolean;
  type = 'basic';
  body: string;
  url: string;

  constructor(body = 'ok', init: FakeResponseInit = {}) {
    this.status = init.status ?? 200;
    this.ok = this.status >= 200 && this.status < 300;
    this.body = body;
    this.url = init.url ?? '';
  }

  clone(): FakeResponse {
    return new FakeResponse(this.body, { status: this.status, url: this.url });
  }

  static error(): FakeResponse {
    return new FakeResponse('network error', { status: 504 });
  }
}

interface InstallLikeEvent {
  waitUntil: (promise: Promise<unknown>) => void;
}

interface FetchLikeEvent {
  request: { method: string; url: string; mode: string };
  respondWith: (promise: Promise<unknown>) => void;
}

type WorkerListener = (event: InstallLikeEvent | FetchLikeEvent) => void;

function makeFetchEvent(url: string, { method = 'GET', mode = 'same-origin' } = {}) {
  return {
    request: { method, url, mode },
    respondWith: vi.fn(),
  };
}

/** Loads sw.js with mocked self/caches/fetch and returns the listeners. */
function loadServiceWorker({ cached }: { cached?: Record<string, FakeResponse> } = {}) {
  const source = readFileSync(SW_PATH, 'utf8');
  const listeners: Record<string, WorkerListener> = {};

  const self = {
    location: { origin: 'https://app.wingmic.xyz' },
    addEventListener: (type: string, fn: WorkerListener) => {
      listeners[type] = fn;
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };

  const cacheStore = new Map<string, FakeResponse>(); // url → response
  const put = vi.fn(async (request: string | { url: string }, response: FakeResponse) => {
    cacheStore.set(typeof request === 'string' ? request : request.url, response);
  });
  const addAll = vi.fn(async (urls: string[]) => {
    for (const url of urls) cacheStore.set(url, new FakeResponse(`shell:${url}`));
  });
  const match = vi.fn(async (request: string | { url: string }) => {
    const key = typeof request === 'string' ? request : request.url;
    return cacheStore.get(key);
  });

  const caches = {
    open: vi.fn(async () => ({ addAll, put })),
    match,
    keys: vi.fn(async () => ['wingmic-static-v1-abc1234', 'old-cache']),
    delete: vi.fn(async () => true),
  };
  for (const [url, response] of Object.entries(cached ?? {})) {
    cacheStore.set(url, response);
  }

  const fetch = vi.fn(async () => new FakeResponse('network default'));
  const context = { self, caches, fetch, Response: FakeResponse, URL };
  vm.createContext(context);
  vm.runInContext(source, context);

  return {
    listeners,
    caches,
    put,
    addAll,
    fetch,
    self,
  };
}

/** Resolves the response a fetch handler passed to respondWith. */
async function respondedTo(event: { respondWith: ReturnType<typeof vi.fn> }) {
  return (await event.respondWith.mock.calls[0][0]) as FakeResponse;
}

/** Runs an install/activate handler to completion — the worker hands its
 * async chain to event.waitUntil instead of returning it, so the stub must
 * capture the promises and the test must await them. */
async function runLifecycleHandler(handler: WorkerListener): Promise<void> {
  const promises: Promise<unknown>[] = [];
  handler({ waitUntil: (p) => promises.push(p) });
  await Promise.all(promises);
}

describe('service worker caching contract (AC1)', () => {
  it('caches the app shell on install and skips waiting', async () => {
    const { listeners, caches, addAll, self } = loadServiceWorker();

    await runLifecycleHandler(listeners.install);

    // The prebuild copy step substitutes the deploy hash; the raw source the
    // sandbox evaluates still carries the __BUILD_ID__ placeholder, so match
    // the versioned prefix rather than one exact name.
    expect(caches.open).toHaveBeenCalledWith(
      expect.stringMatching(/^wingmic-static-v1-/),
    );
    expect(addAll).toHaveBeenCalledWith([
      '/',
      '/manifest.webmanifest',
      '/icon-192.png',
      '/icon-512.png',
    ]);
    expect(self.skipWaiting).toHaveBeenCalled();
  });

  it('purges stale caches on activate and claims clients', async () => {
    const { listeners, caches, self } = loadServiceWorker();

    await runLifecycleHandler(listeners.activate);

    expect(caches.delete).toHaveBeenCalledWith('old-cache');
    expect(self.clients.claim).toHaveBeenCalled();
  });

  it('never intercepts /api/ traffic — even GET', () => {
    const { listeners } = loadServiceWorker();
    const event = makeFetchEvent('https://app.wingmic.xyz/api/capture/transcribe');

    (listeners.fetch as WorkerListener)(event);

    expect(event.respondWith).not.toHaveBeenCalled();
  });

  it('never intercepts tRPC or mutation requests', () => {
    const { listeners } = loadServiceWorker();

    const trpc = makeFetchEvent('https://app.wingmic.xyz/api/trpc/capture.commit?batch=1');
    (listeners.fetch as WorkerListener)(trpc);

    const post = makeFetchEvent('https://app.wingmic.xyz/api/trpc/events.bind', {
      method: 'POST',
    });
    (listeners.fetch as WorkerListener)(post);

    expect(trpc.respondWith).not.toHaveBeenCalled();
    expect(post.respondWith).not.toHaveBeenCalled();
  });

  it('serves hashed Next static assets cache-first', async () => {
    const chunk = new FakeResponse('chunk-bytes');
    const { listeners, fetch } = loadServiceWorker({
      cached: { 'https://app.wingmic.xyz/_next/static/chunk-abc.js': chunk },
    });
    const event = makeFetchEvent('https://app.wingmic.xyz/_next/static/chunk-abc.js');

    (listeners.fetch as WorkerListener)(event);

    expect(await respondedTo(event)).toBe(chunk);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('caches brand icons and the manifest cache-first', async () => {
    const icon = new FakeResponse('icon-bytes');
    const { listeners, fetch } = loadServiceWorker({
      cached: { 'https://app.wingmic.xyz/icon-192.png': icon },
    });
    const event = makeFetchEvent('https://app.wingmic.xyz/icon-192.png');

    (listeners.fetch as WorkerListener)(event);

    expect(await respondedTo(event)).toBe(icon);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches and caches static assets on first encounter', async () => {
    const network = new FakeResponse('fresh bytes');
    const { listeners, fetch, put } = loadServiceWorker();
    fetch.mockResolvedValue(network);
    const event = makeFetchEvent('https://app.wingmic.xyz/_next/static/chunk-abc.js');

    (listeners.fetch as WorkerListener)(event);

    expect(await respondedTo(event)).toBe(network);
    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://app.wingmic.xyz/_next/static/chunk-abc.js' }),
      network,
    );
  });

  it('leaves dynamic page paths to the network when online', () => {
    const { listeners } = loadServiceWorker();
    const event = makeFetchEvent('https://app.wingmic.xyz/acts');

    (listeners.fetch as WorkerListener)(event);

    expect(event.respondWith).not.toHaveBeenCalled();
  });

  it('falls back to the cached shell for navigations when offline', async () => {
    const shell = new FakeResponse('<html>shell</html>');
    const { listeners, fetch } = loadServiceWorker({ cached: { '/': shell } });
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const event = makeFetchEvent('https://app.wingmic.xyz/chat', { mode: 'navigate' });

    (listeners.fetch as WorkerListener)(event);

    expect(await respondedTo(event)).toBe(shell);
  });

  it('responds with a network error for offline navigations with no cached shell', async () => {
    const { listeners, fetch } = loadServiceWorker();
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const event = makeFetchEvent('https://app.wingmic.xyz/chat', { mode: 'navigate' });

    (listeners.fetch as WorkerListener)(event);

    expect((await respondedTo(event)).status).toBe(504); // FakeResponse.error()
  });
});
