// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Alerting Model
// EPIC-012 — Production Observability & Control Plane (Phase 13)
//
// Threshold-based alerts for provider outages, latency/429/5xx spikes,
// RAG failure, abstention spikes, cost/token anomalies, quality
// regression, security incidents, deployment and application failures.
//
// The engine is fed a deterministic METRICS SNAPSHOT (counters/ratios
// read by the caller) plus trace-derived signals, so it stays a pure
// function — easy to test, no hidden I/O. Thresholds are configurable
// (`configure`) and validated. No alerts fire for normal expected
// behavior: every rule requires crossing its threshold.
// ─────────────────────────────────────────────────────────────────────────────

/** Inputs the caller assembles from AIMetrics + the trace store. */
export interface AlertMetricsSnapshot {
  aiRequestsTotal: number;
  aiRequestsFailure: number;
  aiRateLimit429: number;
  aiAbstentions: number;
  ragFallbackCount: number;
  promptCacheHitRatio: number;
  /** Execution cost + the median baseline for the cost-anomaly rule. */
  costUsd?: number;
  baselineCostUsd?: number;
  /** Token spend + previous-window spend for the token-anomaly rule. */
  tokenSpend?: number;
  previousTokenSpend?: number;
  qualityRegressions?: Array<{ applicationId: string; previous: number; current: number }>;
  securityIncidents?: number;
  deploymentFailures?: number;
  applicationFailures?: number;
}

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertRule =
  | 'provider_error_rate'
  | 'latency_p95'
  | 'rate_limit_429'
  | 'rag_fallback_rate'
  | 'abstention_rate'
  | 'cost_anomaly'
  | 'token_anomaly'
  | 'quality_regression'
  | 'security_incident'
  | 'deployment_failure'
  | 'application_failure';

export interface AlertThresholds {
  /** Provider failure rate above this → alert. Default 0.10. */
  providerErrorRate?: number;
  /** p95 latency (ms) above this → alert. Default 120000. */
  latencyP95Ms?: number;
  /** 429s per minute above this → alert. Default 10. */
  rateLimit429PerMin?: number;
  /** RAG keyword-fallback share above this → alert. Default 0.50. */
  ragFallbackRate?: number;
  /** Abstention share above this → alert. Default 0.30. */
  abstentionRate?: number;
  /** Execution cost above median × multiplier → alert (fed from ledger). Default 5. */
  costAnomalyMultiplier?: number;
  /** Token spend above previous window × multiplier → alert. Default 3. */
  tokenAnomalyMultiplier?: number;
  /** Quality score drop above this → alert. Default 15 points. */
  qualityRegressionDrop?: number;
  /** Any security incident in the window → alert. Default 1. */
  securityIncidentCount?: number;
  /** Deployment failures in the window above this → alert. Default 1. */
  deploymentFailureCount?: number;
  /** Application failures in the window above this → alert. Default 3. */
  applicationFailureCount?: number;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  rule: AlertRule;
  message: string;
  value: number;
  threshold: number;
  scope?: { applicationId?: string; userId?: string };
  createdAt: number;
}

export const DEFAULT_ALERT_THRESHOLDS: Required<AlertThresholds> = {
  providerErrorRate: 0.1,
  latencyP95Ms: 120_000,
  rateLimit429PerMin: 10,
  ragFallbackRate: 0.5,
  abstentionRate: 0.3,
  costAnomalyMultiplier: 5,
  tokenAnomalyMultiplier: 3,
  qualityRegressionDrop: 15,
  securityIncidentCount: 1,
  deploymentFailureCount: 1,
  applicationFailureCount: 3,
};

/**
 * Pure, testable alert engine. `configure` accepts partial thresholds
 * (values are clamped to sane ranges); `evaluate` returns alerts that
 * crossed their threshold plus a bounded recent-alert history.
 */
export class AlertEngine {
  private thresholds: Required<AlertThresholds>;
  private readonly history: Alert[] = [];
  private readonly maxHistory: number;
  private readonly now: () => number;
  private alertSeq = 0;

  constructor(
    options: { thresholds?: AlertThresholds; maxHistory?: number; now?: () => number } = {},
  ) {
    this.thresholds = { ...DEFAULT_ALERT_THRESHOLDS, ...sanitizeThresholds(options.thresholds) };
    this.maxHistory = options.maxHistory ?? 200;
    this.now = options.now ?? ((): number => Date.now());
  }

  get configuredThresholds(): AlertThresholds {
    return { ...this.thresholds };
  }

