// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S11 · Mission authorization ceilings at the execution boundary
//
// Governance invariant 1: a user's goal does not itself authorize every action
// needed to pursue it. Invariant 7: a denial must never become permission by
// default. These tests drive the REAL composed runtime (real governed tool
// registry, real planner validation, real agent-execution engine, real
// workspace jail) and assert what a Mission's OWN declared constraints allow.
//
// Two ceilings are declared on a Mission:
//   • `allowedTools`              — the tool NAMES the mission may use;
//   • `grantedPermissionClasses`  — the permission CLASSES it was granted.
//
// Both must be enforced server-side on the execution path. These tests exist
// because the name ceiling was enforced while the class ceiling was only fed to
// the planner's runtime-wide default.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { MockProvider } from '@vedmoulya/orchestrator';
import type { MissionRuntime } from '../index.js';
import {
  COMMAND_EXECUTION_TOOL,
  createMissionRuntime,
  repositoryMissionConstraints,
} from '../index.js';
import { WORKSPACE_WRITE_TOOL } from '../adapters/WorkspaceTools.js';

const workspaces: string[] = [];

function makeWorkspace(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vedmoulya-s11-'));
  workspaces.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of workspaces) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup of a temp dir */
    }
  }
});

const MODULE_SOURCE = ['export const THRESHOLD = 0.82;', '', 'export default { THRESHOLD };'].join(
  '\n',
);

const VERIFIER_SOURCE = [
  "import { readFileSync } from 'node:fs';",
  "const source = readFileSync(new URL('../src/lib/scoring.mjs', import.meta.url), 'utf8');",
  "if (!source.includes('export const THRESHOLD')) { console.error('FAIL'); process.exit(1); }",
  "console.log('OK');",
].join('\n');

function goal(): string {
  return [
    'Update the workspace file src/lib/scoring.mjs with the exact content below,',
    'then confirm the result with the node script verify/scoring.verify.mjs so that the test suite passes.',
    '',
    '```js',
    MODULE_SOURCE,
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

function seedVerifier(workspace: string): void {
  mkdirSync(path.join(workspace, 'verify'), { recursive: true });
  writeFileSync(path.join(workspace, 'verify', 'scoring.verify.mjs'), VERIFIER_SOURCE, 'utf8');
  mkdirSync(path.join(workspace, 'src', 'lib'), { recursive: true });
}

const ARTIFACT = ['src', 'lib', 'scoring.mjs'];

async function runMission(
  runtime: MissionRuntime,
  workspace: string,
  constraints: { allowedTools: string[]; grantedPermissionClasses: string[] },
  userId: string,
) {
  const objective = goal();
  const mission = await runtime.controller.createMission({
    userId,
    title: 'S11 authorization ceiling',
    objective,
    description: objective,
    mode: 'DEVELOPMENT',
    workspace,
    constraints,
    initialObjectives: [objective],
  });
  await runtime.controller.startMission(mission.missionId);
  return runtime.controller.runAutonomousLoop(mission.missionId);
}

describe('S11 · Mission permission-class ceiling is enforced at execution', () => {
  it('CONTROL: full grants execute the governed write and complete', async () => {
    const workspace = makeWorkspace();
    seedVerifier(workspace);
    const runtime = makeRuntime(workspace);

    const done = await runMission(
      runtime,
      workspace,
      repositoryMissionConstraints(),
      's11-control',
    );

    expect(done.state).toBe('COMPLETED');
    expect(existsSync(path.join(workspace, ...ARTIFACT))).toBe(true);
  });

  it('CONTROL: the tool-NAME ceiling denies a tool the mission did not allow', async () => {
    const workspace = makeWorkspace();
    seedVerifier(workspace);
    const runtime = makeRuntime(workspace);
    // Everything but the write tool: the plan needs a write, so it is refused.
    const done = await runMission(
      runtime,
      workspace,
      { allowedTools: [COMMAND_EXECUTION_TOOL], grantedPermissionClasses: ['READ', 'EXECUTE'] },
      's11-name-ceiling',
    );

    expect(existsSync(path.join(workspace, ...ARTIFACT))).toBe(false);
    expect(done.state).not.toBe('COMPLETED');
    expect(done.objectives[0]?.verifiedOutcome?.achieved).not.toBe(true);
  });

  it('a Mission granted only READ cannot execute a WRITE tool', async () => {
    const workspace = makeWorkspace();
    seedVerifier(workspace);
    const runtime = makeRuntime(workspace);

    // The Mission declares a READ-only ceiling while the repository constraint
    // helper lists the write tool. The CEILING must win: a granted class is a
    // permission, and a class that was not granted may never be executed.
    const done = await runMission(
      runtime,
      workspace,
      {
        allowedTools: repositoryMissionConstraints().allowedTools,
        grantedPermissionClasses: ['READ'],
      },
      's11-class-ceiling',
    );

    // The governed write must NOT have happened.
    expect(existsSync(path.join(workspace, ...ARTIFACT))).toBe(false);
    expect(done.state).not.toBe('COMPLETED');
    expect(done.objectives[0]?.state).not.toBe('VERIFIED');
    expect(done.objectives[0]?.verifiedOutcome?.achieved).not.toBe(true);
    // And the refusal must be reported honestly, never as a silent success.
    expect(JSON.stringify(done.objectives[0] ?? {})).toMatch(/PERMISSION_DENIED|not granted/i);
  });

  it('a Mission granted READ+WRITE but not EXECUTE cannot run the command tool', async () => {
    const workspace = makeWorkspace();
    seedVerifier(workspace);
    const runtime = makeRuntime(workspace);

    const done = await runMission(
      runtime,
      workspace,
      {
        allowedTools: repositoryMissionConstraints().allowedTools,
        grantedPermissionClasses: ['READ', 'WRITE'],
      },
      's11-no-execute',
    );

    // The command tool is EXECUTE-class and was not granted, so the real
    // verification command must never run.
    const commandEvents = runtime.toolRegistry
      .getAuditTrail()
      .filter((event) => event.toolName === COMMAND_EXECUTION_TOOL);
    expect(commandEvents).toHaveLength(0);
    expect(done.objectives[0]?.verifiedOutcome?.achieved).not.toBe(true);
  });

  it('an unlisted/unknown class request cannot be satisfied by the READ default', async () => {
    const workspace = makeWorkspace();
    seedVerifier(workspace);
    const runtime = makeRuntime(workspace);

    const done = await runMission(
      runtime,
      workspace,
      {
        allowedTools: repositoryMissionConstraints().allowedTools,
        grantedPermissionClasses: [],
      },
      's11-empty-grant',
    );

    // No granted class ⇒ nothing may execute (never "default to permission").
    expect(existsSync(path.join(workspace, ...ARTIFACT))).toBe(false);
    const anyToolExecuted = runtime.toolRegistry
      .getAuditTrail()
      .some((event) => event.outcome === 'success');
    expect(anyToolExecuted).toBe(false);
    expect(done.objectives[0]?.verifiedOutcome?.achieved).not.toBe(true);
  });

  it('the artifact content is byte-exact when the ceiling permits it (control)', async () => {
    const workspace = makeWorkspace();
    seedVerifier(workspace);
    const runtime = makeRuntime(workspace);
    await runMission(runtime, workspace, repositoryMissionConstraints(), 's11-control-2');

    const artifact = path.join(workspace, ...ARTIFACT);
    expect(existsSync(artifact)).toBe(true);
    if (existsSync(artifact)) {
      expect(readFileSync(artifact, 'utf8')).toBe(MODULE_SOURCE);
      expect(WORKSPACE_WRITE_TOOL).toBeTruthy();
    }
  });
});
