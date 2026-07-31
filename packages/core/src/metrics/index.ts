// ──────────────────────────────────────────────────────────────────
// VedMoulya — Metrics Collection
// Lightweight metrics for counters, gauges, histograms, and timers
// Implements BLP-001/D02 — Engineering Principle #9 (Observability)
// ──────────────────────────────────────────────────────────────────

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  labels?: Record<string, string>;
  timestamp: string;
}

export type MetricListener = (metric: Metric) => void;

/**
 * Metrics collection registry
 */
export class MetricsRegistry {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly histograms = new Map<string, number[]>();
  private readonly listeners: MetricListener[] = [];
  private readonly defaultLabels: Record<string, string>;

  constructor(defaultLabels?: Record<string, string>) {
    this.defaultLabels = defaultLabels ?? {};
  }

  /**
   * Register a listener for metrics events (for exporting)
   */
  onMetric(listener: MetricListener): void {
    this.listeners.push(listener);
  }

  private emit(type: MetricType, name: string, value: number): void {
    const metric: Metric = {
      name,
      type,
      value,
      labels: { ...this.defaultLabels },
      timestamp: new Date().toISOString(),
    };
    for (const listener of this.listeners) {
      listener(metric);
    }
  }

  // ── Counters ────────────────────────────────────────────────────

  /**
   * Increment a counter by a value (default: 1)
   */
  increment(name: string, value: number = 1): void {
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current + value);
    this.emit('counter', name, current + value);
  }

  /**
   * Get current counter value
   */
  getCounter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  // ── Gauges ──────────────────────────────────────────────────────

  /**
   * Set a gauge to a value
   */
  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
    this.emit('gauge', name, value);
  }

  /**
   * Get current gauge value
   */
  getGauge(name: string): number | undefined {
    return this.gauges.get(name);
  }

  // ── Histograms ──────────────────────────────────────────────────

  /**
   * Observe a value for a histogram
   */
  observe(name: string, value: number): void {
    const values = this.histograms.get(name) ?? [];
    values.push(value);
    this.histograms.set(name, values);
    this.emit('histogram', name, value);
  }

  /**
   * Get histogram statistics
   */
  histogramStats(name: string):
    | {
        count: number;
        sum: number;
        min: number;
        max: number;
        avg: number;
        p50: number;
        p95: number;
        p99: number;
      }
    | undefined {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) return undefined;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const count = sorted.length;

    return {
      count,
      sum,
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      avg: sum / count,
      p50: sorted[Math.floor(count * 0.5)] ?? 0,
      p95: sorted[Math.floor(count * 0.95)] ?? 0,
      p99: sorted[Math.floor(count * 0.99)] ?? 0,
    };
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /**
   * Snapshot all current metrics
   */
  snapshot(): Record<string, unknown> {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Array.from(this.histograms.keys()).reduce<Record<string, unknown>>((acc, key) => {
        const stats = this.histogramStats(key);
        if (stats) acc[key] = stats;
        return acc;
      }, {}),
    };
  }
}

/**
 * Default metrics registry
 */
export const metrics = new MetricsRegistry();

/**
 * Timer utility for measuring operation duration
 */
export class Timer {
  private readonly start: number;
  private readonly name: string;
  private readonly registry: MetricsRegistry;

  constructor(name: string, registry?: MetricsRegistry) {
    this.name = name;
    this.start = performance.now();
    this.registry = registry ?? metrics;
  }

  /**
   * Stop the timer and record the duration
   */
  stop(): number {
    const duration = performance.now() - this.start;
    this.registry.observe(this.name, duration);
    return duration;
  }
}
