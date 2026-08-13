// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Shared Startup Probes (EPIC-018/019)
//
// ONE canonical probe surface for the startup CLIs (scripts/preflight.ts and
// scripts/doctor.ts). Every startup command resolves the mode, loads the
// environment, and evaluates the fail-fast config through THIS module — the
// CLI bindings stay thin and the environment strategy is never duplicated.
//
// SECURITY: probes only ever READ environment values; they never print them.
// Messages printed by these helpers contain key NAMES only (redacted via
// redactSecretValues for belt-and-braces).
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { getConfig, loadEnvFilesSafe } from '@vedmoulya/core';
import type { PreflightMode } from '@vedmoulya/core';

export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export const KNOWN_MODES: readonly PreflightMode[] = [
  'development',
  'test',
  'staging',
  'production',
];

/**
 * Resolve the runtime mode from `--mode <value>`, then NODE_ENV, then the
 * development default. Same resolution for every startup CLI.
 */
export function resolveMode(argv: readonly string[]): PreflightMode {
  const modeIndex = argv.indexOf('--mode');
  if (modeIndex >= 0 && argv[modeIndex + 1]) {
    const candidate = argv[modeIndex + 1] as PreflightMode;
    if ((KNOWN_MODES as readonly string[]).includes(candidate)) return candidate;
    console.error(`ERROR: unknown mode "${candidate}" (expected ${KNOWN_MODES.join(' | ')})`);
    process.exit(2);
  }
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv && (KNOWN_MODES as readonly string[]).includes(nodeEnv))
    return nodeEnv as PreflightMode;
  return 'development';
}

/**
 * --skip-docker: lets the preflight continue when the Docker daemon is down —
 * Docker/database/redis REACHABILITY checks degrade to warnings (startup
 * continues in a degraded state). Hard configuration checks (missing/loopback
 * store URLs, missing build, missing AI keys) are NEVER softened.
 * scripts/startup.sh passes this automatically when `docker info` fails.
 */
export function skipDocker(argv: readonly string[]): boolean {
  return argv.includes('--skip-docker');
}

/**
 * --allow-missing-build (kept for external callers): treats the production-
 * build check as satisfied so environment/config/infrastructure can be
 * validated before an explicit build. scripts/startup.sh no longer uses it —
 * startup now REQUIRES the build (no implicit build; the check blocks with
 * the exact `npm run build -w apps/web` action when missing).
 */
export function allowMissingBuild(argv: readonly string[]): boolean {
  return argv.includes('--allow-missing-build');
}

/**
 * One authoritative environment-file strategy (shared by every startup CLI):
 *   • development/test: root .env.local first, then apps/web/.env.local
 *     (the existing gitignored dev-secrets location) as a fallback.
 *   • production/staging: root .env.local only — production secrets come
 *     from the platform environment, never from the web dev file.
 * Uses the repository's built-in loader (process.loadEnvFile, no dotenv) and
 * NEVER prints values. Missing files are skipped, parse errors warn.
 */
export function loadEnvironment(mode: PreflightMode): void {
  const envFiles =
    mode === 'production' || mode === 'staging'
      ? [join(REPO_ROOT, '.env.local')]
      : [join(REPO_ROOT, '.env.local'), join(REPO_ROOT, 'apps', 'web', '.env.local')];
  const result = loadEnvFilesSafe(envFiles);
  for (const error of result.errors) {
    console.warn(`WARNING: ${error}`);
  }
}

// ── Probes (memoized — each probe runs at most once per invocation) ─────────

let dockerProbe: boolean | undefined;
export function dockerAvailable(): boolean {
  if (dockerProbe === undefined) {
    const probe = spawnSync('docker', ['info'], { stdio: 'ignore', timeout: 10_000 });
    dockerProbe = probe.status === 0;
  }
  return dockerProbe;
}

let buildProbe: boolean | undefined;
export function productionBuildExists(allowMissing: boolean): boolean {
  if (allowMissing) return true;
  if (buildProbe === undefined) {
    buildProbe = existsSync(join(REPO_ROOT, 'apps', 'web', '.next', 'BUILD_ID'));
  }
  return buildProbe;
}

/**
 * Direct reachability probe for a configured store: a synchronous TCP connect
 * to the URL's host:port (short 1.5s timeout) via a child Node process (a
 * child keeps the probe synchronous without blocking this process's event
 * loop). Returns true when the URL is unparseable/absent — those cases are
 * already reported by the config check.
 */
export function serviceReachable(kind: 'database' | 'redis'): boolean {
  const key = kind === 'database' ? 'IDENTITY_DATABASE_URL' : 'REDIS_URL';
  const raw = process.env[key] ?? process.env.DATABASE_URL;
  if (!raw) return true; // Not configured — handled by the config check.
  let target: { host: string; port: number };
  try {
    target = parseUrlHostPort(raw);
  } catch {
    return true; // Unparseable URL — the config check reports it.
  }
  const script =
    'const net=require("net");' +
    `const s=net.connect({host:${JSON.stringify(target.host)},port:${target.port},timeout:1500});` +
    's.on("connect",()=>process.exit(0));' +
    's.on("error",()=>process.exit(1));' +
    's.on("timeout",()=>process.exit(1));';
  const probe = spawnSync(process.execPath, ['-e', script], { stdio: 'ignore', timeout: 2_000 });
  return probe.status === 0;
}

function parseUrlHostPort(url: string): { host: string; port: number } {
  const withoutProtocol = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const withoutCredentials = withoutProtocol.replace(/^[^@]*@/, '');
  const hostPort = withoutCredentials.split('/')[0];
  const [hostPart, portPart] = hostPort.split(':');
  return {
    host: hostPart || 'localhost',
    port: portPart ? Number.parseInt(portPart, 10) : kindDefaultPort(url),
  };
}

function kindDefaultPort(url: string): number {
  return /^redis:/i.test(url) ? 6379 : 5432;
}

/** Strip any accidental key-shaped strings from a message before printing. */
export function redactSecretValues(message: string): string {
  return message.replace(
    /\b(sk-[A-Za-z0-9_-]{4,}|sk-ant-[A-Za-z0-9_-]{4,}|AIza[0-9A-Za-z_-]{10,}|ghp_[A-Za-z0-9]{20,}|[A-Za-z0-9+/]{40,}={0,2})\b/g,
    '[REDACTED]',
  );
}

/** Evaluate the fail-fast config; returns the (redacted) error message. */
export function evaluateConfig(): { ok: true } | { ok: false; error: string } {
  try {
    getConfig();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: redactSecretValues(message) };
  }
}
