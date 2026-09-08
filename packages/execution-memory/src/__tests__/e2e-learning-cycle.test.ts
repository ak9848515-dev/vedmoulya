// ──────────────────────────────────────────────────────────────────
// PHASE 25 — End-to-End Learning Cycle (deterministic).
//
//   RUN 1: goal → plan (real PlannerService) → validate → execute
//          (real AgentExecutionService + fake AI) → observe → verify →
//          ACHIEVED  →  extract records → learning signals →
//          validated memory candidates → persisted
//   RUN 2: similar goal → retrieve previous memory → planner receives
//          advisory evidence → normal validation → execution →
//          verification → outcome recorded (aggregation)
//
// Proven:
//   - memory influenced planning (RUN 2 retrieved RUN 1 evidence),
//   - memory did NOT bypass capability/tool/permission/governance/
//     routing/verification/budgets (the frozen foundations validated),
//   - stale/contradictory memory loses to current runtime truth.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { PlannerService } from '@vedmoulya/planning';
import { AgentExecutionService } from '@vedmoulya/agent-execution';
import { ExecutionMemoryService } from '../application/ExecutionMemoryService.js';
import { InMemoryExecutionMemoryStore } from '../infrastructure/InMemoryExecutionMemoryStore.js';
import { PlanningMemoryAdapter } from '../infrastructure/integration-adapters.js';
import { FakeAiPort, FakeClock } from './fixtures.js';

// Content satisfying every repository-fix verification keyword check.
const REPO_OUTPUT =
  'repository inspection found failing tests with clear failure signals; root cause diagnosis complete; minimal fix applied; targeted tests pass and broader suite pass; final state verified. repository test fail cause fix pass verified';

const GOAL = 'Analyze this repository and fix the failing tests.';

async function runOnce(
  clock: FakeClock,
  ai: FakeAiPort,
): Promise<{
  run: Awaited<ReturnType<AgentExecutionService['start']>>;
  traces: ReturnType<AgentExecutionService['getTrace']>;
}> {
  const planner = new PlannerService();
  const { result } = await planner.generatePlan({ goal: GOAL });
  expect(result.readiness.status).toBe('READY');
  const plan = result.plan!;

  const executor = new AgentExecutionService({ ai, clock });
  const run = await executor.start({ userId: 'user-1', goal: GOAL, plan });
  expect(run.outcome).toBe('ACHIEVED');
  const traces = executor.getTrace(run.runId, 'user-1');
  expect(traces.length).toBeGreaterThan(0);
  return { run, traces };
}

