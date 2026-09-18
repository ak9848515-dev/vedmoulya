// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Planning / Execution / Verification
// Port Adapters (BLD-022)
//
// These adapters make the FROZEN mission ports speak to the FROZEN
// foundations:
//   PlanningPort        → PlanningApplicationService (planning package)
//   ExecutionPort       → AgentExecutionService (agent-execution package)
//   VerificationPort    → the REAL execution run's verification results
//   GoalUnderstandingPort → the frozen SimpleGoalUnderstanding (reused)
// No planner, loop, verifier or registry is duplicated. Verification
// truth comes from the executed run — planning can never self-approve,
// the model can never declare success, and a missing run verifies false.
// ──────────────────────────────────────────────────────────────────

import type {
  AgentExecutionRun,
  AgentPlan,
  AgentRunBudgetConfig,
  ToolPermissionClass,
} from '@vedmoulya/agent-execution';
import { PlanningApplicationService } from '@vedmoulya/planning';
import type {
  ExecutionPort,
  FailureContext,
  LearningContext,
  MissionObjective,
  PlanningPort,
  VerificationPort,
} from '@vedmoulya/mission-controller';
import { sanitizePlanningGoal } from './WorkspaceDevTemplate.js';

/** Bounded in-process registry of the runs executed by this runtime. */
export class RunRegistry {
  private readonly runs = new Map<string, AgentExecutionRun>();
  private readonly objectiveRuns = new Map<string, string>();
  private lastRunId: string | undefined;
  private readonly maxRuns = 50;

  remember(run: AgentExecutionRun, context?: { missionId: string; objectiveId: string }): void {
    if (this.runs.size >= this.maxRuns) {
      const oldest = this.runs.keys().next().value;
      if (oldest !== undefined) this.runs.delete(oldest);
    }
    this.runs.set(run.runId, run);
    if (context) this.objectiveRuns.set(`${context.missionId}:${context.objectiveId}`, run.runId);
    this.lastRunId = run.runId;
  }

  get(runId: string): AgentExecutionRun | undefined {
    return this.runs.get(runId);
  }

  last(): AgentExecutionRun | undefined {
    return this.lastRunId ? this.runs.get(this.lastRunId) : undefined;
  }

  forObjective(missionId: string, objectiveId: string): AgentExecutionRun | undefined {
    const runId = this.objectiveRuns.get(`${missionId}:${objectiveId}`);
    return runId === undefined ? undefined : this.runs.get(runId);
  }
}

const ZERO_USAGE = { tokens: 0, costUsd: 0, latencyMs: 0, toolCalls: 0 };

/**
 * PlanningPort over the frozen PlanningApplicationService. Deterministic
 * mode by default (templates); every returned plan is the planner's own
 * validated output. The execution engine re-validates feasibility itself,
 * so a plan whose readiness flagged issues is still handed over honestly —
 * the engine (not the planner) is the execution truth. A plan that could
 * not be generated at all (ambiguous/placeholder goal) throws an explicit
 * error — never fabricated.
 */
export class MissionPlanningAdapter implements PlanningPort {
  constructor(
    private readonly planning: PlanningApplicationService,
    private readonly options: {
      userId?: string;
      /**
       * FINAL-02 — the permission classes this mission principal actually
       * holds. Supplied by the production composition from the SAME governed
       * registry that classifies the real tools (never hard-coded here), so
       * a plan may only select a tool whose real class the principal was
       * granted. Defaults to READ+WRITE: without an explicit grant the
       * planner cannot reach EXECUTE tools such as the governed command
       * tool, and validation rejects any plan that tries.
       */
      grantedPermissionClasses?: readonly string[];
      /** Bounded plan size for this principal. */
      maxSteps?: number;
      /**
       * FINAL-02 — the mission's real run-budget envelope (merged over the
       * frozen defaults). The repository-development path executes several
       * real tool actions, which needs more than the frozen 8-tool-call
       * default; the mission declares its honest envelope here. Every other
       * bound (attempts, revisions, tokens, cost, latency) is preserved.
       */
      budget?: Partial<AgentRunBudgetConfig>;
    } = {},
  ) {}

