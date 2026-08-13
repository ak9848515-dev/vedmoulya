// VedMoulya — Service Worker
// BLD-016B — Life OS Web Application
//
// HARDENED (2026-08-09): the previous build cached every request — including
// cross-origin fetches, non-2xx responses, and private `/api/*` endpoints
// (authenticated user data). This revision:
//   • only intercepts same-origin GET requests,
//   • never caches `/api/*` (private/auth data, telemetry),
//   • only stores successful (ok) responses,
//   • network-first for navigations (fresh app shell, offline fallback),
//   • cache-first for same-origin static assets.

const CACHE_VERSION = 'vedmoulya-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PRECACHE_URLS = ['/', '/manifest.json'];

// A request is eligible for caching only when it is a same-origin GET for a
// same-origin URL that is not an API/private endpoint.
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
