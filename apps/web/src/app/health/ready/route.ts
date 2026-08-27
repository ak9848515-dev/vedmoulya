// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — /health/ready HTTP Endpoint
// SPRINT-090A — Readiness Contract
//
// Readiness probe. Returns 200 ONLY when the application can safely serve
// normal authenticated requests. Returns 503 during startup until all
// required infrastructure is ready.
//
// Readiness dependency graph (SPRINT-090A Phase 3):
//
//   Process alive
//       ↓
//   Gateway initialized (getServices() — wires production repos)
//       ↓
//   Database reachable (databaseManager.health() — SELECT 1 bounded timeout)
//       ↓
//   READY
//
// Required for READY:
//   - Process alive (we're responding)
//   - Gateway initialized (getServices() called)
//   - Database reachable (or in-memory stores in dev/test)
//
// Optional / degraded (NOT required for READY):
//   - Redis (rate limiter degrades to in-memory)
//   - AI providers (MockProvider fallback in dev)
//   - Persistence hydration (mirrors start empty, catch up on writes)
//   - Engine table DDL (runs on first tRPC request via deferred DDL pattern)
//   - Scheduler cadence driver (starts after hydration)
//
// Contract:
//   GET /health/ready → 200 { status: "ready", uptime, checks }
//   GET /health/ready → 503 { status: "not_ready", uptime, checks, error? }
//
// Security:
//   - No credentials, tokens, API keys, or connection strings
//   - Safe metadata only (latency, status, uptime)
//   - No authentication required (this IS the readiness gate)
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { databaseManager } from '@vedmoulya/core';

const startupTime = Date.now();

/** Maximum time to wait for database probe (ms). */
const DB_PROBE_TIMEOUT_MS = 5_000;

/** Whether the gateway has been initialized at least once. */
let gatewayInitialized = false;

/**
 * Ensure the gateway is initialized (idempotent — first call wires repos,
 * subsequent calls are no-ops).
 */
async function ensureGateway(): Promise<void> {
  if (gatewayInitialized) return;
  try {
    const { getServices } = await import('@vedmoulya/api');
    getServices();
    gatewayInitialized = true;
  } catch {
    // Gateway construction failure — readiness will reflect this via the
    // database health probe below.
  }
}

export async function GET(): Promise<NextResponse> {
  await ensureGateway();

  // ── 1. Gateway ───────────────────────────────────────────────────────
  const gateway = { status: gatewayInitialized ? 'initialized' : 'not_initialized' };

  // ── 2. Database ──────────────────────────────────────────────────────
  // SPRINT-090B — String() widening: next-env.d.ts narrows NODE_ENV to
  // 'development' | 'production' | 'test', so a literal === 'staging'
  // comparison is flagged as no-overlap during `next build` type-check.
  const nodeEnv = process.env.NODE_ENV as string;
  const isStrict = nodeEnv === 'production' || nodeEnv === 'staging';
  let dbStatus = 'not_configured';
  let dbLatencyMs: number | undefined;
  let dbError: string | undefined;
  try {
    const dbHealth = await databaseManager.health({ timeoutMs: DB_PROBE_TIMEOUT_MS });
    dbStatus = dbHealth.ok ? 'healthy' : 'unhealthy';
    dbLatencyMs = dbHealth.latencyMs;
    dbError = dbHealth.error;
  } catch (error) {
    dbStatus = 'unhealthy';
    dbError = error instanceof Error ? error.message : String(error);
  }

  // ── Verdict ──────────────────────────────────────────────────────────
  // READY requires: gateway initialized + database healthy.
  // In dev/test, database failure is NOT blocking — the app falls back to
  // in-memory stores (documented convention). In production/staging,
  // database failure IS blocking — the app cannot serve authenticated
  // requests without persistence.
  // In production/staging, DB must be healthy. In dev/test, the app
  // gracefully degrades to in-memory stores — DB failure is not blocking.
  const dbReady = isStrict ? dbStatus === 'healthy' : true;
  const ready = gatewayInitialized && dbReady;

  const result = {
    status: ready ? 'ready' : 'not_ready',
    uptime: Date.now() - startupTime,
    checks: {
      gateway,
      database: { status: dbStatus, latencyMs: dbLatencyMs, error: dbError },
    },
  };

  return NextResponse.json(result, { status: ready ? 200 : 503 });
}
