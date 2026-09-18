// ──────────────────────────────────────────────────────────────────
// VedMoulya — FINAL-03A: Governed Repair Mechanism Tests
//
// Proves the production repair mechanism that closes the loop
//
//   REAL FAILURE → STRUCTURED DIAGNOSIS → GOVERNED REPAIR →
//   WORKSPACE_WRITE_TOOL → RE-EXECUTION → REAL VERIFICATION
//
// is governed END TO END: every mutation it performs goes through the SAME
// governed ToolRegistry the mission executes plans against (real path jail,
// real schema validation, real rate limit, real audit trail), and it refuses
// — loudly and honestly — whenever the mission's own allowlist, permission
// classes, diagnosis strategy or objective do not authorise it.
//
// There is no mock registry here: `createMissionRuntime` composes the real
// governed registry (workspace_jail + governed command tool) and the real
// `GovernedRepairAdapter` over it.
// ──────────────────────────────────────────────────────────────────

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { FailureDiagnosis } from '@vedmoulya/mission-controller';
import { createGovernedToolRegistry } from '../adapters/GovernedToolRegistry.js';
import { GovernedRepairAdapter, WORKSPACE_WRITE_TOOL, createMissionRuntime } from '../index.js';

const tempRoots: string[] = [];
function newWorkspace(label: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), `vedmoulya-final03a-repair-${label}-`));
  tempRoots.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempRoots) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

/** A structured diagnosis selecting a GOVERNED workspace mutation. */
function mutationDiagnosis(): FailureDiagnosis {
  return {
    failureClass: 'VERIFICATION_FAILURE',
    summary: 'TEST_FAILURE: Test execution failed',
    rootCause: { category: 'TEST_FAILURE', description: 'Test execution failed' },
    confidence: 'HIGH',
    evidence: ['Exit code: 1', 'stderr: multiply(3, 4) must equal 12'],
    suggestedRepair: 'MODIFY_SOURCE',
  };
}

/** An objective carrying an explicit repair target (the plan's own source). */
function repairObjective(): string {
  return 'Fix the failing tests by updating the workspace file src.js with the repaired content';
}

