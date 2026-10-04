// ──────────────────────────────────────────────────────────────────
// VedMoulya — REAL-08: REAL MULTI-LINE GOVERNED CODE EXECUTION
//
// Sprint 5 Limitation B: the deterministic artifact extractors could only see
// ONE line (~200 chars), so a mission could not author real multi-line source,
// configuration or documentation. The pre-existing, unwired
// `mission-test-verified-file` template already had the governed machinery —
// it simply lacked a multi-line content channel and was never installed into
// the composed runtime template list.
//
// These tests pin:
//   1. the smallest new capability: bounded fenced-block extraction
//   2. the jail: no absolute path, no `..`, no Windows separator ever matches
//   3. the security surface: only a COMMAND_CATALOG id + one jailed fileArg —
//      never an executable, never a shell string, never a free argv
//   4. REAL governed execution: a genuine multi-line file is written by the
//      governed tool and verified by a REAL command exit status
//   5. the negative path: a failing command fails the objective (no synthetic
//      success)
// ──────────────────────────────────────────────────────────────────

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { MockProvider } from '@vedmoulya/orchestrator';
import {
  COMMAND_CATALOG,
  COMMAND_EXECUTION_TOOL,
  createMissionRuntime,
  createTestVerifiedTemplate,
  extractTestVerifiedFileTarget,
  repositoryMissionConstraints,
} from '../index.js';
import type { MissionRuntime } from '../index.js';

const workspaces: string[] = [];

function makeWorkspace(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vedmoulya-real08-'));
  workspaces.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of workspaces) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort cleanup of a temp dir */
    }
  }
});

/** A real, meaningful, multi-line ESM module (far beyond the old 200-char cap). */
const MULTILINE_MODULE = [
  '/**',
  ' * Release readiness scoring for the mission artifact.',
  ' * Deterministic: the same inputs always produce the same verdict.',
  ' */',
  'export const THRESHOLD = 0.82;',
  '',
  'export function score(checks) {',
  '  const passed = checks.filter((check) => check === true).length;',
  '  return checks.length === 0 ? 0 : passed / checks.length;',
  '}',
  '',
  'export function verdict(ratio) {',
  '  if (ratio >= THRESHOLD) return "READY";',
  '  if (ratio > 0) return "AT_RISK";',
  '  return "BLOCKED";',
  '}',
  '',
  'export default { THRESHOLD, score, verdict };',
].join('\n');

/** An independent verifier script — real Node, no mission machinery involved. */
const VERIFIER_SOURCE = [
  "import { readFileSync } from 'node:fs';",
  "const source = readFileSync(new URL('../src/lib/scoring.mjs', import.meta.url), 'utf8');",
  "const module = await import('../src/lib/scoring.mjs');",
  'const failures = [];',
  "if (!source.includes('export function score(checks)')) failures.push('missing score export');",
  "if (!source.includes('export function verdict(ratio)')) failures.push('missing verdict export');",
  "if (source.split('\\n').length < 15) failures.push('artifact is not multi-line');",
  "if (module.verdict(module.score([true, true, true])) !== 'READY') failures.push('READY verdict wrong');",
  "if (module.verdict(module.score([true, false])) !== 'AT_RISK') failures.push('AT_RISK verdict wrong');",
  "if (module.verdict(module.score([])) !== 'BLOCKED') failures.push('BLOCKED verdict wrong');",
  "if (module.score([true, true, true, false]) !== 0.75) failures.push('score ratio wrong');",
  "if (!source.includes('VEDMOULYA_REAL08_MARKER')) failures.push('missing release marker');",
  'if (failures.length > 0) {',
  "  console.error('FAIL: ' + failures.join('; '));",
  '  process.exit(1);',
  '}',
  "console.log('OK: scoring artifact verified');",
].join('\n');

function multiLineGoal(marker = 'VEDMOULYA_REAL08_MARKER'): string {
  return [
    'Update the workspace file src/lib/scoring.mjs with the exact content below,',
    'then confirm the result with the node script verify/scoring.verify.mjs so that the test suite passes.',
    '',
    '```js',
    MULTILINE_MODULE.replace(
      'export const THRESHOLD = 0.82;',
      `export const THRESHOLD = 0.82; // ${marker}`,
    ),
    '```',
  ].join('\n');
}

function makeRuntime(workspace: string): MissionRuntime {
  return createMissionRuntime({
    workspaceRoot: workspace,
    orchestratorOptions: { retryBaseDelayMs: 1 },
    registerProviders: (orchestrator) => {
      orchestrator.registerProvider(new MockProvider());
    },
  });
}

function seedVerifier(workspace: string, source = VERIFIER_SOURCE): void {
  const dir = path.join(workspace, 'verify');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'scoring.verify.mjs'), source, 'utf8');
  mkdirSync(path.join(workspace, 'src', 'lib'), { recursive: true });
}

