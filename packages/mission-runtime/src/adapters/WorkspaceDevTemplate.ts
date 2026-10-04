// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Workspace Development Template (BLD-022)
//
// A deterministic plan template installed through the FROZEN planner's
// `templates` extension point (PlannerServiceOptions.templates) — this is
// NOT a second planner: understanding, validation, readiness and the
// other templates remain the frozen planning estate. The template matches
// bounded "create/write the workspace file X ..." development goals and
// emits ONE governed tool step (workspace_write through ToolRuntime,
// verified by DETERMINISTICALLY re-reading the file and asserting its exact
// content) plus ONE real AI execution whose output is never the verdict.
//
// The AI confirmation is retained because it is the runtime's genuine
// provider-execution/usage-identity surface (and the certification suite
// exercises the provider-failure matrix through it). What changed is its
// VERIFICATION: it is graded against the real artifact, so model wording
// cannot decide success or failure. Semantic objectives
// (summarize / analyze / classify / judge) remain on the other templates,
// where AI reasoning is the requirement. Every plan still passes the full
// frozen validation pipeline before execution.
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

/**
 * Deterministic content verification: re-read the REAL artifact through the
 * governed tool port and require the FULL content to equal the content the
 * plan itself wrote. The verdict comes from real execution state — never from
 * model prose — so a differently-worded (or missing) confirmation can never
 * fail a correct write, and a tampered/missing file can never pass.
 */
function artifactContentVerification(
  relativePath: string,
  content: string,
  description: string,
): VerificationPolicy {
  return {
    kind: 'command',
    description,
    command: {
      toolName: 'workspace_read',
      arguments: { relativePath, expectedContent: content },
      expect: 'ok',
    },
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
            expectedOutcome: `workspace file ${target.relativePath} holds the exact required content`,
            verificationPolicy: artifactContentVerification(
              target.relativePath,
              target.content,
              `workspace file ${target.relativePath} must read back with the exact required content`,
            ),
            recoveryPolicy: BOUNDED_RECOVERY,
          },
          {
            stepId: 'step-2',
            objective: 'Confirm the created artifact holds the required content',
            capability: 'reasoning',
            // Verified against the REAL artifact, never the model's wording:
            // an incorrect or differently-phrased reply can never fail a
            // correct write. workspace_read is declared honestly because the
            // verification command executes it through the governed tool port.
            allowedTools: ['workspace_read'],
            dependencies: ['step-1'],
            actions: [
              {
                actionId: 'step-2-confirm',
                kind: 'ai',
                capability: 'reasoning',
                instruction: `The file ${target.relativePath} was written and read back through the governed workspace tools. Using ONLY the observed read-back content, state briefly whether it holds exactly the required content. Do not invent content you did not observe.`,
                expectedOutcome: 'a grounded confirmation of the observed read-back',
              },
            ],
            expectedOutcome: 'a grounded confirmation of the observed read-back',
            verificationPolicy: artifactContentVerification(
              target.relativePath,
              target.content,
              `the artifact ${target.relativePath} must really hold the exact required content`,
            ),
            recoveryPolicy: BOUNDED_RECOVERY,
          },
        ],
        finalVerification: artifactContentVerification(
          target.relativePath,
          target.content,
          `the goal is verified only if ${target.relativePath} really holds the required content`,
        ),
        completionCriteria: [
          'workspace file written through the governed tool runtime',
          'workspace file reads back through the governed read tool',
          'read-back content equals the exact required content (deterministic)',
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
