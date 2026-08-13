// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Mapper
// EPIC-009 — maps engine sessions to the requirements.* DTO boundary.
// The session is the documented contract; the mapper guarantees a
// stable, clone-safe shape for the gateway.
// ──────────────────────────────────────────────────────────────────

import type { RequirementSession } from '../types/requirement-types.js';
import type {
  RequirementsApproveDTO,
  RequirementsSessionDTO,
  RequirementsSessionSummaryDTO,
  RequirementsStartDTO,
} from './RequirementsDTO.js';

export class RequirementsMapper {
  toStartDTO(session: RequirementSession): RequirementsStartDTO {
    const bundles = session.questionPlan?.bundles ?? [];
    return {
      sessionId: session.sessionId,
      phase: session.phase,
      idea: session.idea,
      questionBundles: bundles,
      blockingCount: session.questionPlan?.blocking.length ?? 0,
      importantCount: session.questionPlan?.important.length ?? 0,
      defaultsCount: (session.defaults ?? []).filter((d) => d.status === 'proposed').length,
      completenessReady: session.completeness?.ready ?? false,
      criticalUnknowns: session.completeness?.criticalUnknowns ?? [],
    };
  }

  toSessionDTO(session: RequirementSession): RequirementsSessionDTO {
    return structuredClone({
      sessionId: session.sessionId,
      owner: session.owner,
      idea: session.idea,
      phase: session.phase,
      intent: session.intent,
      requirements: session.requirements,
      graph: session.graph,
      ambiguity: session.ambiguity,
      questionPlan: session.questionPlan,
      defaults: session.defaults,
      completeness: session.completeness,
      conflicts: session.conflicts,
      brief: session.brief,
      journeys: session.journeys,
      experience: session.experience,
      design: session.design,
      architecture: session.architecture,
      aiStrategy: session.aiStrategy,
      ragStrategy: session.ragStrategy,
      toolStrategy: session.toolStrategy,
      security: session.security,
      cost: session.cost,
      buildPlan: session.buildPlan,
      review: session.review,
      traceability: session.traceability,
      changeImpacts: session.changeImpacts,
      versions: session.versions,
      handoffGoal: session.handoffGoal,
      enrichment: session.enrichment,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    } satisfies RequirementsSessionDTO);
  }

  toSummaryDTO(session: RequirementSession): RequirementsSessionSummaryDTO {
    return {
      sessionId: session.sessionId,
      idea: session.idea,
      phase: session.phase,
      archetype: session.intent?.archetype,
      confirmedRequirements:
        session.requirements?.requirements.filter((r) => r.status === 'CONFIRMED').length ?? 0,
      criticalUnknowns: session.completeness?.criticalUnknowns.length ?? 0,
      completenessReady: session.completeness?.ready ?? false,
      updatedAt: session.updatedAt,
    };
  }

  toApproveDTO(session: RequirementSession): RequirementsApproveDTO {
    return {
      sessionId: session.sessionId,
      phase: session.phase,
      approvedAt: session.review?.approvedAt,
      handoffGoal: session.handoffGoal,
    };
  }
}
