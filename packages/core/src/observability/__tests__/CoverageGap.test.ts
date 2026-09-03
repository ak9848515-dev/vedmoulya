// ──────────────────────────────────────────────────────────────────
// VedMoulya — Targeted branch-coverage tests for observability gaps
// Covers the empty-histogram skip in prometheus.ts and the
// export barrel's re-exports.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { metricsToPrometheus, metricsSnapshotJson, prometheusMetrics } from '../index.js';
import { MetricsRegistry } from '../../metrics/index.js';

describe('prometheus — branch coverage', () => {
  it('renders an empty registry (no counters, no gauges, no histograms)', () => {
    const m = new MetricsRegistry();
    const text = metricsToPrometheus(m);
    expect(text).toContain('vedmoulya_process_memory_bytes');
    expect(text).toContain('vedmoulya_process_uptime_seconds');
  });

  it('renders a histogram with observations', () => {
    const m = new MetricsRegistry();
    m.observe('http_latency', 10);
    m.observe('http_latency', 20);
    m.observe('http_latency', 30);
    const text = metricsToPrometheus(m);
    expect(text).toContain('http_latency_count 3');
    expect(text).toContain('http_latency_sum');
    expect(text).toContain('quantile="0.5"');
    expect(text).toContain('quantile="0.95"');
    expect(text).toContain('quantile="0.99"');
  });

  it('skips histograms where count is 0 (the continue branch)', () => {
    const m = new MetricsRegistry();
    m.increment('counter1');
    m.setGauge('gauge1', 42);
    // No histograms observed — the for-of loop must skip the empty histogram branch.
    const text = metricsToPrometheus(m);
    expect(text).toContain('counter1 1');
    expect(text).toContain('gauge1 42');
    // No histogram summary lines
    expect(text).not.toContain('summary');
  });

  it('metricsSnapshotJson returns a snapshot', () => {
    const m = new MetricsRegistry();
    m.increment('req');
    const snap = metricsSnapshotJson(m);
    expect(snap).toHaveProperty('counters');
  });

  it('prometheusMetrics uses the global registry', () => {
    const text = prometheusMetrics();
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });
});
