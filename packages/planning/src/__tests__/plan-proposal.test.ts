// ──────────────────────────────────────────────────────────────────
// Plan Proposal Parsing — the UNTRUSTED-input safety boundary. Every
// rejection here proves the planner cannot be steered into executing
// something the model invented (providers, models, tools, capabilities,
// unbounded recovery).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { MAX_PLAN_STEPS, parsePlanProposal, planFromProposal } from '../domain/plan-proposal.js';
import { validProposalJson } from './fixtures.js';

function proposalWith(overrides: Record<string, unknown>): string {
  const base = JSON.parse(validProposalJson()) as Record<string, unknown>;
  return JSON.stringify({ ...base, ...overrides });
}

function stepWith(overrides: Record<string, unknown>, stepIndex = 0): string {
  const base = JSON.parse(validProposalJson()) as {
    steps: Array<Record<string, unknown>>;
  };
  base.steps[stepIndex] = { ...base.steps[stepIndex], ...overrides };
  return JSON.stringify(base);
}

describe('parsePlanProposal — trusted shapes', () => {
  it('parses a valid proposal (plain JSON and code-fenced)', () => {
    const plain = parsePlanProposal(validProposalJson());
    expect(plain.ok).toBe(true);
    if (plain.ok) {
      expect(plain.plan.steps.length).toBe(3);
      expect(plain.plan.steps[0]?.dependencies).toEqual([]);
      expect(plain.plan.steps[1]?.dependencies).toEqual(['step-1']);
      expect(plain.plan.finalVerification?.kind).toBe('rule');
    }
    const fenced = parsePlanProposal(`\`\`\`json\n${validProposalJson()}\n\`\`\``);
    expect(fenced.ok).toBe(true);
  });

  it('assigns deterministic step ids when the model omits them', () => {
    const withMissingIds = proposalWith({
      steps: JSON.parse(validProposalJson()).steps.map(
        ({ stepId: _stepId, ...rest }: { stepId?: string; [k: string]: unknown }) => rest,
      ),
    });
    const parsed = parsePlanProposal(withMissingIds);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const plan = planFromProposal(parsed.plan, 'goal-1', 'plan-1');
      expect(plan.steps.map((s) => s.stepId)).toEqual(['step-1', 'step-2', 'step-3']);
    }
  });

  it('rejects non-JSON output', () => {
    const parsed = parsePlanProposal('this is not json at all');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.join(' ')).toContain('not valid JSON');
  });

  it('rejects a non-object top level', () => {
    const parsed = parsePlanProposal('[1,2,3]');
    expect(parsed.ok).toBe(false);
  });
});

describe('parsePlanProposal — safety boundary (untrusted input)', () => {
  it('rejects provider/model routing directives (planner cannot bypass routing)', () => {
    const withProvider = proposalWith({ provider: 'gemini', model: 'gemini-2.0-flash' });
    const parsed = parsePlanProposal(withProvider);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.join(' ')).toContain('provider');
      expect(parsed.errors.join(' ')).toContain('model');
    }
  });

  it('rejects provider directives inside steps (never silently dropped)', () => {
    const parsed = parsePlanProposal(stepWith({ provider: 'openai' }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.join(' ')).toContain('provider');
  });

  it('rejects unknown capabilities', () => {
    const parsed = parsePlanProposal(stepWith({ capability: 'teleportation' }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.join(' ')).toContain('CapabilityType');
  });

  it('rejects unknown required capabilities', () => {
    const parsed = parsePlanProposal(
      stepWith({ requiredCapabilities: ['coding', 'mind_reading'] }),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.join(' ')).toContain('mind_reading');
  });

  it('rejects unbounded recovery (infinite loops are impossible by construction)', () => {
    const parsed = parsePlanProposal(stepWith({ recovery: { maxAttempts: 99, maxRevisions: 50 } }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.join(' ')).toContain('maxAttempts');
      expect(parsed.errors.join(' ')).toContain('maxRevisions');
    }
  });

  it('rejects malformed verification policies', () => {
    const badRule = parsePlanProposal(
      stepWith({ verification: { kind: 'rule', description: 'x', checks: [] } }),
    );
    expect(badRule.ok).toBe(false);
    const unknownKind = parsePlanProposal(
      stepWith({ verification: { kind: 'guessing', description: 'x', checks: [] } }),
    );
    expect(unknownKind.ok).toBe(false);
    const badSchema = parsePlanProposal(
      stepWith({ verification: { kind: 'schema', description: 'x', requiredKeys: [] } }),
    );
    expect(badSchema.ok).toBe(false);
  });

  it('rejects malformed dependencies (non-string entries)', () => {
    const parsed = parsePlanProposal(stepWith({ dependencies: ['step-1', 42] }));
    expect(parsed.ok).toBe(false);
  });

  it('rejects duplicate step ids', () => {
    const base = JSON.parse(validProposalJson()) as { steps: Array<Record<string, unknown>> };
    base.steps[1] = { ...base.steps[1], stepId: 'step-1' };
    const parsed = parsePlanProposal(JSON.stringify(base));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.join(' ')).toContain('duplicated');
  });

  it('rejects too many steps (plan size is bounded)', () => {
    const base = JSON.parse(validProposalJson()) as { steps: Array<Record<string, unknown>> };
    const steps = base.steps[0];
    for (let i = 1; i <= MAX_PLAN_STEPS; i++) {
      base.steps.push({ ...steps, stepId: `step-extra-${String(i)}` });
    }
    const parsed = parsePlanProposal(JSON.stringify(base));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.join(' ')).toContain('exceeds the maximum');
  });

  it('rejects non-object tool arguments (never spreads untrusted objects)', () => {
    const parsed = parsePlanProposal(
      JSON.stringify({
        objective: 'use a tool',
        steps: [
          {
            stepId: 'step-1',
            objective: 'call tool',
            allowedTools: ['echo'],
            dependencies: [],
            actions: [{ kind: 'tool', toolName: 'echo', arguments: 'not-an-object' }],
          },
        ],
      }),
    );
    expect(parsed.ok).toBe(false);
  });

  it('converts a validated proposal into the frozen AgentPlan contract', () => {
    const parsed = parsePlanProposal(validProposalJson());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const plan = planFromProposal(parsed.plan, 'goal-abc', 'plan-abc');
    expect(plan.goalId).toBe('goal-abc');
    expect(plan.planId).toBe('plan-abc');
    expect(plan.steps[0]?.actions[0]?.kind).toBe('ai');
    expect(plan.steps[0]?.verificationPolicy?.kind).toBe('rule');
    expect(plan.steps[0]?.recoveryPolicy?.maxAttempts).toBe(2);
    expect(plan.finalVerification?.kind).toBe('rule');
  });
});
