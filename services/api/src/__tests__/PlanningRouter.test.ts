// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: planning.* namespace tests
// BLD-017A — Autonomous Planning Intelligence
//
// Exercises planning.plan and planning.planAndExecute through the REAL tRPC
// pipeline (auth + IDOR guard + rate-limit middleware + RouterRegistry
// handler closures). The planner AI port + executor AI/tool ports are
// deterministic fakes — no live providers. Verifies:
//   - deterministic plan → READY with the full observability result
//   - AI mode proposal → parsed + validated → READY
//   - planAndExecute hands ONLY READY plans to the frozen AgentExecutionService
//   - IDOR: a foreign userId is refused by the gateway guard
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { AgentExecutionService } from '@vedmoulya/agent-execution';
import type {
  AgentAiActionInput,
  AgentAiActionResult,
  AgentAiExecutionPort,
  AgentClockPort,
  AgentToolActionResult,
  AgentToolExecutionPort,
  AgentToolInfo,
  AgentToolRegistryPort,
} from '@vedmoulya/agent-execution';
import { PlanningApplicationService } from '@vedmoulya/planning';
import type { PlannerAiPort, PlannerAiProposalResult } from '@vedmoulya/planning';
import { createAppRouter } from '../services/RouterRegistry.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';

// ── Deterministic fakes (hermetic — no live services) ───────────────────────

class FixedClock implements AgentClockPort {
  private ms = 0;
  now(): string {
    return new Date(this.ms).toISOString();
  }
  timestampMs(): number {
    return this.ms;
  }
  advance(ms: number): void {
    this.ms += ms;
  }
}

function validProposalJson(): string {
  return JSON.stringify({
    objective: 'Analyze the repository and fix the failing tests',
    steps: [
      {
        stepId: 'step-1',
        objective: 'Inspect repository state',
        capability: 'reasoning',
        dependencies: [],
        allowedTools: [],
        actions: [
          {
            kind: 'ai',
            capability: 'reasoning',
            instruction: 'Inspect the repository and report its test state with evidence.',
          },
        ],
        verification: {
          kind: 'rule',
          description: 'inspection reported',
          checks: [
            { name: 'has-report', kind: 'includes', text: 'repository' },
            { name: 'has-test', kind: 'includes', text: 'test' },
          ],
        },
        recovery: { maxAttempts: 2, maxRevisions: 1 },
      },
      {
        stepId: 'step-2',
        objective: 'Implement the minimal fix',
        capability: 'coding',
        dependencies: ['step-1'],
        allowedTools: [],
        actions: [
          {
            kind: 'ai',
            capability: 'coding',
            instruction: 'Implement the minimal fix for the failing tests.',
          },
        ],
        verification: {
          kind: 'rule',
          description: 'fix described',
          checks: [{ name: 'has-fix', kind: 'includes', text: 'fix' }],
        },
        recovery: { maxAttempts: 2, maxRevisions: 1 },
      },
      {
        stepId: 'step-3',
        objective: 'Verify the final state',
        capability: 'reasoning',
        dependencies: ['step-2'],
        allowedTools: [],
        actions: [
          {
            kind: 'ai',
            capability: 'reasoning',
            instruction: 'Verify the final repository state.',
          },
        ],
        verification: {
          kind: 'rule',
          description: 'state verified',
          checks: [{ name: 'has-verified', kind: 'includes', text: 'verified' }],
        },
        recovery: { maxAttempts: 2, maxRevisions: 1 },
      },
    ],
    completionCriteria: ['failing tests fixed and verified'],
    finalVerification: {
      kind: 'rule',
      description: 'goal verified',
      checks: [{ name: 'goal-verified', kind: 'includes', text: 'verified' }],
    },
  });
}

class FakePlannerAi implements PlannerAiPort {
  propose(): Promise<PlannerAiProposalResult> {
    return Promise.resolve({
      content: validProposalJson(),
      provider: 'mock',
      model: 'mock-v1',
      tokens: { input: 120, output: 80, total: 200 },
      costUsd: 0.001,
      latencyMs: 3,
    });
  }
  canRoute(): Promise<{ ok: boolean; reason?: string }> {
    return Promise.resolve({ ok: true });
  }
}

class FakeStepAi implements AgentAiExecutionPort {
  async execute(input: AgentAiActionInput): Promise<AgentAiActionResult> {
    // Echo the composed instruction + a pass/verified verdict so the frozen
    // rule checks see deterministic evidence (mirrors the demo provider).
    return {
      content: `${input.instruction}\n\nAll checks pass: the outcome is verified, no failures remaining.`,
      provider: 'mock',
      model: 'mock-v1',
      tokens: { input: 10, output: 60, total: 70 },
      costUsd: 0.001,
      latencyMs: 1,
    };
  }
  canRoute(): Promise<{ ok: boolean; reason?: string }> {
    return Promise.resolve({ ok: true });
  }
}

