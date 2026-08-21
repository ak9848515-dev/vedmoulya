import { describe, expect, it } from 'vitest';
import { ActiveIntelligenceControlPlane } from '../application/ActiveIntelligenceControlPlane.js';
import { InMemoryControlStores } from '../infrastructure/InMemoryControlStores.js';
import type {
  ControlBrainPort,
  ControlFabricPort,
  ControlProactivePort,
} from '../contracts/control-ports.js';

function makePlane(overrides: { engaged?: boolean; recs?: unknown[]; approvals?: unknown[] } = {}) {
  const stores = new InMemoryControlStores();
  const brain: ControlBrainPort = {
    listTasksWithApprovals: () =>
      (overrides.approvals ?? [
        { taskId: 't1', title: 'Publish the report', approvalRequired: ['publish'] },
      ]) as never,
    outcomeCount: () => 3,
  };
  const proactive: ControlProactivePort = {
    refresh: async () => ({ success: true }),
    listRecommendations: () =>
      (overrides.recs ?? [
        {
          id: 'r1',
          title: 'Publish the report to the website',
          category: 'OPPORTUNITY',
          authorizationRequired: true,
          riskLevel: 'HIGH',
        },
        {
          id: 'r2',
          title: 'Summarize the weekly report',
          category: 'TASK',
          authorizationRequired: false,
          riskLevel: 'LOW',
        },
      ]) as never,
  };
  const fabric: ControlFabricPort = {
    allProviderHealth: () => [{ providerId: 'openai', state: 'HEALTHY', observedCalls: 5 }],
    costSnapshot: () => ({ dailyUsd: 1.2 }),
  };
  const plane = new ActiveIntelligenceControlPlane({ brain, proactive, fabric, stores });
  if (overrides.engaged) {
    plane.engageStop({ ownerId: 'u1', actor: 'alice', reason: 'test', source: 'user' });
  }
  return { plane, stores };
}