  /**
   * AUTONOMY-02 + AUTONOMY-06 — the planner's advisory context. The
   * AUTONOMY-02 failure context (WHY the previous attempt failed) and the
   * AUTONOMY-06 bounded verified learning are folded into the planning
   * package's `context` field as bounded advisory text. The planner still
   * validates capabilities/tools/permissions/verification/budgets through
   * its frozen pipeline — this text can never widen authority.
   */
  async createPlan(
    goal: string,
    requiredCapabilities: string[],
    constraints: string[],
    failureContext?: FailureContext,
    learning?: LearningContext,
  ): Promise<AgentPlan> {
    const context = buildPlanningContext(constraints, failureContext, learning);
    const result = await this.planning.generatePlan({
      userId: this.options.userId,
      goal: sanitizePlanningGoal(goal),
      ...(context !== undefined ? { context } : {}),
      mode: 'deterministic',
      constraints: {
        maxSteps: this.options.maxSteps ?? 8,
        autonomyLevel: 'CONTROLLED_AUTONOMOUS',
        // FINAL-02 — the repository-development path executes REAL governed
        // tool actions (write + read-back + up to three real command runs,
        // each with bounded retries). The frozen default envelope (8 tool
        // calls) is honestly insufficient for that plan, so the mission
        // declares its real envelope here. It is a bounded ceiling, not a
        // grant: the engine still enforces it, and every other limit
        // (attempts/revisions/tokens/cost/latency) is untouched.
        budget: this.options.budget ?? { maxToolCalls: 24 },
        // FINAL-02 — the granted classes come from the production principal
        // (composition → governed registry classification), never from this
        // adapter. A class the principal does not hold cannot be reached.
        grantedPermissionClasses: (this.options.grantedPermissionClasses ?? [
          'READ',
          'WRITE',
        ]) as ToolPermissionClass[],
      },
    });
    if (result.plan) return result.plan;
    const reasons =
      result.readiness.blockedReasons.join('; ') || 'plan generation produced no plan';
    throw new Error(`Plan blocked: ${reasons}`);
  }
}

/** Bounded advisory context passed to the frozen planning pass. */
const MAX_CONTEXT_CHARS = 2_000;

function buildPlanningContext(
  constraints: string[],
  failureContext?: FailureContext,
  learning?: LearningContext,
): string | undefined {
  const lines: string[] = [];
  for (const constraint of constraints.slice(0, 8)) {
    lines.push(`constraint: ${constraint}`);
  }
  if (failureContext) {
    lines.push(
      `[failure-context] previous attempt failed with ${failureContext.failureClass} (${failureContext.suggestedAction}): ${failureContext.reason}`,
    );
    for (const item of failureContext.evidence.slice(0, 5)) {
      lines.push(`[failure-context] evidence: ${item}`);
    }
    if (failureContext.executionError) {
      lines.push(`[failure-context] previous error: ${failureContext.executionError}`);
    }
    if (failureContext.verificationResult) {
      lines.push(
        `[failure-context] previous verification: verified=${String(failureContext.verificationResult.verified)} (${failureContext.verificationResult.method})`,
      );
    }
    lines.push('[failure-context] advisory only — current repository state stays authoritative');
  }
  if (learning && learning.text.length > 0) {
    lines.push(`[learning][advisory] verified historical guidance (never authority):`);
    lines.push(learning.text);
  }
  if (lines.length === 0) return undefined;
  let text = lines.join('\n');
  if (text.length > MAX_CONTEXT_CHARS) {
    text = `${text.slice(0, MAX_CONTEXT_CHARS)}…`;
  }
  return text;
}

/**
 * Semantic failure class for a blocked run. "Unavailable" reasons mean a
 * required capability genuinely cannot be served today (missing tool,
 * unroutable capability) → CAPABILITY_UNAVAILABLE; everything else the
 * security chain denied → PERMISSION_DENIED. The mission's failure
 * classifier maps both to non-recoverable (never blind-retried).
 */
function blockedRunFailureClass(reasons: string[]): 'CAPABILITY_UNAVAILABLE' | 'PERMISSION_DENIED' {
  const text = reasons.join('; ').toLowerCase();
  const capabilityUnavailable =
    text.includes('unavailable') ||
    text.includes('not available') ||
    text.includes('not configured') ||
    text.includes('no eligible');
  return capabilityUnavailable ? 'CAPABILITY_UNAVAILABLE' : 'PERMISSION_DENIED';
}

/** Collect every tool a plan selects (bounded). */
export function planToolNames(plan: AgentPlan): string[] {
  const names = new Set<string>();
  for (const step of plan.steps) {
    for (const action of step.actions) {
      if (action.kind === 'tool' && action.toolName) names.add(action.toolName);
    }
  }
  return [...names];
}

/**
 * ExecutionPort over the frozen AgentExecutionService. Mission tool
 * constraints are enforced HERE before any execution (a plan selecting a
 * tool the mission does not allow fails with PERMISSION_DENIED and never
 * runs). Run usage flows back to the controller's budget accounting.
 */
export class AgentExecutionAdapter implements ExecutionPort {
  constructor(
    private readonly agent: import('@vedmoulya/agent-execution').AgentExecutionService,
    private readonly runs: RunRegistry,
  ) {}

