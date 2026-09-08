// ──────────────────────────────────────────────────────────────────
// Integration — the implementation actually CONNECTS:
//
//   USER GOAL → GOAL UNDERSTANDING → PLAN GENERATION → VALIDATION →
//   READINESS → EXISTING AGENT EXECUTION ENGINE
//
// The frozen AgentExecutionService is the authoritative execution
// kernel: it re-validates the plan, enforces the security chain,
// approval gates and budgets. This suite proves a READY plan from the
// planner executes end-to-end, a BLOCKED plan never executes, and
// governance (approval gates) still pauses the run.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { AgentExecutionService } from '@vedmoulya/agent-execution';
import { PlanningApplicationService } from '../application/PlanningApplicationService.js';
import {
  FakeAiPort,
  FakeClock,
  FakePlannerAi,
  FakeToolPort,
  FakeToolRegistry,
  validProposalJson,
} from './fixtures.js';

/** Content that satisfies every deterministic template rule check. */
const ALL_PASSING_CONTENT =
  'This repository test failure has a root cause diagnosis and a minimal fix applied; ' +
  'the targeted and broader tests pass and the final repository state is verified.';

function buildStack(
  overrides: {
    content?: string;
    tools?: FakeToolRegistry;
    plannerAi?: FakePlannerAi;
  } = {},
) {
  const clock = new FakeClock();
  const executor = new AgentExecutionService({
    ai: new FakeAiPort(overrides.content ?? ALL_PASSING_CONTENT),
    tools: new FakeToolPort(),
    toolRegistry:
      overrides.tools ??
      new FakeToolRegistry([
        { toolName: 'calculator', permissionClass: 'EXECUTE', requiresApproval: false },
      ]),
    clock,
  });
  const application = new PlanningApplicationService({
    executor,
    ai: overrides.plannerAi ?? new FakePlannerAi(),
    toolRegistry:
      overrides.tools ??
      new FakeToolRegistry([
        { toolName: 'calculator', permissionClass: 'EXECUTE', requiresApproval: false },
      ]),
    clock,
  });
  return { executor, application, clock };
}

