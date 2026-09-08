// ──────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Planning Intelligence: Plan Validation
//
// Pure, deterministic validation a generated plan MUST pass before it
// can be handed to the execution engine. Every check is explainable:
//   - capability membership (frozen CAPABILITY_TYPES — never a parallel
//     taxonomy; unknown capabilities are REJECTED);
//   - tool availability against the authoritative registry + step
//     allowlist discipline (a tool not in the registry is BLOCKED, never
//     fabricated);
//   - permission classes (the planner cannot grant itself permission);
//   - DAG/dependency validity (reuses the frozen validatePlanStructure);
//   - budget (tool-call/token/cost ceilings, deterministic estimate);
//   - verification-aware planning (missing verification is EXPLICITLY
//     flagged — never silently treated as success);
//   - bounded recovery (no infinite loops, no unbounded replanning);
//   - boundary discipline (no provider/model directives, known kinds).
//
// Validation NEVER executes anything. The planner proposes; validation
// gates; readiness decides; the execution engine remains authoritative.
// ──────────────────────────────────────────────────────────────────

import { CAPABILITY_TYPES } from '@vedmoulya/ai';
import type {
  AgentPlan,
  AgentRunBudgetConfig,
  PlanValidationIssue,
  StepRecoveryPolicy,
  ToolPermissionClass,
  VerificationPolicy,
} from '@vedmoulya/agent-execution';
import {
  HIGH_RISK_PERMISSION_CLASSES,
  TOOL_PERMISSION_CLASSES,
  validatePlanStructure,
} from '@vedmoulya/agent-execution';
import type { AgentToolRegistryPort } from '../contracts/planning-ports.js';
import type { PlanConstraint } from '../types/planning-types.js';
import { MAX_RECOVERY_ATTEMPTS, MAX_RECOVERY_REVISIONS } from './plan-proposal.js';

// ── Deterministic budget estimate model (documented, conservative) ─
/** Estimated tokens per AI action per attempt (input + output). */
export const ESTIMATED_TOKENS_PER_AI_ACTION = 1_500;
/** Conservative cost ceiling per token (≈ $2 / 1M tokens). */
export const ESTIMATED_COST_PER_TOKEN = 0.000002;

export interface PlanValidationContext {
  /** Budget envelope (already merged with defaults). */
  budget: AgentRunBudgetConfig;
  /** Plan constraints (granted permissions, maxSteps, verification). */
  constraints: PlanConstraint;
  /** Authoritative tool registry (required when the plan uses tools). */
  toolRegistry?: AgentToolRegistryPort;
}

/**
 * Run the full validation pipeline over a generated plan. Deterministic
 * and explainable; every issue carries a stable code. Reuses the frozen
 * structural validator (duplicate ids, unknown deps, cycles, empty
 * steps, allowlist discipline).
 */
export function validateGeneratedPlan(
  plan: AgentPlan,
  context: PlanValidationContext,
): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = [];

  // 1. Structural/DAG — the frozen validator (deterministic).
  issues.push(...validatePlanStructure(plan));

  // 2. Capability membership + boundary discipline.
  validateCapabilities(plan, issues);

  // 3. Tool availability + permission (authoritative registry).
  validateTools(plan, context, issues);

  // 4. Budget (deterministic estimate).
  validateBudget(plan, context, issues);

  // 5. Verification-aware planning.
  validateVerification(plan, context, issues);

  // 6. Bounded recovery.
  validateRecovery(plan, context, issues);

  return issues;
}

// ── Capability membership ─────────────────────────────────────────

