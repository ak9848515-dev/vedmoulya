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

  const response = await getAuthApp().fetch(request);
  return withCorsHeaders(response, request);
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as OPTIONS,
};
