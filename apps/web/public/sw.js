// VedMoulya — Service Worker
// BLD-016B — Life OS Web Application
//
// HARDENED (2026-08-09): the previous build cached every request — including
// cross-origin fetches, non-2xx responses, and private `/api/*` endpoints
// (authenticated user data). This revision:
//   • only intercepts same-origin GET requests,
//   • never caches `/api/*` (private/auth data, telemetry),
//   • never caches Next.js RSC / client-navigation traffic (G8.4 — a stale
//     RSC payload replayed against a newer client bundle corrupts the hydrated
//     tree: React error #41 "Target container is not valid"),
//   • only stores successful (ok) responses,
//   • network-first for navigations (fresh app shell, offline fallback),
//   • cache-first for same-origin static assets.

// G8.4 — bumped from 'vedmoulya-v2' so browsers purge any RSC payloads the
// previous revision cached (activate() deletes every cache except the current
// STATIC_CACHE).
const CACHE_VERSION = 'vedmoulya-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PRECACHE_URLS = ['/', '/manifest.json'];

// G8.4 — true when a request carries Next.js App Router RSC / client-navigation
// indicators. Such responses are per-navigation RSC payloads (`text/x-component`
// of the current router state), NOT immutable static assets: replaying a cached
// one against a newer client bundle desynchronises the hydrated tree and React
// throws #41 ("Target container is not valid"). They must always hit the network.
function isRscRequest(request, url) {
  // 1. The `_rsc` query parameter Next appends to client-navigation fetches.
  if (url.searchParams.has('_rsc')) return true;
  // 2. Explicit RSC router headers (client navigations + server actions).
  if (request.headers.get('rsc') !== null) return true;
  if (request.headers.get('next-router-state-tree') !== null) return true;
  // 3. The RSC payload media type preferred by the App Router client.
  const accept = request.headers.get('accept');
  if (accept !== null && accept.includes('text/x-component')) return true;
  return false;
}

// A request is eligible for caching only when it is a same-origin GET for a
// same-origin URL that is not an API/private endpoint and is not Next.js RSC
// navigation traffic (which must never be replayed from a stale cache).
function isCacheableGet(request) {
  if (request.method !== 'GET') return false;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }

  if (url.origin !== self.location.origin) return false;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  // Never intercept authenticated endpoints or telemetry.
  if (url.pathname.startsWith('/api/')) return false;
  // Never serve Next.js RSC / client-navigation payloads from the cache.
  if (isRscRequest(request, url)) return false;
  return true;
}

function putInCache(request, response) {
  return caches.open(STATIC_CACHE).then((cache) => cache.put(request, response));
}

// Install: precache the application shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {
        // Precache failure is non-fatal — the app still runs from the network.
      }),
  );
});

// Activate: purge caches from earlier versions (incl. the old all-cache v1).
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key)))),
  );
});

// Fetch: network-first navigations, cache-first static assets.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!isCacheableGet(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            // Best-effort cache refresh (never blocks the response).
            void putInCache(request, response.clone());
          }
          return response;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          // Offline: fall back to the precached app shell.
          const shell = await caches.match('/');
          return shell ?? new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          void putInCache(request, response.clone());
        }
        return response;
      } catch {
        return Response.error();
      }
    })(),
  );
});
