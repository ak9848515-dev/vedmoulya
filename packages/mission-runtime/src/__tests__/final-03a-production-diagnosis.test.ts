// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// VedMoulya â€” FINAL-03A: Production Composition + Real Failure Path
//
// Proves the structured root-cause diagnosis is wired into the REAL
// production composition (`createMissionRuntime`) and reaches the EXISTING
// governed repair/revision mechanism â€” with the only test double being a
// ProviderAdapter implementing the frozen ProviderAdapter contract (exactly
// as the BLD-022/AUTONOMY-08 certification suites do).
//
// Nothing is mocked: the real MissionControllerService, real
// PlanningApplicationService/PlannerService, real AgentExecutionService,
// real governed ToolRegistry, real workspace files, real run_command
// subprocess, real verification.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { AIOrchestrationService } from '@vedmoulya/services';
import type { ProviderAdapter } from '@vedmoulya/services';
import type { AIResponse, CapabilityType } from '@vedmoulya/ai';
import { MockProvider } from '@vedmoulya/orchestrator';
import { InMemoryCheckpointStore, InMemoryMissionStore } from '@vedmoulya/mission-controller';
import {
  MissionDiagnosisAdapter,
  WORKSPACE_WRITE_TOOL,
  createMissionRuntime,
  repositoryMissionConstraints,
} from '../index.js';
import type { MissionRuntime } from '../index.js';

const ALL_CAPABILITIES: CapabilityType[] = [
  'reasoning',
  'coding',
  'vision',
  'embeddings',
  'summarization',
  'classification',
  'translation',
  'speech',
  'image_understanding',
  'general_conversation',
  'content_generation',
];

const tempRoots: string[] = [];
function newWorkspace(label: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), `vedmoulya-final03a-${label}-`));
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

/**
 * A real, tiny repository with an INTENTIONALLY FAILING test. The test file
 * is plain Node (no test framework dependency) so the governed `npm test`
 * command really exits non-zero, and the repair (writing the source file)
 * really makes it exit zero.
 */
function seedFailingRepository(workspace: string): { sourcePath: string } {
  mkdirSync(workspace, { recursive: true });
  writeFileSync(
    path.join(workspace, 'package.json'),
    JSON.stringify(
      {
        name: 'final03a-fixture',
        version: '1.0.0',
        private: true,
        scripts: { test: 'node test.js' },
      },
      null,
      2,
    ),
    'utf8',
  );
  // The source under repair: intentionally WRONG (adds instead of multiplies).
  const sourcePath = path.join(workspace, 'src.js');
  writeFileSync(
    sourcePath,
    'function multiply(a, b) { return a + b; }\nmodule.exports = { multiply };\n',
    'utf8',
  );
  writeFileSync(
    path.join(workspace, 'test.js'),
    [
      "const assert = require('node:assert');",
      "const { multiply } = require('./src.js');",
      'assert.strictEqual(multiply(3, 4), 12, "multiply(3, 4) must equal 12");',
      "console.log('all tests pass');",
      '',
    ].join('\n'),
    'utf8',
  );
  return { sourcePath };
}

