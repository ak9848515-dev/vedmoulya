// ──────────────────────────────────────────────────────────────────
// VedMoulya — PRODUCT-001: Mission → REAL AI → execution → verification
//                → memory → experience → next objective
//
// The canonical autonomous intelligence loop is MissionControllerService
// (see MissionRuntime). This test enters through that loop — not through a
// direct AI call — and proves the full acceptance path END TO END:
//
//   USER GOAL → mission → objective 1 → understand → plan → EXECUTE on a
//   REAL ProviderAdapter (OllamaProvider) → real AgentExecutionRun →
//   verification → memory.ingestRun → experience signal → objective 2 →
//   COMPLETE — all with NO second user prompt.
//
// The ONLY test double is the transport: a stubbed `fetch` stands in for a
// running Ollama server, so the REAL OllamaProvider adapter executes. The
// deterministic MockProvider is ALSO registered, and the test proves it is
// never chosen while the real adapter is available.
// ──────────────────────────────────────────────────────────────────

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { MockProvider, OllamaProvider } from '@vedmoulya/orchestrator';
import { ExecutionMemoryService } from '@vedmoulya/execution-memory';
import {
  ExperienceMemoryPortAdapter,
  ExperienceOptimizationService,
  InMemoryRecommendationOutcomeStore,
} from '@vedmoulya/experience-optimization';
import { createMissionRuntime, WORKSPACE_WRITE_TOOL } from '../index.js';
import type { MissionRuntime } from '../index.js';

const INSTALLED_MODEL = 'qwen2.5-coder:7b-instruct';

/** Ollama `/api/tags` — the model the adapter will really execute. */
const tagsResponse = (): Response =>
  new Response(
    JSON.stringify({ models: [{ name: INSTALLED_MODEL, capabilities: ['completion', 'tools'] }] }),
    { status: 200 },
  );

/** Ollama `/api/chat` — a real generation reply. */
const chatResponse = (content: string): Response =>
  new Response(
    JSON.stringify({
      model: INSTALLED_MODEL,
      message: { role: 'assistant', content },
      prompt_eval_count: 12,
      eval_count: 9,
    }),
    { status: 200 },
  );

const tempRoots: string[] = [];
function newWorkspace(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vedmoulya-product-001-'));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  vi.unstubAllGlobals();
});
afterAll(() => {
  for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true });
});

const workspaceAuditWrites = (runtime: MissionRuntime): number =>
  runtime.toolRegistry
    .getAuditTrail()
    .filter((event) => event.toolName === WORKSPACE_WRITE_TOOL && event.outcome === 'success')
    .length;

describe('PRODUCT-001 — canonical Mission loop on a REAL provider (not mock)', () => {
  it('runs USER goal → objective 1 → objective 2 on OllamaProvider with real run, verification, memory and experience', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const href = String(url);
        calls.push(href);
        return href.endsWith('/api/tags')
          ? tagsResponse()
          : chatResponse('verified: real local model summary output');
      }),
    );

    const workspace = newWorkspace();

    // REAL learning estate — the SAME services production uses. Spied so the
    // test can prove ingestion/experience really happened after verification.
    const memory = new ExecutionMemoryService();
    const ingestSpy = vi.spyOn(memory, 'ingestRun');
    const optimization = new ExperienceOptimizationService({
      memory: new ExperienceMemoryPortAdapter(memory),
      outcomes: new InMemoryRecommendationOutcomeStore(),
    });
    const recommendSpy = vi.spyOn(optimization, 'recommend');

    // The deterministic mock is registered — and must never be chosen.
    const mock = new MockProvider();
    const mockExecute = vi.spyOn(mock, 'execute');

    const runtime: MissionRuntime = createMissionRuntime({
      workspaceRoot: workspace,
      orchestratorOptions: { retryBaseDelayMs: 1 },
      // Production wiring point: register the REAL local adapter alongside the
      // mock. The runtime's own routing intelligence (advisor) is active here
      // because MissionRuntime configures it for a self-created orchestrator.
      registerProviders: (orchestrator) => {
        orchestrator.registerProvider(new OllamaProvider({ baseUrl: 'http://127.0.0.1:11434' }));
        orchestrator.registerProvider(mock);
      },
      memory,
      optimization,
    });

    // ── 1. Real user goal → Mission ──────────────────────────────────────
    const mission = await runtime.controller.createMission({
      userId: 'product-001',
      title: 'PRODUCT-001 real provider loop',
      objective: 'Improve the workspace autonomously',
      mode: 'DEVELOPMENT',
      workspace,
      constraints: {
        allowedTools: ['workspace_write', 'workspace_read'],
        grantedPermissionClasses: ['READ', 'WRITE'],
      },
      initialObjectives: [
        'Create the workspace file product-one.md with the first sprint summary content',
        'Create the workspace file product-two.md with the second sprint summary content',
      ],
    });
    await runtime.controller.startMission(mission.missionId);

    // ── 2. Autonomous execution: ONE loop call drives BOTH objectives ────
    const done = await runtime.controller.runAutonomousLoop(mission.missionId);

    expect(done.state).toBe('COMPLETED');
    expect(done.outcome).toBe('ACHIEVED');
    expect(done.objectives).toHaveLength(2);
    expect(done.objectives.every((objective) => objective.state === 'VERIFIED')).toBe(true);
    expect(done.budgetUsage.objectivesCompleted).toBe(2);
    expect(workspaceAuditWrites(runtime)).toBe(2);
    expect(existsSync(path.join(workspace, 'product-one.md'))).toBe(true);
    expect(existsSync(path.join(workspace, 'product-two.md'))).toBe(true);
    expect(readFileSync(path.join(workspace, 'product-two.md'), 'utf8').length).toBeGreaterThan(0);

    // ── 3. REAL AI: OllamaProvider executed (mock registered, never used) ─
    const chatCalls = calls.filter((call) => call.endsWith('/api/chat'));
    expect(chatCalls.length).toBeGreaterThan(0);
    expect(done.budgetUsage.tokensConsumed).toBeGreaterThan(0);
    expect(mockExecute).not.toHaveBeenCalled();

    // ── 4. Real execution + authoritative verification ───────────────────
    expect(done.objectives.every((objective) => objective.verifiedOutcome?.achieved === true)).toBe(
      true,
    );
    expect(done.objectives[0]?.verifiedOutcome?.evidence.length ?? 0).toBeGreaterThan(0);
    expect(done.objectives[0]?.executionRunId).toBeDefined();

    // ── 5. Memory: the real runs were ingested (both objectives) ─────────
    expect(ingestSpy).toHaveBeenCalled();
    expect(ingestSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

    // ── 6. Experience: the existing optimization received the outcome ─────
    expect(recommendSpy).toHaveBeenCalled();
  });
});
