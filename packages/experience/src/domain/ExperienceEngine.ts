// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Intelligence: Experience Engine
// EPIC-010 — the orchestrating layer above the Application Factory
// that evaluates and refines generated applications.
//
//   GENERATED APP → DESIGN SYSTEM → UI BLUEPRINT → DESIGN DECISIONS
//   → VISUAL CRITIC → MULTI-DIMENSIONAL QUALITY → EVIDENCE → TARGETED
//   REFINEMENT → REVIEW AGAIN (bounded)
//
// The engine executes NO AI directly; optional AI critique flows
// through a narrow port over the frozen runtime. Everything else is
// fully deterministic and evidence-backed.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type { DesignSpecification } from '@vedmoulya/requirements';
import { DesignSystemEngine } from './DesignSystemEngine.js';
import { DesignDecisionEngine } from './DesignDecisionEngine.js';
import { UIBlueprintEngine } from './UIBlueprintEngine.js';
import { VisualCriticEngine } from './VisualCriticEngine.js';
import { QualityEvaluator } from './QualityEvaluator.js';
import { EvidenceClassifier } from './EvidenceClassifier.js';
import { RefinementPlanner } from './RefinementPlanner.js';
import { TraceabilityEngine } from './TraceabilityEngine.js';
import type { AICritiquePort } from '../contracts/AICritiquePort.js';
import type {
  CriticFinding,
  EvidenceClass,
  ExperienceEvaluationBundle,
  RefinementPlan,
} from '../types/experience-types.js';

export interface ExperienceEngineOptions {
  designSystem?: DesignSystemEngine;
  blueprint?: UIBlueprintEngine;
  decisions?: DesignDecisionEngine;
  critic?: VisualCriticEngine;
  quality?: QualityEvaluator;
  evidence?: EvidenceClassifier;
  refinement?: RefinementPlanner;
  traceability?: TraceabilityEngine;
  /** Optional AI critique seam (EPIC-010 Phase 8/11). When provided, the
   *  engine may run `evaluateWithAI` to augment the deterministic critic
   *  with live-provider critique. `evaluate` stays deterministic and is
   *  identical whether or not the seam is wired. */
  aiCritique?: AICritiquePort;
}

export interface EvaluateInput {
  applicationId: string;
  /** The authenticated user requesting evaluation — forwarded to the AI
   *  runtime through the optional critique seam (per-user scoping).
   *  Never the application id. */
  userId?: string;
  archetype: AppArchetype;
  designSpec?: DesignSpecification;
  files: Array<{ path: string; content: string }>;
  securityFindings?: Array<{
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    filePath?: string;
  }>;
  validationEvidence?: Array<{ gate: string; passed: boolean; detail: string }>;
}

export interface RefineInput {
  applicationId: string;
  archetype: AppArchetype;
  findingId: string;
  designSpec?: DesignSpecification;
  files: Array<{ path: string; content: string }>;
}

export class ExperienceEngine {
  private readonly designSystem: DesignSystemEngine;
  private readonly blueprint: UIBlueprintEngine;
  private readonly decisions: DesignDecisionEngine;
  private readonly critic: VisualCriticEngine;
  private readonly quality: QualityEvaluator;
  private readonly evidence: EvidenceClassifier;
  private readonly refinement: RefinementPlanner;
  private readonly traceability: TraceabilityEngine;
  private readonly aiCritique: AICritiquePort | undefined;

  constructor(options: ExperienceEngineOptions = {}) {
    this.aiCritique = options.aiCritique;
    this.designSystem = options.designSystem ?? new DesignSystemEngine();
    this.blueprint = options.blueprint ?? new UIBlueprintEngine();
    this.decisions = options.decisions ?? new DesignDecisionEngine();
    this.critic = options.critic ?? new VisualCriticEngine({ aiCritique: options.aiCritique });
    this.quality = options.quality ?? new QualityEvaluator();
    this.evidence = options.evidence ?? new EvidenceClassifier();
    this.refinement = options.refinement ?? new RefinementPlanner();
    this.traceability = options.traceability ?? new TraceabilityEngine();
  }