  configure(partial: AlertThresholds): void {
    this.thresholds = { ...this.thresholds, ...sanitizeThresholds(partial) };
  }

  evaluate(input: AlertMetricsSnapshot): Alert[] {
    const alerts: Alert[] = [];
    const t = this.thresholds;
    const createdAt = this.now();

    const successTotal = input.aiRequestsTotal - input.aiRequestsFailure;
    const errorRate =
      input.aiRequestsTotal > 0 ? input.aiRequestsFailure / input.aiRequestsTotal : 0;
    if (input.aiRequestsTotal >= 20 && errorRate > t.providerErrorRate) {
      alerts.push(
        this.alert(
          'provider_error_rate',
          errorRate > t.providerErrorRate * 2 ? 'critical' : 'warning',
          `Provider error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold ${(t.providerErrorRate * 100).toFixed(1)}%`,
          errorRate,
          t.providerErrorRate,
          createdAt,
        ),
      );
    }

    const abortTotal = input.aiRequestsTotal;
    const abstentionRate = abortTotal > 0 ? input.aiAbstentions / abortTotal : 0;
    if (abortTotal >= 10 && abstentionRate > t.abstentionRate) {
      alerts.push(
        this.alert(
          'abstention_rate',
          'warning',
          `Abstention rate ${(abstentionRate * 100).toFixed(1)}% exceeds threshold ${(t.abstentionRate * 100).toFixed(1)}% — evidence grounding may be degraded`,
          abstentionRate,
          t.abstentionRate,
          createdAt,
        ),
      );
    }

    if (input.aiRateLimit429 > t.rateLimit429PerMin) {
      alerts.push(
        this.alert(
          'rate_limit_429',
          'warning',
          `${input.aiRateLimit429} rate-limit (429) responses exceed threshold ${t.rateLimit429PerMin}/min`,
          input.aiRateLimit429,
          t.rateLimit429PerMin,
          createdAt,
        ),
      );
    }

    const ragCalls = successTotal + input.ragFallbackCount;
    const ragFallbackRate = ragCalls > 0 ? input.ragFallbackCount / ragCalls : 0;
    if (ragCalls >= 5 && ragFallbackRate > t.ragFallbackRate) {
      alerts.push(
        this.alert(
          'rag_fallback_rate',
          'warning',
          `RAG keyword-fallback rate ${(ragFallbackRate * 100).toFixed(1)}% exceeds threshold ${(t.ragFallbackRate * 100).toFixed(1)}% — embedding pipeline may be unhealthy`,
          ragFallbackRate,
          t.ragFallbackRate,
          createdAt,
        ),
      );
    }

    for (const reg of input.qualityRegressions ?? []) {
      if (reg.previous - reg.current >= t.qualityRegressionDrop) {
        alerts.push(
          this.alert(
            'quality_regression',
            'warning',
            `Quality regression on ${reg.applicationId}: ${reg.previous} → ${reg.current} (drop ≥ ${t.qualityRegressionDrop})`,
            reg.previous - reg.current,
            t.qualityRegressionDrop,
            createdAt,
            { applicationId: reg.applicationId },
          ),
        );
      }
    }

    const securityIncidents = input.securityIncidents ?? 0;
    if (securityIncidents >= t.securityIncidentCount) {
      alerts.push(
        this.alert(
          'security_incident',
          'critical',
          `${securityIncidents} security incident(s) in the window — immediate operator review required`,
          securityIncidents,
          t.securityIncidentCount,
          createdAt,
        ),
      );
    }

    const deploymentFailures = input.deploymentFailures ?? 0;
    if (deploymentFailures >= t.deploymentFailureCount) {
      alerts.push(
        this.alert(
          'deployment_failure',
          'critical',
          `${deploymentFailures} deployment failure(s) in the window`,
          deploymentFailures,
          t.deploymentFailureCount,
          createdAt,
        ),
      );
    }

    const applicationFailures = input.applicationFailures ?? 0;
    if (applicationFailures >= t.applicationFailureCount) {
      alerts.push(
        this.alert(
          'application_failure',
          'warning',
          `${applicationFailures} application failure(s) in the window`,
          applicationFailures,
          t.applicationFailureCount,
          createdAt,
        ),
      );
    }

    // Cost anomaly: execution cost vs the median baseline (ledger-derived).
    if (
      input.costUsd !== undefined &&
      input.baselineCostUsd !== undefined &&
      input.baselineCostUsd > 0
    ) {
      const multiplier = input.costUsd / input.baselineCostUsd;
      if (multiplier > t.costAnomalyMultiplier) {
        alerts.push(
          this.alert(
            'cost_anomaly',
            multiplier > t.costAnomalyMultiplier * 2 ? 'critical' : 'warning',
            `Execution cost $${input.costUsd.toFixed(5)} is ${multiplier.toFixed(1)}× the $${input.baselineCostUsd.toFixed(5)} median baseline`,
            multiplier,
            t.costAnomalyMultiplier,
            createdAt,
          ),
        );
      }
    }

    // Token anomaly: current window spend vs the previous window.
    if (
      input.tokenSpend !== undefined &&
      input.previousTokenSpend !== undefined &&
      input.previousTokenSpend > 0
    ) {
      const multiplier = input.tokenSpend / input.previousTokenSpend;
      if (multiplier > t.tokenAnomalyMultiplier) {
        alerts.push(
          this.alert(
            'token_anomaly',
            'warning',
            `Token spend ${input.tokenSpend} is ${multiplier.toFixed(1)}× the previous window (${input.previousTokenSpend})`,
            multiplier,
            t.tokenAnomalyMultiplier,
            createdAt,
          ),
        );
      }
    }

    for (const alert of alerts) {
      this.history.push(alert);
      if (this.history.length > this.maxHistory) this.history.shift();
    }
    return alerts;
  }

