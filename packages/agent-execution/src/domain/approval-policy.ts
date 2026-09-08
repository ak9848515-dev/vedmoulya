// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Approval Policy
//
// A model response is NOT permission. A model request for a tool is NOT
// authorization. Every step passes this deterministic boundary BEFORE its
// first action executes:
//
//   - explicit step.approvalRequired        → always gate
//   - tool metadata requiresApproval        → always gate
//   - HIGH_RISK_PERMISSION_CLASSES (DELETE,
//     SECRETS, DEPLOYMENT)                  → always gate (every autonomy)
//   - ASSISTED autonomy                     → gate EVERY tool action
//   - SUPERVISED / CONTROLLED_AUTONOMOUS    → low/medium risk executes;
//                                             high-risk gates remain
//
// Gates pause the run in WAITING_FOR_APPROVAL. Execution never proceeds
// past the gate without an explicit human decision recorded on the run.
// ──────────────────────────────────────────────────────────────────

import type { AgentToolRegistryPort } from '../contracts/agent-execution-ports.js';
import type {
  AgentApprovalReasonClass,
  AgentAutonomyLevel,
  AgentExecutionRun,
  AgentPlanStep,
  ToolPermissionClass,
} from '../types/agent-execution-types.js';
import { HIGH_RISK_PERMISSION_CLASSES } from '../types/agent-execution-types.js';

export interface ApprovalGate {
  reason: string;
  riskClass: AgentApprovalReasonClass;
}

export function approvalGateForStep(
  step: AgentPlanStep,
  autonomyLevel: AgentAutonomyLevel,
  toolRegistry?: AgentToolRegistryPort,
): ApprovalGate | undefined {
  if (step.approvalRequired) {
    return {
      reason: 'step requires explicit human approval before execution',
      riskClass: 'EXPLICIT',
    };
  }

  const toolActions = step.actions.filter(
    (a): a is Extract<typeof a, { kind: 'tool' }> => a.kind === 'tool',
  );

  if (toolActions.length === 0) {
    return undefined; // AI-only steps need no tool-approval gate
  }

  for (const action of toolActions) {
    const info = toolRegistry?.describe(action.toolName);
    const permissionClass = info?.permissionClass;

    if (info?.requiresApproval === true) {
      return {
        reason: `tool "${action.toolName}" requires human approval before execution`,
        riskClass: permissionClass ?? ('EXPLICIT' as const),
      };
    }
    if (permissionClass !== undefined && isHighRisk(permissionClass)) {
      return {
        reason: `tool "${action.toolName}" performs a high-risk ${permissionClass} operation — approval is always required`,
        riskClass: permissionClass,
      };
    }
    if (autonomyLevel === 'ASSISTED') {
      return {
        reason: 'ASSISTED autonomy requires human approval for every tool execution',
        riskClass: 'AUTONOMY',
      };
    }
  }

  return undefined;
}

export function isHighRisk(permissionClass: ToolPermissionClass): boolean {
  return HIGH_RISK_PERMISSION_CLASSES.includes(permissionClass);
}

/** Whether a paused run is still awaiting a decision for the given step. */
export function awaitingDecisionForStep(run: AgentExecutionRun, stepId: string): boolean {
  const decision = run.approvalDecisions.find((d) => d.stepId === stepId);
  return decision === undefined;
}

/** Whether the owner is allowed to mutate this run (central IDOR guard). */
export function ownsRun(run: AgentExecutionRun, userId: string): boolean {
  return run.userId === userId;
}
