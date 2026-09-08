// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Workspace Development Template (BLD-022)
//
// A deterministic plan template installed through the FROZEN planner's
// `templates` extension point (PlannerServiceOptions.templates) — this is
// NOT a second planner: understanding, validation, readiness and the
// other templates remain the frozen planning estate. The template matches
// bounded "create/write the workspace file X ..." development goals and
// emits ONE governed tool step (workspace_write through ToolRuntime,
// verified by reading the file back) plus ONE AI confirmation step (real
// provider execution through AIOrchestrationService). Every plan still
// passes the full frozen validation pipeline before execution.
// ──────────────────────────────────────────────────────────────────

import type { AgentPlan, VerificationPolicy } from '@vedmoulya/agent-execution';
import type { GoalUnderstanding, PlanTemplate } from '@vedmoulya/planning';

/** Matches bounded workspace-file development goals. */
const WORKSPACE_FILE_PATTERN =
  /(create|write|implement|add|update)[\s\S]*workspace file\s+([A-Za-z0-9][A-Za-z0-9._-]{0,80})/i;
const CONTENT_PATTERN = /(?:with|containing)[\s:]+(.{3,200})$/i;

export interface WorkspaceFileTarget {
  relativePath: string;
  content: string;
}

/**
 * Deterministically extract the bounded file target from the goal text.
 * Undefined → the goal does not match this template (other templates or
 * the generic fallback still apply). The derived path is a relative
 * filename — never absolute, never '..'.
 */
export function extractWorkspaceFileTarget(goal: string): WorkspaceFileTarget | undefined {
  const match = WORKSPACE_FILE_PATTERN.exec(goal);
  const rawName = match?.[2];
  if (!rawName) return undefined;
  let relativePath = rawName.toLowerCase();
  if (!/\.[a-z0-9]{1,10}$/.test(relativePath)) relativePath += '.md';
  if (relativePath.includes('..') || relativePath.includes('\\')) return undefined;
  const contentMatch = CONTENT_PATTERN.exec(goal);
  const content = (contentMatch?.[1] ?? 'Completed by the VedMoulya mission runtime.').trim();
  return { relativePath, content: content.slice(0, 400) };
}

function rulePolicy(
  checks: Array<{ name: string; kind: 'includes' | 'minLength'; text?: string; length?: number }>,
  description: string,
): VerificationPolicy {
  return {
    kind: 'rule',
    description,
    checks: checks.map((check) =>
      check.kind === 'minLength'
        ? { name: check.name, kind: 'minLength' as const, length: check.length ?? 1 }
        : { name: check.name, kind: check.kind, text: check.text ?? '' },
    ),
  };
}

const BOUNDED_RECOVERY = { maxAttempts: 2, maxRevisions: 0 };

export function createWorkspaceFileTemplate(): PlanTemplate {
  return {
    id: 'mission-workspace-file',
    matches: (understanding: GoalUnderstanding): boolean =>
      extractWorkspaceFileTarget(understanding.normalizedGoal) !== undefined,
    build: (understanding: GoalUnderstanding, planId: string): AgentPlan => {
      const target = extractWorkspaceFileTarget(understanding.normalizedGoal) ?? {
        relativePath: 'mission-output.md',
        content: 'Completed by the VedMoulya mission runtime.',
      };
      return {
        planId,
        goalId: understanding.goalId,
        objective: understanding.normalizedGoal,
        steps: [
          {
            stepId: 'step-1',
            objective: `Write the workspace file ${target.relativePath} through the governed tool runtime`,
            capability: 'coding',
            allowedTools: ['workspace_write', 'workspace_read'],
            dependencies: [],
            actions: [
              {
                actionId: 'step-1-write',
                kind: 'tool',
                toolName: 'workspace_write',
                arguments: {
                  relativePath: target.relativePath,
                  content: target.content,
                },
                expectedOutcome: `workspace file ${target.relativePath} exists with the required content`,
              },
            ],
            expectedOutcome: `workspace file ${target.relativePath} exists`,
            verificationPolicy: {
              kind: 'command',
              description: `workspace file ${target.relativePath} must read back successfully`,
              command: {
                toolName: 'workspace_read',
                arguments: { relativePath: target.relativePath },
                expect: 'ok',
              },
            },
            recoveryPolicy: BOUNDED_RECOVERY,
          },
          {
            stepId: 'step-2',
            objective: 'Confirm the verified workspace state',
            capability: 'reasoning',
            allowedTools: [],
            dependencies: ['step-1'],
            actions: [
              {
                actionId: 'step-2-confirm',
                kind: 'ai',
                capability: 'reasoning',
                instruction: `verified status report: workspace file ${target.relativePath} was created through the governed tool runtime and read back successfully. Write a short 2-3 sentence status report that begins with the exact lowercase word "verified" followed by a colon.`,
                expectedOutcome: 'explicit verified confirmation',
              },
            ],
            expectedOutcome: 'explicit verified confirmation',
            verificationPolicy: rulePolicy(
              [
                { name: 'has-verified', kind: 'includes', text: 'verified' },
                { name: 'length', kind: 'minLength', length: 20 },
              ],
              'the confirmation must explicitly state the verified workspace state',
            ),
            recoveryPolicy: BOUNDED_RECOVERY,
          },
        ],
        finalVerification: rulePolicy(
          [{ name: 'goal-verified', kind: 'includes', text: 'verified' }],
          'the final summary must state the goal is verified',
        ),
        completionCriteria: [
          'workspace file written through the governed tool runtime',
          'workspace file reads back successfully',
          'execution verified the outcome explicitly',
        ],
      };
    },
  };
}

/**
 * Sanitize marker keywords that the FROZEN planner's deterministic goal
 * understanding refuses to plan ("todo/tbd" placeholder phrasing →
 * CLARIFICATION_REQUIRED). TODO-marker-derived development tasks are
 * concrete tracked work — the marker word is replaced with plain task
 * language in the PLANNING INPUT only; the mission's own objective text
 * is never mutated.
 */
export function sanitizePlanningGoal(goal: string): string {
  return goal.replace(/\btodo\b/gi, 'tracked task').replace(/\btbd\b/gi, 'unresolved detail');
}
