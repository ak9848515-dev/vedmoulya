// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Test-Verified Development Template (AUTONOMY-02)
//
// A deterministic plan template installed through the FROZEN planner's
// `templates` extension point — NOT a second planner. It extends the
// workspace-file development template with REAL command verification:
//
//   write the goal-derived file → run an ALLOWLISTED command from the governed
//   command catalog through the governed tool runtime → the REAL exit status
//   is the step verdict, and the governed read-back must return the exact
//   content the plan wrote.
//
// Completion is gated on real execution evidence (kind:'command' with
// expect:'ok'): the model can never declare success, and a failing command
// fails the step with the structured exit/stdout/stderr evidence attached. A
// goal without the test-passing phrase falls back to the other templates (this
// template simply does not match).
//
// ── REAL-08 (Sprint 5): MULTI-LINE CODE ──────────────────────────────
// The pre-existing deterministic extractors could only ever see ONE line:
//   WorkspaceDevTemplate  CONTENT_PATTERN       /…(.{3,200})$/i
//   planner-templates.ts  FILE_CONTENT_PATTERN /…([^\n"'`]{3,200})/i
// so multi-line source, real configuration and documentation were impossible
// to author through a mission. The smallest missing capability is therefore a
// bounded, DETERMINISTIC fenced-block extractor — nothing more. No new
// execution framework, no new tool, no new verification engine:
//
//   * content comes from the GOAL's fenced block, never from the model, so a
//     hallucinated path or body can never become a write;
//   * the path is validated here AND re-jailed by the governed
//     `WorkspaceRootBinding.resolveInside()` inside `workspace_write`;
//   * the verification command is a catalog id from `COMMAND_CATALOG` plus at
//     most ONE path-jailed relative file argument — the model can never name an
//     executable, a shell string or an arbitrary argument;
//   * the read-back uses the existing deterministic `expectedContent`
//     assertion over the FULL untruncated bytes, so a wrong or partial file
//     can never pass.
// ──────────────────────────────────────────────────────────────────

import type { AgentPlan, VerificationPolicy } from '@vedmoulya/agent-execution';
import type { GoalUnderstanding, PlanTemplate } from '@vedmoulya/planning';
import { COMMAND_EXECUTION_TOOL } from './CommandExecutionTool.js';
import { extractWorkspaceFileTarget } from './WorkspaceDevTemplate.js';

/**
 * Matches bounded development goals that demand REAL test verification:
 *   "update the workspace file greeting.ts with X so that npm test passes"
 *   "fix the workspace file app.js to make the tests pass"
 *   "write the file src/a.ts … so that the npm test suite passes"
 * The test phrase is matched FIRST so the generic workspace-file template
 * (verified by read-back only) does not swallow test-verified goals.
 */
const TEST_VERIFICATION_PATTERN =
  /\b(?:so that|to make|and make|until|and)\s+(?:the\s+)?(?:npm test|npm run test|tests?|test suite|test\.run)\b[\s\S]{0,30}\bpass/i;

/**
 * A fenced code block. This is the deterministic multi-line content channel.
 * The language tag is optional and ignored; the body may contain any number of
 * lines, blank lines, quotes and braces. Closing fence required (fail closed).
 */
const FENCED_BLOCK_PATTERN = /```[A-Za-z0-9_+.-]*\r?\n([\s\S]*?)```/;

/**
 * Target file: a relative, jail-safe path. Directories are allowed (unlike
 * the single-segment workspace-file extractor) because real code lives in
 * folders. Absolute paths, `..` traversal and Windows separators are rejected
 * here and again by the governed tool.
 */
