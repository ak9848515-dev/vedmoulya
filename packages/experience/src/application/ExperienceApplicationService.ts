// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Intelligence: Application Service
// EPIC-010 — the experience.* execution contract:
//   experience.evaluate     — design system + blueprint + decisions +
//                             critic + multi-dimensional quality +
//                             traceability for a generated app
//   experience.findings     — evidence-classified critic findings
//   experience.refine       — targeted refinement plan (change impact,
//                             only affected files, never regenerate-all)
// The service is deterministic and provider-neutral; optional AI
// critique flows through the frozen runtime via a narrow port.
// ──────────────────────────────────────────────────────────────────

import { NOOP_TELEMETRY } from '@vedmoulya/core';
import type { TelemetryPort } from '@vedmoulya/core';
import { ExperienceEngine } from '../domain/ExperienceEngine.js';
import type { AppArchetype } from '@vedmoulya/app-factory';
import type { AICritiquePort } from '../contracts/AICritiquePort.js';
import type {
  ExperienceEvaluateDTO,
  ExperienceEvaluateInput,
  ExperienceFindingsDTO,
  ExperienceRefineDTO,
  ExperienceRefineInput,
} from './ExperienceDTO.js';

export interface ExperienceApplicationServiceOptions {
  engine?: ExperienceEngine;
  /** Optional AI critique seam (EPIC-010 Phase 8/11) — see ExperienceEngine. */
  aiCritique?: AICritiquePort;
  /**
   * EPIC-012 — optional telemetry port. When provided, evaluations and
   * refinements emit spans carrying the quality verdict, overall score and
   * finding counts. Defaults to a zero-overhead NOOP.
   */
  telemetry?: TelemetryPort;
}

export class ExperienceApplicationService {
  private readonly engine: ExperienceEngine;
  private readonly telemetry: TelemetryPort;

  constructor(options: ExperienceApplicationServiceOptions = {}) {
    this.telemetry = options.telemetry ?? NOOP_TELEMETRY;
    this.engine = options.engine ?? new ExperienceEngine({ aiCritique: options.aiCritique });
  }

  evaluate(input: ExperienceEvaluateInput): ExperienceEvaluateDTO {
    const bundle = this.engine.evaluate({
      applicationId: input.applicationId,
      archetype: input.archetype as AppArchetype,
      designSpec: input.designSpec,
      files: input.files,
      securityFindings: input.securityFindings,
      validationEvidence: input.validationEvidence,
    });
    // EPIC-012: emit the quality outcome onto the trace spine (synchronous
    // deterministic evaluation — a plain span, not withSpan).
    const span = this.telemetry.startSpan({
      name: 'experience.evaluate',
      kind: 'engine',
      applicationId: bundle.applicationId,
      userId: input.userId,
      attributes: {
        verdict: bundle.quality.verdict,
        overall: bundle.quality.overall,
        findings: bundle.critic.findings.length,
        blocking: bundle.critic.blocking,
      },
    });
    span.end(bundle.quality.verdict === 'NOT_READY' ? 'VALIDATION_FAILURE' : 'OK');
    return {
      applicationId: bundle.applicationId,
      archetype: bundle.archetype,
      designSystem: bundle.designSystem,
      blueprint: bundle.blueprint,
      designDecisions: bundle.designDecisions,
      critic: bundle.critic,
      quality: bundle.quality,
      traceability: bundle.traceability,
    };
  }

  /**
   * Evaluate WITH the optional AI critique seam. Without a wired port this
   * returns exactly what `evaluate` returns (deterministic); with a port the
   * live-provider critique augments the critic and quality is re-computed.
   */
  async evaluateWithAI(input: ExperienceEvaluateInput): Promise<ExperienceEvaluateDTO> {
    const bundle = await this.engine.evaluateWithAI({
      userId: input.userId,
      applicationId: input.applicationId,
      archetype: input.archetype as AppArchetype,
      designSpec: input.designSpec,
      files: input.files,
      securityFindings: input.securityFindings,
      validationEvidence: input.validationEvidence,
    });
    return {
      applicationId: bundle.applicationId,
      archetype: bundle.archetype,
      designSystem: bundle.designSystem,
      blueprint: bundle.blueprint,
      designDecisions: bundle.designDecisions,
      critic: bundle.critic,
      quality: bundle.quality,
      traceability: bundle.traceability,
    };
  }

  findings(input: ExperienceEvaluateInput): ExperienceFindingsDTO {
    const bundle = this.engine.evaluate({
      applicationId: input.applicationId,
      archetype: input.archetype as AppArchetype,
      designSpec: input.designSpec,
      files: input.files,
      securityFindings: input.securityFindings,
      validationEvidence: input.validationEvidence,
    });
    return { findings: this.engine.classify(bundle.critic.findings) };
  }

  refine(input: ExperienceRefineInput): ExperienceRefineDTO {
    const plan = this.engine.planRefinement({
      applicationId: input.applicationId,
      archetype: input.archetype as AppArchetype,
      findingId: input.findingId,
      designSpec: input.designSpec,
      files: input.files,
    });
    const span = this.telemetry.startSpan({
      name: 'experience.refine',
      kind: 'engine',
      applicationId: input.applicationId,
      attributes: {
        finding_id: plan.findingId,
        file_operations: plan.fileOperations.length,
        targeted: plan.impact.targeted,
        requires_approval: plan.requiresApproval,
      },
    });
    span.end();
    return { applicationId: input.applicationId, plan };
  }
}