function validateCapabilities(plan: AgentPlan, issues: PlanValidationIssue[]): void {
  for (const step of plan.steps) {
    for (const action of step.actions) {
      if (action.kind === 'ai') {
        if (!CAPABILITY_TYPES.includes(action.capability)) {
          issues.push({
            severity: 'error',
            code: 'UNKNOWN_CAPABILITY',
            stepId: step.stepId,
            message: `action "${action.actionId}" declares capability "${action.capability}" which is not in the frozen CapabilityType taxonomy`,
          });
        }
        for (const required of action.requiredCapabilities ?? []) {
          if (!CAPABILITY_TYPES.includes(required)) {
            issues.push({
              severity: 'error',
              code: 'UNKNOWN_CAPABILITY',
              stepId: step.stepId,
              message: `action "${action.actionId}" requires capability "${required}" which is not in the frozen CapabilityType taxonomy`,
            });
          }
        }
      }
    }
    if (step.capability !== undefined && !CAPABILITY_TYPES.includes(step.capability)) {
      issues.push({
        severity: 'error',
        code: 'UNKNOWN_CAPABILITY',
        stepId: step.stepId,
        message: `step "${step.stepId}" declares unknown capability "${step.capability}"`,
      });
    }
    for (const required of step.requiredCapabilities ?? []) {
      if (!CAPABILITY_TYPES.includes(required)) {
        issues.push({
          severity: 'error',
          code: 'UNKNOWN_CAPABILITY',
          stepId: step.stepId,
          message: `step "${step.stepId}" requires unknown capability "${required}"`,
        });
      }
    }
  }
}

// ── Tool availability + permission ────────────────────────────────

function validateTools(
  plan: AgentPlan,
  context: PlanValidationContext,
  issues: PlanValidationIssue[],
): void {
  const registry = context.toolRegistry;
  const planUsesTools = plan.steps.some((step) =>
    step.actions.some((action) => action.kind === 'tool'),
  );
  if (planUsesTools && !registry) {
    issues.push({
      severity: 'error',
      code: 'TOOL_REGISTRY_REQUIRED',
      message:
        'the plan selects tool actions but no authoritative tool registry is wired — tool availability and permission cannot be verified; the planner cannot grant itself permission',
    });
    return;
  }

  const allowedTools = new Set(context.constraints.allowedTools ?? []);
  const granted = new Set(context.constraints.grantedPermissionClasses ?? ['READ']);

  for (const step of plan.steps) {
    for (const toolName of step.allowedTools) {
      if (!isRegistered(registry, toolName)) {
        issues.push({
          severity: 'error',
          code: 'TOOL_UNAVAILABLE',
          stepId: step.stepId,
          message: `step "${step.stepId}" allowlists tool "${toolName}" which is not exposed by the authoritative registry — unavailable tools are BLOCKED, never fabricated`,
        });
      }
    }
    for (const action of step.actions) {
      if (action.kind !== 'tool') continue;
      const permissionClass = permissionOf(registry, action.toolName);
      if (!isRegistered(registry, action.toolName)) {
        issues.push({
          severity: 'error',
          code: 'TOOL_UNAVAILABLE',
          stepId: step.stepId,
          message: `action "${action.actionId}" requires tool "${action.toolName}" which is not available on this platform`,
        });
        continue;
      }
      // The planner cannot grant itself permission: the tool's class must be
      // within the principal's granted classes.
      if (!granted.has(permissionClass)) {
        issues.push({
          severity: 'error',
          code: 'INSUFFICIENT_PERMISSION',
          stepId: step.stepId,
          message: `action "${action.actionId}" uses tool "${action.toolName}" (permission class ${permissionClass}) which is NOT granted to this principal (granted: ${[...granted].join(', ')}) — the planner cannot grant itself permission`,
        });
      }
      // High-risk classes must surface a governance gate.
      if (HIGH_RISK_PERMISSION_CLASSES.includes(permissionClass) && !step.approvalRequired) {
        issues.push({
          severity: 'warning',
          code: 'MISSING_APPROVAL_GATE',
          stepId: step.stepId,
          message: `step "${step.stepId}" uses high-risk tool "${action.toolName}" (${permissionClass}) without approvalRequired — governance will still gate at execution, but the step should declare it`,
        });
      }
      // Constraint-level tool allowlist: the planner may only select tools
      // the principal is permitted to use.
      if (allowedTools.size > 0 && !allowedTools.has(action.toolName)) {
        issues.push({
          severity: 'error',
          code: 'TOOL_NOT_PERMITTED',
          stepId: step.stepId,
          message: `action "${action.actionId}" uses tool "${action.toolName}" which is not in the principal's permitted tool set`,
        });
      }
    }
  }
}