describe('ActiveIntelligenceControlPlane (SPRINT-031)', () => {
  it('observe composes provider health + cost + pending approvals + outcomes', () => {
    const { plane } = makePlane();
    const snap = plane.observe('u1');
    expect(snap.providerHealth[0]?.state).toBe('HEALTHY');
    expect(snap.cost.dailyUsd).toBe(1.2);
    expect(snap.pendingApprovals[0]?.taskId).toBe('t1');
    expect(snap.outcomeCount).toBe(3);
    expect(snap.emergencyStopEngaged).toBe(false);
  });

  it('cycle is BOUNDED and NEVER executes — structural guarantee', async () => {
    const { plane } = makePlane();
    // The user must first explicitly confirm autonomy settings (fail-closed
    // default would otherwise block everything at level 0).
    const updated = plane.updateSettings({
      ownerId: 'u1',
      autonomyLevel: 4,
      maxDailyCostUsd: 10,
      maxTaskCostUsd: 1,
      updatedBy: 'u1',
      userConfirmed: true,
    });
    expect(updated.success).toBe(true);

    const result = await plane.cycle('u1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.executedNothing).toBe(true);
      // Class C proposal → WAITING_FOR_APPROVAL (never executed).
      const publish = result.data.proposed.find((p) => p.id === 'r1');
      expect(publish?.verdict).toBe('WAITING_FOR_APPROVAL');
      const summarize = result.data.proposed.find((p) => p.id === 'r2');
      expect(summarize?.verdict).toBe('ALLOWED');
    }
  });

  it('cycle halts immediately when the emergency stop is engaged', async () => {
    const { plane } = makePlane({ engaged: true });
    const result = await plane.cycle('u1');
    if (result.success) {
      expect(result.data.emergencyStopped).toBe(true);
      expect(result.data.proposed).toEqual([]);
    }
  });

  it('settings updates require explicit confirmation and persist owner-scoped', () => {
    const { plane } = makePlane();
    const denied = plane.updateSettings({
      ownerId: 'u1',
      autonomyLevel: 3,
      updatedBy: 'u1',
      userConfirmed: false,
    });
    expect(denied.success).toBe(false);

    const accepted = plane.updateSettings({
      ownerId: 'u1',
      autonomyLevel: 3,
      maxDailyCostUsd: 5,
      updatedBy: 'u1',
      userConfirmed: true,
    });
    expect(accepted.success).toBe(true);

    const other = plane.getSettings('u2');
    expect(other).toBeUndefined();
    const mine = plane.getSettings('u1');
    expect(mine?.autonomyLevel).toBe(3);
  });

  it('opportunity lifecycle is guarded end-to-end through the control plane', () => {
    const { plane } = makePlane();
    const opp = plane.discoverOpportunity({
      ownerId: 'u1',
      title: 'AI consulting service',
      description: 'Offer workflow automation consulting to local businesses',
      category: 'consulting',
      evidence: [{ label: '3 users requested this in the last month', status: 'VERIFIED' }],
      riskLevel: 'MEDIUM',
      automationPotential: 'MEDIUM',
    });
    // Walk the legal path to PRESENTED, then APPROVED without a record → refused.
    plane.transitionOpportunity({ ownerId: 'u1', id: opp.id, to: 'ASSESSED', note: 'scored' });
    plane.transitionOpportunity({
      ownerId: 'u1',
      id: opp.id,
      to: 'SHORTLISTED',
      note: 'shortlist',
    });
    plane.transitionOpportunity({ ownerId: 'u1', id: opp.id, to: 'PRESENTED', note: 'shown' });
    const refused = plane.transitionOpportunity({
      ownerId: 'u1',
      id: opp.id,
      to: 'APPROVED',
      note: 'x',
    });
    expect(refused.success).toBe(false);

    const approved = plane.transitionOpportunity({
      ownerId: 'u1',
      id: opp.id,
      to: 'APPROVED',
      note: 'user approved',
      approval: { id: 'a1', grantedBy: 'alice', grantedAt: '2026-08-14T09:00:00Z', scope: 'opp' },
    });
    expect(approved.success).toBe(true);
    // Duplicate discovery returns the same record (idempotent).
    const again = plane.discoverOpportunity({
      ownerId: 'u1',
      title: 'AI consulting service',
      description: 'x',
      category: 'consulting',
      evidence: [],
      riskLevel: 'LOW',
      automationPotential: 'LOW',
    });
    expect(again.id).toBe(opp.id);
  });

  it('todayBriefing is no-spam and composed', () => {
    const { plane } = makePlane();
    const briefing = plane.todayBriefing('u1');
    expect(briefing.hasContent).toBe(true);
    expect(briefing.pendingApprovals.length).toBe(1);
    expect(briefing.recommendedNextAction).toMatch(/pending approvals/);
    expect(briefing.autonomyLevel).toBe(0); // default fail-closed
    expect(briefing.emergencyStopEngaged).toBe(false);
  });

  it('emergency stop is audited end-to-end and blocks the briefing state', () => {
    const { plane } = makePlane();
    plane.engageStop({ ownerId: 'u1', actor: 'alice', reason: 'test', source: 'user' });
    expect(plane.stopStatus('u1').engaged).toBe(true);
    const briefing = plane.todayBriefing('u1');
    expect(briefing.emergencyStopEngaged).toBe(true);
    plane.releaseStop({ ownerId: 'u1', actor: 'alice', reason: 'resolved', source: 'user' });
    expect(plane.stopStatus('u1').engaged).toBe(false);
  });

  it('owner isolation — another owner sees none of your state', () => {
    const { plane } = makePlane();
    plane.engageStop({ ownerId: 'u1', actor: 'alice', reason: 'x', source: 'user' });
    plane.discoverOpportunity({
      ownerId: 'u1',
      title: 'Only mine',
      description: 'x',
      category: 'x',
      evidence: [],
      riskLevel: 'LOW',
      automationPotential: 'LOW',
    });
    expect(plane.stopStatus('u2').engaged).toBe(false);
    expect(plane.listOpportunities('u2')).toEqual([]);
  });
});