function makeRuntime(
  workspace: string,
  overrides: {
    stores?: { missions?: InMemoryMissionStore; checkpoints?: InMemoryCheckpointStore };
    diagnosis?: MissionRuntime['ports']['diagnosis'];
  } = {},
): MissionRuntime {
  return createMissionRuntime({
    workspaceRoot: workspace,
    workspaceTools: true,
    commandTools: true,
    orchestratorOptions: { retryBaseDelayMs: 1 },
    registerProviders: (orch) => {
      orch.registerProvider(new MockProvider());
    },
    stores: overrides.stores,
    diagnosis: overrides.diagnosis,
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TEST 7 â€” PRODUCTION COMPOSITION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

describe('FINAL-03A: production composition wiring', () => {
  it('TEST 7a â€” the REAL production composition exposes the diagnosis dependency', () => {
    const workspace = newWorkspace('composition');
    const runtime = makeRuntime(workspace);

    // The composition root assembled an actual diagnosis port...
    expect(runtime.ports.diagnosis).toBeDefined();
    // ...and it is the production adapter over the EXISTING diagnosis engine.
    expect(runtime.ports.diagnosis).toBeInstanceOf(MissionDiagnosisAdapter);
    expect(typeof runtime.ports.diagnosis?.diagnose).toBe('function');
    // The controller that the API path drives is the real composed service.
    expect(runtime.controller).toBeDefined();
    expect(typeof runtime.controller.runAutonomousLoop).toBe('function');
  });

  it('TEST 7b â€” the diagnosis port is reachable through the SAME runtime MissionService composes', () => {
    const workspace = newWorkspace('composition-service');
    const stores = {
      missions: new InMemoryMissionStore(),
      checkpoints: new InMemoryCheckpointStore(),
    };
    // MissionService composes exactly this shape (workspaceRoot + runtimeOptions).
    const runtime = makeRuntime(workspace, {
      stores: { missions: stores.missions, checkpoints: stores.checkpoints },
    });

    expect(runtime.ports.diagnosis).toBeInstanceOf(MissionDiagnosisAdapter);
    expect(runtime.ports.failureClassifier).toBeDefined();
    expect(runtime.stores.missions).toBe(stores.missions);
    // The API-visible runtime is the composed one, not a test harness.
    expect(runtime.api).toBeDefined();
  });

  it('TEST 7c â€” an explicit opt-out composes honestly without a diagnosis port', () => {
    const workspace = newWorkspace('composition-optout');
    // Default stays ON.
    const runtime = makeRuntime(workspace);
    expect(runtime.ports.diagnosis).toBeDefined();

    // The explicit, deliberate opt-out yields the pre-FINAL-03A behavior.
    const optedOut = createMissionRuntime({ workspaceRoot: workspace, diagnosis: null });
    expect(optedOut.ports.diagnosis).toBeUndefined();
    expect(optedOut.controller).toBeDefined();
  });

  it('TEST 7d â€” the production diagnosis adapter produces a structured diagnosis from real evidence', async () => {
    const adapter = new MissionDiagnosisAdapter();
    const diagnosis = await adapter.diagnose({
      evidence: {
        failureContext: {
          failureClass: 'VERIFICATION_FAILURE',
          reason: 'npm test exited with code 1',
          suggestedAction: 'REVISE_OBJECTIVE',
          evidence: ['step step-2: status=failed verified=false attempts=1'],
          failedObjectiveId: 'obj_1',
          failedObjectiveTitle: 'Fix failing test',
          revisionAttempt: 0,
          failedAt: new Date().toISOString(),
        },
        command: 'npm test',
        exitCode: 1,
        stderr: [
          '> final03a-fixture@1.0.0 test',
          '> node test.js',
          '',
          'node:internal/assert:1',
          'AssertionError [ERR_ASSERTION]: multiply(3, 4) must equal 12',
          '',
          'npm ERR! test failed: exit code 1',
        ].join('\n'),
        stdout: 'failing test: multiply(3, 4) must equal 12',
      },
      objective: 'Fix the failing test in the repository',
      missionContext: 'Repository development mission',
    });

    // Structured, bounded, and derived from the REAL failure text.
    expect(diagnosis.failureClass).toBe('VERIFICATION_FAILURE');
    expect(diagnosis.rootCause).toBeDefined();
    expect(diagnosis.confidence).toBe('HIGH');
    expect(diagnosis.summary.length).toBeGreaterThan(0);
    expect(diagnosis.evidence.length).toBeGreaterThan(0);
    expect(diagnosis.verificationCommand).toBe('npm test');
    expect(typeof diagnosis.suggestedRepair).toBe('string');
  });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TESTS 3 + 5 â€” REAL FAILURE â†’ DIAGNOSIS â†’ GOVERNED REPAIR â†’ RE-VERIFY
//
// A real repository with a real failing `npm test`. The mission uses the
// production repository-fix plan (governed run_command + workspace_write +
// a real re-run). The provider only supplies TEXT (the fixed source); the
// actual file write and the actual test execution go through the governed
// ToolRegistry â€” never through AI text.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * A deterministic provider standing in for a real model. Its ONLY output is
 * natural-language content for AI steps â€” it has no tool access, no shell
 * access, no filesystem access. This is the same boundary every real
 * ProviderAdapter has.
 */
class RepositoryFixSimulatorProvider implements ProviderAdapter {
  name = 'final03a-sim';
  family = 'final03a';
  capabilities: CapabilityType[] = ALL_CAPABILITIES;
  readonly calls: string[] = [];

  async isHealthy(): Promise<boolean> {
    return true;
  }
  async getHealth() {
    return {
      providerId: this.name,
      status: 'healthy' as const,
      latency: 1,
      errorRate: 0,
      lastChecked: new Date(),
      isRateLimited: false,
      rateLimitRemaining: 0,
      rateLimitReset: null,
    };
  }

  async execute(request: {
    messages: Array<{ role: string; content: string }>;
  }): Promise<AIResponse> {
    const last = request.messages[request.messages.length - 1]?.content ?? '';
    this.calls.push(last);
    const lower = last.toLowerCase();
    // The provider answers with TEXT tailored to the step it was asked. Each
    // answer satisfies the frozen plan's rule-based step verification AND
    // describes the real repair; the actual file write and the actual test
    // execution still go through the governed ToolRegistry.
    //
    // Routing note: the production template interpolates the goal into EVERY
    // instruction, and the goal itself contains the words "Fix"/"fixes", so a
    // single-keyword match on "fix" would capture the final verification step
    // too. The steps are therefore routed on the template's DISTINCT
    // instruction phrases (a real model reads the whole instruction, not one
    // word), never on bare keywords.
    let content = 'observed the repository and test state';
    if (lower.includes('inspect the repository')) {
      content =
        'Repository inspection: the workspace is a small node repository with a package.json test script; the test context shows a single assertion on multiply(), so the repository and test context are clear.';
    } else if (lower.includes('diagnose the root cause')) {
      content =
        'The failing test is multiply(3, 4) must equal 12 from the observed process output of the test run. The root cause is an incorrect implementation in src.js: multiply() adds instead of multiplying, so the test fails with the observed assertion failure.';
    } else if (lower.includes('summarize the final repository state')) {
      content =
        'verified: the real governed test command exited successfully and reported that all tests pass, so the goal state is verified with a passing test run.';
    } else if (lower.includes('implement the minimal fix')) {
      content =
        'Fix applied: the implementation of multiply() in workspace file src.js was corrected to return the product instead of the sum, so the diagnosed root cause no longer applies.';
    }
    return {
      content,
      provider: this.name,
      model: 'final03a-sim-v1',
      confidence: 0.9,
      qualityScore: 9,
      latency: 5,
      cost: 0.0001,
      tokenUsage: { input: 10, output: 20, total: 30 },
      validation: {
        passed: true,
        checks: [{ name: 'format', passed: true, score: 10 }],
        overallScore: 10,
        decision: 'pass',
      },
      traceId: 'final03a-sim',
      metadata: {
        providerFamily: 'final03a',
        modelVersion: 'final03a-sim-v1',
        processingTime: 5,
        contextUsed: [],
        routingDecision: {
          selectedProvider: this.name,
          reason: 'Final-03A simulator',
          alternativesConsidered: [],
          strategy: 'balanced',
        },
        validationDetails: [],
      },
    };
  }
}

/**
 * FINAL-03A â€” the mission objective for the REAL repository-fix path.
 *
 * It matches the production `repository-fix` plan template AND carries an
 * explicit repair target, so the shipped production plan performs a REAL
 * governed `workspace_write` repair of the broken source file, re-runs the
 * real test command and re-verifies. This is the FULL production plan
 * (governed test run â†’ observed failure â†’ diagnosis â†’ governed repair write â†’
 * targeted re-run â†’ broader re-run â†’ final verification) â€” no test-only
 * plan, no fabricated repair, no AI-text-to-command execution.
 */
function repositoryRepairObjective(): string {
  return [
    'Fix the failing tests in the repository',
    'by updating the workspace file src.js with',
    'function multiply(a, b) { return a * b; }',
    'module.exports = { multiply };',
  ].join(' ');
}

// â”€â”€ Operator workspaces with a REAL failing test â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * The operator-attested workspace writes the repository files BEFORE the
 * mission starts (a real filesystem, not a mock). The repair itself must
 * still go through the governed workspace tool: the test asserts the file's
 * content changed because the mission's governed write ran, and the real
 * `npm test` subprocess exit status flipped from non-zero to zero.
 */
function workspaceRootAndSource(label: string): { workspace: string; sourcePath: string } {
  const workspace = newWorkspace(label);
  const { sourcePath } = seedFailingRepository(workspace);
  return { workspace, sourcePath };
}

// A recording diagnosis port that wraps the REAL production adapter, so the
// test can prove the production path actually invoked diagnosis (without
// substituting the diagnosis engine itself).
function recordingProductionDiagnosis(): {
  port: import('@vedmoulya/mission-controller').FailureDiagnosisPort;
  provided: Array<{ objective: string; evidence: unknown }>;
} {
  const inner = new MissionDiagnosisAdapter();
  const provided: Array<{ objective: string; evidence: unknown }> = [];
  return {
    provided,
    port: {
      diagnose: async (input) => {
        provided.push({ objective: input.objective, evidence: input.evidence });
        return inner.diagnose(input);
      },
    },
  };
}

describe('FINAL-03A: real governed failure â†’ diagnosis â†’ repair â†’ re-verify', () => {
  it('TEST 3 â€” repair remains governed: real commands, governed repair write, no unauthorized tools', async () => {
    const { workspace, sourcePath } = workspaceRootAndSource('real-governed');
    const recorder = recordingProductionDiagnosis();
    const runtime = createMissionRuntime({
      workspaceRoot: workspace,
      workspaceTools: true,
      commandTools: true,
      orchestratorOptions: { retryBaseDelayMs: 1 },
      registerProviders: (orch) => {
        orch.registerProvider(new RepositoryFixSimulatorProvider());
      },
      diagnosis: recorder.port,
    });

    // The broken source really fails the real test command BEFORE the mission.
    const brokenSource = readFileSync(sourcePath, 'utf8');
    expect(brokenSource).toContain('a + b');

    const mission = await runtime.controller.createMission({
      userId: 'final03a-user',
      title: 'Fix the failing test',
      objective: 'Fix the failing test in the repository',
      mode: 'DEVELOPMENT',
      workspace,
      constraints: repositoryMissionConstraints(),
      budget: { maxRetries: 3, maxReplans: 3, maxObjectives: 3 },
      initialObjectives: [repositoryRepairObjective()],
    });
    await runtime.controller.startMission(mission.missionId);
    const done = await runtime.controller.runAutonomousLoop(mission.missionId);

    // 1. The real governed command tool executed a real subprocess.
    const audit = runtime.toolRegistry.getAuditTrail();
    const commandEvents = audit.filter((e) => e.toolName === 'run_command');
    expect(commandEvents.length).toBeGreaterThanOrEqual(1);
    // 2. Every real workspace mutation went through the governed write tool.
    const writeEvents = audit.filter(
      (e) => e.toolName === WORKSPACE_WRITE_TOOL && e.outcome === 'success',
    );
    expect(writeEvents.length).toBeGreaterThanOrEqual(1);
    // 3. No unauthorized tool ever ran.
    const unauthorized = audit.filter(
      (e) => !['run_command', WORKSPACE_WRITE_TOOL, 'workspace_read'].includes(e.toolName),
    );
    expect(unauthorized).toHaveLength(0);

    // 4. The production diagnosis path produced structured diagnoses, derived
    //    from the REAL observed failure evidence.
    expect(recorder.provided.length).toBeGreaterThanOrEqual(1);
    const diagnosisRecord = done.objectives[0]?.diagnosisHistory?.[0];
    expect(diagnosisRecord?.diagnosis.failureClass).toBeDefined();
    expect(diagnosisRecord?.diagnosis.evidence.length).toBeGreaterThan(0);
    expect(diagnosisRecord?.diagnosis.summary.length).toBeGreaterThan(0);
    expect(typeof diagnosisRecord?.diagnosis.suggestedRepair).toBe('string');
    // The diagnosis was built from evidence the controller observed (the real
    // failing process output), never from fabricated input.
    const observed = recorder.provided[0]?.evidence as
      { exitCode?: number; stderr?: string } | undefined;
    expect(observed?.exitCode).toBe(1);
    expect((observed?.stderr ?? '').length).toBeGreaterThan(0);

    // 5. The diagnosis reached the EXISTING repair path â€” and the repair
    //    itself ran through the governed workspace tool, really fixing the
    //    file on disk (the broken `a + b` is gone).
    expect(done.objectives[0]?.state).toBe('VERIFIED');
    expect(done.objectives[0]?.verifiedOutcome?.achieved).toBe(true);
    const repairedSource = readFileSync(sourcePath, 'utf8');
    expect(repairedSource).toContain('a * b');
    expect(repairedSource).not.toContain('a + b');
    // The controller recorded that the frozen bounded policy permitted repair.
    expect(diagnosisRecord?.nextAction).toBe('REPAIR');
    expect(diagnosisRecord?.repairPermitted).toBe(true);
    // 6. Success is never fabricated: VERIFIED implies a real verified outcome.
    expect(done.state).toBe('COMPLETED');
  }, 120_000);
});