describe('PlanningApplicationService — GOAL → ... → EXECUTION', () => {
  it('deterministic repository-fix goal plans AND executes to ACHIEVED', async () => {
    const { application } = buildStack();
    const outcome = await application.planAndExecute({
      userId: 'user-1',
      goal: 'Analyze this repository and fix the failing tests',
    });

    expect(outcome.planResult.readiness.status).toBe('READY');
    expect(outcome.execution).toBeDefined();
    const run = outcome.execution?.run;
    expect(run?.state).toBe('COMPLETED');
    expect(run?.outcome).toBe('ACHIEVED');
    // The frozen engine re-validated the produced plan — no issues.
    expect(run?.validationIssues.length).toBe(0);
    // All 7 steps completed and verified.
    expect(run?.stepResults.filter((s) => s.status === 'completed').length).toBe(7);
    expect(run?.stepResults.every((s) => s.verified)).toBe(true);
  });

  it('AI-assisted goal plans AND executes to ACHIEVED through the same chain', async () => {
    const { application } = buildStack();
    const outcome = await application.planAndExecute({
      userId: 'user-1',
      goal: 'Analyze this repository and fix the failing tests',
      mode: 'ai',
    });

    expect(outcome.planResult.source).toBe('ai');
    expect(outcome.planResult.readiness.status).toBe('READY');
    expect(outcome.execution).toBeDefined();
    const run = outcome.execution?.run;
    expect(run?.state).toBe('COMPLETED');
    expect(run?.outcome).toBe('ACHIEVED');
    expect(run?.plan.steps.length).toBe(3);
  });

  it('a BLOCKED plan is NEVER handed to the execution engine', async () => {
    const { application } = buildStack();
    const outcome = await application.planAndExecute({
      userId: 'user-1',
      goal: 'Analyze this repository and fix the failing tests',
      constraints: { budget: { maxCostUsd: 0.0001 } },
    });
    expect(outcome.planResult.readiness.status).toBe('BLOCKED');
    expect(outcome.execution).toBeUndefined();
  });

  it('clarification-required goals are never executed', async () => {
    const { application } = buildStack();
    const outcome = await application.planAndExecute({
      userId: 'user-1',
      goal: 'do stuff',
    });
    expect(outcome.planResult.readiness.status).toBe('BLOCKED');
    expect(outcome.planResult.readiness.blockedReasons.join(' ')).toContain('too short');
    expect(outcome.execution).toBeUndefined();
  });

  it('tool execution goes through the FROZEN engine security chain (not the planner)', async () => {
    const toolProposal = JSON.stringify({
      objective: 'Calculate the total',
      steps: [
        {
          stepId: 'step-1',
          objective: 'Invoke calculator',
          capability: 'reasoning',
          allowedTools: ['calculator'],
          dependencies: [],
          actions: [{ kind: 'tool', toolName: 'calculator', arguments: { expression: '1+1' } }],
          verification: {
            kind: 'rule',
            description: 'tool ran',
            checks: [{ name: 'has-result', kind: 'minLength', length: 5 }],
          },
          recovery: { maxAttempts: 2, maxRevisions: 1 },
        },
      ],
      completionCriteria: ['done'],
    });
    const registry = new FakeToolRegistry([
      { toolName: 'calculator', permissionClass: 'EXECUTE', requiresApproval: false },
    ]);
    const { executor, application } = buildStack({
      tools: registry,
      plannerAi: new FakePlannerAi({ content: toolProposal }),
    });
    const outcome = await application.planAndExecute({
      userId: 'user-1',
      goal: 'Calculate the total cost of the project correctly',
      mode: 'ai',
      constraints: { grantedPermissionClasses: ['READ', 'EXECUTE'] },
    });
    expect(outcome.planResult.readiness.status).toBe('READY');
    expect(outcome.planResult.selectedTools).toEqual(['calculator']);
    expect(outcome.execution).toBeDefined();
    const run = outcome.execution?.run;
    expect(run?.state).toBe('COMPLETED');
    // The tool call was recorded on the RUN (execution trace), proving the
    // frozen engine — not the planner — executed it through its security chain.
    const toolObservations = run?.stepResults.flatMap((s) => s.observations) ?? [];
    expect(toolObservations.some((o) => o.toolName === 'calculator')).toBe(true);
    expect(executor).toBeDefined();
  });

  it('governance remains authoritative: approval-required steps pause the run', async () => {
    const proposal = JSON.parse(validProposalJson()) as { steps: Array<Record<string, unknown>> };
    proposal.steps[0] = { ...proposal.steps[0], approvalRequired: true };
    const { executor, application } = buildStack({
      plannerAi: new FakePlannerAi({ content: JSON.stringify(proposal) }),
    });
    const outcome = await application.planAndExecute({
      userId: 'user-1',
      goal: 'Analyze this repository and fix the failing tests',
      mode: 'ai',
    });
    expect(outcome.planResult.readiness.status).toBe('READY');
    const run = outcome.execution?.run;
    // The run pauses at the governance gate — nothing executes past it.
    expect(run?.state).toBe('WAITING_FOR_APPROVAL');
    expect(run?.approvals.length).toBe(1);
    expect(run?.stepResults[0]?.status).toBe('waiting_approval');

    // A recorded human approval lets the frozen engine continue.
    const approved = await executor.approveStep(run?.runId ?? '', 'user-1', 'step-1');
    expect(approved.state).toBe('COMPLETED');
    expect(approved.outcome).toBe('ACHIEVED');
  });
});

describe('PlanningApplicationService — plan-only and no-executor paths', () => {
  it('generatePlan returns understanding + validated plan WITHOUT executing anything', async () => {
    const { application } = buildStack();

    const result = await application.generatePlan({
      userId: 'user-1',
      goal: 'Analyze this repository and fix the failing tests',
    });

    expect(result.plan).toBeDefined();
    expect(result.readiness.status).toBe('READY');
    expect(result.issues).toHaveLength(0);
  });

  it('planAndExecute never executes when no executor is wired (plan-only service)', async () => {
    const application = new PlanningApplicationService({
      ai: new FakePlannerAi(),
      toolRegistry: new FakeToolRegistry([
        { toolName: 'calculator', permissionClass: 'EXECUTE', requiresApproval: false },
      ]),
      clock: new FakeClock(),
      // no executor
    });

    const outcome = await application.planAndExecute({
      userId: 'user-1',
      goal: 'Analyze this repository and fix the failing tests',
    });

    expect(outcome.planResult.readiness.status).toBe('READY');
    expect(outcome.execution).toBeUndefined();
  });
});