function isRegistered(registry: AgentToolRegistryPort | undefined, toolName: string): boolean {
  if (!registry) return false;
  const allowed = registry.listAllowed();
  return allowed.includes(toolName) || registry.describe(toolName) !== undefined;
}

function permissionOf(
  registry: AgentToolRegistryPort | undefined,
  toolName: string,
): ToolPermissionClass {
  const info = registry?.describe(toolName);
  if (info && TOOL_PERMISSION_CLASSES.includes(info.permissionClass)) {
    return info.permissionClass;
  }
  return 'READ';
}

// ── Budget (deterministic estimate) ───────────────────────────────

function validateBudget(
  plan: AgentPlan,
  context: PlanValidationContext,
  issues: PlanValidationIssue[],
): void {
  const budget = context.budget;
  const maxSteps = context.constraints.maxSteps ?? 12;
  if (plan.steps.length > maxSteps) {
    issues.push({
      severity: 'error',
      code: 'PLAN_TOO_LARGE',
      message: `plan has ${String(plan.steps.length)} steps exceeding the ${String(maxSteps)} step constraint — smallest viable plan required`,
    });
  }

  let estimatedToolCalls = 0;
  let estimatedTokens = 0;
  let estimatedCostUsd = 0;
  for (const step of plan.steps) {
    const attemptsPerStep = attemptsBound(step.recoveryPolicy, budget);
    for (const action of step.actions) {
      if (action.kind === 'ai') {
        const tokens = ESTIMATED_TOKENS_PER_AI_ACTION * attemptsPerStep;
        estimatedTokens += tokens;
        estimatedCostUsd += tokens * ESTIMATED_COST_PER_TOKEN;
      } else {
        estimatedToolCalls += attemptsPerStep;
      }
    }
  }

  if (estimatedToolCalls > budget.maxToolCalls) {
    issues.push({
      severity: 'error',
      code: 'BUDGET_EXCEEDED',
      message: `plan needs ~${String(estimatedToolCalls)} tool calls exceeding the ${String(budget.maxToolCalls)} tool-call budget`,
    });
  }
  if (estimatedTokens > budget.maxTokens) {
    issues.push({
      severity: 'error',
      code: 'BUDGET_EXCEEDED',
      message: `plan needs ~${String(estimatedTokens)} tokens exceeding the ${String(budget.maxTokens)} token budget`,
    });
  }
  if (estimatedCostUsd > budget.maxCostUsd) {
    issues.push({
      severity: 'error',
      code: 'BUDGET_EXCEEDED',
      message: `plan is estimated at ~$${estimatedCostUsd.toFixed(4)} exceeding the $${String(budget.maxCostUsd)} cost budget`,
    });
  }
}

/** Attempts bound = maxAttempts × (maxRevisions + 1), all bounded. */
function attemptsBound(
  recovery: StepRecoveryPolicy | undefined,
  budget: AgentRunBudgetConfig,
): number {
  const attempts = Math.min(
    recovery?.maxAttempts ?? budget.maxAttemptsPerStep,
    MAX_RECOVERY_ATTEMPTS,
  );
  const revisions = Math.min(
    recovery?.maxRevisions ?? budget.maxRevisionsPerStep,
    MAX_RECOVERY_REVISIONS,
  );
  return attempts * (revisions + 1);
}

// ── Verification-aware planning ───────────────────────────────────

const VERIFICATION_KINDS = new Set(['rule', 'schema', 'artifact', 'command', 'state', 'model']);

function validateVerification(
  plan: AgentPlan,
  context: PlanValidationContext,
  issues: PlanValidationIssue[],
): void {
  for (const step of plan.steps) {
    const policy = step.verificationPolicy;
    if (policy === undefined) {
      const message =
        'step declares no verification policy — its verdict will be UNKNOWN (never silently success); it can never make the goal ACHIEVED';
      issues.push({
        severity: context.constraints.requireVerification === true ? 'error' : 'warning',
        code: 'STEP_NO_VERIFICATION_POLICY',
        stepId: step.stepId,
        message,
      });
      continue;
    }
    const policyIssues = validateVerificationPolicy(policy, step.stepId, 'verificationPolicy');
    issues.push(...policyIssues);
  }
  if (plan.finalVerification !== undefined) {
    issues.push(
      ...validateVerificationPolicy(plan.finalVerification, undefined, 'finalVerification'),
    );
  }
}

