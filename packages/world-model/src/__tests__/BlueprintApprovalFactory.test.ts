// SPRINT-034 — BlueprintApprovalFactory
// A blueprint produces approval requests for gated steps ONLY through the
// existing A/B/C/D authority. Structural proofs: no self-authorization, no
// execution path, `executed:false` is immutable at this layer.

import { describe, expect, it } from 'vitest';
import { ActionClassPolicy } from '@vedmoulya/proactive';
import { BlueprintApprovalFactory } from '../domain/BlueprintApprovalFactory.js';
import type { WorldActionPort } from '../contracts/world-ports.js';
import type { WorkflowExecutionBlueprint } from '../types/world-types.js';

const actionPort: WorldActionPort = {
  classify: (action, opts) => new ActionClassPolicy().classify(action, opts),
};

const now = (): string => '2026-08-15T10:00:00.000Z';

function makeBlueprint(stepLabel: string): WorkflowExecutionBlueprint {
  return {
    id: 'bp-1',
    ownerId: 'alice',
    sourceTitle: 'AI automation service',
    sourceGoal: 'Build a repeatable AI automation service',
    steps: [
      {
        id: 's1',
        label: stepLabel,
        actionClass: 'A',
        approvalGateRequired: false,
        dependsOn: [],
      },
    ],
    bounds: { allowed: true, reason: 'within bounds' },
    approvalGates: [],
    executed: false,
    authorizationRequired: true,
    createdAt: now(),
  };
}

describe('BlueprintApprovalFactory', () => {
  it('produces an approval request for a class-C step (existing policy)', () => {
    const factory = new BlueprintApprovalFactory(actionPort, now);
    const blueprint = makeBlueprint('Publish the content to YouTube');
    const step = blueprint.steps[0];
    if (!step) throw new Error('no step');
    const result = factory.build({
      ownerId: 'alice',
      blueprint,
      step,
      providerId: 'provider-x',
      estimatedCostUsd: { value: 5, status: 'ESTIMATED', evidence: ['quote'] },
      dataScope: 'public content',
      expectedOutcome: 'Published video',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const request = result.data;
    expect(request.status).toBe('WAITING_FOR_APPROVAL');
    expect(request.authorityRequired).toBe('C');
    expect(request.executed).toBe(false);
    expect(request.reversibility).toBe('IRREVERSIBLE');
    expect(request.riskLevel).toBe('HIGH');
    expect(request.estimatedCostUsd?.value).toBe(5);
    expect(request.stableKey).toContain('bp-1');
    expect(request.stableKey).toContain('s1');
  });

  it('REFUSES a request for a class-A step (low-risk per existing policy)', () => {
    const factory = new BlueprintApprovalFactory(actionPort, now);
    const blueprint = makeBlueprint('Draft a research summary');
    const step = blueprint.steps[0];
    if (!step) throw new Error('no step');
    const result = factory.build({ ownerId: 'alice', blueprint, step });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('NOT_SENSITIVE');
  });

  it('never fabricates approval — the request carries no decision and executed:false is structural', () => {
    const factory = new BlueprintApprovalFactory(actionPort, now);
    const blueprint = makeBlueprint('Send an invoice to the customer');
    const step = blueprint.steps[0];
    if (!step) throw new Error('no step');
    const result = factory.build({ ownerId: 'alice', blueprint, step });
    expect(result.success).toBe(true);
    if (!result.success) return;
    // A request is born WAITING with NO decision — the factory never approves.
    expect(result.data.decision).toBeUndefined();
    expect(result.data.status).toBe('WAITING_FOR_APPROVAL');
    // `executed` is a literal `false` type — the factory has no surface to
    // ever produce an executed blueprint (structural, type-level proof).
    expect(result.data.executed).toBe(false);
    // There is no approve/spend/execute method on the factory (runtime proof).
    const prototype = Object.getOwnPropertyNames(Object.getPrototypeOf(factory));
    expect(prototype.some((m) => /approve|execute|spend/i.test(m))).toBe(false);
  });

  it('exposes the full approval surface (action/reason/cost/scope/outcome/reversibility)', () => {
    const factory = new BlueprintApprovalFactory(actionPort, now);
    const blueprint = makeBlueprint('Publish the content to YouTube');
    const step = blueprint.steps[0];
    if (!step) throw new Error('no step');
    const result = factory.build({
      ownerId: 'alice',
      blueprint,
      step,
      providerId: 'provider-x',
      estimatedCostUsd: { value: 3, status: 'ESTIMATED', evidence: ['quote'] },
      dataScope: 'public content',
      expectedOutcome: 'Published video',
    });
    if (!result.success) throw new Error('build failed');
    expect(result.data.action.length).toBeGreaterThan(0);
    expect(result.data.reason.length).toBeGreaterThan(0);
    expect(result.data.providerId).toBe('provider-x');
    expect(result.data.dataScope).toBe('public content');
    expect(result.data.expectedOutcome).toBe('Published video');
  });
});
