// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Next.js Server Environment Boundary (PROD-02B)
//
// ONE deterministic, production-safe strategy for loading the repository's
// authoritative environment into the Next.js server process.
//
// WHY THIS EXISTS
//   The web application runs the API gateway INSIDE the Next.js server process
//   (src/app/api/trpc/[trpc]/route.ts imports @vedmoulya/api). Next.js only
//   reads env files from its OWN project directory (`apps/web`), so a plain
//   `npm run dev` / `next start` never saw the repository's authoritative root
//   `.env.local` — where the backend/services configuration lives (AI keys,
//   database URLs, Redis, SMTP, feature flags). The gateway then resolved
//   `config.database.url` through the localhost fallback and every
//   provider/AI/database read disagreed with `npm run preflight`.
//
// THE CONTRACT (identical to scripts/lib/probes.ts → loadEnvironment)
//   development / test  → root `.env.local`, then `apps/web/.env.local`
//   production / staging → NO local file; the platform environment is the
//                          ONLY source (Vercel / GitHub Actions secrets)
//
// PRECEDENCE (never violates operator intent)
//   `process.loadEnvFile` only ever ADDS a key that is not already present, so:
//     shell/platform variables  >  apps/web/.env.local  >  root .env.local
//   Next.js loads `apps/web/.env.local` itself, which is exactly why the
//   app-local file still wins as a documented override surface.
//
// SECURITY
//   - Every key stays SERVER-SIDE. Nothing here reads or writes a
//     NEXT_PUBLIC_* name, so no secret can be inlined into a browser bundle.
//   - No value is ever logged; errors only name the FILE that failed.
//   - Loading is idempotent and memoized — safe to call from config, route
//     handlers and instrumentation alike.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/* eslint-disable security/detect-non-literal-fs-filename -- false positive:
   every path is built from a repo-root anchor plus fixed literals
   ('packages/core/package.json', '.env.local', 'apps/web/…') and nothing here
   is derived from request input. Same convention as apps/web/next.config.ts. */
/* eslint-disable security/detect-object-injection -- Heuristic rule: the only
   computed access here is `env[name]`, where `name` comes from the fixed
   SERVER_ENV_KEYS inventory (never request or file content), and the result is
   only tested for a non-empty string. Same convention as packages/core config. */

/** Resolved outcome of one load pass. Never contains secret values. */
export interface ServerEnvLoadResult {
  /** Files that were actually read, in load order (root first). */
  loaded: string[];
  /** Human-readable, secret-free messages for files that could not be read. */
  errors: string[];
  /** True when a local file pass ran (development/test only). */
  localFilesApplied: boolean;
}

/**
 * Resolve the monorepo root for an environment-file load.
 *
 * The PRIMARY and authoritative signal is the module's OWN location: the web
 * app lives at `<repoRoot>/apps/web`, so walking up from this file finds the
 * correct root even when the process cwd — or an ancestor directory — happens
 * to contain an unrelated `packages/core/package.json` (e.g. a temp fixture
 * created under a path that is itself inside another VedMoulya checkout).
 *
 * When `start` is supplied the walk begins there and stops at the first
 * directory that has BOTH `packages/core` and `apps/web` markers, so a partial
 * checkout (root `.env.local` only, no workspace) is never mistaken for a root.
 * The walk is bounded to 6 levels.
 */
