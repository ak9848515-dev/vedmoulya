// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Optimization: Integration Adapters
//
// Thin advisory consumers for the planner, the adaptive loop and the
// router. Every surface here is ADVISORY ONLY:
//   - the planner MUST still validate capabilities/tools/permissions/
//     verification/budgets/readiness itself;
//   - the adaptive loop MUST still route every action through the
//     ToolRuntime / AIOrchestrationService security chains;
//   - the router (ProviderRoutingAdvisor) remains authoritative for
//     provider/model selection — current health and measured evidence
//     always override stale experience.
// No adapter modifies executable code, configuration, permissions,
// governance or budgets.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type {
  ExperienceOptimizationService,
  RoutingExperienceSignal,
} from '../application/ExperienceOptimizationService.js';
import type {
  OptimizationContext,
  StrategyRecommendation,
} from '../types/experience-optimization-types.js';

// ── Planner advisory (Phase 7) ────────────────────────────────────

export interface PlanStrategyAdvisory {
  planPattern?: StrategyRecommendation;
  toolSelection?: StrategyRecommendation;
  sequence?: StrategyRecommendation;
  /** Bounded advisory text the planner may use as context (never injected blindly). */
  summary: string;
  advisory: true;
}

export class PlanningExperienceAdapter {
  constructor(private readonly service: ExperienceOptimizationService) {}

  /** Advisory plan-pattern / tool / sequence evidence for a goal (planner still validates everything). */
  async advisoryForPlanning(context: OptimizationContext = {}): Promise<PlanStrategyAdvisory> {
    const [planPattern, toolSelection, sequence] = await Promise.all([
      this.service.recommend('PLAN_PATTERN', context),
      this.service.recommend('TOOL_SELECTION', context),
      this.service.recommend('EXECUTION_SEQUENCE', context),
    ]);
    const summary = this.summarize([planPattern, toolSelection, sequence]);
    return { planPattern, toolSelection, sequence, summary, advisory: true };
  }

  private summarize(recommendations: (StrategyRecommendation | undefined)[]): string {
    const lines = recommendations
      .filter((r): r is StrategyRecommendation => r !== undefined)
      .map((r) => `${r.target}: prefer "${r.subject}" (${r.evidenceLevel.toLowerCase()})`);
    return lines.length === 0 ? 'no sufficient strategy evidence available' : lines.join('; ');
  }
}

// ── Adaptive-loop advisory (Phase 12) ─────────────────────────────

export interface FailureAdvisory {
  recovery?: StrategyRecommendation;
  alternateTools: StrategyRecommendation[];
  summary: string;
  advisory: true;
}

export class AdaptiveExperienceAdapter {
  constructor(private readonly service: ExperienceOptimizationService) {}

  /** After a failed action: advisory recovery + alternate tool suggestions (loop still validates/authorizes). */
  async advisoryForFailure(input: {
    failureClass?: string;
    capability?: CapabilityType;
    failedTool?: string;
    allowedTools?: string[];
    runtimeTruth?: OptimizationContext['runtimeTruth'];
  }): Promise<FailureAdvisory> {
    const baseContext: OptimizationContext = {
      capabilities: input.capability === undefined ? undefined : [input.capability],
      runtimeTruth: input.runtimeTruth,
      constraints: { allowedSubjects: input.allowedTools },
    };
    const [recovery, toolRec] = await Promise.all([
      this.service.recommend('RECOVERY_STRATEGY', baseContext),
      this.service.recommend('TOOL_SELECTION', baseContext),
    ]);
    const alternateTools: StrategyRecommendation[] = [];
    if (
      toolRec !== undefined &&
      input.failedTool !== undefined &&
      toolRec.subject !== input.failedTool
    ) {
      alternateTools.push(toolRec);
    }
    const topAlternate = alternateTools[0];
    const summary =
      [
        recovery !== undefined
          ? `recovery: prefer "${recovery.subject}" (${recovery.evidenceLevel.toLowerCase()})`
          : undefined,
        topAlternate !== undefined ? `alternate tool: "${topAlternate.subject}"` : undefined,
      ]
        .filter((s): s is string => s !== undefined)
        .join('; ') || 'no sufficient strategy evidence available';
    return { recovery, alternateTools, summary, advisory: true };
  }
}

// ── Router advisory (Phase 11 — advisory ONLY) ────────────────────

export class RoutingExperienceAdapter {
  constructor(private readonly service: ExperienceOptimizationService) {}

  /** Advisory provider/model signal for the EXISTING router. Never authoritative. */
  async routingAdvisory(
    context: OptimizationContext = {},
  ): Promise<RoutingExperienceSignal | undefined> {
    return this.service.routingSignal(context);
  }
}