describe('FINAL-03A: governed repair mechanism (GovernedRepairAdapter)', () => {
  it('TEST 4 — the production composition wires the repair over the REAL governed registry', () => {
    const workspace = newWorkspace('composition');
    const runtime = createMissionRuntime({ workspaceRoot: workspace, workspaceTools: true });

    // Present by default, over the SAME registry the mission executes against.
    expect(runtime.ports.repair).toBeInstanceOf(GovernedRepairAdapter);
    expect(runtime.toolRegistry.has(WORKSPACE_WRITE_TOOL)).toBe(true);

    // Explicit opt-out composes honestly (pre-FINAL-03A behavior).
    const optedOut = createMissionRuntime({ workspaceRoot: workspace, repair: null });
    expect(optedOut.ports.repair).toBeUndefined();

    // Where there is no governed workspace tool there is no repair mechanism.
    const noWorkspaceTools = createMissionRuntime({
      workspace,
      workspaceTools: false,
      repair: null,
    });
    expect(noWorkspaceTools.ports.repair).toBeUndefined();
  });

  it('TEST 5 — a mutation diagnosis performs a REAL governed workspace_write (audited success)', async () => {
    const workspace = newWorkspace('real-write');
    const target = path.join(workspace, 'src.js');
    writeFileSync(target, 'BROKEN', 'utf8');
    const runtime = createMissionRuntime({ workspaceRoot: workspace, workspaceTools: true });

    const result = await runtime.ports.repair!.repair({
      diagnosis: mutationDiagnosis(),
      classification: {
        failureClass: 'VERIFICATION_FAILURE',
        recoverable: true,
        reason: 'test failed',
        suggestedAction: 'REVISE_OBJECTIVE',
        evidence: ['stderr: assertion'],
      },
      objective: repairObjective(),
      missionContext: 'Repository development mission',
      allowedTools: [WORKSPACE_WRITE_TOOL, 'workspace_read', 'run_command'],
      grantedPermissionClasses: ['READ', 'WRITE', 'EXECUTE'],
    });

    // The repair reports the EXISTING AUTONOMY-04 contract, honestly.
    expect(result.attempted).toBe(true);
    expect(result.success).toBe(true);
    expect(result.modifiedFiles).toEqual(['src.js']);
    expect(result.repairRecord?.strategy).toBe('MODIFY_SOURCE');

    // The REAL file on disk changed — this was a real governed write, not a claim.
    expect(readFileSync(target, 'utf8')).toBe('the repaired content');

    // …and the write is observable through the governed audit contract.
    const writes = runtime.toolRegistry
      .getAuditTrail()
      .filter((event) => event.toolName === WORKSPACE_WRITE_TOOL);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.outcome).toBe('success');
    expect(writes[0]?.denied).toBe(false);
  });

  it('TEST 6 — the repair NEVER widens governance: allowlist, permission class, strategy and target are all refusals', async () => {
    const workspace = newWorkspace('refusals');
    const target = path.join(workspace, 'src.js');
    writeFileSync(target, 'UNTOUCHED', 'utf8');
    const runtime = createMissionRuntime({ workspaceRoot: workspace, workspaceTools: true });
    const diagnosis = mutationDiagnosis();
    const classification = {
      failureClass: 'VERIFICATION_FAILURE' as const,
      recoverable: true,
      reason: 'test failed',
      suggestedAction: 'REVISE_OBJECTIVE' as const,
      evidence: ['stderr: assertion'],
    };

    // (a) the tool is not on the mission's governed allowlist.
    const notAllowed = await runtime.ports.repair!.repair({
      diagnosis,
      classification,
      objective: repairObjective(),
      missionContext: 'mission',
      allowedTools: ['workspace_read'],
      grantedPermissionClasses: ['READ'],
    });
    // (b) the principal does not hold the WRITE class.
    const notGranted = await runtime.ports.repair!.repair({
      diagnosis,
      classification,
      objective: repairObjective(),
      missionContext: 'mission',
      allowedTools: [WORKSPACE_WRITE_TOOL],
      grantedPermissionClasses: ['READ'],
    });
    // (c) the diagnosis does not select a workspace mutation.
    const notMutation = await runtime.ports.repair!.repair({
      diagnosis: { ...diagnosis, suggestedRepair: 'BLOCK' },
      classification,
      objective: repairObjective(),
      missionContext: 'mission',
      allowedTools: [WORKSPACE_WRITE_TOOL],
      grantedPermissionClasses: ['WRITE'],
    });
    // (d) the objective declares no repair target — nothing is ever invented.
    const noTarget = await runtime.ports.repair!.repair({
      diagnosis,
      classification,
      objective: 'Fix the failing tests in the repository',
      missionContext: 'mission',
      allowedTools: [WORKSPACE_WRITE_TOOL],
      grantedPermissionClasses: ['WRITE'],
    });

    for (const refused of [notAllowed, notGranted, notMutation, noTarget]) {
      expect(refused.attempted).toBe(false);
      expect(refused.success).toBe(false);
      expect(refused.modifiedFiles).toEqual([]);
    }
    // Nothing was written and nothing was even attempted against the registry.
    expect(readFileSync(target, 'utf8')).toBe('UNTOUCHED');
    expect(
      runtime.toolRegistry.getAuditTrail().filter((e) => e.toolName === WORKSPACE_WRITE_TOOL),
    ).toHaveLength(0);
  });

  it('TEST 9 — a repair that cannot reach a governed tool is reported honestly (never fabricated)', async () => {
    const workspace = newWorkspace('unavailable');
    // A registry with NO governed workspace tools: the repair must fail honestly.
    const bareRegistry = createGovernedToolRegistry({});
    const adapter = new GovernedRepairAdapter({ registry: bareRegistry });

    const result = await adapter.repair({
      diagnosis: mutationDiagnosis(),
      classification: {
        failureClass: 'VERIFICATION_FAILURE',
        recoverable: true,
        reason: 'test failed',
        suggestedAction: 'REVISE_OBJECTIVE',
        evidence: [],
      },
      objective: repairObjective(),
      missionContext: 'mission',
      allowedTools: [WORKSPACE_WRITE_TOOL],
      grantedPermissionClasses: ['WRITE'],
    });

    expect(result.attempted).toBe(true);
    expect(result.success).toBe(false);
    expect(result.modifiedFiles).toEqual([]);
    expect(result.repairRecord?.success).toBe(false);
    expect(result.repairRecord?.error).toBeDefined();
    // The governed registry really never performed a workspace write.
    expect(existsSync(path.join(workspace, 'src.js'))).toBe(false);
  });

  it('TEST 6c — the repair respects the real workspace jail (no escape)', async () => {
    const workspace = newWorkspace('jail');
    mkdirSync(workspace, { recursive: true });
    const runtime = createMissionRuntime({ workspaceRoot: workspace, workspaceTools: true });

    // The bounded extraction rule refuses traversal targets outright, so the
    // objective cannot even name a file outside the operator's workspace.
    const escaped = await runtime.ports.repair!.repair({
      diagnosis: mutationDiagnosis(),
      classification: {
        failureClass: 'VERIFICATION_FAILURE',
        recoverable: true,
        reason: 'test failed',
        suggestedAction: 'REVISE_OBJECTIVE',
        evidence: [],
      },
      objective: 'Fix the failing tests by updating the workspace file ../outside.js with pwned',
      missionContext: 'mission',
      allowedTools: [WORKSPACE_WRITE_TOOL],
      grantedPermissionClasses: ['WRITE'],
    });
    expect(escaped.attempted).toBe(false);
    expect(
      runtime.toolRegistry.getAuditTrail().filter((e) => e.toolName === WORKSPACE_WRITE_TOOL),
    ).toHaveLength(0);
  });
});
