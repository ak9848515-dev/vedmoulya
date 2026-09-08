// ──────────────────────────────────────────────────────────────────
// VedMoulya — Adaptive Agent Loop: Decision Validation
//
// A parsed decision is STILL untrusted until it passes validation.
// Deterministic gates (each returns explicit reasons — never silent):
//   1. capability whitelist    — a model may only use capabilities the
//      goal/plan/step already allow; anything else is CAPABILITY_ESCALATION
//      (BLOCKED — the model cannot upgrade its own authority).
//   2. requiredCapabilities    — preserved in FULL, never reduced.
//   3. tool resolution         — the frozen registry is authoritative:
//      unknown tool → TOOL_UNAVAILABLE, unauthorized permission class →
//      UNAUTHORIZED_TOOL / PERMISSION_DENIED (never retried).
//   4. governance              — high-risk tools require explicit approval;
//      the model cannot downgrade a high-risk action to avoid approval.
//   5. revision/replan bounds  — REVISE_STEP / REPLAN may not touch
//      permissions, capability authority, allowedTools, autonomy,
//      budgets or governance; revisions respect the frozen maxRevisions.
//
// No component may silently absorb another component's authority.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type {
  AgentAutonomyLevel,
  AgentPlan,
  AgentPlanStep,
  AgentToolRegistryPort,
  ToolPermissionClass,
} from '@vedmoulya/agent-execution';
import { isHighRisk } from '@vedmoulya/agent-execution';
import type { AdaptiveDecision } from '../types/adaptive-loop-types.js';

export interface DecisionValidationContext {
  plan: AgentPlan;
  currentStep?: AgentPlanStep;
  /** Capabilities already allowed by the goal/plan/step. */
  allowedCapabilities: CapabilityType[];
  /** Tools the principal is permitted to use (constraint union). */
  allowedTools: string[];
  /** Permission classes the principal holds. */
  grantedPermissionClasses: ToolPermissionClass[];
  toolRegistry?: AgentToolRegistryPort;
  /** Autonomy level — ASSISTED gates EVERY tool behind human approval. */
  autonomyLevel: AgentAutonomyLevel;
  /** Remaining REVISE_STEP budget. */
  revisionsRemaining: number;
  /** Remaining REPLAN budget. */
  replansRemaining: number;
}

export interface DecisionValidationResult {
  ok: boolean;
  /** Deterministic reasons (BLOCKED when any is present). */
  rejectionReasons: string[];
  /** The validated permission class for tool proposals. */
  permissionClass?: ToolPermissionClass;
  /** High-risk tool → governance gate required before execution. */
  requiresApproval: boolean;
}

/** Capability whitelist — the model can never expand its authority. */
function validateCapability(decision: AdaptiveDecision, ctx: DecisionValidationContext): string[] {
  const reasons: string[] = [];
  const proposed = decision.capability;
  if (proposed !== undefined && !ctx.allowedCapabilities.includes(proposed)) {
    reasons.push(
      `CAPABILITY_ESCALATION: capability "${proposed}" is not allowed by the goal/plan/step (allowed: ${ctx.allowedCapabilities.join(', ')})`,
    );
  }
  for (const rc of decision.requiredCapabilities ?? []) {
    if (!ctx.allowedCapabilities.includes(rc)) {
      reasons.push(
        `CAPABILITY_ESCALATION: requiredCapability "${rc}" is not allowed by the goal/plan/step`,
      );
    }
  }
  return reasons;
}

/** Tool resolution against the authoritative registry + principal grants. */
function validateTool(
  decision: AdaptiveDecision,
  ctx: DecisionValidationContext,
): { reasons: string[]; permissionClass?: ToolPermissionClass; requiresApproval: boolean } {
  const reasons: string[] = [];
  const toolName = decision.tool;
  if (toolName === undefined) {
    return { reasons: ['TOOL_CALL requires a tool name'], requiresApproval: false };
  }

  const info = ctx.toolRegistry?.describe(toolName);
  if (info === undefined) {
    reasons.push(
      `TOOL_UNAVAILABLE: tool "${toolName}" is not exposed by the authoritative registry`,
    );
    return { reasons, requiresApproval: false };
  }

  // Principal allowlist (constraint union with the registry).
  if (ctx.allowedTools.length > 0 && !ctx.allowedTools.includes(toolName)) {
    reasons.push(`UNAUTHORIZED_TOOL: tool "${toolName}" is not in the principal's allowedTools`);
  }

  // Permission class — the model cannot grant itself permission.
  const permissionClass = info.permissionClass;
  if (!ctx.grantedPermissionClasses.includes(permissionClass)) {
    reasons.push(
      `PERMISSION_DENIED: tool "${toolName}" requires permission class ${permissionClass}, not granted to this principal (granted: ${ctx.grantedPermissionClasses.join(', ')})`,
    );
  }

  // Governance — the frozen approval policy is authoritative: tools flagged
  // requiresApproval and high-risk classes (DELETE/SECRETS/DEPLOYMENT) always
  // gate at EVERY autonomy level, and ASSISTED autonomy gates every tool.
  // The model cannot downgrade a high-risk action to avoid approval.
  const requiresApproval =
    info.requiresApproval === true ||
    isHighRisk(permissionClass) ||
    ctx.autonomyLevel === 'ASSISTED';

  return { reasons, permissionClass, requiresApproval };
}

