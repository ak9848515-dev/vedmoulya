// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Real Repository Path (BLD-022 §14)
//
// Proves the runtime against a REAL (temporary) repository:
//   inspect repository → identify an objective (repo-driven discovery) →
//   perform an allowed change THROUGH the governed ToolRuntime →
//   run verification → record checkpoint — autonomously, with no second
//   user prompt. Also proves the security jails: repository inspection
//   and the workspace tools refuse every path outside the authorized
//   workspace. The production repository is NEVER touched — every test
//   runs in a fresh temporary workspace.
// ──────────────────────────────────────────────────────────────────

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { MockProvider } from '@vedmoulya/orchestrator';
import { createMissionRuntime, WORKSPACE_WRITE_TOOL, FsRepositoryInspector } from '../index.js';

const tempRoots: string[] = [];
function newWorkspace(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vedmoulya-mission-repo-'));
  tempRoots.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true });
});

/** A real (minimal) repository layout in a temporary workspace. */
function seedRepository(workspace: string): void {
  mkdirSync(path.join(workspace, 'src'), { recursive: true });
  writeFileSync(
    path.join(workspace, 'package.json'),
    JSON.stringify(
      { name: 'mission-it-repo', version: '0.1.0', scripts: { test: 'node test.js' } },
      null,
      2,
    ),
  );
  writeFileSync(
    path.join(workspace, 'src', 'greeting.ts'),
    '// TODO: create the workspace file greeting-notes.md with the greeting summary text\nexport const greeting = "hello";\n',
  );
  // Simulated git identity (what the bounded reader honestly exposes).
  mkdirSync(path.join(workspace, '.git', 'refs', 'heads'), { recursive: true });
  writeFileSync(path.join(workspace, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  writeFileSync(path.join(workspace, '.git', 'refs', 'heads', 'main'), 'abc123def4567890\n');
}

const devConstraints = (): { allowedTools: string[]; grantedPermissionClasses: string[] } => ({
  allowedTools: ['workspace_write', 'workspace_read'],
  grantedPermissionClasses: ['READ', 'WRITE'],
});

describe('Mission Runtime — real repository path (BLD-022 §14)', () => {
  it('inspects the repository: identity, git branch/revision, bounded TODO markers', async () => {
    const workspace = newWorkspace();
    seedRepository(workspace);
    const inspector = new FsRepositoryInspector({ defaultWorkspace: workspace });
    const inspection = await inspector.inspectRepository(workspace);
    expect(
      inspection.todos.some(
        (todo) => todo.includes('greeting.ts') && todo.includes('greeting-notes.md'),
      ),
    ).toBe(true);
    expect(inspection.incompletePackages).toHaveLength(0); // manifest is sane
    const detailed = inspector.inspectDetailed(workspace);
    expect(detailed.identity.name).toBe('mission-it-repo');
    expect(detailed.git?.branch).toBe('main');
    expect(detailed.git?.revision).toBe('abc123def4567890');
  });

  it('refuses inspection outside the authorized workspace (path jail)', async () => {
    const workspace = newWorkspace();
    seedRepository(workspace);
    const inspector = new FsRepositoryInspector({ defaultWorkspace: workspace });
    const outside = path.dirname(workspace);
    await expect(inspector.inspectRepository(outside)).rejects.toThrow(
      /escapes the authorized root/,
    );
    await expect(
      inspector.inspectRepository(path.join(outside, 'definitely-not-authorized')),
    ).rejects.toThrow();
  });

  it('refuses workspace tool writes that escape the jail — through the governed registry', async () => {
    const workspace = newWorkspace();
    seedRepository(workspace);
    const runtime = createMissionRuntime({
      workspaceRoot: workspace,
      registerProviders: (orchestrator) => {
        orchestrator.registerProvider(new MockProvider());
      },
    });
    const attempt = await runtime.toolRegistry.execute({
      toolName: WORKSPACE_WRITE_TOOL,
      arguments: { relativePath: '../escape.txt', content: 'must never be written' },
      userId: 'attacker',
    });
    expect(attempt.ok).toBe(false);
    expect(existsSync(path.join(path.dirname(workspace), 'escape.txt'))).toBe(false);

    const absolute = await runtime.toolRegistry.execute({
      toolName: WORKSPACE_WRITE_TOOL,
      arguments: { relativePath: path.join(tempRoots[0] ?? workspace, 'abs.txt'), content: 'x' },
      userId: 'attacker',
    });
    expect(absolute.ok).toBe(false);
  });

  it('THE AUTONOMOUS REPO-DRIVEN MISSION: inspect → discover objective → change through ToolRuntime → verify → checkpoint → honest completion — no second user prompt', async () => {
    const workspace = newWorkspace();
    seedRepository(workspace);
    const runtime = createMissionRuntime({
      workspaceRoot: workspace,
      registerProviders: (orchestrator) => {
        orchestrator.registerProvider(new MockProvider());
      },
    });

    // The user supplies ONE prompt: an open-ended development mission with
    // NO pre-seeded objectives. Everything after this is autonomous.
    const mission = await runtime.controller.createMission({
      userId: 'operator-1',
      title: 'Improve VedMoulya autonomously',
      objective: 'Inspect the workspace and resolve its tracked work',
      mode: 'DEVELOPMENT',
      workspace,
      constraints: devConstraints(),
      initialObjectives: [],
    });
    await runtime.controller.startMission(mission.missionId);
    const completed = await runtime.controller.runAutonomousLoop(mission.missionId);

    // Repository inspection discovered the TODO, planned it, executed the
    // change through ToolRuntime, verified it, checkpointed, and completed.
    expect(completed.state).toBe('COMPLETED');
    expect(completed.outcome).toBe('ACHIEVED');
    expect(completed.objectives.length).toBe(1); // discovered exactly once — no duplicates
    const discovered = completed.objectives[0];
    expect(discovered?.title.toLowerCase()).toContain('todo');
    expect(discovered?.state).toBe('VERIFIED');
    expect(discovered?.verifiedOutcome?.achieved).toBe(true);

    // The REAL repository file exists with the REAL content.
    const notesPath = path.join(workspace, 'greeting-notes.md');
    expect(existsSync(notesPath)).toBe(true);
    expect(readFileSync(notesPath, 'utf8')).toContain('greeting summary text');

    // Checkpoint recorded; budget consumed by real work only.
    const checkpoint = await runtime.stores.checkpoints.getLatestForMission(mission.missionId);
    expect(checkpoint).toBeDefined();
    expect(checkpoint?.state).toBe('VERIFIED');
    expect(completed.budgetUsage.objectivesCompleted).toBe(1);
    expect(completed.budgetUsage.toolCallsExecuted).toBeGreaterThan(0);
  });

  it('provider recovery: WAITING_FOR_PROVIDER mission resumes and completes when a provider becomes available', async () => {
    const workspace = newWorkspace();
    const runtime = createMissionRuntime({
      workspaceRoot: workspace,
      // NO providers registered → honest WAITING_FOR_PROVIDER.
      registerProviders: () => undefined,
    });
    const mission = await runtime.controller.createMission({
      userId: 'operator-2',
      title: 'Resume when providers return',
      objective: 'Improve the workspace autonomously',
      mode: 'DEVELOPMENT',
      workspace,
      constraints: devConstraints(),
      initialObjectives: [
        'Create the workspace file resume-notes.md with the resume summary content',
      ],
    });
    await runtime.controller.startMission(mission.missionId);
    const waiting = await runtime.controller.runAutonomousLoop(mission.missionId);
    expect(waiting.state).toBe('WAITING_FOR_PROVIDER');

    // A provider becomes available (operator registers the local Ollama/mock).
    runtime.orchestrator.registerProvider(new MockProvider());
    const resumed = await runtime.controller.resumeMission(mission.missionId);
    expect(resumed.state).toBe('RUNNING');
    const completed = await runtime.controller.runAutonomousLoop(mission.missionId);
    expect(completed.state).toBe('COMPLETED');
    expect(completed.objectives[0]?.state).toBe('VERIFIED');
    expect(existsSync(path.join(workspace, 'resume-notes.md'))).toBe(true);
  });
});
