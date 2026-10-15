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
  AgentExecutionService,
  AgentActionRecord,
  AgentObservation,
  AgentPlan,
  AgentRunBudgetConfig,
  ToolPermissionClass,
} from '@vedmoulya/agent-execution';
import { sanitizeTraceText } from '@vedmoulya/agent-execution';
import { PlanningApplicationService } from '@vedmoulya/planning';
import type {
  ExecutionPort,
  FailureContext,
  LearningContext,
  MissionObjective,
  PlanningPort,
  VerificationPort,
} from '@vedmoulya/mission-controller';
import type { MissionExecutionTrace } from '@vedmoulya/mission-controller';
import { permissionClassForTool } from './GovernedToolRegistry.js';
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

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

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
    // A step may also EXECUTE a tool through its verification policy
    // (`kind: 'command'`) — the frozen engine runs it through the same
    // governed tool runtime. It is therefore subject to the same mission
    // tool/class ceilings and must be scanned here; otherwise a plan could
    // run a tool the mission never granted under the cover of "verification".
    if (step.verificationPolicy?.kind === 'command') {
      names.add(step.verificationPolicy.command.toolName);
    }
  }
  // Goal-level verification can execute a tool too (same reasoning).
  if (plan.finalVerification?.kind === 'command') {
    names.add(plan.finalVerification.command.toolName);
  }
  return [...names];
}

/**
 * ExecutionPort over the frozen AgentExecutionService. Mission tool
 * constraints are enforced HERE before any execution (a plan selecting a
 * tool the mission does not allow fails with PERMISSION_DENIED and never
 * runs). Both ceilings are checked against every tool the plan can really
 * execute — action tools AND verification-command tools:
 *   • `allowedTools`             — tool NAMES the mission allows;
 *   • `grantedPermissionClasses` — permission CLASSES the mission was granted.
 * Run usage flows back to the controller's budget accounting.
 */
/**
 * PROVIDER-01 → Mission: resolves the OWNER's agent (bound to a per-user
 * orchestrator carrying that user's own credential-backed adapter) so an
 * objective executes on the provider the user actually connected. Absent →
 * the shared deployment agent (unchanged behavior).
 */
export type UserAgentResolver = (userId: string) => Promise<AgentExecutionService>;

export class AgentExecutionAdapter implements ExecutionPort {
  constructor(
    private readonly agent: AgentExecutionService,
    private readonly runs: RunRegistry,
    private readonly resolveUserAgent?: UserAgentResolver,
  ) {}

  async executePlan(
    plan: AgentPlan,
    userId: string,
    budget?: Partial<AgentRunBudgetConfig>,
    allowedTools?: string[],
    permissionClasses?: string[],
    executionContext?: { missionId: string; objectiveId: string },
  ): Promise<{
    runId: string;
    success: boolean;
    verified: boolean;
    output?: string;
    error?: string;
    failureClass?: string;
    trace?: MissionExecutionTrace;
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

    // S11 — the mission's declared PERMISSION-CLASS ceiling.
    //
    // `allowedTools` bounds tool NAMES; `grantedPermissionClasses` bounds the
    // CLASSES the mission was granted, and is enforced here — on the same
    // pre-execution boundary, before the agent is ever started. The class of a
    // tool is taken from the SAME governed classification table the registry
    // advertises (`permissionClassForTool`), so no class can be invented or
    // widened here; when the mission grants nothing, nothing may execute.
    //
    // Omitted (undefined) keeps the documented default: the mission declared
    // no class ceiling, so the frozen runtime's own permission model applies
    // unchanged. The check only ever RESTRICTS — it can never grant a class
    // the governing registry would not already have reported.
    if (permissionClasses !== undefined) {
      const grantedClasses = new Set(permissionClasses);
      const deniedClasses = planToolNames(plan).filter(
        (tool) => !grantedClasses.has(permissionClassForTool(tool)),
      );
      if (deniedClasses.length > 0) {
        return {
          runId: `rejected-${plan.planId}`,
          success: false,
          verified: false,
          error: `mission permission classes deny required tools: ${deniedClasses.join(', ')}`,
          failureClass: 'PERMISSION_DENIED',
          usage: ZERO_USAGE,
        };
      }
    }
    // PROVIDER-01 → Mission: when a user-scoped agent is wired, the run
    // executes on THAT user's orchestrator, so the generation is performed by
    // the adapter built from the same credential the user connected — never
    // another user's, never a deployment-wide key the user did not supply.
    const agent = this.resolveUserAgent ? await this.resolveUserAgent(userId) : this.agent;
    const run = await agent.start({
      userId,
      goal: plan.objective,
      plan,
      autonomyLevel: 'CONTROLLED_AUTONOMOUS',
      budget,
      // The Mission identity that already exists on this call is handed to the
      // run verbatim, so every AI execution inside the objective is attributed
      // to this real Mission + objective.
      ...(executionContext !== undefined ? { missionContext: executionContext } : {}),
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
      trace: {
        runId: run.runId,
        goalId: run.goalId,
        planId: run.planId,
        state: run.state,
        startedAt: run.createdAt,
        ...(run.finishedAt ? { finishedAt: run.finishedAt } : {}),
        usage: {
          tokens: run.usage.tokensUsed,
          costUsd: run.usage.costUsd,
          latencyMs: run.usage.latencyMs,
          toolCalls: run.usage.toolCalls,
          attempts: run.usage.attempts,
          revisions: run.usage.revisions,
        },
        actions: safeArray<AgentExecutionRun['stepResults'][number]>(run.stepResults)
          .flatMap((step) =>
            safeArray<AgentActionRecord>(step.actions).map((action) => ({
              actionId: action.actionId,
              stepId: action.stepId,
              attempt: action.attempt,
              status: action.status,
              startedAt: action.startedAt,
              endedAt: action.endedAt,
              ...(action.observationId ? { observationId: action.observationId } : {}),
              ...(action.provider ? { provider: action.provider } : {}),
              ...(action.model ? { model: action.model } : {}),
              ...(action.toolName ? { toolName: action.toolName } : {}),
              ...(action.error
                ? { error: sanitizeTraceText(action.error, { maxLength: 400 }) }
                : {}),
              artifacts: safeArray<AgentObservation>(step.observations)
                .filter((observation) => observation.actionId === action.actionId)
                .flatMap((observation) => observation.artifacts)
                .slice(0, 20)
                .map((artifact) => ({
                  name: sanitizeTraceText(artifact.name, { maxLength: 120 }),
                  type: sanitizeTraceText(artifact.type, { maxLength: 80 }),
                })),
            })),
          )
          .slice(-200),
        observations: safeArray<AgentExecutionRun['stepResults'][number]>(run.stepResults)
          .flatMap((step) => safeArray<AgentObservation>(step.observations))
          .slice(-200)
          .map((observation) => ({
            observationId: observation.observationId,
            actionId: observation.actionId,
            stepId: observation.stepId,
            attempt: observation.attempt,
            status: observation.status,
            observedAt: observation.observedAt,
            ...(observation.provider ? { provider: observation.provider } : {}),
            ...(observation.model ? { model: observation.model } : {}),
            ...(observation.toolName ? { toolName: observation.toolName } : {}),
          })),
      },
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