/** REVISE_STEP / REPLAN may never touch authority fields. */
function validateScope(decision: AdaptiveDecision, ctx: DecisionValidationContext): string[] {
  const reasons: string[] = [];
  if (decision.kind === 'REVISE_STEP') {
    if (ctx.revisionsRemaining <= 0) {
      reasons.push('REVISION_BUDGET_EXCEEDED: no revisions remaining');
    }
    if (decision.capability !== undefined || (decision.requiredCapabilities ?? []).length > 0) {
      reasons.push('REVISE_STEP may not change capability authority');
    }
    if (decision.tool !== undefined || decision.arguments !== undefined) {
      reasons.push('REVISE_STEP may not propose tools');
    }
    if (decision.verification !== undefined) {
      reasons.push('REVISE_STEP may not change verification/governance requirements');
    }
  }
  if (decision.kind === 'REPLAN') {
    if (ctx.replansRemaining <= 0) {
      reasons.push('REPLAN_BUDGET_EXCEEDED: no replans remaining');
    }
    if (decision.capability !== undefined || (decision.requiredCapabilities ?? []).length > 0) {
      reasons.push(
        'REPLAN may not introduce capabilities — a replan is a new proposal, not a new authority level',
      );
    }
    if (decision.tool !== undefined) {
      reasons.push('REPLAN may not propose tools directly');
    }
  }
  return reasons;
}

/**
 * Validate a parsed decision against the frozen authority model. Only a
 * validated decision may become an ActionProposal (or a governed state
 * transition).
 */
export function validateDecision(
  decision: AdaptiveDecision,
  ctx: DecisionValidationContext,
): DecisionValidationResult {
  const rejectionReasons: string[] = [
    ...validateCapability(decision, ctx),
    ...validateScope(decision, ctx),
  ];
  let permissionClass: ToolPermissionClass | undefined;
  let requiresApproval = false;

  if (decision.kind === 'TOOL_CALL') {
    const tool = validateTool(decision, ctx);
    rejectionReasons.push(...tool.reasons);
    permissionClass = tool.permissionClass;
    requiresApproval = tool.requiresApproval;
  }

  if (decision.kind === 'AI_ACTION' && decision.capability === undefined) {
    rejectionReasons.push('AI_ACTION requires a capability');
  }

  return { ok: rejectionReasons.length === 0, rejectionReasons, permissionClass, requiresApproval };
}

/** The step's declared capabilities are the authoritative whitelist. */
export function allowedCapabilitiesForStep(
  plan: AgentPlan,
  step?: AgentPlanStep,
): CapabilityType[] {
  const allowed = new Set<CapabilityType>();
  if (step?.capability) allowed.add(step.capability);
  for (const required of step?.requiredCapabilities ?? []) allowed.add(required);
  for (const action of step?.actions ?? []) {
    if (action.kind === 'ai') {
      allowed.add(action.capability);
      for (const required of action.requiredCapabilities ?? []) allowed.add(required);
    }
  }
  // The plan's overall capability surface is also allowed (steps may move
  // across the plan's declared capabilities during adaptive continuation).
  for (const s of plan.steps) {
    if (s.capability) allowed.add(s.capability);
    for (const required of s.requiredCapabilities ?? []) allowed.add(required);
    for (const action of s.actions) {
      if (action.kind === 'ai') {
        allowed.add(action.capability);
        for (const required of action.requiredCapabilities ?? []) allowed.add(required);
      }
    }
  }
  return [...allowed];
}
