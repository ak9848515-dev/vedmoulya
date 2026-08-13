// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Intelligence: AI Critique Port (optional)
// EPIC-010 — Phase 8/10/11 optional seam. A live provider can critique
// generated UI IN ADDITION to the deterministic VisualCriticEngine —
// with the SAME evidence-first findings format (severity, area, issue,
// evidence, recommendation, evidence class).
//
// The port is provider-neutral: it defines ONLY the contract. The
// gateway implements it as an adapter over the frozen AI runtime
// (AIOrchestratorSpecialistPort → AIOrchestrationService), exactly like
// the EPIC-009 requirement-enrichment seam. Business engines never call
// provider SDKs.
//
// Honesty contract (Evidence-First, EPIC-010 Phase 10):
//   - Every finding must carry CONCRETE evidence from the generated
//     files. The engine re-classifies the model's claimed confidence
//     deterministically — a claim without evidence can never become
//     CONFIRMED, and an empty-evidence finding is DROPPED (never
//     invented).
//   - The port may ABSTAIN (insufficient or conflicting evidence) —
//     abstention is a valid, honest outcome and must not break the
//     deterministic path.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type {
  ApplicationDesignSystem,
  CriticFinding,
  CriticSeverity,
  UIBlueprint,
  VisualCriticArea,
} from '../types/experience-types.js';

/** Everything the model needs to critique the generated UI. */
export interface AICritiqueInput {
  /** The AUTHENTICATED user who requested the critique — the AI runtime's
   *  per-user rate limiting, caches and audit attribution key off this.
   *  Never the application id: two users critiquing the same app must not
   *  share one identity. The gateway router supplies `ctx.userId`. */
  userId: string;
  applicationId: string;
  archetype: AppArchetype;
  designSystem: ApplicationDesignSystem;
  blueprint: UIBlueprint;
  files: Array<{ path: string; content: string }>;
  /** Deterministic findings already found — the AI must NOT duplicate them. */
  existingFindings: CriticFinding[];
}

/** A model-claimed finding. Confidence is a claim, NOT a fact — the
 *  engine maps it to EvidenceClass deterministically and honestly. */
export interface AICritiqueFinding {
  severity: CriticSeverity;
  area: VisualCriticArea;
  /** Where the issue is (screen / component / file). */
  location: string;
  issue: string;
  /** Concrete evidence from the generated files (never invented). */
  evidence: string;
  recommendation: string;
  /** The model's claimed confidence (re-classified by the engine). */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AICritiqueResult {
  /** Provider/model that produced the critique (transparency). */
  provider: string;
  model: string;
  tokens: { input: number; output: number; total: number };
  costUsd: number;
  latencyMs: number;
  /** Evidence-First: the runtime abstained (no fabricated critique). */
  abstained: boolean;
  findings: AICritiqueFinding[];
  /** Non-fatal: a provider/parse failure must not break evaluation. */
  error?: string;
}

/** The ONLY way the experience engines talk to an AI critic. Optional:
 *  when absent, evaluation is fully deterministic (EPIC-010 default). */
export interface AICritiquePort {
  critique(input: AICritiqueInput): Promise<AICritiqueResult>;
}
