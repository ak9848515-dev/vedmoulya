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
    const run = this.runs.forObjective(missionId, objectiveId);
    if (!run) return;
    try {
      await this.memory.ingestRun(run);
    } catch {
      // Learning evidence recording must never break a mission.
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
