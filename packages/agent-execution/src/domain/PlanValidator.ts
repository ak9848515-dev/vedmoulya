// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Plan Validation
//
// A plan must never execute an impossible step. Validation happens BEFORE
// execution:
//   - structural  (duplicate ids, unknown dependencies, cycles, empty
//     actions, tool actions outside the step allowlist) — errors block the
//     whole plan;
//   - feasibility (capability routable through the AI runtime, tool
//     available on the platform) — errors block the STEP (it never runs);
//     sibling steps may still execute honestly.
// ──────────────────────────────────────────────────────────────────

import type {
  AgentAiExecutionPort,
  AgentToolRegistryPort,
} from '../contracts/agent-execution-ports.js';
import type {
  AgentActionSpec,
  AgentPlan,
  PlanValidationIssue,
} from '../types/agent-execution-types.js';

export interface ReadinessPorts {
  ai?: AgentAiExecutionPort;
  toolRegistry?: AgentToolRegistryPort;
}

/** Structural validation — no ports needed, fully deterministic. */
export function validatePlanStructure(plan: AgentPlan): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = [];

  if (plan.steps.length === 0) {
    issues.push({
      severity: 'error',
      code: 'PLAN_EMPTY',
      message: 'plan has no steps — nothing can be executed or verified',
    });
    return issues;
  }

  const ids = new Set<string>();
  const planActionIds = new Set<string>();
  for (const step of plan.steps) {
    if (ids.has(step.stepId)) {
      issues.push({
        severity: 'error',
        code: 'STEP_DUPLICATE_ID',
        stepId: step.stepId,
        message: `duplicate stepId "${step.stepId}"`,
      });
    }
    ids.add(step.stepId);

    if (step.actions.length === 0) {
      issues.push({
        severity: 'error',
        code: 'STEP_NO_ACTIONS',
        stepId: step.stepId,
        message: `step "${step.stepId}" declares no actions`,
      });
    }

    const actionIds = new Set<string>();
    for (const action of step.actions) {
      if (actionIds.has(action.actionId)) {
        issues.push({
          severity: 'error',
          code: 'ACTION_DUPLICATE_ID',
          stepId: step.stepId,
          message: `duplicate actionId "${action.actionId}" in step "${step.stepId}"`,
        });
      }
      actionIds.add(action.actionId);
      if (planActionIds.has(action.actionId)) {
        issues.push({
          severity: 'error',
          code: 'ACTION_DUPLICATE_ID',
          stepId: step.stepId,
          message: `actionId "${action.actionId}" is not unique across the plan`,
        });
      }
      planActionIds.add(action.actionId);

      if (action.kind === 'tool' && !step.allowedTools.includes(action.toolName)) {
        issues.push({
          severity: 'error',
          code: 'TOOL_NOT_ALLOWED',
          stepId: step.stepId,
          message: `tool action "${action.actionId}" references "${action.toolName}" which is NOT in the step allowlist — arbitrary tools are never permitted`,
        });
      }
    }

    const altTools = step.recoveryPolicy?.alternateTools ?? [];
    for (const alt of altTools) {
      if (!step.allowedTools.includes(alt)) {
        issues.push({
          severity: 'warning',
          code: 'ALT_TOOL_NOT_ALLOWED',
          stepId: step.stepId,
          message: `recovery alternate tool "${alt}" is not in the step allowlist — it can never be executed`,
        });
      }
    }
  }

  // Unknown dependencies.
  for (const step of plan.steps) {
    for (const dep of step.dependencies) {
      if (!ids.has(dep)) {
        issues.push({
          severity: 'error',
          code: 'DEPENDENCY_UNKNOWN',
          stepId: step.stepId,
          message: `step "${step.stepId}" depends on unknown step "${dep}"`,
        });
      }
    }
  }

  // Cycles (DFS over dependency edges).
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(plan.steps.map((s) => [s.stepId, s]));
  for (const step of plan.steps) {
    const cycle = findCycle(step.stepId, byId, visiting, visited);
    if (cycle) {
      issues.push({
        severity: 'error',
        code: 'DEPENDENCY_CYCLE',
        stepId: step.stepId,
        message: `dependency cycle detected: ${cycle.join(' -> ')}`,
      });
    }
  }

  return issues;
}

function findCycle(
  start: string,
  byId: Map<string, { stepId: string; dependencies: string[] }>,
  visiting: Set<string>,
  visited: Set<string>,
): string[] | undefined {
  if (visited.has(start)) return undefined;
  if (visiting.has(start)) {
    // Back-edge: report the path suffix starting at start.
    return [start];
  }
  visiting.add(start);
  const step = byId.get(start);
  if (step) {
    for (const dep of step.dependencies) {
      const result = findCycle(dep, byId, visiting, visited);
      if (result) {
        if (result[0] === start) {
          return result; // closed the cycle
        }
        return [start, ...result];
      }
    }
  }
  visiting.delete(start);
  visited.add(start);
  return undefined;
}

/**
 * Feasibility validation against live routing + tool availability. Requires
 * ports; every issue is attributed to a step (never blocks sibling steps).
 */
export async function validatePlanReadiness(
  plan: AgentPlan,
  ports: ReadinessPorts,
): Promise<PlanValidationIssue[]> {
  const issues: PlanValidationIssue[] = [];
  for (const step of plan.steps) {
    for (const action of step.actions) {
      issues.push(...(await validateActionReadiness(action, step.stepId, ports)));
    }
  }
  return issues;
}

async function validateActionReadiness(
  action: AgentActionSpec,
  stepId: string,
  ports: ReadinessPorts,
): Promise<PlanValidationIssue[]> {
  const issues: PlanValidationIssue[] = [];
  if (action.kind === 'ai') {
    if (ports.ai?.canRoute !== undefined) {
      const feasibility = await ports.ai.canRoute({
        capability: action.capability,
        requiredCapabilities: action.requiredCapabilities,
      });
      if (!feasibility.ok) {
        issues.push({
          severity: 'error',
          code: 'CAPABILITY_NOT_ROUTABLE',
          stepId,
          message: `action "${action.actionId}" requires ${describeCapabilities(
            action.requiredCapabilities ?? [action.capability],
          )} but no eligible model is available: ${feasibility.reason ?? 'no route'}`,
        });
      }
    }
  } else {
    const registry = ports.toolRegistry;
    if (registry) {
      const allowed = registry.listAllowed();
      const info = registry.describe(action.toolName);
      if (info === undefined && !allowed.includes(action.toolName)) {
        issues.push({
          severity: 'error',
          code: 'TOOL_UNAVAILABLE',
          stepId,
          message: `action "${action.actionId}" requires tool "${action.toolName}" which is not available on this platform`,
        });
      }
    }
  }
  return issues;
}

function describeCapabilities(capabilities: string[]): string {
  return capabilities.map((c) => `"${c}"`).join(' + ');
}
