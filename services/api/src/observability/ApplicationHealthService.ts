// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Application Health Model
// EPIC-012 — Production Observability & Control Plane (Phase 10)
//
// Derives a HEALTHY / DEGRADED / BLOCKED / FAILED / UNKNOWN verdict for each
// persisted application from REAL persisted evidence (factory project
// status, validation gates, security report, UI quality, repair loop). A
// numeric quality score can never mask a critical security finding — the
// verdict derivation is rule-first, exactly like the quality gates.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ApplicationStatus,
  SecurityReport,
  ValidationReport,
  UIQualityReport,
  EconomicsSnapshot,
} from '@vedmoulya/app-factory';

export type AppHealthStatus = 'HEALTHY' | 'DEGRADED' | 'BLOCKED' | 'FAILED' | 'UNKNOWN';

export interface ApplicationHealth {
  applicationId: string;
  name: string;
  archetype: string;
  verdict: AppHealthStatus;
  factoryStatus: ApplicationStatus;
  lastBuildAt?: string;
  validation?: { overall: ValidationReport['overall']; gatesPassed: number; gatesTotal: number };
  security?: { blocked: boolean; critical: number; high: number; medium: number; low: number };
  uiQuality?: { score: number; verdict: UIQualityReport['verdict'] };
  qualityVerdict?: string;
  economics?: { totalTokens: number; estimatedCostUsd: number; aiCalls: number };
  repairLimitReached?: boolean;
  error?: string;
  /** Human-readable reasons for the verdict (operator diagnosis). */
  reasons: string[];
  updatedAt?: string;
}

/**
 * Structural input shape: every field the health derivation reads. Both the
 * factory engine's AppProject and the gateway's FactoryApplicationDTO satisfy
 * it, so the derivation is reusable at any layer.
 */
export interface AssessableApplication {
  applicationId: string;
  name: string;
  archetype: string;
  status: ApplicationStatus;
  health?: string;
  lastBuildAt?: string;
  lastValidation?: ValidationReport;
  securityReport?: SecurityReport;
  uiQuality?: UIQualityReport;
  economics?: EconomicsSnapshot;
  repairLimitReached?: boolean;
  terminationReason?: string;
  error?: string;
  updatedAt?: string;
}

/**
 * Derive the health verdict from persisted project evidence. Rule order is
 * intentional: FAILED (hard terminal) → BLOCKED (hard gates) → DEGRADED
 * (soft gates) → HEALTHY (all evidence clean) → UNKNOWN (no build evidence).
 */
export function assessApplicationHealth(project: AssessableApplication): ApplicationHealth {
  const reasons: string[] = [];
  const validation = project.lastValidation
    ? {
        overall: project.lastValidation.overall,
        gatesPassed: project.lastValidation.gates.filter((g) => g.passed).length,
        gatesTotal: project.lastValidation.gates.length,
      }
    : undefined;
  const security = project.securityReport
    ? {
        blocked: project.securityReport.blocked,
        critical: project.securityReport.summary.critical,
        high: project.securityReport.summary.high,
        medium: project.securityReport.summary.medium,
        low: project.securityReport.summary.low,
      }
    : undefined;
  const uiQuality = project.uiQuality
    ? { score: project.uiQuality.score, verdict: project.uiQuality.verdict }
    : undefined;

  // FAILED — terminal build/execution failure.
  if (project.status === 'FAILED' || project.error !== undefined) {
    reasons.push(project.error ? `build failed: ${project.error}` : `status ${project.status}`);
    if (project.terminationReason) reasons.push(`termination: ${project.terminationReason}`);
    return buildHealth(project, 'FAILED', reasons);
  }

  // BLOCKED — critical/high security findings or exhausted repair loop.
  if (security?.blocked) {
    reasons.push(
      `${security.critical} critical + ${security.high} high security findings block completion`,
    );
    return buildHealth(project, 'BLOCKED', reasons);
  }
  if (project.repairLimitReached) {
    reasons.push('repair loop exhausted its attempts while still failing');
    return buildHealth(project, 'BLOCKED', reasons);
  }

  // DEGRADED — validation/UI quality failed but not security-blocked.
  if (validation && validation.overall !== 'PASS') {
    reasons.push(
      `validation ${validation.overall}: ${validation.gatesPassed}/${validation.gatesTotal} gates passed`,
    );
    return buildHealth(project, 'DEGRADED', reasons);
  }
  if (uiQuality && uiQuality.verdict === 'FAIL') {
    reasons.push(
      `UI quality ${uiQuality.verdict} (score ${Math.round(uiQuality.score * 100)}/100)`,
    );
    return buildHealth(project, 'DEGRADED', reasons);
  }
  if (project.health === 'degraded') {
    reasons.push('platform health probe reports degraded');
    return buildHealth(project, 'DEGRADED', reasons);
  }

  // HEALTHY — a real build produced clean evidence.
  if (project.lastBuildAt && validation) {
    if (security && (security.critical > 0 || security.high > 0)) {
      reasons.push('security findings present but not blocking');
    }
    reasons.push('build validated and security review complete');
    return buildHealth(project, 'HEALTHY', reasons);
  }

  // UNKNOWN — created/planned but never built.
  reasons.push(`no build evidence yet (status ${project.status})`);
  return buildHealth(project, 'UNKNOWN', reasons);
}

function buildHealth(
  project: AssessableApplication,
  verdict: AppHealthStatus,
  reasons: string[],
): ApplicationHealth {
  return {
    applicationId: project.applicationId,
    name: project.name,
    archetype: project.archetype,
    verdict,
    factoryStatus: project.status,
    lastBuildAt: project.lastBuildAt,
    validation: project.lastValidation
      ? {
          overall: project.lastValidation.overall,
          gatesPassed: project.lastValidation.gates.filter((g) => g.passed).length,
          gatesTotal: project.lastValidation.gates.length,
        }
      : undefined,
    security: project.securityReport
      ? {
          blocked: project.securityReport.blocked,
          critical: project.securityReport.summary.critical,
          high: project.securityReport.summary.high,
          medium: project.securityReport.summary.medium,
          low: project.securityReport.summary.low,
        }
      : undefined,
    uiQuality: project.uiQuality
      ? { score: project.uiQuality.score, verdict: project.uiQuality.verdict }
      : undefined,
    economics: project.economics
      ? {
          totalTokens: project.economics.totalTokens,
          estimatedCostUsd: project.economics.estimatedCostUsd,
          aiCalls: project.economics.aiCalls,
        }
      : undefined,
    repairLimitReached: project.repairLimitReached,
    error: project.error,
    reasons,
    updatedAt: project.updatedAt,
  };
}
