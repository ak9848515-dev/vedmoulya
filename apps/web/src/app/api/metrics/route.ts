// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Prometheus Metrics Scrape Endpoint
// Serves the global MetricsRegistry in Prometheus text exposition format
// so Prometheus/Grafana can scrape real runtime + API metrics.
// PH-002 — Enterprise Operations & Reliability (T1 Observability)
// ─────────────────────────────────────────────────────────────────────────────

import { prometheusMetrics } from '@vedmoulya/core';
import { initGatewayObservability } from '@vedmoulya/api';
import type { NextRequest } from 'next/server';

// ── Metrics Scrape (GET /api/metrics) ────────────────────────────────────────
// Returns the current registry snapshot in Prometheus text exposition format
// (https://prometheus.io/docs/instrumenting/exposition_formats/).
//
// The gateway's observability singleton (OTel exporter + runtime metrics
// interval) lives in @vedmoulya/api and is initialized lazily from the tRPC
// route handler. Calling initGatewayObservability() here is a cheap idempotent
// no-op that guarantees runtime memory/CPU/uptime gauges exist even when the
// very first request this process serves is the /api/metrics scrape itself.

// prometheusMetrics() reads process.memoryUsage()/process.uptime(), so this
// handler must run on the Node.js runtime (not edge).
export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

let observabilityInitialized = false;

export function GET(_request: NextRequest): Response {
  if (!observabilityInitialized) {
    observabilityInitialized = true;
    initGatewayObservability();
  }
  return new Response(prometheusMetrics(), {
    headers: {
      'content-type': 'text/plain; version=0.0.4; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
