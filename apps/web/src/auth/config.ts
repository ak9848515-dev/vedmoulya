// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Auth Configuration
// MOB-001 — Mobile Authentication
// Reads the NEXT_PUBLIC_* env vars that locate the Identity Service and the
// tRPC gateway. These are inlined by Next.js at build time, so the same
// static bundle works for the web app and the Capacitor WebView.
//
//   NEXT_PUBLIC_IDENTITY_URL        Absolute base URL of the Identity Service
//                                   REST API. Web: leave unset (same origin,
//                                   served by the Next.js app). Mobile: must
//                                   point at the deployed server.
//   NEXT_PUBLIC_GATEWAY_URL         tRPC gateway URL (defaults to same origin
//                                   `/api/trpc`; set to the remote gateway for
//                                   the mobile static export).
//   NEXT_PUBLIC_GOOGLE_REDIRECT_URI OAuth redirect URI registered with Google
//                                   AND matching the identity service's
//                                   GOOGLE_REDIRECT_URI. Defaults to
//                                   <origin>/oauth2redirect — inside the
//                                   Capacitor WebView that origin is
//                                   https://localhost (the app's own server),
//                                   so the OAuth callback always lands back in
//                                   the app.
// ─────────────────────────────────────────────────────────────────────────────

const AUTH_BASE_PATH = '/api/v1/identity/auth';

/** Absolute base URL of the Identity Service REST API ('' = same origin). */
export function identityBaseUrl(): string {
  return process.env.NEXT_PUBLIC_IDENTITY_URL?.trim() ?? '';
}

/** Full URL for an identity auth endpoint (e.g. 'sign-in', 'refresh'). */
export function authEndpoint(path: string): string {
  const base = identityBaseUrl();
  return `${base}${AUTH_BASE_PATH}/${path}`;
}