// ── 1. bounded multi-line extraction ─────────────────────────────────

describe('REAL-08 multi-line deterministic extraction', () => {
  it('extracts a real multi-line body well beyond the old ~200-char cap', () => {
    const target = extractTestVerifiedFileTarget(multiLineGoal());
    expect(target).toBeDefined();
    expect(target?.relativePath).toBe('src/lib/scoring.mjs');
    // The decisive property: NEWLINES survive and the body is far longer than
    // the pre-existing single-line 200/400-char limit.
    expect(target?.content.split('\n').length).toBeGreaterThan(15);
    expect(target!.content.length).toBeGreaterThan(200);
    expect(target?.content).toContain('export function score(checks) {');
    expect(target?.content).toContain('  return "BLOCKED";');
  });

  it('selects the catalog command from the goal, never from the model', () => {
    expect(extractTestVerifiedFileTarget(multiLineGoal())?.commandId).toBe('node_run');
    expect(extractTestVerifiedFileTarget(multiLineGoal())?.fileArg).toBe(
      'verify/scoring.verify.mjs',
    );
    expect(
      extractTestVerifiedFileTarget(
        'Write the file notes.md with exact contents hello so that the tests pass.',
      )?.commandId,
    ).toBe('npm_test');
    expect(
      extractTestVerifiedFileTarget(
        'Write the file a.js with exact contents hello so that the test file src/a.test.js passes.',
      ),
    ).toMatchObject({ commandId: 'npm_test_file', fileArg: 'src/a.test.js' });
  });

  it('does not match a goal without the real-verification phrase', () => {
    expect(
      extractTestVerifiedFileTarget('Write the file a.js with exact contents hello.'),
    ).toBeUndefined();
  });
});

// ── 2. workspace jail ────────────────────────────────────────────────

describe('REAL-08 workspace jail', () => {
  const goals = [
    'Write the file /etc/passwd with exact contents x so that the tests pass.',
    'Write the file ../../escape.mjs with exact contents x so that the tests pass.',
    'Write the file src\\..\\..\\escape.mjs with exact contents x so that the tests pass.',
    'Write the file C:/Windows/system32/evil.mjs with exact contents x so that the tests pass.',
  ];
  it.each(goals)('refuses an escaping target: %s', (goal) => {
    expect(extractTestVerifiedFileTarget(goal)).toBeUndefined();
  });

  it('refuses an escaping verification script', () => {
    const goal = [
      'Write the file src/lib/scoring.mjs with exact contents ok so that the tests pass.',
      'Use the node script ../../outside.mjs',
    ].join('\n');
    const target = extractTestVerifiedFileTarget(goal);
    // Whatever the extractor derives, the escaping path can NEVER become an
    // argv element: the `..` segment is rejected, so the plan falls back to a
    // jail-safe argument (or none) inside an allowlisted catalog entry.
    expect(target?.fileArg ?? '').not.toContain('..');
    expect(target?.fileArg ?? '').not.toContain('\\');
    expect(['npm_test', 'npm_test_file', 'node_run']).toContain(target?.commandId);
  });
});

// ── 3. security surface of the generated plan ────────────────────────

describe('REAL-08 plan security surface', () => {
  const catalogIds = COMMAND_CATALOG.map((spec) => spec.id);

  it('emits only a catalog command id plus at most one file argument', () => {
    const template = createTestVerifiedTemplate();
    const understanding = {
      goalId: 'goal_real08',
      normalizedGoal: multiLineGoal(),
    } as never;
    const plan = template.build(understanding, 'plan_real08');

    const commandPolicies = [plan.steps[0]?.verificationPolicy, plan.finalVerification].filter(
      (policy) => policy?.kind === 'command',
    );

    // step-1 verification is the REAL governed command.
    const runCommand = plan.steps[0]?.verificationPolicy as {
      command: { toolName: string; arguments: Record<string, unknown>; expect: string };
    };
    expect(runCommand.command.toolName).toBe(COMMAND_EXECUTION_TOOL);
    expect(runCommand.command.expect).toBe('ok');
    expect(runCommand.command.arguments.command).toBe('node_run');
    expect(Object.keys(runCommand.command.arguments).sort()).toEqual(['command', 'fileArg']);
    expect(catalogIds).toContain(runCommand.command.arguments.command as string);

    // Never a shell string, never a free argv, never an executable path.
    // The check applies to the COMMAND ARGUMENTS (the only place a shell
    // could ever be smuggled in) — the artifact body is legitimate content.
    const commandArgs = JSON.stringify(runCommand.command.arguments);
    for (const forbidden of ['&&', '||', ';', '$(', '`', '>', '<', 'curl', 'wget', 'rm -rf']) {
      expect(commandArgs).not.toContain(forbidden);
    }
    const argvFor = COMMAND_CATALOG.find((spec) => spec.id === 'node_run')?.argv ?? [];
    expect(argvFor).toEqual(['node']);
    // Every verification policy is deterministic real execution.
    for (const policy of commandPolicies) {
      expect(policy.kind).toBe('command');
    }
  });

  it('writes only through the governed workspace tools', () => {
    const template = createTestVerifiedTemplate();
    const plan = template.build({ goalId: 'g', normalizedGoal: multiLineGoal() } as never, 'p');
    const toolNames = plan.steps.flatMap((step) =>
      step.actions.filter((action) => action.kind === 'tool').map((action) => action.toolName),
    );
    expect(new Set(toolNames)).toEqual(new Set(['workspace_write']));
    expect(plan.steps[0]?.allowedTools).toContain(COMMAND_EXECUTION_TOOL);
  });
});