export function findRepoRoot(start?: string): string {
  if (start === undefined) return moduleRepoRoot();

  let dir = resolve(start);
  for (let depth = 0; depth < 6; depth += 1) {
    if (hasRepoMarkers(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // No coherent root above the start directory — callers then load nothing
  // rather than reading an unrelated checkout's configuration.
  return resolve(start);
}

/** True when `dir` holds BOTH the core package and the web application. */
function hasRepoMarkers(dir: string): boolean {
  return (
    existsSync(join(dir, 'packages', 'core', 'package.json')) &&
    existsSync(join(dir, 'apps', 'web', 'package.json'))
  );
}

/**
 * Memoized repo root derived from this module's own path
 * (`<repoRoot>/apps/web/src/lib/server-env.ts` → `<repoRoot>`). Falls back to
 * the marker walk from cwd when the module is bundled to a different layout.
 */
let moduleRoot: string | null = null;
function moduleRepoRoot(): string {
  if (moduleRoot !== null) return moduleRoot;
  try {
    // apps/web/src/lib/server-env.ts  →  ../../../../ = repo root
    const candidate = resolve(
      dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
      '..',
      '..',
      '..',
      '..',
    );
    moduleRoot = hasRepoMarkers(candidate) ? candidate : walkFromCwd();
  } catch {
    moduleRoot = walkFromCwd();
  }
  return moduleRoot;
}

function walkFromCwd(): string {
  return findRepoRoot(process.cwd());
}

/**
 * Should local `.env.local` files be read for this mode?
 * Production and staging are deliberately platform-only (fail-closed): a
 * developer workstation file must never configure a deployed environment.
 */
export function shouldLoadLocalEnvFiles(nodeEnv: string | undefined): boolean {
  const mode = nodeEnv ?? 'development';
  return mode !== 'production' && mode !== 'staging';
}

/**
 * The ordered local env files for a repository root.
 * Root first, app-local second — `process.loadEnvFile` never overwrites an
 * already-set key, so the app-local file wins for the keys it defines and the
 * root file supplies everything else (the whole backend/services surface).
 */
export function localEnvFilePaths(repoRoot: string): string[] {
  return [join(repoRoot, '.env.local'), join(repoRoot, 'apps', 'web', '.env.local')];
}

let applied: ServerEnvLoadResult | null = null;

/**
 * Apply the environment strategy ONCE per process.
 *
 * Idempotent: repeated calls return the memoized result without re-reading
 * files, so `next build` workers, route handlers and instrumentation cannot
 * observe different environments within one process.
 *
 * @param options.nodeEnv  Override for NODE_ENV (testability).
 * @param options.cwd      Override for the working directory (testability).
 * @param options.loadEnvFile Injectable loader (testability) — defaults to
 *                         Node's built-in `process.loadEnvFile`.
 */
export function applyServerEnv(
  options: {
    nodeEnv?: string | undefined;
    cwd?: string | undefined;
    loadEnvFile?: ((path: string) => void) | undefined;
  } = {},
): ServerEnvLoadResult {
  if (applied !== null) return applied;

  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const errors: string[] = [];

  if (!shouldLoadLocalEnvFiles(nodeEnv)) {
    applied = { loaded: [], errors, localFilesApplied: false };
    return applied;
  }

  const loader =
    options.loadEnvFile ??
    (typeof process.loadEnvFile === 'function'
      ? (path: string): void => {
          process.loadEnvFile(path);
        }
      : undefined);

  if (loader === undefined) {
    errors.push(
      'process.loadEnvFile is unavailable in this Node runtime — local .env.local files were NOT loaded. ' +
        'Run on Node >= 20.12 (the repository requires >= 22).',
    );
    applied = { loaded: [], errors, localFilesApplied: false };
    return applied;
  }

  const repoRoot = findRepoRoot(options.cwd);
  const loaded: string[] = [];
  for (const file of localEnvFilePaths(repoRoot)) {
    if (!existsSync(file)) continue;
    try {
      loader(file);
      loaded.push(file);
    } catch (error) {
      // A malformed/absent file must never break the server — report the FILE
      // that failed (never its contents) and continue.
      errors.push(
        `Failed to load environment file ${file}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  applied = { loaded, errors, localFilesApplied: true };
  return applied;
}

/**
 * Environment key NAMES the server-side API requires, grouped by subsystem.
 * This is the DOCUMENTED contract for Vercel/production configuration and is
 * asserted by the unit tests — it is intentionally a name-only list (never a
 * value), so it is safe to surface in diagnostics.
 */
export const SERVER_ENV_KEYS = {
  /** Always required — no safe default outside the strictest dev fixtures. */
  required: ['AUTH_JWT_SECRET', 'IDENTITY_DATABASE_URL'],
  /** Required when the platform actually runs a real Postgres/Redis. */
  infrastructure: ['REDIS_URL'],
  /**
   * AI EXECUTION surface. Never an authentication prerequisite: an absent key
   * only leaves the corresponding adapter dormant. `AI_OLLAMA_BASE_URL` is a
   * URL, not a credential (the provider is registered when it is set).
   */
  aiProviders: [
    'AI_OPENAI_API_KEY',
    'AI_GOOGLE_API_KEY',
    'AI_DEEPSEEK_API_KEY',
    'AI_OLLAMA_BASE_URL',
    'AI_OLLAMA_MODEL',
    'AI_DEFAULT_PROVIDER',
    'AI_ROUTING_STRATEGY',
    'AI_ENABLE_MOCK',
    'AI_MAX_INPUT_TOKENS',
    'AI_MAX_OUTPUT_TOKENS',
    'AI_PROVIDER_TIMEOUT_MS',
    'AI_TOOL_ALLOWLIST',
    'AI_CREDENTIAL_ENCRYPTION_KEY',
  ],
  /** Google OAuth — SEPARATE from the Google AI (Gemini) Studio key. */
  oauth: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'],
  /** Feature flags that gate server-side behaviour. */
  features: ['FF_SOCIAL_LOGIN_ENABLED', 'FF_AI_ASSISTANT_ENABLED', 'FF_MARKETPLACE_ENABLED'],
  /** Optional delivery + observability configuration. */
  optional: [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
    'APP_URL',
    'EMAIL_DELIVERY_MODE',
    'OTEL_SERVICE_NAME',
    'OTEL_EXPORTER_OTLP_ENDPOINT',
  ],
} as const;

/**
 * Presence report for the server-side contract — NAMES ONLY. Used by
 * diagnostics and the unit tests; it only tests for a non-blank string, so it
 * can never leak a secret value.
 */
export function describeServerEnv(env: Record<string, string | undefined> = process.env): {
  present: string[];
  missing: string[];
} {
  const present: string[] = [];
  const missing: string[] = [];
  const groups: readonly (readonly string[])[] = [
    SERVER_ENV_KEYS.required,
    SERVER_ENV_KEYS.infrastructure,
    SERVER_ENV_KEYS.aiProviders,
    SERVER_ENV_KEYS.oauth,
    SERVER_ENV_KEYS.features,
  ];
  for (const group of groups) {
    for (const name of group) {
      const value = env[name];
      if (typeof value === 'string' && value.trim() !== '') present.push(name);
      else missing.push(name);
    }
  }
  return { present, missing };
}

/**
 * Assert that no server-side secret is reachable through a client-exposed
 * name. Next.js inlines every `NEXT_PUBLIC_*` value into the browser bundle,
 * so a secret must never appear under that prefix. Returns the offending NAMES
 * (never values) so a diagnostic can report them safely.
 */
export function findLeakedPublicSecrets(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const secretish = /(API_?KEY|SECRET|PASSWORD|TOKEN|DATABASE_URL|_URL$|JWT|CLIENT_ID)/i;
  const allowlist = new Set(['NEXT_PUBLIC_GATEWAY_URL', 'NEXT_PUBLIC_IDENTITY_URL']);
  return Object.keys(env)
    .filter((name) => name.startsWith('NEXT_PUBLIC_'))
    .filter((name) => !allowlist.has(name))
    .filter((name) => secretish.test(name));
}

/** Test seam — clears the memoized load result. */
export function resetServerEnvForTesting(): void {
  applied = null;
}