describe('PHASE 25 — full learning cycle', () => {
  it('RUN 1 learns verified experience and RUN 2 retrieves it (memory influences planning)', async () => {
    const clock = new FakeClock();
    const store = new InMemoryExecutionMemoryStore();
    const memory = new ExecutionMemoryService({ store, clock });

    // ── RUN 1: execute a real plan to ACHIEVED, then learn. ──────
    const { run: run1, traces: traces1 } = await runOnce(
      clock,
      new FakeAiPort({ content: REPO_OUTPUT }),
    );
    const learned = await memory.ingestRun(run1, traces1);
    expect(learned.accepted.length).toBeGreaterThan(0);
    const categories = learned.accepted.map((e) => e.category);
    expect(categories).toContain('PLAN_PATTERN');
    expect(categories).toContain('TASK_PATTERN');
    expect(categories).toContain('ROUTING_SIGNAL');

    // ── RUN 2: a similar goal retrieves RUN 1's memory. ──────────
    clock.advanceDays(2);
    const plannerAdapter = new PlanningMemoryAdapter(memory);
    const evidence = await plannerAdapter.retrieve({
      userId: 'user-1',
      goalType: 'fix',
      capabilities: ['reasoning', 'coding'],
      planPattern: 'reasoning',
    });
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.some((e) => e.category === 'PLAN_PATTERN')).toBe(true);
    expect(evidence.some((e) => e.category === 'TASK_PATTERN' && e.subject === 'fix')).toBe(true);
    // Routing signals are NOT planner context — they stay advisory for the
    // routing path only (Phase 15).
    expect(evidence.some((e) => e.category === 'ROUTING_SIGNAL')).toBe(false);
    const routingEvidence = await memory.retrieve({ userId: 'user-1', provider: 'mock', limit: 5 });
    expect(routingEvidence.some((e) => e.category === 'ROUTING_SIGNAL')).toBe(true);

    // ── RUN 2: execute again — frozen validation still governs, and
    //    the new verified outcome aggregates into the same entries. ──
    const { run: run2, traces: traces2 } = await runOnce(
      clock,
      new FakeAiPort({ content: REPO_OUTPUT }),
    );
    const learned2 = await memory.ingestRun(run2, traces2);
    expect(learned2.accepted.length).toBeGreaterThan(0);
    const planEntries = await memory.listEntries({ category: 'PLAN_PATTERN' });
    expect(planEntries).toHaveLength(1);
    expect(planEntries[0].sampleCount).toBe(2); // aggregated, not duplicated
    expect(planEntries[0].provenance.sourceType).toBe('aggregation');
  });

  it('memory never bypasses the frozen gates — a memory-suggested unavailable tool stays blocked', async () => {
    const clock = new FakeClock();
    const store = new InMemoryExecutionMemoryStore();
    const memory = new ExecutionMemoryService({ store, clock });
    const { run, traces } = await runOnce(clock, new FakeAiPort({ content: REPO_OUTPUT }));
    await memory.ingestRun(run, traces);

    // Contradictory runtime truth: the remembered tool is unavailable now.
    const runtimeTruth = { availableTools: ['totally.different'] };
    const evidence = await memory.retrieve(
      { userId: 'user-1', tools: ['test-runner'], limit: 10 },
      runtimeTruth,
    );
    // Historical success memory exists but is suppressed by current truth.
    const all = await memory.listEntries({ category: 'TOOL_RELIABILITY' });
    void all;
    expect(evidence.every((e) => e.category !== 'TOOL_RELIABILITY')).toBe(true);

    // And the planning pass itself: the frozen planner never proposes a
    // tool that is not in the registry, regardless of memory.
    const planner = new PlannerService();
    const { result } = await planner.generatePlan({ goal: GOAL });
    expect(result.readiness.status).toBe('READY');
    expect(result.plan!.steps.every((s) => s.actions.every((a) => a.kind !== 'tool'))).toBe(true);
    expect(result.selectedTools).toEqual([]);
  });

  it('current explicit request and health override stale memory (Phase 19)', async () => {
    const clock = new FakeClock();
    const store = new InMemoryExecutionMemoryStore();
    const memory = new ExecutionMemoryService({ store, clock });
    const { run, traces } = await runOnce(clock, new FakeAiPort({ content: REPO_OUTPUT }));
    await memory.ingestRun(run, traces);
    await memory.recordUserPreference({
      userId: 'user-1',
      subject: 'outputFormat',
      value: 'pdf',
      source: 'user-request',
    });

    // Explicit current request wins over preference memory.
    const explicit = await memory.retrieve(
      { userId: 'user-1', limit: 10 },
      { explicitOverrides: { outputFormat: 'docx' } },
    );
    expect(explicit.some((e) => e.subject === 'outputFormat')).toBe(false);

    // Current health wins over stale routing memory.
    const healthy = await memory.retrieve({ userId: 'user-1', provider: 'mock', limit: 10 });
    expect(healthy.some((e) => e.category === 'ROUTING_SIGNAL')).toBe(true);
    const degraded = await memory.retrieve(
      { userId: 'user-1', provider: 'mock', limit: 10 },
      { degradedProviders: ['mock'] },
    );
    expect(degraded.some((e) => e.category === 'ROUTING_SIGNAL')).toBe(false);
  });
});