  evaluate(input: EvaluateInput): ExperienceEvaluationBundle {
    const system = this.designSystem.derive({
      applicationId: input.applicationId,
      archetype: input.archetype,
      designSpec: input.designSpec,
    });
    const blueprint = this.blueprint.derive({
      applicationId: input.applicationId,
      archetype: input.archetype,
    });
    const designDecisions = this.decisions.derive({
      applicationId: input.applicationId,
      archetype: input.archetype,
      designSpec: input.designSpec ?? this.fallbackDesignSpec(input.archetype),
    });
    const critic = this.critic.critique({
      applicationId: input.applicationId,
      archetype: input.archetype,
      designSystem: system,
      blueprint,
      files: input.files,
    });
    const quality = this.quality.evaluate({
      applicationId: input.applicationId,
      files: input.files,
      critic,
      securityFindings: input.securityFindings,
      validationEvidence: input.validationEvidence,
    });
    const traceability = this.traceability.index({
      applicationId: input.applicationId,
      archetype: input.archetype,
      blueprint,
      decisions: designDecisions,
      files: input.files,
    });
    return {
      applicationId: input.applicationId,
      archetype: input.archetype,
      designSystem: system,
      blueprint,
      designDecisions,
      critic,
      quality,
      traceability,
    };
  }

  /**
   * Evaluate WITH the optional AI critique seam (EPIC-010 Phase 8/11).
   *
   * - No seam wired (default): identical to `evaluate` — fully deterministic.
   * - Seam wired: the deterministic evaluation runs first, then the AI
   *   critique augments the critic, and the multi-dimensional quality is
   *   re-computed over the merged critic so a confirmed AI finding can never
   *   be hidden by the aggregate score.
   */
  async evaluateWithAI(input: EvaluateInput): Promise<ExperienceEvaluationBundle> {
    if (!this.aiCritique) {
      return this.evaluate(input);
    }
    const bundle = this.evaluate(input);
    const critic = await this.critic.critiqueWithAI(
      {
        userId: input.userId,
        applicationId: input.applicationId,
        archetype: input.archetype,
        designSystem: bundle.designSystem,
        blueprint: bundle.blueprint,
        files: input.files,
      },
      this.aiCritique,
    );
    const quality = this.quality.evaluate({
      applicationId: input.applicationId,
      files: input.files,
      critic,
      securityFindings: input.securityFindings,
      validationEvidence: input.validationEvidence,
    });
    return { ...bundle, critic, quality };
  }

  /** Re-run the evidence classifier over every critic finding (Phase 10). */
  classify(
    findings: CriticFinding[],
  ): Array<CriticFinding & { evidenceClass: EvidenceClass; summary: string }> {
    return findings.map((f) => ({
      ...f,
      evidenceClass: this.evidence.classify({ finding: f, sourceEvidence: [f.evidence] }),
      summary: this.evidence.evidenceSummary(f),
    }));
  }

  planRefinement(input: RefineInput): RefinementPlan {
    const system = this.designSystem.derive({
      applicationId: input.applicationId,
      archetype: input.archetype,
      designSpec: input.designSpec,
    });
    const blueprint = this.blueprint.derive({
      applicationId: input.applicationId,
      archetype: input.archetype,
    });
    const critic = this.critic.critique({
      applicationId: input.applicationId,
      archetype: input.archetype,
      designSystem: system,
      blueprint,
      files: input.files,
    });
    const finding = critic.findings.find((f) => f.id === input.findingId);
    if (!finding) {
      throw new Error(`no critic finding "${input.findingId}" exists for this application`);
    }
    return this.refinement.plan({
      applicationId: input.applicationId,
      archetype: input.archetype,
      designSystem: system,
      blueprint,
      finding,
      files: input.files,
    });
  }

  private fallbackDesignSpec(_archetype: AppArchetype): DesignSpecification {
    return {
      sessionId: 'experience',
      visualPersonality: 'From the archetype visual baseline',
      targetAudience: 'Primary users of the application',
      brandDirection: 'Consistent with the archetype',
      colorSystem: [],
      typography: 'System type scale',
      spacing: 'Token-based spacing scale',
      components: [],
      iconography: 'Consistent icon set',
      motion: 'Subtle, purposeful transitions',
      responsiveStrategy: 'Mobile-first breakpoints',
      accessibility: 'WCAG AA baseline',
      interactionStates: ['hover', 'focus', 'pressed', 'loading', 'disabled'],
      emptyStates: ['no data'],
      loadingStates: ['initial load'],
      errorStates: ['request failure'],
      rationale: ['Deterministic fallback when no EPIC-009 specification is attached'],
    };
  }
}
