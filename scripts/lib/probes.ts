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
import type { PreflightMode, StoreReachability } from '@vedmoulya/core';

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
 *   • production/staging: no local env files — production secrets must come
 *     from the platform environment, never from developer workstations.
 * Uses the repository's built-in loader (process.loadEnvFile, no dotenv) and
 * NEVER prints values. Missing files are skipped, parse errors warn.
 */
export function loadEnvironment(mode: PreflightMode): void {
  const envFiles =
    mode === 'production' || mode === 'staging'
      ? []
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
 * Direct reachability probe for a configured store.
 *
 *   • database — a REAL authenticated `SELECT 1` via postgres.js in a child Node
 *     process (keeps the probe synchronous without blocking this process's event
 *     loop). This distinguishes a REACHABLE server that REJECTED the credentials
 *     (PostgreSQL 28P01 / 28000 / 3D000 → `authFailed`) from one that is simply
 *     down — so a wrong/rotated cloud password is caught at STARTUP, not at the
 *     first user login. Only a redacted driver code is ever surfaced.
 *   • redis — a plain TCP connect (no auth handshake needed for reachability).
 *
 * Returns `true` (reachable) when the URL is absent/unparseable — those cases
 * are already reported by the config check. Never prints credentials.
 */
export function serviceReachable(kind: 'database' | 'redis'): boolean | StoreReachability {
  const key = kind === 'database' ? 'IDENTITY_DATABASE_URL' : 'REDIS_URL';
  const raw = process.env[key] ?? process.env.DATABASE_URL;
  if (!raw) return true; // Not configured — handled by the config check.
  let target: { host: string; port: number };
  try {
    target = parseUrlHostPort(raw);
  } catch {
    return true; // Unparseable URL — the config check reports it.
  }

  if (kind === 'database') {
    return probeDatabaseAuth(raw);
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

/**
 * Real, bounded, credential-safe database probe. Runs `SELECT 1` in a child
 * process so the check is synchronous; the child prints ONE safe token:
 *   REACHABLE | AUTH_FAILED | UNREACHABLE
 * PostgreSQL auth/authorization failures map to AUTH_FAILED (credential
 * problem); any other driver error maps to UNREACHABLE (host/port/SSL/network).
 * The child NEVER prints the URL, password or driver message.
 */
function probeDatabaseAuth(url: string): StoreReachability {
  const script =
    'const postgres=require(' +
    JSON.stringify(requireResolvePostgres()) +
    ');' +
    'const url=process.env.__VM_PROBE_URL;' +
    'const sql=postgres(url,{max:1,connect_timeout:20,idle_timeout:2});' +
    'sql.unsafe("SELECT 1 AS ok").then(()=>{console.log("REACHABLE");return sql.end({timeout:2});})' +
    '.then(()=>process.exit(0))' +
    '.catch((e)=>{const c=String((e&&e.code)||"");' +
    'if(c==="28P01"||c==="28000"||c==="3D000"){console.log("AUTH_FAILED:"+c);}' +
    'else{console.log("UNREACHABLE");}' +
    'sql.end({timeout:2}).catch(()=>undefined).then(()=>process.exit(0));});';
  // Bounded, but generous enough for a serverless/managed store to wake up:
  // Neon (and equivalents) suspend idle compute, and a COLD endpoint can take
  // >8s to accept a connection. A too-short timeout turns "the endpoint was
  // asleep" into a false UNREACHABLE — which would block a production start.
  // A rejected credential (28P01) still fails fast, in well under a second.
  const probe = spawnSync(process.execPath, ['-e', script], {
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 30_000,
    env: { ...process.env, __VM_PROBE_URL: url },
  });
  const out = (probe.stdout?.toString() ?? '').trim();
  if (out.startsWith('AUTH_FAILED')) {
    const code = out.split(':')[1] ?? 'auth_failed';
    return { reachable: true, authFailed: true, error: `driver code ${code}` };
  }
  if (out === 'REACHABLE') return { reachable: true };
  // Child failed before printing (crash/timeout) — treat as unreachable.
  return { reachable: false };
}

/** Resolve postgres.js from the repo root so the child probe can require it. */
function requireResolvePostgres(): string {
  try {
    return join(REPO_ROOT, 'node_modules', 'postgres');
  } catch {
    return 'postgres';
  }
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
