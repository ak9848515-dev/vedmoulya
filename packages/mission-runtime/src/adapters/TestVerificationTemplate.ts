// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Test-Verified Development Template (AUTONOMY-02)
//
// A deterministic plan template installed through the FROZEN planner's
// `templates` extension point — NOT a second planner. It extends the
// workspace-file development template with REAL command verification:
//
//   write the goal-derived file → run the allowlisted test suite through
//   the governed command tool → the REAL exit status is the step verdict.
//
// Completion is gated on command execution evidence (kind:'command' with
// expect:'ok'): the model can never declare success, and a failing test
// suite fails the step with the structured exit/stdout/stderr evidence
// attached. A goal without the test-passing phrase falls back to the other
// templates (this template simply does not match).
// ──────────────────────────────────────────────────────────────────

import type { AgentPlan, VerificationPolicy } from '@vedmoulya/agent-execution';
import type { GoalUnderstanding, PlanTemplate } from '@vedmoulya/planning';
import { COMMAND_EXECUTION_TOOL } from './CommandExecutionTool.js';
import { extractWorkspaceFileTarget } from './WorkspaceDevTemplate.js';

/**
 * Matches bounded development goals that demand REAL test verification:
 *   "update the workspace file greeting.ts with X so that npm test passes"
 *   "fix the workspace file app.js to make the tests pass"
 * The test phrase is matched FIRST so the generic workspace-file template
 * (verified by read-back only) does not swallow test-verified goals.
 */
const TEST_VERIFICATION_PATTERN =
  /\b(?:so that|to make|and make|until|and)\s+(?:the\s+)?(?:npm test|npm run test|tests?|test suite|test\.run)\b[\s\S]{0,30}\bpass/i;

/**
 * Deterministically extract the bounded file target from a test-verified
 * development goal. Undefined → this template does not match. Reuses the
 * workspace-file extraction rules (relative filename, bounded content).
 */
export function extractTestVerifiedFileTarget(
  goal: string,
): { relativePath: string; content: string } | undefined {
  if (!TEST_VERIFICATION_PATTERN.test(goal)) return undefined;
  return extractWorkspaceFileTarget(goal);
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

export function createTestVerifiedTemplate(): PlanTemplate {
  return {
    id: 'mission-test-verified-file',
    matches: (understanding: GoalUnderstanding): boolean =>
      extractTestVerifiedFileTarget(understanding.normalizedGoal) !== undefined,
    build: (understanding: GoalUnderstanding, planId: string): AgentPlan => {
      const target = extractTestVerifiedFileTarget(understanding.normalizedGoal) ?? {
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
            objective: `Write ${target.relativePath} and verify it with the REAL workspace test run`,
            capability: 'coding',
            // run_command is declared honestly: this step's verification
            // executes it through the governed ToolRuntime security chain.
            allowedTools: ['workspace_write', COMMAND_EXECUTION_TOOL],
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
                expectedOutcome: `${target.relativePath} written with the goal-derived content`,
              },
            ],
            expectedOutcome: 'the workspace test suite passes against the written file',
            verificationPolicy: {
              kind: 'command',
              description:
                'the workspace test suite must pass — verified by REAL command execution, never by model self-report',
              command: {
                toolName: COMMAND_EXECUTION_TOOL,
                arguments: { command: 'npm_test' },
                expect: 'ok',
              },
            },
            recoveryPolicy: BOUNDED_RECOVERY,
          },
          {
            stepId: 'step-2',
            objective: 'Confirm the verified test run',
            capability: 'reasoning',
            allowedTools: [],
            dependencies: ['step-1'],
            actions: [
              {
                actionId: 'step-2-confirm',
                kind: 'ai',
                capability: 'reasoning',
                instruction: `verified status report: ${target.relativePath} was written through the governed tool runtime and the workspace test suite passed by REAL command execution (exit status 0). Write a short 2-3 sentence status report that begins with the exact lowercase word "verified" followed by a colon.`,
                expectedOutcome: 'explicit verified confirmation',
              },
            ],
            expectedOutcome: 'explicit verified confirmation',
            verificationPolicy: rulePolicy(
              [
                { name: 'has-verified', kind: 'includes', text: 'verified' },
                { name: 'length', kind: 'minLength', length: 20 },
              ],
              'the confirmation must explicitly state the verified test result',
            ),
            recoveryPolicy: BOUNDED_RECOVERY,
          },
        ],
        finalVerification: rulePolicy(
          [{ name: 'goal-verified', kind: 'includes', text: 'verified' }],
          'the final summary must state the goal is verified',
        ),
        completionCriteria: [
          'goal-derived file written through the governed tool runtime',
          'workspace test suite executed through the governed command tool',
          'test suite exit status 0 (real execution evidence)',
          'execution verified the outcome explicitly',
        ],
      };
    },
  };
}
