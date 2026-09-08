// ──────────────────────────────────────────────────────────────────
// Plan Validation + Readiness — pure, deterministic unit coverage for
// paths the planner-service suite exercises only end-to-end.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { DEFAULT_AGENT_RUN_BUDGET } from '@vedmoulya/agent-execution';
import type { AgentPlan, VerificationPolicy } from '@vedmoulya/agent-execution';
import { validateGeneratedPlan } from '../domain/plan-validation.js';
import { computePlanReadiness } from '../domain/plan-readiness.js';
import { FakeToolRegistry } from './fixtures.js';

const BUDGET = DEFAULT_AGENT_RUN_BUDGET;

function simplePlan(overrides: Partial<AgentPlan> = {}): AgentPlan {
  return {
    planId: 'plan-1',
    goalId: 'goal-1',
    objective: 'do the thing',
    steps: [
      {
        stepId: 'step-1',
        objective: 'analyze',
        capability: 'reasoning',
        allowedTools: [],
        dependencies: [],
        actions: [
          {
            actionId: 'a1',
            kind: 'ai',
            capability: 'reasoning',
            instruction: 'Analyze the repository for the goal {goal}.',
          },
        ],
        verificationPolicy: {
          kind: 'rule',
          description: 'analysis produced',
          checks: [{ name: 'has-output', kind: 'minLength', length: 20 }],
        } satisfies VerificationPolicy,
      },
    ],
    ...overrides,
  };
}

describe('validateGeneratedPlan — pure pipeline', () => {
  it('passes a well-formed plan (no issues)', () => {
    const issues = validateGeneratedPlan(simplePlan(), {
      budget: BUDGET,
      constraints: {},
    });
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('requires a tool registry when the plan uses tools', () => {
    const plan = simplePlan({
      steps: [
        {
          stepId: 'step-1',
          objective: 'run calculator',
          capability: 'reasoning',
          allowedTools: ['calculator'],
          dependencies: [],
          actions: [{ actionId: 'a1', kind: 'tool', toolName: 'calculator' }],
          verificationPolicy: {
            kind: 'rule',
            description: 'tool ran',
            checks: [{ name: 'has-result', kind: 'minLength', length: 5 }],
          },
        },
      ],
    });
    const issues = validateGeneratedPlan(plan, { budget: BUDGET, constraints: {} });
    expect(issues.some((i) => i.code === 'TOOL_REGISTRY_REQUIRED' && i.severity === 'error')).toBe(
      true,
    );
  });

  it('flags invalid verification policies', () => {
    const plan = simplePlan({
      steps: [
        {
          stepId: 'step-1',
          objective: 'analyze',
          capability: 'reasoning',
          allowedTools: [],
          dependencies: [],
          actions: [{ actionId: 'a1', kind: 'ai', capability: 'reasoning', instruction: 'do it' }],
          verificationPolicy: {
            kind: 'rule',
            description: 'x',
            checks: [],
          } as VerificationPolicy,
        },
      ],
    });
    const issues = validateGeneratedPlan(plan, { budget: BUDGET, constraints: {} });
    expect(
      issues.some((i) => i.code === 'INVALID_VERIFICATION_POLICY' && i.severity === 'error'),
    ).toBe(true);
  });

  it('warns when alternate recovery tools are outside the allowlist', () => {
    const plan = simplePlan({
      steps: [
        {
          stepId: 'step-1',
          objective: 'analyze',
          capability: 'reasoning',
          allowedTools: ['echo'],
          dependencies: [],
          actions: [{ actionId: 'a1', kind: 'ai', capability: 'reasoning', instruction: 'do it' }],
          recoveryPolicy: { alternateTools: ['calculator'] },
        },
      ],
    });
    const issues = validateGeneratedPlan(plan, { budget: BUDGET, constraints: {} });
    expect(issues.some((i) => i.code === 'ALT_TOOL_NOT_ALLOWED')).toBe(true);
  });

  it('warns when acceptUnknown is set without a verification policy', () => {
    const plan = simplePlan({
      steps: [
        {
          stepId: 'step-1',
          objective: 'analyze',
          capability: 'reasoning',
          allowedTools: [],
          dependencies: [],
          actions: [{ actionId: 'a1', kind: 'ai', capability: 'reasoning', instruction: 'do it' }],
          recoveryPolicy: { acceptUnknown: true },
        },
      ],
    });
    const issues = validateGeneratedPlan(plan, { budget: BUDGET, constraints: {} });
    expect(issues.some((i) => i.code === 'UNKNOWN_ACCEPTED_WITHOUT_POLICY')).toBe(true);
  });

  it('validates tool availability + permission against the registry', () => {
    const plan = simplePlan({
      steps: [
        {
          stepId: 'step-1',
          objective: 'run deploy',
          capability: 'reasoning',
          allowedTools: ['deploy'],
          dependencies: [],
          actions: [{ actionId: 'a1', kind: 'tool', toolName: 'deploy' }],
        },
      ],
    });
    const issues = validateGeneratedPlan(plan, {
      budget: BUDGET,
      constraints: {},
      toolRegistry: new FakeToolRegistry([{ toolName: 'deploy', permissionClass: 'DEPLOYMENT' }]),
    });
    expect(issues.some((i) => i.code === 'INSUFFICIENT_PERMISSION')).toBe(true);
    // High-risk tool without an explicit gate is at least surfaced.
    expect(issues.some((i) => i.code === 'MISSING_APPROVAL_GATE')).toBe(true);
  });
});

describe('computePlanReadiness — deterministic result', () => {
  it('READY when only warnings exist', async () => {
    const plan = simplePlan();
    const issues = validateGeneratedPlan(plan, { budget: BUDGET, constraints: {} });
    const readiness = await computePlanReadiness(plan, issues, {});
    expect(readiness.status).toBe('READY');
    expect(readiness.blockedReasons).toEqual([]);
  });

  it('BLOCKED when any error exists, with explainable reasons', async () => {
    const plan = simplePlan({
      steps: [
        {
          stepId: 'step-1',
          objective: 'analyze',
          capability: 'reasoning',
          allowedTools: ['ghost_tool'],
          dependencies: [],
          actions: [{ actionId: 'a1', kind: 'ai', capability: 'reasoning', instruction: 'do it' }],
        },
      ],
    });
    const issues = validateGeneratedPlan(plan, {
      budget: BUDGET,
      constraints: {},
      toolRegistry: new FakeToolRegistry([{ toolName: 'echo', permissionClass: 'READ' }]),
    });
    const readiness = await computePlanReadiness(plan, issues, {});
    expect(readiness.status).toBe('BLOCKED');
    expect(readiness.blockedReasons.join(' ')).toContain('ghost_tool');
  });

  it('deduplicates identical issues', async () => {
    const plan = simplePlan();
    const issues = validateGeneratedPlan(plan, { budget: BUDGET, constraints: {} });
    const readiness = await computePlanReadiness(plan, [...issues, ...issues], {});
    const keyCounts = new Map<string, number>();
    for (const issue of readiness.issues) {
      const key = `${issue.code}|${issue.stepId ?? ''}`;
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }
    for (const count of keyCounts.values()) {
      expect(count).toBe(1);
    }
  });
});
