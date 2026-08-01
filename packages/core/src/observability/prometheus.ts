// ──────────────────────────────────────────────────────────────────
// VedMoulya — Prometheus Exporter
// Renders the MetricsRegistry as Prometheus text exposition format
// PH-002 — Enterprise Operations & Reliability (T1 Observability)
// ──────────────────────────────────────────────────────────────────

import { metrics, type MetricsRegistry } from '../metrics/index.js';

/**
 * Escape a metric name to a valid Prometheus name (alphanumeric + _ :).
 */
function escapeMetricName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_:]/g, '_');
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return String(value);
}

interface PrometheusSnapshot {
  counters?: Record<string, number>;
  gauges?: Record<string, number>;
  histograms?: Record<
    string,
    { count: number; sum: number; p50: number; p95: number; p99: number }
  >;
}

/**
 * Convert a MetricsRegistry snapshot into Prometheus text exposition format.
 * Counters and gauges map 1:1; histograms render as summaries with
 * quantiles (p50/p95/p99) plus `_count` and `_sum` series so Grafana can
 * query latency percentiles out of the box.
 */
export function metricsToPrometheus(registry: MetricsRegistry): string {
  const snapshot = registry.snapshot() as PrometheusSnapshot;

  const lines: string[] = [];

  // ── Counters ────────────────────────────────────────────────────
  for (const [name, value] of Object.entries(snapshot.counters ?? {})) {
    const metric = escapeMetricName(name);
    lines.push(`# TYPE ${metric} counter`);
    lines.push(`${metric} ${formatValue(value)}`);
  }

  // ── Gauges ──────────────────────────────────────────────────────
  for (const [name, value] of Object.entries(snapshot.gauges ?? {})) {
    const metric = escapeMetricName(name);
    lines.push(`# TYPE ${metric} gauge`);
    lines.push(`${metric} ${formatValue(value)}`);
  }

  // ── Histograms (rendered as summaries with quantiles) ───────────
  for (const [name, stats] of Object.entries(snapshot.histograms ?? {})) {
    if (stats.count === 0) continue;
    const metric = escapeMetricName(name);
    lines.push(`# TYPE ${metric} summary`);
    lines.push(`${metric}_count ${formatValue(stats.count)}`);
    lines.push(`${metric}_sum ${formatValue(stats.sum)}`);
    lines.push(`${metric}{quantile="0.5"} ${formatValue(stats.p50)}`);
    lines.push(`${metric}{quantile="0.95"} ${formatValue(stats.p95)}`);
    lines.push(`${metric}{quantile="0.99"} ${formatValue(stats.p99)}`);
  }

  // ── Process gauges (memory / cpu / uptime) ──────────────────────
  const mem = process.memoryUsage();
  lines.push('# TYPE vedmoulya_process_memory_bytes gauge');
  lines.push(`vedmoulya_process_memory_bytes{type="rss"} ${formatValue(mem.rss)}`);
  lines.push(`vedmoulya_process_memory_bytes{type="heap_total"} ${formatValue(mem.heapTotal)}`);
  lines.push(`vedmoulya_process_memory_bytes{type="heap_used"} ${formatValue(mem.heapUsed)}`);
  lines.push('# TYPE vedmoulya_process_uptime_seconds gauge');
  lines.push(`vedmoulya_process_uptime_seconds ${formatValue(process.uptime())}`);

  return lines.join('\n') + '\n';
}

/**
 * Render the default global registry. Convenience wrapper for scrape endpoints.
 */
export function prometheusMetrics(): string {
  return metricsToPrometheus(metrics);
}

/**
 * Render a JSON snapshot (useful for dashboards that read JSON rather
 * than the text exposition format, e.g. the tRPC metrics router).
 */
export function metricsSnapshotJson(registry: MetricsRegistry): Record<string, unknown> {
  return registry.snapshot();
}
