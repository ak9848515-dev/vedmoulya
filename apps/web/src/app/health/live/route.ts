// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — /health/live HTTP Endpoint
// SPRINT-090A — Readiness Contract
//
// Lightweight liveness probe. Returns 200 whenever the process is alive.
// No database, no engine, no DDL — purely a process-alive signal.
//
// Contract:
//   GET /health/live → 200 { status: "alive", timestamp }
//   Never returns 5xx. Never performs I/O. Never blocks.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

export function GET(): NextResponse {
  return NextResponse.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
}
