// wingmic service worker — static shell + assets only.
//
// Contract: /api/** (batch ASR transcription, tRPC) is NEVER intercepted —
// capture traffic must always hit the network so recordings never read stale.
// Static assets are hashed by Next (immutable) and are safe to cache-first;
// navigations fall back to the cached root shell only when offline.
//
// The cache name is rotated per deploy: the prebuild/predev copy step
// substitutes __BUILD_ID__ with the current git SHA. Each deploy installs
// into a fresh cache and the activate purge deletes the old one wholesale —
// non-hashed assets (manifest, icons) refresh every deploy instead of going
// stale, and old hashed chunks can't accumulate as entries.
const CACHE = 'wingmic-static-v1-__BUILD_ID__';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return; // mutations: never intercepted

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // cross-origin: never intercepted
  if (url.pathname.startsWith('/api/')) return; // ASR + tRPC: always network
  if (url.pathname.startsWith('/_next/webpack-hmr')) return; // dev HMR (registration is prod-only anyway)

  if (request.mode === 'navigate') {
    // /bay deep links (share links, ?q= opens): never the cached root shell —
    // a stale home chrome behind a map link is worse than the browser's own
    // offline page. Leave these navigations to the browser entirely.
    if (url.pathname.startsWith('/bay')) return;

    // network-first: live response wins, cached shell covers offline
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match('/')
          .then((shell) => shell || Response.error()),
      ),
    );
    return;
  }

  if (!isStaticAsset(url.pathname)) return; // everything else: default browser behavior

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') || // hashed Next output — immutable
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-touch-icon') ||
    pathname.startsWith('/og-image') ||
    pathname === '/manifest.webmanifest'
  );
}