  listRecent(limit = 50): Alert[] {
    return this.history.slice(-limit).reverse();
  }

  clear(): void {
    this.history.length = 0;
  }

  private alert(
    rule: AlertRule,
    severity: AlertSeverity,
    message: string,
    value: number,
    threshold: number,
    createdAt: number,
    scope?: { applicationId?: string; userId?: string },
  ): Alert {
    this.alertSeq += 1;
    return {
      id: `alert-${this.alertSeq}`,
      severity,
      rule,
      message,
      value,
      threshold,
      scope,
      createdAt,
    };
  }
}

function sanitizeThresholds(partial?: AlertThresholds): Partial<Required<AlertThresholds>> {
  if (!partial) return {};
  const out: Partial<Required<AlertThresholds>> = {};
  const clamp = (v: number | undefined, min: number, max: number, fallback: number): number => {
    if (v === undefined) return fallback;
    return Math.min(max, Math.max(min, v));
  };
  out.providerErrorRate = clamp(
    partial.providerErrorRate,
    0.01,
    0.99,
    DEFAULT_ALERT_THRESHOLDS.providerErrorRate,
  );
  out.latencyP95Ms = clamp(
    partial.latencyP95Ms,
    1_000,
    3_600_000,
    DEFAULT_ALERT_THRESHOLDS.latencyP95Ms,
  );
  out.rateLimit429PerMin = clamp(
    partial.rateLimit429PerMin,
    1,
    10_000,
    DEFAULT_ALERT_THRESHOLDS.rateLimit429PerMin,
  );
  out.ragFallbackRate = clamp(
    partial.ragFallbackRate,
    0.01,
    0.99,
    DEFAULT_ALERT_THRESHOLDS.ragFallbackRate,
  );
  out.abstentionRate = clamp(
    partial.abstentionRate,
    0.01,
    0.99,
    DEFAULT_ALERT_THRESHOLDS.abstentionRate,
  );
  out.costAnomalyMultiplier = clamp(
    partial.costAnomalyMultiplier,
    1.5,
    100,
    DEFAULT_ALERT_THRESHOLDS.costAnomalyMultiplier,
  );
  out.tokenAnomalyMultiplier = clamp(
    partial.tokenAnomalyMultiplier,
    1.5,
    100,
    DEFAULT_ALERT_THRESHOLDS.tokenAnomalyMultiplier,
  );
  out.qualityRegressionDrop = clamp(
    partial.qualityRegressionDrop,
    1,
    100,
    DEFAULT_ALERT_THRESHOLDS.qualityRegressionDrop,
  );
  out.securityIncidentCount = clamp(
    partial.securityIncidentCount,
    1,
    10_000,
    DEFAULT_ALERT_THRESHOLDS.securityIncidentCount,
  );
  out.deploymentFailureCount = clamp(
    partial.deploymentFailureCount,
    1,
    10_000,
    DEFAULT_ALERT_THRESHOLDS.deploymentFailureCount,
  );
  out.applicationFailureCount = clamp(
    partial.applicationFailureCount,
    1,
    10_000,
    DEFAULT_ALERT_THRESHOLDS.applicationFailureCount,
  );
  return out;
}
