// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — CORS Helper
// MOB-001 — Mobile Authentication
// The Capacitor WebView serves the app from https://localhost, so every
// cross-origin call to the deployed server (gateway + identity auth REST)
// must be answered with CORS headers. Origin policy mirrors the identity
// service: API_CORS_ORIGIN (comma-separated) when set, otherwise '*' (the
// dev default that keeps local development working).
//
// Consumed exclusively by server route handlers (never imported from client
// code), so it ships only in the server bundle.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the origin we are allowed to echo back, or null when the request
 * origin is not permitted (in which case the response must not carry CORS
 * headers and the browser will block it).
 */
export function resolveCorsOrigin(request: Request): string | null {
  const configured = (process.env.API_CORS_ORIGIN ?? '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = request.headers.get('origin');

  if (configured.length === 0 || configured.includes('*')) {
    // Permissive mode is still credential-safe: echo the request's Origin
    // header instead of a literal '*' (browsers reject credentialed
    // responses carrying `Access-Control-Allow-Origin: *`).
    return origin ?? '*';
  }

  return origin && configured.includes(origin) ? origin : null;
}

/** Build CORS response headers for a request (empty when the origin is denied). */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = resolveCorsOrigin(request);
  if (!origin) return {};

  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

/** True for a cross-origin preflight (OPTIONS with CORS request headers). */
export function isCorsPreflight(request: Request): boolean {
  return (
    request.method === 'OPTIONS' &&
    request.headers.has('origin') &&
    request.headers.has('access-control-request-method')
  );
}

/** Merge CORS headers into an existing response. */
export function withCorsHeaders(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
