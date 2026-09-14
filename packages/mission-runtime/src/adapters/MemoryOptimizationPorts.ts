// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Memory & Optimization Port Adapters
// (BLD-022)
//
// Adapters over the FROZEN learning estate — no second memory system,
// no second optimization engine:
//   ExecutionMemoryPort        → ExecutionMemoryService.ingestRun (the
//                                 REAL sanitized run becomes the learning
//                                 evidence — no fabricated records).
//   ExperienceOptimizationPort → ExperienceOptimizationService.recommend.
// Both are ADVISORY ONLY (security invariants 6/7): nothing here can
// authorize a tool, widen a capability or override runtime truth; an
// advisory failure degrades to "no signal" and never breaks a mission.
//
// Association is keyed by mission/objective, not "last run": advisory
// learning must never cross mission or objective boundaries.
// ──────────────────────────────────────────────────────────────────

import { ExecutionMemoryService } from '@vedmoulya/execution-memory';
import { ExperienceOptimizationService } from '@vedmoulya/experience-optimization';
import type {
  ExecutionMemoryPort,
  ExperienceOptimizationPort,
  LearningContext,
  LearningEvidenceItem,
  LearningQuery,
  LearningRetrievalPort,
} from '@vedmoulya/mission-controller';
import type { RunRegistry } from './PlanningExecutionPorts.js';

export class MissionExecutionMemoryAdapter implements ExecutionMemoryPort {
  constructor(
    private readonly memory: ExecutionMemoryService,
    private readonly runs: RunRegistry,
  ) {}

  async recordVerifiedOutcome(
    missionId: string,
    objectiveId: string,
    outcome: { success: boolean; verified?: boolean; output?: string; evidence: string[] },
  ): Promise<void> {
    if (!outcome.success || outcome.verified !== true) return;
    await this.ingestObjectiveRun(missionId, objectiveId);
  }

  /**
   * AUTONOMY-06 — failed objective executions are learning evidence too.
   * The failed run is ingested through the SAME frozen learning cycle, which
   * deterministically derives negative signals (GOAL_FAILED / FAILED_PLAN /
   * TOOL_FAILURE / RECOVERY_FAILURE) from the run's actual outcome. Advisory:
   * recording never throws and never alters recovery semantics or budgets.
   */
  async recordFailedOutcome(
    missionId: string,
    objectiveId: string,
    _failure: { failureClass: string; reason: string; evidence: string[] },
  ): Promise<void> {
    try {
      await this.ingestObjectiveRun(missionId, objectiveId);
    } catch {
      // Learning evidence recording must never break a mission.
    }
  }

  /** Shared ingest over the REAL sanitized run for this objective. */
  private async ingestObjectiveRun(missionId: string, objectiveId: string): Promise<void> {
    const run = this.runs.forObjective(missionId, objectiveId);
    if (!run) return;
    try {
      await this.memory.ingestRun(run);
    } catch {
      // Learning evidence recording must never break a mission.
    }
  }
}

/**
 * AUTONOMY-06 — advisory learning retrieval over the EXISTING frozen
 * execution-memory service (retrieveForDecision). Bounded output (≤5 items,
 * compact evidence block), conflict-filtered against current runtime truth
 * (a tool that is currently unavailable can never be recommended by memory).
 * Retrieval is GUIDANCE for planning/diagnosis/repair ranking — it can never
 * bypass ToolRuntime, permissions, command catalog, budgets or verification.
 */
export class MissionLearningRetrievalAdapter implements LearningRetrievalPort {
  constructor(
    private readonly memory: ExecutionMemoryService,
    private readonly options: { availableTools?: () => string[] } = {},
  ) {}

  async relevantLearning(query: LearningQuery): Promise<LearningContext> {
    try {
      const block = await this.memory.retrieveForDecision(
        {
          tools: query.tools,
          capabilities: query.capabilities as import('@vedmoulya/ai').CapabilityType[],
          categories: [
            'RECOVERY_PATTERN',
            'TOOL_RELIABILITY',
            'PLAN_PATTERN',
            'TASK_PATTERN',
            'EXECUTION_PATTERN',
          ],
          limit: Math.min(Math.max(query.limit ?? 5, 1), 5),
        },
        { availableTools: this.options.availableTools?.() },
      );
      const items: LearningEvidenceItem[] = block.evidence.map((e) => ({
        category: e.category,
        scope: e.scope,
        subject: e.subject,
        predicate: e.predicate,
        value: e.value,
        confidenceLevel: e.confidenceLevel,
        sampleCount: e.sampleCount,
        successCount: e.successCount,
        failureCount: e.failureCount,
      }));
      return { items, text: block.text };
    } catch {
      // Advisory retrieval must never break planning.
      return { items: [], text: '' };
    }
  }
}

export class MissionExperienceOptimizationAdapter implements ExperienceOptimizationPort {
  constructor(private readonly optimization: ExperienceOptimizationService) {}

  async getAdvisorySignal(
    taskPattern: string,
    context: Record<string, unknown>,
  ): Promise<{
    recommendation?: string;
    confidence: number;
    evidenceCount: number;
    reason?: string;
  }> {
    try {
      const recommendation = await this.optimization.recommend('EXECUTION_SEQUENCE', {
        userId: typeof context.userId === 'string' ? context.userId : undefined,
      });
      if (!recommendation) {
        return {
          confidence: 0,
          evidenceCount: 0,
          reason: `no sufficient experience evidence yet for: ${taskPattern.slice(0, 120)}`,
        };
      }
      return {
        recommendation: recommendation.subject,
        confidence: recommendation.confidence.score,
        evidenceCount: 1,
        reason: recommendation.explanation[0] ?? 'evidence-backed advisory signal',
      };
    } catch (error) {
      return {
        confidence: 0,
        evidenceCount: 0,
        reason: `advisory unavailable: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
