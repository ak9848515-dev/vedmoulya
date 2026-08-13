// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Intelligence: DTO Boundary
// EPIC-010 — the experience.* API contract. The DTO exposes only what
// the workspace Quality center renders; internal engine mechanics are
// never leaked.
// ──────────────────────────────────────────────────────────────────

import type { DesignSpecification } from '@vedmoulya/requirements';
import type {
  ApplicationDesignSystem,
  ApplicationQualityEvaluation,
  CriticFinding,
  DesignDecision,
  EvidenceClass,
  RefinementPlan,
  TraceabilityLink,
  UIBlueprint,
  VisualCriticReport,
} from '../types/experience-types.js';

export interface ExperienceEvaluateDTO {
  applicationId: string;
  archetype: string;
  designSystem: ApplicationDesignSystem;
  blueprint: UIBlueprint;
  designDecisions: DesignDecision[];
  critic: VisualCriticReport;
  quality: ApplicationQualityEvaluation;
  traceability: TraceabilityLink[];
}

export interface ExperienceFindingsDTO {
  findings: Array<CriticFinding & { evidenceClass: EvidenceClass; summary: string }>;
}

export interface ExperienceRefineDTO {
  applicationId: string;
  plan: RefinementPlan;
}

export interface ExperienceEvaluateInput {
  applicationId: string;
  /** The authenticated user requesting evaluation — forwarded to the AI
   *  runtime through the optional critique seam (per-user scoping).
   *  Never the application id. */
  userId?: string;
  archetype: string;
  designSpec?: DesignSpecification;
  files: Array<{ path: string; content: string }>;
  securityFindings?: Array<{
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    filePath?: string;
  }>;
  validationEvidence?: Array<{ gate: string; passed: boolean; detail: string }>;
}

export interface ExperienceRefineInput {
  applicationId: string;
  archetype: string;
  findingId: string;
  designSpec?: DesignSpecification;
  files: Array<{ path: string; content: string }>;
}
