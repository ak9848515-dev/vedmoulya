// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — WorkflowExecutionBlueprint tests (SPRINT-033 Part E)
// The controlled Opportunity → approval → workflow → selection → execution
// (existing bridge) → verification → outcome path — as a REPRESENTATION:
//   • per-step action class comes from the EXISTING authority (A/B/C/D)
//   • class-C steps carry an approval gate ONLY the existing authority clears
//   • `executed:false` + `authorizationRequired:true` are STRUCTURAL
//   • the plan is validated against the EXISTING WorkflowBounds
//   • estimated cost requires evidence (never fabricated)
//   • no voice-only authorization, no hidden execution, no autonomous spending
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ActionClassPolicy } from '@vedmoulya/proactive';
import { WorkflowExecutionBlueprintFactory } from '../domain/WorkflowExecutionBlueprint.js';
import type { WorldActionPort } from '../contracts/world-ports.js';

const now = (): string => '2026-08-15T10:00:00.000Z';

function makeFactory(): WorkflowExecutionBlueprintFactory {
  const policy = new ActionClassPolicy();
  const action: WorldActionPort = { classify: (a, opts) => policy.classify(a, opts) };
  return new WorkflowExecutionBlueprintFactory(action, now);
}

describe('WorkflowExecutionBlueprint — structural guarantees', () => {
  it('executed:false + authorizationRequired:true (structural — never launches)', () => {
    const factory = makeFactory();
    const result = factory.build({
      ownerId: 'u1',
      sourceTitle: 'AI automation service',
      sourceGoal: 'Deliver workflow automation to local businesses.',
      steps: [{ id: 's1', label: 'research the market', dependsOn: [] }],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.executed).toBe(false);
    expect(result.data.authorizationRequired).toBe(true);
  });

  it('class-C steps carry an approval gate via the EXISTING authority', () => {
    const factory = makeFactory();
    const result = factory.build({
      ownerId: 'u1',
      sourceTitle: 'Content business',
      sourceGoal: 'Produce and publish content.',
      steps: [
        { id: 's1', label: 'draft the report', dependsOn: [] },
        { id: 's2', label: 'publish the report to the website', dependsOn: ['s1'] },
      ],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.steps[0]?.actionClass).toBe('A'); // safe verb
    expect(result.data.steps[0]?.approvalGateRequired).toBe(false);
    expect(result.data.steps[1]?.actionClass).toBe('C'); // sensitive
    expect(result.data.steps[1]?.approvalGateRequired).toBe(true);
    expect(result.data.approvalGates).toHaveLength(1);
    expect(result.data.approvalGates[0]?.stepId).toBe('s2');
  });

  it('never-automate actions are recorded class D — never executed', () => {
    const factory = makeFactory();
    const result = factory.build({
      ownerId: 'u1',
      sourceTitle: 'Ops',
      sourceGoal: 'Operate the business.',
      steps: [{ id: 's1', label: 'delete-account permanently', dependsOn: [] }],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.steps[0]?.actionClass).toBe('D');
    // Class D is never approval-gated — it is simply never automated.
    expect(result.data.steps[0]?.approvalGateRequired).toBe(false);
  });

  it('bounds are enforced via the EXISTING WorkflowBounds (SPRINT-030 caps)', () => {
    const factory = makeFactory();
    const overBudget = factory.build({
      ownerId: 'u1',
      sourceTitle: 'Huge plan',
      sourceGoal: 'Do everything at once.',
      steps: Array.from({ length: 8 }, (_, i) => ({
        id: `s${i}`,
        label: `step ${i}`,
        capability: 'REASONING',
        dependsOn: [],
      })),
      estimatedCostUsd: { value: 100, status: 'ESTIMATED', evidence: ['quote'] },
    });
    expect(overBudget.success).toBe(true);
    if (!overBudget.success) return;
    expect(overBudget.data.bounds.allowed).toBe(false);
    expect(overBudget.data.bounds.exceeded).toBe('cost');
  });

  it('a blueprint cannot exceed 24 steps (SPRINT-030 bound)', () => {
    const factory = makeFactory();
    const result = factory.build({
      ownerId: 'u1',
      sourceTitle: 'Too big',
      sourceGoal: 'Too many steps.',
      steps: Array.from({ length: 25 }, (_, i) => ({
        id: `s${i}`,
        label: `step ${i}`,
        dependsOn: [],
      })),
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('TOO_MANY_STEPS');
  });
});

describe('WorkflowExecutionBlueprint — evidence + failure handling', () => {
  it('refuses estimated cost without evidence (nothing fabricated)', () => {
    const factory = makeFactory();
    const result = factory.build({
      ownerId: 'u1',
      sourceTitle: 'Plan',
      sourceGoal: 'Goal.',
      steps: [{ id: 's1', label: 'research', dependsOn: [] }],
      estimatedCostUsd: { value: 50, status: 'ESTIMATED', evidence: [] },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('NO_EVIDENCE');
  });

  it('refuses empty source or missing steps', () => {
    const factory = makeFactory();
    expect(
      factory.build({
        ownerId: 'u1',
        sourceTitle: '',
        sourceGoal: 'x',
        steps: [{ id: 's1', label: 'a', dependsOn: [] }],
      }).success,
    ).toBe(false);
    expect(
      factory.build({
        ownerId: 'u1',
        sourceTitle: 'x',
        sourceGoal: '',
        steps: [{ id: 's1', label: 'a', dependsOn: [] }],
      }).success,
    ).toBe(false);
    expect(
      factory.build({ ownerId: 'u1', sourceTitle: 'x', sourceGoal: 'y', steps: [] }).success,
    ).toBe(false);
  });

  it('steps may name capabilities and roles — never provider ids', () => {
    const factory = makeFactory();
    const result = factory.build({
      ownerId: 'u1',
      sourceTitle: 'Content pipeline',
      sourceGoal: 'Produce a video.',
      steps: [
        {
          id: 's1',
          label: 'research',
          capability: 'RESEARCH',
          roleName: 'CONTENT_RESEARCHER',
          dependsOn: [],
        },
        {
          id: 's2',
          label: 'draft script',
          capability: 'TEXT_GENERATION',
          roleName: 'CONTENT_WRITER',
          dependsOn: ['s1'],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.steps[0]?.capability).toBe('RESEARCH');
    expect(result.data.steps[0]?.roleName).toBe('CONTENT_RESEARCHER');
    // Provider ids never appear on the blueprint — binding stays advisory.
    expect(JSON.stringify(result.data)).not.toContain('providerId');
  });
});
