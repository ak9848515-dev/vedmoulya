// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Execution Bridge Ports (EPIC-014)
// Adapters that connect the frozen @vedmoulya/execution-bridge engine to the
// existing gateway services. No new provider SDKs, no duplicate routing:
//   • provider execution → the SAME AIOrchestratorSpecialistPort the loop and
//     factory use (AI-SELECT routing, evidence-first, retry/fallback,
//     structured validation, telemetry) — inherited by construction.
//   • plan source → the REAL EPIC-013 CapabilityMarketplaceApplicationService
//     (plans are owner-scoped there; the run never invents a plan).
//   • budget → env-tunable hard limits consumed by the LoopBudget wrapper.
// ─────────────────────────────────────────────────────────────────────────────

import type { AIOrchestrationService } from '@vedmoulya/services';
import type { CapabilityType } from '@vedmoulya/ai';
import { AIOrchestratorSpecialistPort } from '@vedmoulya/loop-engine';
import type {
  CapabilityMarketplaceApplicationService,
  FactoryCapabilityPlan,
} from '@vedmoulya/capability-marketplace';
import type {
  ExecutionBudgetConfig,
  PlanSource,
  StepExecutionPort,
  StepExecutionResult,
} from '@vedmoulya/execution-bridge';

/**
 * The ONLY way an executable plan step talks to a provider. Delegates to the
 * frozen specialist port over the AI runtime — the step's mapped runtime
 * capability is executed with the plan's own instruction text. Availability
 * is honest: unmapped capabilities report unavailable (the resolver already
 * excluded them, so this is a belt-and-braces guard).
 */
export function createStepExecutionPort(ai: AIOrchestrationService): StepExecutionPort {
  const specialist = new AIOrchestratorSpecialistPort(ai);
  return {
    availability: (capability, runtimeCapability): { available: boolean; reason?: string } => {
      if (!runtimeCapability) {
        return { available: false, reason: `no runtime execution path for ${capability}` };
      }
      return { available: true };
    },
    execute: async (input): Promise<StepExecutionResult> => {
      try {
        const result = await specialist.execute({
          taskId: `execution-step-${input.stepId}`,
          capability: input.runtimeCapability as CapabilityType,
          qualityTier: 'standard',
          userInput: input.instruction,
          userId: input.userId,
          constraints: {
            maxInputTokens: 4_000,
            maxOutputTokens: input.expectedOutputTokens ?? 2_000,
          },
        });
        return {
          ok: !result.abstained,
          content: result.content,
          provider: result.provider,
          model: result.model,
          tokens: result.tokens,
          costUsd: result.costUsd,
          latencyMs: result.latencyMs,
          abstained: result.abstained,
          validationDecision: result.validationDecision,
          error: result.abstained ? 'runtime abstained (evidence-first)' : undefined,
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * The run consumes the REAL EPIC-013 plan: owner-scoped fetch through the
 * existing capability service (IDOR refused there). A missing plan is an
 * honest "plan not found", never a fabricated plan.
 */
export function createExecutionPlanSource(
  capability: CapabilityMarketplaceApplicationService,
): PlanSource {
  return {
    getPlan: async (ownerId, planId): Promise<FactoryCapabilityPlan | undefined> => {
      const plan = await capability.getPlan(ownerId, planId);
      return plan ?? undefined;
    },
  };
}

/**
 * Hard execution limits consumed by the LoopBudget-backed RunBudgetGuard.
 * Env-tunable (AI_EXECUTION_MAX_*); fail-closed — a budget breach BLOCKS the
 * run, it is never silently exceeded.
 */
export function createExecutionBudgetConfig(): ExecutionBudgetConfig {
  const readNumber = (name: string, fallback: number): number => {
    // eslint-disable-next-line security/detect-object-injection -- Environment variable lookup by a fixed internal name (never user-controlled).
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    maxIterations: readNumber('AI_EXECUTION_MAX_ITERATIONS', 50),
    maxTokens: readNumber('AI_EXECUTION_MAX_TOKENS', 100_000),
    maxCostUsd: readNumber('AI_EXECUTION_MAX_COST_USD', 5),
    maxLatencyMs: readNumber('AI_EXECUTION_MAX_LATENCY_MS', 600_000),
  };
}
