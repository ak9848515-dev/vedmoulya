// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Canonical CORS Origin Policy
//
// ONE authoritative resolver for every HTTP surface that can answer a
// cross-origin request: the Next.js route handlers (apps/web/src/lib/cors.ts)
// and the Hono service routers (identity, decision, execution, knowledge,
// memory). Before this module each surface re-implemented the parse with the
// same permissive '*' fallback — including in production, where an unset
// API_CORS_ORIGIN silently reflected ANY request Origin.
//
// POLICY
//   • development / test — API_CORS_ORIGIN when set, otherwise the permissive
//     '*' default. Local development, the certification harnesses and the
//     Capacitor WebView keep working exactly as before.
//   • production / staging — a cross-origin allow-list must be explicit:
//       – unset, empty, or '*'-only  → DENY (no Access-Control-Allow-Origin is
//         ever emitted). The same-origin web app is unaffected; native WebView
//         and other cross-origin clients require the operator to set the value.
//       – loopback entries (localhost / 127.0.0.1 / 0.0.0.0 / ::1) → dropped
//         from the allow-list, and the fail-fast config loader rejects them at
//         startup (assertProductionCorsOrigin).
//
// SECURITY: origins are not secrets, but no message in this module ever echoes
// a configured value's credentials (origins carry none) and no message is built
// from request input.
// ─────────────────────────────────────────────────────────────────────────────

import { EnvironmentError } from '../env/index.js';

/** The single environment variable that owns the cross-origin allow-list. */
export const CORS_ORIGIN_ENV = 'API_CORS_ORIGIN';

/**
 * Read the configured allow-list value.
 *
 * The value is read through its LITERAL property name rather than a dynamic
 * lookup: the key is a compile-time constant, so there is no computed property
 * access to reason about and no lint suppression is needed. `CORS_ORIGIN_ENV`
 * remains the single source of truth for operator-facing messages and
 * diagnostics; `cors.test.ts` pins the two together so they cannot drift (a
 * drift would silently ignore the configured allow-list).
 */
function readConfiguredOrigin(env: NodeJS.ProcessEnv): string | undefined {
  return env.API_CORS_ORIGIN;
}

/** Modes where the permissive development default is never acceptable. */
const STRICT_MODES: ReadonlySet<string> = new Set(['production', 'staging']);

/** Loopback / wildcard-host origins are development-only by definition. */
const LOOPBACK_ORIGIN_PATTERN =
  /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1)(?::\d+)?$/i;

/** Parse a comma-separated allow-list, dropping empty entries. */
export function parseCorsOrigins(raw: string | undefined): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** True for an origin that only a developer machine can serve from. */
export function isLoopbackOrigin(origin: string): boolean {
  return LOOPBACK_ORIGIN_PATTERN.test(origin.trim().replace(/\/+$/, ''));
}

/**
 * Resolve the runtime CORS allow-list for the current environment.
 *
 * Returns the list of origins the caller may echo. An EMPTY list means "deny
 * every cross-origin request" — callers must treat it as such (never replace it
 * with a wildcard).
 */
export function resolveCorsOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const parsed = parseCorsOrigins(readConfiguredOrigin(env));
  const strict = STRICT_MODES.has(env.NODE_ENV ?? 'development');

  if (!strict) {
    // Development/test: explicit wildcard anywhere keeps the permissive
    // behaviour; otherwise the parsed list; an empty list falls back to '*'.
    if (parsed.includes('*')) return ['*'];
    return parsed.length > 0 ? parsed : ['*'];
  }

  // Production/staging: wildcards are not a policy and loopback origins cannot
  // serve real traffic — both are removed. What remains (possibly nothing) is
  // the allow-list.
  return parsed.filter((origin) => origin !== '*' && !isLoopbackOrigin(origin));
}

/**
 * Fail-fast guard used by the configuration loader: in production/staging a
 * loopback allow-list entry is a misconfiguration that must be fixed before the
 * service starts (it can never match a real client and hides the absence of a
 * production origin). An UNSET value is not an error here — the runtime denies
 * cross-origin requests and the startup preflight reports it as DEGRADED, so a
 * same-origin-only deployment can still boot.
 */
export function assertProductionCorsOrigin(env: NodeJS.ProcessEnv = process.env): void {
  const strict = STRICT_MODES.has(env.NODE_ENV ?? 'development');
  if (!strict) return;

  const loopback = parseCorsOrigins(readConfiguredOrigin(env)).filter(isLoopbackOrigin);
  if (loopback.length === 0) return;

  const error = new EnvironmentError([CORS_ORIGIN_ENV]);
  error.message =
    `${CORS_ORIGIN_ENV} contains a loopback origin in ` +
    `NODE_ENV=${String(env.NODE_ENV)} (fail-fast). ` +
    `Set the public origin of the deployed web app (for example ` +
    `https://app.vedmoulya.com); add the native WebView origins separately ` +
    `when the Capacitor client must call the API cross-origin.`;
  throw error;
}

/** Safe, value-free summary for startup diagnostics. */
export function describeCorsPolicy(env: NodeJS.ProcessEnv = process.env): string {
  // Only the RESOLVED policy is described — an origin list would be topology
  // and a '*' would be a wildcard; neither belongs in a startup summary.
  const resolved = resolveCorsOrigins(env);
  if (resolved.length === 0) return 'deny cross-origin (no allow-list configured)';
  if (resolved.length === 1 && resolved[0] === '*') return 'permissive (*)';
  return `allow-list (${resolved.length} origin${resolved.length === 1 ? '' : 's'})`;
}

/** Re-exported so callers can reason about the raw configuration cost-free. */
export function hasConfiguredCorsOrigin(env: NodeJS.ProcessEnv = process.env): boolean {
  return parseCorsOrigins(readConfiguredOrigin(env)).some((origin) => origin !== '*');
}