const TARGET_FILE_PATTERN =
  /(?:workspace file|file|artifact|document|note)\s+(?:called\s+|named\s+)?["'`]?([A-Za-z0-9][A-Za-z0-9._/-]{0,150}\.[A-Za-z0-9]{1,10})["'`]?/i;

/** A single named test file → the `npm_test_file` catalog entry. */
const TEST_FILE_PATTERN =
  /(?:test file|single test|only test)\s+(?:called\s+|named\s+)?["'`]?([A-Za-z0-9][A-Za-z0-9._/-]{0,150}\.[A-Za-z0-9]{1,10})["'`]?/i;

/** A named node verification script → the `node_run` catalog entry. */
const NODE_SCRIPT_PATTERN =
  /(?:node script|node run|verification script|verify script|node file)\s+(?:called\s+|named\s+)?["'`]?([A-Za-z0-9][A-Za-z0-9._/-]{0,150}\.[A-Za-z0-9]{1,10})["'`]?/i;

/**
 * Bounded extraction limits. The governed `workspace_write` accepts far more
 * (64 KB); this keeps the deterministic content extractor predictable and
 * keeps a plan document small.
 */
/**
 * Single-line content fallback (the pre-existing behavior, same shape as
 * planner-templates' FILE_CONTENT_PATTERN): used when the goal states the
 * content inline instead of in a fenced block.
 */
const INLINE_CONTENT_PATTERN =
  /(?:with|containing|content(?:\s+is)?|contents?(?:\s+are)?|exact\s+contents?)\s*[:-]?\s*["'`]?([^\n"'`]{3,400})["'`]?/i;

const MAX_CONTENT_CHARS = 8_000;
const MAX_PATH_CHARS = 160;

/** Deterministic bounded target of a test-verified development goal. */
export interface TestVerifiedFileTarget {
  relativePath: string;
  content: string;
  /** Governed command catalog id used as the REAL verification command. */
  commandId: 'npm_test' | 'npm_test_file' | 'node_run';
  /** The ONE optional jail-checked file argument for that catalog entry. */
  fileArg?: string;
}

/** Reject anything the workspace jail must never see. */
function isJailSafeRelativePath(value: string): boolean {
  if (!value || value.length > MAX_PATH_CHARS) return false;
  if (value.includes('..')) return false;
  if (value.includes('\\')) return false;
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value);
}

/**
 * Deterministically extract the bounded file target from a test-verified
 * development goal. Undefined → this template does not match.
 *
 * Multi-line body: the goal's fenced block (REAL-08). Single-line body: the
 * pre-existing workspace-file extraction rules, unchanged.
 */
export function extractTestVerifiedFileTarget(goal: string): TestVerifiedFileTarget | undefined {
  if (!TEST_VERIFICATION_PATTERN.test(goal)) return undefined;

  // Fail closed on an UNCLOSED fence: the body would be truncated/mangled, so
  // this template must not match at all rather than write a partial artifact.
  const fenceCount = (goal.match(/```/g) ?? []).length;
  if (fenceCount % 2 !== 0) return undefined;

  const relativePath = extractRelativePath(goal);
  if (!relativePath) return undefined;

  const fenced = FENCED_BLOCK_PATTERN.exec(goal);
  const inline = INLINE_CONTENT_PATTERN.exec(goal)?.[1]
    ?.replace(/^(?:the\s+)?exact\s+contents?\s+/i, '')
    .replace(/^contents?\s+/i, '')
    .replace(/[.,;]+$/, '')
    .trim();
  const content = fenced?.[1]
    ? fenced[1].replace(/\r\n/g, '\n').replace(/\n+$/, '')
    : (inline ?? extractWorkspaceFileTarget(goal)?.content);
  const bounded = (content ?? '').slice(0, MAX_CONTENT_CHARS);
  if (bounded.trim().length === 0) return undefined;

  // Catalog selection is deterministic and comes from the GOAL only. The model
  // never chooses a command: it can only pick which allowlisted entry the
  // already-fixed argv runs, and the single file argument is path-jailed.
  const nodeScript = NODE_SCRIPT_PATTERN.exec(goal)?.[1];
  if (nodeScript && isJailSafeRelativePath(nodeScript)) {
    return { relativePath, content: bounded, commandId: 'node_run', fileArg: nodeScript };
  }
  const testFile = TEST_FILE_PATTERN.exec(goal)?.[1];
  if (testFile && isJailSafeRelativePath(testFile)) {
    return { relativePath, content: bounded, commandId: 'npm_test_file', fileArg: testFile };
  }
  return { relativePath, content: bounded, commandId: 'npm_test' };
}

/** The jail-safe relative target path from the goal (or undefined). */
function extractRelativePath(goal: string): string | undefined {
  const direct = TARGET_FILE_PATTERN.exec(goal)?.[1];
  if (direct && isJailSafeRelativePath(direct)) return direct;
  // Fall back to the pre-existing single-segment extractor (adds the default
  // extension for a bare name such as "greeting.ts" / "notes").
  const legacy = extractWorkspaceFileTarget(goal)?.relativePath;
  return legacy && isJailSafeRelativePath(legacy) ? legacy : undefined;
}

/**
 * Deterministic content verification against the REAL artifact (same
 * mechanism as the workspace-file template): the governed read-back must
 * return the exact content the plan wrote, compared over the FULL untruncated
 * bytes. The AI confirmation's wording is never part of the verdict.
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

export function createTestVerifiedTemplate(): PlanTemplate {
  return {
    id: 'mission-test-verified-file',
    matches: (understanding: GoalUnderstanding): boolean =>
      extractTestVerifiedFileTarget(understanding.normalizedGoal) !== undefined,
    build: (understanding: GoalUnderstanding, planId: string): AgentPlan => {
      const target = extractTestVerifiedFileTarget(understanding.normalizedGoal) ?? {
        relativePath: 'mission-output.md',
        content: 'Completed by the VedMoulya mission runtime.',
        commandId: 'npm_test' as const,
      };
      // The REAL verification command: a catalog id plus at most ONE
      // jail-checked relative path. Never a shell string, never a free argv.
      const commandArguments: Record<string, unknown> = { command: target.commandId };
      if (target.fileArg !== undefined) commandArguments.fileArg = target.fileArg;
      const commandDescription =
        target.commandId === 'npm_test'
          ? 'the workspace test suite (npm test) must pass'
          : `${target.commandId} must exit 0 when running ${target.fileArg}`;
      return {
        planId,
        goalId: understanding.goalId,
        objective: understanding.normalizedGoal,
        steps: [
          {
            stepId: 'step-1',
            objective: `Write ${target.relativePath} and verify it with the REAL workspace command run`,
            capability: 'coding',
            // run_command is declared honestly: this step's verification
            // executes it through the governed ToolRuntime security chain.
            allowedTools: ['workspace_write', 'workspace_read', COMMAND_EXECUTION_TOOL],
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
            expectedOutcome: `the governed command ${commandDescription} against the written file`,
            verificationPolicy: {
              kind: 'command',
              description: `${commandDescription} — verified by REAL command execution, never by model self-report`,
              command: {
                toolName: COMMAND_EXECUTION_TOOL,
                arguments: commandArguments,
                expect: 'ok',
              },
            },
            recoveryPolicy: BOUNDED_RECOVERY,
          },
          {
            stepId: 'step-2',
            objective: 'Confirm the artifact holds the required content',
            capability: 'reasoning',
            // Verified against the REAL artifact, never the model's wording.
            // workspace_read is declared honestly for the verification command.
            allowedTools: ['workspace_read'],
            dependencies: ['step-1'],
            actions: [
              {
                actionId: 'step-2-confirm',
                kind: 'ai',
                capability: 'reasoning',
                instruction: `${target.relativePath} was written through the governed tool runtime and ${commandDescription} by REAL command execution. Using ONLY that real evidence, state briefly whether the file holds exactly the required content.`,
                expectedOutcome: 'a grounded confirmation of the real test + artifact evidence',
              },
            ],
            expectedOutcome: 'a grounded confirmation of the real test + artifact evidence',
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
          'goal-derived file written through the governed tool runtime',
          `workspace command ${target.commandId} executed through the governed command tool`,
          `${target.commandId} exit status 0 (real execution evidence)`,
          'execution verified the outcome explicitly',
        ],
      };
    },
  };
}
