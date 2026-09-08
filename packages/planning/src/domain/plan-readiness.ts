// ──────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Planning Intelligence: Plan Readiness
//
// A clear, deterministic, explainable readiness result. A plan is READY
// only when NO error-severity validation issue exists — missing
// capability, unavailable tool, insufficient permission, impossible
// dependency, invalid verification policy, budget exceeded and
// unsupported execution requirements all produce BLOCKED with reasons.
//
// Feasibility (can this capability set be routed today? is this tool
// available?) is delegated to the frozen estate: the execution engine's
// validatePlanReadiness over the SAME AgentAiExecutionPort.canRoute
// contract the runtime implements — the planner never guesses routing
// or tool availability and never waits until execution to discover
// obvious impossibilities.
// ──────────────────────────────────────────────────────────────────

import type { PlanValidationIssue } from '@vedmoulya/agent-execution';
import { validatePlanReadiness } from '@vedmoulya/agent-execution';
import type { AgentPlan } from '@vedmoulya/agent-execution';
import type { AgentToolRegistryPort } from '../contracts/planning-ports.js';
import type { PlanReadiness, PlanReadinessIssue } from '../types/planning-types.js';

export interface ReadinessPorts {
  /** Feasibility shim over the planner's AI port (canRoute only). */
  ai?: {
    canRoute(input: {
      capability: string;
      requiredCapabilities?: string[];
    }): Promise<{ ok: boolean; reason?: string }>;
  };
  toolRegistry?: AgentToolRegistryPort;
}

/**
 * Compute the deterministic readiness result for a generated plan.
 * `issues` are the validation-pipeline issues (errors + warnings);
 * feasibility issues from the frozen validator are appended, then every
 * issue is deduplicated by (code, stepId, message). BLOCKED iff any
 * error-severity issue remains.
 */
export async function computePlanReadiness(
  plan: AgentPlan,
  issues: PlanValidationIssue[],
  ports: ReadinessPorts,
): Promise<PlanReadiness> {
  const readinessIssues = new Map<string, PlanReadinessIssue & { severity: 'error' | 'warning' }>();

  const addIssue = (issue: PlanValidationIssue): void => {
    const key = `${issue.code}|${issue.stepId ?? ''}|${issue.message}`;
    if (!readinessIssues.has(key)) {
      readinessIssues.set(key, {
        code: issue.code,
        stepId: issue.stepId,
        reason: issue.message,
        severity: issue.severity,
      });
    }
  };

  // Validation-pipeline issues (deterministic).
  for (const issue of issues) {
    addIssue(issue);
  }

  // Feasibility from the frozen estate (routing + tool availability). The
  // frozen validator only ever consumes `ai.canRoute` (it never executes) —
  // the cast adapts the planner's narrow proposal port to the execution
  // port's type without fabricating an `execute` implementation.
  const aiShim = ports.ai
    ? {
        canRoute: async (input: {
          capability: import('@vedmoulya/ai').CapabilityType;
          requiredCapabilities?: import('@vedmoulya/ai').CapabilityType[];
        }): Promise<{ ok: boolean; reason?: string }> => {
          const result = await (ports.ai as NonNullable<ReadinessPorts['ai']>).canRoute(input);
          return result;
        },
      }
    : undefined;
  const feasibility = await validatePlanReadiness(plan, {
    ai: aiShim as import('@vedmoulya/agent-execution').AgentAiExecutionPort | undefined,
    toolRegistry: ports.toolRegistry,
  });
  for (const issue of feasibility) {
    addIssue(issue);
  }

  const all = [...readinessIssues.values()].map(({ severity: _severity, ...issue }) => issue);
  const blockedReasons = [...readinessIssues.values()]
    .filter((issue) => issue.severity === 'error')
    .map((issue) => issue.reason);

  return {
    status: blockedReasons.length > 0 ? 'BLOCKED' : 'READY',
    issues: all,
    blockedReasons,
  };
}

/** Blocking codes a caller may surface (stable, explainable). */
export const READINESS_BLOCK_CODES = new Set([
  'UNKNOWN_CAPABILITY',
  'TOOL_UNAVAILABLE',
  'TOOL_NOT_PERMITTED',
  'INSUFFICIENT_PERMISSION',
  'TOOL_REGISTRY_REQUIRED',
  'DEPENDENCY_UNKNOWN',
  'DEPENDENCY_CYCLE',
  'STEP_DUPLICATE_ID',
  'STEP_NO_ACTIONS',
  'PLAN_EMPTY',
  'INVALID_VERIFICATION_POLICY',
  'BUDGET_EXCEEDED',
  'PLAN_TOO_LARGE',
  'RECOVERY_UNBOUNDED',
  'CAPABILITY_NOT_ROUTABLE',
  'PLAN_GENERATION_FAILED',
  'CLARIFICATION_REQUIRED',
]);
