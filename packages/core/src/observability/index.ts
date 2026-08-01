// ──────────────────────────────────────────────────────────────────
// VedMoulya — Observability
// Prometheus export, OTel exporter, correlation context, error
// reporting, and runtime info — unified exports.
// PH-002 — Enterprise Operations & Reliability (T1 Observability)
// ──────────────────────────────────────────────────────────────────

export { metricsToPrometheus, prometheusMetrics, metricsSnapshotJson } from './prometheus.js';
export { OtelExporter, type OtelExporterOptions } from './otel.js';
export {
  createCorrelationId,
  runWithCorrelation,
  withNewCorrelation,
  getCorrelationId,
  ensureCorrelationId,
} from './correlation.js';
export {
  ConsoleErrorReporter,
  HttpErrorReporter,
  ErrorReporterHub,
  errorReporter,
  type ErrorReporter,
  type ErrorReportContext,
} from './errorReporter.js';
export { getRuntimeInfo, recordRuntimeMetrics, type RuntimeInfo } from './runtime.js';
