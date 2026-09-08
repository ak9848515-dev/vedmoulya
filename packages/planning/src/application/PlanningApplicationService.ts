// ──────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Planning Intelligence: Application Service
//
//   USER GOAL → GOAL UNDERSTANDING → PLAN GENERATION → VALIDATION →
//   READINESS → (READY only) → EXISTING AGENT EXECUTION ENGINE
//
// The planner PROPOSES. The execution engine executes. Governance
// authorizes. Verification determines evidence of success. This service
// is the clean composition seam: it hands a READY AgentPlan to the
// frozen AgentExecutionService (never bypassing its validation,
// security chain, approval gates or budget) and returns the run.
//
// No public API router is added in this sprint — this is the
// domain/application boundary; a router can be added later.
// ──────────────────────────────────────────────────────────────────

import type { AgentExecutionService } from '@vedmoulya/agent-execution';
import type { AgentClockPort } from '@vedmoulya/agent-execution';
import { PlannerService, type GeneratePlanInput } from '../domain/planner-service.js';
import type { PlannerAiPort, AgentToolRegistryPort } from '../contracts/planning-ports.js';
import type {
  PlanAndExecuteInput,
  PlanAndExecuteResult,
  PlanGenerationResult,
} from '../types/planning-types.js';

export interface PlanningApplicationServiceOptions {
  planner?: PlannerService;
  /** The frozen execution service — delegated to ONLY for READY plans. */
  executor?: AgentExecutionService;
  ai?: PlannerAiPort;
  toolRegistry?: AgentToolRegistryPort;
  clock?: AgentClockPort;
}

export class PlanningApplicationService {
  private readonly planner: PlannerService;
  private readonly executor?: AgentExecutionService;

  constructor(options: PlanningApplicationServiceOptions = {}) {
    this.planner =
      options.planner ??
      new PlannerService({
        ai: options.ai,
        toolRegistry: options.toolRegistry,
        clock: options.clock,
      });
    this.executor = options.executor;
  }

  /** Plan only: GOAL → UNDERSTANDING → PLAN → VALIDATION → READINESS. */
  async generatePlan(input: GeneratePlanInput): Promise<PlanGenerationResult> {
    const output = await this.planner.generatePlan(input);
    return output.result;
  }

  /**
   * Plan and execute: only a READY plan is handed to the frozen
   * AgentExecutionService. A BLOCKED plan is never executed.
   */
  async planAndExecute(input: PlanAndExecuteInput): Promise<PlanAndExecuteResult> {
    const output = await this.planner.generatePlan({
      userId: input.userId,
      goal: input.goal,
      context: input.context,
      constraints: input.constraints,
      mode: input.mode,
    });
    const { understanding, result } = output;

    if (result.readiness.status !== 'READY' || result.plan === undefined) {
      return { understanding, planResult: result };
    }

    if (!this.executor) {
      return { understanding, planResult: result };
    }

    // The plan is READY — the frozen execution kernel is authoritative from
    // here on (it re-validates structurally + feasibility before any step
    // runs, enforces the security chain, approval gates and budgets).
    const run = await this.executor.start({
      userId: input.userId,
      goal: result.originalGoal,
      goalId: understanding.goalId,
      plan: result.plan,
      autonomyLevel: understanding.autonomyLevel,
      budget: understanding.budget,
    });

    return {
      understanding,
      planResult: result,
      execution: { run, usage: run.usage },
    };
  }
}
