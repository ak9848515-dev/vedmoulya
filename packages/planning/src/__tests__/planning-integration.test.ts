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
  governedRepositoryToolRegistry,
  validProposalJson,
} from './fixtures.js';

/**
 * FINAL-02 — the repository-fix plan performs REAL repository work through
 * governed tools, so a repository-fix stack exposes the governed repository
 * tools and grants their classes (READ + WRITE + EXECUTE). Non-repository
 * tests keep the read/write default implicitly (they are not affected).
 */
const REPOSITORY_CONSTRAINTS = {
  grantedPermissionClasses: ['READ', 'WRITE', 'EXECUTE'] as ('READ' | 'WRITE' | 'EXECUTE')[],
  // The repository-fix path executes several REAL governed tool actions, so
  // its honest envelope is wider than the frozen 8-tool-call default.
  budget: { maxToolCalls: 24 },
};

/** Content that satisfies every deterministic template rule check. */
const ALL_PASSING_CONTENT =
  'This repository test failure has a root cause diagnosis and a minimal fix applied; ' +
  'the targeted and broader tests pass and the final repository state is verified.';

function buildStack(
  overrides: {
    content?: string;
    tools?: FakeToolRegistry;
    plannerAi?: FakePlannerAi;
    /** Override the default governed repository registry. */
    repositoryTools?: boolean;
  } = {},
) {
  const clock = new FakeClock();
  const registry =
    overrides.tools ??
    (overrides.repositoryTools === false
      ? new FakeToolRegistry([
          { toolName: 'calculator', permissionClass: 'EXECUTE', requiresApproval: false },
        ])
      : governedRepositoryToolRegistry());
  const executor = new AgentExecutionService({
    ai: new FakeAiPort(overrides.content ?? ALL_PASSING_CONTENT),
    tools: new FakeToolPort(),
    toolRegistry: registry,
    clock,
  });
  const application = new PlanningApplicationService({
    executor,
    ai: overrides.plannerAi ?? new FakePlannerAi(),
    toolRegistry: registry,
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
      constraints: REPOSITORY_CONSTRAINTS,
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

  it('a repository-fix tool step really invokes the governed tool through the engine', async () => {
    // FINAL-02 — the command steps are EXPLICIT governed tool actions, so
    // the frozen engine executes them through the real tool port.
    const { application } = buildStack();
    const outcome = await application.planAndExecute({
      userId: 'user-1',
      goal: 'Analyze this repository and fix the failing tests',
      constraints: REPOSITORY_CONSTRAINTS,
    });
    const run = outcome.execution?.run;
    const runCommandActions = (run?.stepResults ?? []).flatMap((step) =>
      step.actions.filter((action) => action.kind === 'tool' && action.toolName === 'run_command'),
    );
    // Three REAL governed command executions: initial failure observation,
    // targeted re-run, broader re-run.
    expect(runCommandActions.length).toBe(3);
    // Every governed command really executed and really succeeded through the
    // engine's tool port (the fix made the suite pass).
    expect(runCommandActions.every((action) => action.status === 'succeeded')).toBe(true);
    // The command steps were verified by the deterministic command check
    // (real outcome), never by model prose.
    const commandSteps = (run?.stepResults ?? []).filter((step) =>
      step.actions.some((action) => action.kind === 'tool' && action.toolName === 'run_command'),
    );
    expect(commandSteps.length).toBe(3);
    for (const step of commandSteps) {
      expect(step.verification?.policyKind).toBe('command');
      expect(step.verified).toBe(true);
    }
  });

  it('AI-assisted goal plans AND executes to ACHIEVED through the same chain', async () => {
    const { application } = buildStack();
    const outcome = await application.planAndExecute({
      userId: 'user-1',
      goal: 'Analyze this repository and fix the failing tests',
      mode: 'ai',
      constraints: REPOSITORY_CONSTRAINTS,
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
      constraints: { ...REPOSITORY_CONSTRAINTS, budget: { maxCostUsd: 0.0001 } },
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
      constraints: REPOSITORY_CONSTRAINTS,
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
      constraints: REPOSITORY_CONSTRAINTS,
    });

    expect(result.plan).toBeDefined();
    expect(result.readiness.status).toBe('READY');
    expect(result.issues).toHaveLength(0);
  });

  it('planAndExecute never executes when no executor is wired (plan-only service)', async () => {
    const application = new PlanningApplicationService({
      ai: new FakePlannerAi(),
      toolRegistry: governedRepositoryToolRegistry(),
      clock: new FakeClock(),
      // no executor
    });

    const outcome = await application.planAndExecute({
      userId: 'user-1',
      goal: 'Analyze this repository and fix the failing tests',
      constraints: REPOSITORY_CONSTRAINTS,
    });

    expect(outcome.planResult.readiness.status).toBe('READY');
    expect(outcome.execution).toBeUndefined();
  });
});
