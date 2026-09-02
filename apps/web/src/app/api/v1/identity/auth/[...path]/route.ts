// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Identity Auth REST Route Handler
// MOB-001 — Mobile Authentication
// Serves the EXISTING Identity Service auth router (createAuthRouter) in
// process at /api/v1/identity/auth/* — see lib/auth-app.ts for the app
// construction. The mobile static export build (scripts/build-mobile.mjs)
// moves src/app/api aside, so these routes never ship to the device — the app
// authenticates against the deployed server, exactly like the tRPC gateway.
// ─────────────────────────────────────────────────────────────────────────────

import { getAuthApp } from '../../../../../../lib/auth-app.js';
import { corsHeaders, isCorsPreflight, withCorsHeaders } from '../../../../../../lib/cors.js';
import type { NextRequest } from 'next/server';

// ── Request Handler ──────────────────────────────────────────────────────────

async function handle(request: NextRequest): Promise<Response> {
  // CORS preflight (the Capacitor WebView and cross-origin web clients).
  if (isCorsPreflight(request)) {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  try {
    const response = await (await getAuthApp()).fetch(request);
    return withCorsHeaders(response, request);
  } catch (error) {
    // SPRINT-098B — Return a structured error instead of a bare 500 so the
    // client can display a meaningful message and we can diagnose Vercel
    // initialization failures from the response.
    //
    // SECURITY — never expose internal error details (env var names,
    // connection strings, infrastructure config) to the browser. Log the
    // full error server-side; return a safe generic message to the client.
    console.error(
      '[auth-route] Initialization failed:',
      error instanceof Error ? error.message : String(error),
    );
    const body = JSON.stringify({
      success: false,
      error: {
        code: 'AUTH_INIT_FAILED',
        message: 'Authentication service is temporarily unavailable. Please try again later.',
      },
    });
    return withCorsHeaders(
      new Response(body, {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
      request,
    );
  }
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as OPTIONS,
};