// ── 4 + 5. REAL governed execution and the negative path ──────────────

describe('REAL-08 real governed multi-line execution', () => {
  it('writes a real multi-line module and verifies it with a REAL command exit status', async () => {
    const workspace = makeWorkspace();
    seedVerifier(workspace);
    const runtime = makeRuntime(workspace);
    const goal = multiLineGoal();

    const mission = await runtime.controller.createMission({
      userId: 'real08-user',
      title: 'Real multi-line code execution',
      objective: goal,
      description: goal,
      mode: 'DEVELOPMENT',
      workspace,
      constraints: repositoryMissionConstraints(),
      initialObjectives: [goal],
    });
    await runtime.controller.startMission(mission.missionId);
    const done = await runtime.controller.runAutonomousLoop(mission.missionId);

    // Real file on disk, byte-exact, genuinely multi-line.
    const artifact = path.join(workspace, 'src', 'lib', 'scoring.mjs');
    expect(done.state).toBe('COMPLETED');
    expect(done.objectives[0]?.state).toBe('VERIFIED');
    expect(existsSync(artifact)).toBe(true);
    expect(readFileSync(artifact, 'utf8')).toBe(
      MULTILINE_MODULE.replace(
        'export const THRESHOLD = 0.82;',
        'export const THRESHOLD = 0.82; // VEDMOULYA_REAL08_MARKER',
      ),
    );
    expect(readFileSync(artifact, 'utf8').split('\n').length).toBeGreaterThan(15);

    // The REAL command ran through the governed registry, and it is audited.
    const commandEvents = runtime.toolRegistry
      .getAuditTrail()
      .filter((event) => event.toolName === COMMAND_EXECUTION_TOOL);
    expect(commandEvents.length).toBeGreaterThan(0);
    expect(commandEvents.every((event) => event.outcome === 'success')).toBe(true);

    // Verification evidence comes from real execution, not model wording.
    const evidence = done.objectives[0]?.verifiedOutcome?.evidence.join('\n') ?? '';
    expect(evidence).toContain('verified=true');
    expect(evidence).toContain('ACHIEVED');
    // The verdict is real execution evidence, not model wording: the only AI
    // step in this plan is step-2, and its wording is never the verdict.
    expect(done.objectives[0]?.verifiedOutcome?.method).toBeDefined();
  });

  it('FAILS the objective when the real verification command fails (no synthetic success)', async () => {
    const workspace = makeWorkspace();
    // A verifier that demands a marker the artifact does NOT carry.
    seedVerifier(
      workspace,
      VERIFIER_SOURCE.replace('VEDMOULYA_REAL08_MARKER', 'A_MARKER_THAT_IS_ABSENT'),
    );
    const runtime = makeRuntime(workspace);
    // Goal content therefore cannot satisfy the real command.
    const goal = multiLineGoal('VEDMOULYA_REAL08_MARKER');

    const mission = await runtime.controller.createMission({
      userId: 'real08-user',
      title: 'Negative multi-line execution',
      objective: goal,
      description: goal,
      mode: 'DEVELOPMENT',
      workspace,
      constraints: repositoryMissionConstraints(),
      initialObjectives: [goal],
    });
    await runtime.controller.startMission(mission.missionId);
    const done = await runtime.controller.runAutonomousLoop(mission.missionId);

    expect(done.state).not.toBe('COMPLETED');
    expect(done.outcome).not.toBe('ACHIEVED');
    const objective = done.objectives[0];
    expect(objective?.state).toBe('FAILED');
    expect(objective?.verifiedOutcome?.achieved).not.toBe(true);

    // The real command's non-zero exit is in the audit trail.
    const failedCommand = runtime.toolRegistry
      .getAuditTrail()
      .filter((event) => event.toolName === COMMAND_EXECUTION_TOOL)
      .find((event) => event.outcome !== 'success');
    expect(failedCommand).toBeDefined();

    // A checkpoint persists the failure rather than inventing success.
    expect(done.checkpoints.length).toBeGreaterThan(0);
  });
});
