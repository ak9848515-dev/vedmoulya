// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — /health/check HTTP Endpoint
// SPRINT-090B — Diagnostics Contract
//
// Diagnostics probe returning pool utilization, database status, and gateway
// state. Designed for runtime observation during E2E runs (SPRINT-090B Phase 6).
//
// Returns:
//   pool:    { inFlight, peak, total, max, min, latencyMs }
//   database: { status, latencyMs }
//   gateway:  { status }
//
// Security:
//   - No credentials, tokens, API keys, or connection strings
//   - Safe metadata only (latency, status, counts)
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { databaseManager } from '@vedmoulya/core';

const startupTime = Date.now();

/** Maximum time to wait for database probe (ms). */
const DB_PROBE_TIMEOUT_MS = 5_000;

export async function GET(): Promise<NextResponse> {
  // ── Gateway ──────────────────────────────────────────────────────────
  // The Next.js server is responding to this request, so the gateway layer
  // is initialized. (Detailed gateway state is available via the tRPC
  // health.check procedure for authenticated callers.)
  const gateway = {
    status: 'initialized',
  };

  // ── Database ─────────────────────────────────────────────────────────
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

  // ── Pool utilization stats (safe metadata only — URLs already redacted) ──
  let poolStats:
    { inFlight: number; peak: number; total: number; pools: number; poolMax: number } | undefined;
  try {
    const snapshot = databaseManager.getStats();
    const aggregate = snapshot.pools.reduce(
      (acc, pool) => {
        acc.inFlight += pool.inFlightQueries;
        acc.peak = Math.max(acc.peak, pool.peakInFlightQueries);
        acc.total += pool.totalQueries;
        acc.poolMax = pool.poolMax;
        return acc;
      },
      { inFlight: 0, peak: 0, total: 0, poolMax: 0 },
    );
    poolStats = {
      inFlight: aggregate.inFlight,
      peak: aggregate.peak,
      total: aggregate.total,
      pools: snapshot.poolCount,
      poolMax: aggregate.poolMax,
    };
  } catch {
    // Pool stats unavailable — non-fatal
  }

  return NextResponse.json({
    status: dbStatus === 'healthy' ? 'ok' : 'degraded',
    uptime: Date.now() - startupTime,
    checks: {
      gateway,
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        error: dbError,
      },
      pool: poolStats,
    },
  });
}