class FakeToolPort implements AgentToolExecutionPort, AgentToolRegistryPort {
  async execute(input: {
    toolName: string;
    arguments: Record<string, unknown>;
    userId?: string;
  }): Promise<AgentToolActionResult> {
    return { ok: true, denied: false, outcome: `${input.toolName} executed` };
  }
  listAllowed(): string[] {
    return ['calculator'];
  }
  describe(toolName: string): AgentToolInfo | undefined {
    if (toolName === 'calculator') {
      return { toolName, permissionClass: 'EXECUTE', requiresApproval: false };
    }
    return undefined;
  }
}

function makePlanning(): PlanningApplicationService {
  const clock = new FixedClock();
  const tools = new FakeToolPort();
  const executor = new AgentExecutionService({
    ai: new FakeStepAi(),
    tools,
    toolRegistry: tools,
    clock,
  });
  return new PlanningApplicationService({
    ai: new FakePlannerAi(),
    toolRegistry: tools,
    executor,
    clock,
  });
}

function makeServices(): ApiApplicationService {
  return { planning: makePlanning() } as unknown as ApiApplicationService;
}

const ctx = (userId: string) => ({ userId, email: `${userId}@vm.local`, role: 'user' });

interface PlanResultData {
  goalId: string;
  planId: string;
  originalGoal: string;
  source: string;
  plan?: { steps: Array<{ stepId: string }> };
  readiness: { status: string; blockedReasons: string[] };
  issues: Array<{ severity: string; code: string }>;
  selectedCapabilities: string[];
  plannerAi?: { provider?: string; model?: string };
}

describe('planning namespace (BLD-017A)', () => {
  it('plan: deterministic goal → READY plan with full observability', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('planner-1'));

    const response = await caller.planning.plan({
      userId: 'planner-1',
      goal: 'Analyze this repository and fix the failing tests',
    });
    expect(response.success).toBe(true);
    const result = response.data as PlanResultData;
    expect(result.source).toBe('deterministic');
    expect(result.readiness.status).toBe('READY');
    expect(result.plan?.steps.length).toBe(7);
    expect(result.selectedCapabilities).toContain('coding');
    expect(result.selectedCapabilities).toContain('reasoning');
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.goalId.length).toBeGreaterThan(0);
  });

  it('plan: AI mode proposal is parsed + validated through the runtime port', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('planner-2'));

    const response = await caller.planning.plan({
      userId: 'planner-2',
      goal: 'Analyze this repository and fix the failing tests',
      mode: 'ai',
    });
    expect(response.success).toBe(true);
    const result = response.data as PlanResultData;
    expect(result.source).toBe('ai');
    expect(result.plannerAi?.provider).toBe('mock');
    expect(result.readiness.status).toBe('READY');
    expect(result.plan?.steps.length).toBe(3);
  });

  it('plan: underspecified goal returns an honest BLOCKED readiness (no guess)', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('planner-3'));

    const response = await caller.planning.plan({
      userId: 'planner-3',
      goal: 'do stuff',
    });
    expect(response.success).toBe(true);
    const result = response.data as PlanResultData;
    expect(result.readiness.status).toBe('BLOCKED');
    expect(result.readiness.blockedReasons.join(' ')).toContain('too short');
  });

  it('planAndExecute: ONLY READY plans reach the frozen AgentExecutionService', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('planner-4'));

    const response = await caller.planning.planAndExecute({
      userId: 'planner-4',
      goal: 'Analyze this repository and fix the failing tests',
      mode: 'deterministic',
    });
    expect(response.success).toBe(true);
    const data = response.data as {
      planResult: PlanResultData;
      execution?: {
        run: {
          runId: string;
          state: string;
          outcome: string;
          stepResults: Array<{ stepId: string; verified: boolean }>;
        };
        usage: { tokensUsed: number };
      };
    };
    expect(data.planResult.readiness.status).toBe('READY');
    expect(data.execution).toBeDefined();
    expect(data.execution?.run.runId.startsWith('agent-run-')).toBe(true);
    expect(data.execution?.run.state).toBe('COMPLETED');
    expect(data.execution?.run.outcome).toBe('ACHIEVED');
    expect(data.execution?.run.stepResults.every((s) => s.verified)).toBe(true);
    expect(data.execution?.usage.tokensUsed).toBeGreaterThan(0);
  });

  it('planAndExecute: a BLOCKED plan is NEVER executed', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('planner-5'));

    const response = await caller.planning.planAndExecute({
      userId: 'planner-5',
      goal: 'do stuff',
    });
    expect(response.success).toBe(true);
    const data = response.data as { planResult: PlanResultData; execution?: unknown };
    expect(data.planResult.readiness.status).toBe('BLOCKED');
    expect(data.execution).toBeUndefined();
  });

  it('refuses a foreign userId (IDOR) on every planning procedure', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('planner-owner'));

    await expect(
      caller.planning.plan({
        userId: 'planner-attacker',
        goal: 'Analyze this repository and fix the failing tests',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.planning.planAndExecute({
        userId: 'planner-attacker',
        goal: 'Analyze this repository and fix the failing tests',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