  async executePlan(
    plan: AgentPlan,
    userId: string,
    budget?: Partial<AgentRunBudgetConfig>,
    allowedTools?: string[],
    _permissionClasses?: string[],
    executionContext?: { missionId: string; objectiveId: string },
  ): Promise<{
    runId: string;
    success: boolean;
    verified: boolean;
    output?: string;
    error?: string;
    failureClass?: string;
    usage: { tokens: number; costUsd: number; latencyMs: number; toolCalls: number };
  }> {
    if (allowedTools) {
      const allowed = new Set(allowedTools);
      const denied = planToolNames(plan).filter((tool) => !allowed.has(tool));
      if (denied.length > 0) {
        return {
          runId: `rejected-${plan.planId}`,
          success: false,
          verified: false,
          error: `mission constraints deny required tools: ${denied.join(', ')}`,
          failureClass: 'PERMISSION_DENIED',
          usage: ZERO_USAGE,
        };
      }
    }
    const run = await this.agent.start({
      userId,
      goal: plan.objective,
      plan,
      autonomyLevel: 'CONTROLLED_AUTONOMOUS',
      budget,
    });
    this.runs.remember(run, executionContext);
    const success = run.state === 'COMPLETED';
    const verified =
      success && run.stepResults.length > 0 && run.stepResults.every((step) => step.verified);
    // FINAL-03A — a FAILED_FINAL run means the objective's plan did NOT reach
    // an achieved, verified outcome. Reporting every FAILED_FINAL as `UNKNOWN`
    // threw that semantic away and let the controller classify a real
    // verification failure as a generic transient error — burning retries on
    // an identical plan that can never pass, instead of entering the existing
    // revision/repair path. A run that ended in an explicitly REJECTED
    // approval is a deliberate operator decision, not a verification failure,
    // so it keeps the pre-FINAL-03A delegation to the frozen classifier; every
    // other FAILED_FINAL is the honest VERIFICATION_FAILURE of the objective.
    const approvalRejected = run.approvalDecisions.some(
      (decision) => decision.decision === 'rejected',
    );
    const failureClass =
      run.state === 'BLOCKED'
        ? blockedRunFailureClass(run.outcomeReasons)
        : run.state === 'FAILED_FINAL' && !approvalRejected
          ? 'VERIFICATION_FAILURE'
          : undefined;
    const output = [...run.stepResults].reverse().find((step) => step.output)?.output;
    const error =
      run.error ??
      (success
        ? undefined
        : `run ended in ${run.state}: ${run.outcomeReasons.join('; ') || 'no reasons recorded'}`);
    return {
      runId: run.runId,
      success,
      verified,
      output,
      error,
      failureClass,
      usage: {
        tokens: run.usage.tokensUsed,
        costUsd: run.usage.costUsd,
        latencyMs: run.usage.latencyMs,
        toolCalls: run.usage.toolCalls,
      },
    };
  }
}

/**
 * VerificationPort driven by the REAL executed run. The verification layer
 * remains the authority for completion: no run → not verified (never
 * fabricated); a completed run with any unverified step → not verified.
 */
export class RunVerificationAdapter implements VerificationPort {
  private readonly maxEvidence = 20;

  constructor(private readonly runs: RunRegistry) {}

  async verifyObjective(
    objective: MissionObjective,
    executionResult: { output?: string; success: boolean },
  ): Promise<{ verified: boolean; evidence: string[]; method: string }> {
    const method = 'agent_execution_verification';
    const run = objective.executionRunId ? this.runs.get(objective.executionRunId) : undefined;
    if (!run) {
      return {
        verified: false,
        evidence: ['no execution run recorded for this objective — nothing to verify'],
        method,
      };
    }
    if (!executionResult.success) {
      return {
        verified: false,
        evidence: [`execution did not complete: ${executionResult.output ?? run.state}`],
        method,
      };
    }
    const evidence: string[] = [];
    for (const step of run.stepResults.slice(0, this.maxEvidence)) {
      evidence.push(
        `step ${step.stepId}: status=${step.status} verified=${String(step.verified)} attempts=${String(step.attempts)}`,
      );
    }
    if (run.outcome) evidence.push(`run outcome: ${run.outcome}`);
    for (const reason of run.outcomeReasons.slice(0, 5)) evidence.push(`run reason: ${reason}`);
    const verified =
      run.state === 'COMPLETED' &&
      run.stepResults.length > 0 &&
      run.stepResults.every((step) => step.verified);
    if (!verified && evidence.length < this.maxEvidence) {
      evidence.push('verification failed: not every executed step verified');
    }
    return { verified, evidence, method };
  }
}
