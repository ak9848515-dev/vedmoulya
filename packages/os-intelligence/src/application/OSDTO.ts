// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: DTOs
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// JSON-safe API surface. All dates are ISO strings; all nested
// records are plain objects (tRPC-safe). The output DTOs alias the
// OS types directly (they are already JSON-safe); the input DTOs are
// validated at the tRPC boundary with zod (RouterRegistry).
// ──────────────────────────────────────────────────────────────────

import type {
  OSDashboardData,
  OSDependencyGraph,
  OSDiagnosticFinding,
  OSDiagnosticsReport,
  OSEngineStatus,
  OSHealthSnapshot,
  OSPerformanceMetrics,
  OSPipelineHealth,
  OSPlatformValidation,
  OSSystemHealth,
} from '../types/os-types.js';

// ── Output DTOs (JSON-safe entity shapes) ─────────────────────────

export type OSSystemHealthDTO = OSSystemHealth;
export type OSPipelineHealthDTO = OSPipelineHealth;
export type OSDiagnosticsReportDTO = OSDiagnosticsReport;
export type OSDiagnosticFindingDTO = OSDiagnosticFinding;
export type OSPlatformValidationDTO = OSPlatformValidation;
export type OSEngineStatusDTO = OSEngineStatus;
export type OSDependencyGraphDTO = OSDependencyGraph;
export type OSPerformanceMetricsDTO = OSPerformanceMetrics;
export type OSHealthSnapshotDTO = OSHealthSnapshot;
export type OSDashboardDataDTO = OSDashboardData;

// ── Input DTOs ────────────────────────────────────────────────────

export interface OSSnapshotListDTO {
  limit?: number;
}

export interface OSValidatePlatformDTO {
  /** Re-run the full health pass before validating. Default true. */
  fresh?: boolean;
}