function validateVerificationPolicy(
  policy: VerificationPolicy,
  stepId: string | undefined,
  label: string,
): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = [];
  if (!VERIFICATION_KINDS.has(policy.kind)) {
    issues.push({
      severity: 'error',
      code: 'INVALID_VERIFICATION_POLICY',
      stepId,
      message: `${label} has unknown kind "${String((policy as { kind?: unknown }).kind)}"`,
    });
    return issues;
  }
  if (
    policy.kind === 'rule' &&
    (policy.checks.length === 0 || policy.checks.some((c) => !c.name))
  ) {
    issues.push({
      severity: 'error',
      code: 'INVALID_VERIFICATION_POLICY',
      stepId,
      message: `${label} (rule) must declare at least one named check`,
    });
  }
  if (policy.kind === 'schema' && policy.requiredKeys.length === 0) {
    issues.push({
      severity: 'error',
      code: 'INVALID_VERIFICATION_POLICY',
      stepId,
      message: `${label} (schema) must declare at least one required key`,
    });
  }
  if (policy.kind === 'model' && policy.criteria.length === 0) {
    issues.push({
      severity: 'error',
      code: 'INVALID_VERIFICATION_POLICY',
      stepId,
      message: `${label} (model) must declare at least one criterion — model verification is only allowed where deterministic verification is impossible`,
    });
  }
  return issues;
}

// ── Bounded recovery ──────────────────────────────────────────────

function validateRecovery(
  plan: AgentPlan,
  context: PlanValidationContext,
  issues: PlanValidationIssue[],
): void {
  const maxAttemptsCeiling = Math.min(
    context.constraints.recovery?.maxAttempts ?? MAX_RECOVERY_ATTEMPTS,
    MAX_RECOVERY_ATTEMPTS,
  );
  const maxRevisionsCeiling = Math.min(
    context.constraints.recovery?.maxRevisions ?? MAX_RECOVERY_REVISIONS,
    MAX_RECOVERY_REVISIONS,
  );
  for (const step of plan.steps) {
    const recovery = step.recoveryPolicy;
    if (!recovery) continue;
    if (recovery.maxAttempts !== undefined && recovery.maxAttempts > maxAttemptsCeiling) {
      issues.push({
        severity: 'error',
        code: 'RECOVERY_UNBOUNDED',
        stepId: step.stepId,
        message: `step recovery maxAttempts ${String(recovery.maxAttempts)} exceeds the ${String(maxAttemptsCeiling)} ceiling — recovery must remain bounded`,
      });
    }
    if (recovery.maxRevisions !== undefined && recovery.maxRevisions > maxRevisionsCeiling) {
      issues.push({
        severity: 'error',
        code: 'RECOVERY_UNBOUNDED',
        stepId: step.stepId,
        message: `step recovery maxRevisions ${String(recovery.maxRevisions)} exceeds the ${String(maxRevisionsCeiling)} ceiling — recovery must remain bounded`,
      });
    }
    for (const alternate of recovery.alternateTools ?? []) {
      if (!step.allowedTools.includes(alternate)) {
        issues.push({
          severity: 'warning',
          code: 'ALT_TOOL_NOT_ALLOWED',
          stepId: step.stepId,
          message: `recovery alternate tool "${alternate}" is not in the step allowlist — it can never be executed`,
        });
      }
    }
    if (recovery.acceptUnknown === true && step.verificationPolicy === undefined) {
      issues.push({
        severity: 'warning',
        code: 'UNKNOWN_ACCEPTED_WITHOUT_POLICY',
        stepId: step.stepId,
        message:
          'step accepts UNKNOWN verdicts but declares no verification policy — an unverified step can never make the goal ACHIEVED',
      });
    }
  }
}
