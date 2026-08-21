// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — FounderBriefing tests (SPRINT-033 Part A)
// Advisory-first executive intelligence:
//   • `advisory:true` — a briefing is NEVER an action order
//   • `hasContent:false` when nothing meaningful → caller must NOT notify
//     (no-spam)
//   • pending approvals surface from the pipeline (approvalRequired)
//   • HIGH-risk opportunities become attention items
//   • emergency stop + unconfirmed autonomy settings are attention items
//   • what-changed is bounded (max 5)
//   • deterministic + pure (same input → same output)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { buildFounderBriefing, type BriefingInput } from '../domain/FounderBriefing.js';
import type { OpportunityPipelineEntry } from '../types/world-types.js';

const now = '2026-08-15T10:00:00.000Z';

function baseInput(overrides?: Partial<BriefingInput>): BriefingInput {
  return {
    ownerId: 'u1',
    generatedAt: now,
    pendingApprovals: [],
    pipeline: [],
    revenue: { streamCount: 0 },
    cost: {},
    posture: {
      emergencyStopEngaged: false,
      autonomyLevel: 0,
      // Confirmed by default so an empty briefing is genuinely empty (the
      // unconfirmed-settings attention item is tested explicitly).
      settingsConfirmed: true,
    },
    recentChanges: [],
    signals: [],
    ...overrides,
  };
}

function entry(partial: Partial<OpportunityPipelineEntry>): OpportunityPipelineEntry {
  return {
    opportunityId: 'opp-1',
    title: 'Opportunity',
    category: 'business',
    status: 'PRESENTED',
    score: 0.5,
    capitalMode: 'UNKNOWN',
    riskLevel: 'LOW',
    approvalRequired: true,
    evidence: [],
    ...partial,
  };
}

describe('buildFounderBriefing — advisory + no-spam', () => {
  it('hasContent:false when nothing meaningful exists (no-spam)', () => {
    const briefing = buildFounderBriefing(baseInput());
    expect(briefing.hasContent).toBe(false);
    expect(briefing.advisory).toBe(true);
  });

  it('hasContent:true when approvals, risks, revenue or changes exist', () => {
    const withApproval = buildFounderBriefing(
      baseInput({
        pipeline: [entry({ status: 'PRESENTED' })],
      }),
    );
    expect(withApproval.hasContent).toBe(true);

    const withRevenue = buildFounderBriefing(
      baseInput({ revenue: { streamCount: 1, totalEstimatedMonthlyRevenueUsd: 5000 } }),
    );
    expect(withRevenue.hasContent).toBe(true);

    const withChange = buildFounderBriefing(
      baseInput({
        recentChanges: [
          {
            id: 'e1',
            ownerId: 'u1',
            type: 'task',
            label: 'Task',
            stableKey: 'k',
            evidence: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
      }),
    );
    expect(withChange.hasContent).toBe(true);
  });

  it('surfaces pending approvals from the pipeline (bounded)', () => {
    const pipeline: OpportunityPipelineEntry[] = [];
    for (let i = 0; i < 10; i += 1) {
      pipeline.push(entry({ title: `Opp ${i}`, approvalRequired: true }));
    }
    const briefing = buildFounderBriefing(baseInput({ pipeline }));
    expect(briefing.today.pendingApprovals.length).toBeLessThanOrEqual(6);
    expect(briefing.today.pendingApprovals[0]?.title).toBe('Opp 0');
  });

  it('HIGH-risk opportunities become attention items', () => {
    const briefing = buildFounderBriefing(
      baseInput({
        pipeline: [entry({ title: 'Risky', riskLevel: 'HIGH', status: 'PRESENTED' })],
      }),
    );
    expect(briefing.today.highRiskOpportunities).toBe(1);
    expect(briefing.attention.some((a) => a.category === 'RISK' && a.title === 'Risky')).toBe(true);
  });

  it('emergency stop + unconfirmed settings become attention items', () => {
    const briefing = buildFounderBriefing(
      baseInput({
        posture: { emergencyStopEngaged: true, autonomyLevel: 0, settingsConfirmed: false },
      }),
    );
    expect(briefing.attention.some((a) => a.category === 'EMERGENCY_STOP')).toBe(true);
    expect(briefing.attention.some((a) => a.category === 'AUTONOMY_SETTINGS')).toBe(true);
    expect(briefing.today.emergencyStopEngaged).toBe(true);
  });

  it('what-changed is bounded and reflects recent observations', () => {
    const changes = Array.from({ length: 8 }, (_, i) => ({
      id: `e${i}`,
      ownerId: 'u1',
      type: 'task' as const,
      label: `Task ${i}`,
      stableKey: `k${i}`,
      evidence: [],
      createdAt: now,
      updatedAt: now,
    }));
    const briefing = buildFounderBriefing(baseInput({ recentChanges: changes }));
    expect(briefing.whatChanged.length).toBe(5);
    expect(briefing.whatChanged[0]?.label).toBe('Task 0');
  });

  it('excludes rejected/completed/dismissed opportunities from today', () => {
    const briefing = buildFounderBriefing(
      baseInput({
        pipeline: [
          entry({ title: 'Rejected', status: 'REJECTED' }),
          entry({ title: 'Done', status: 'COMPLETED' }),
          entry({ title: 'Active', status: 'PRESENTED' }),
        ],
      }),
    );
    expect(briefing.today.activeOpportunities).toBe(1);
    expect(briefing.today.pendingApprovals.map((a) => a.title)).toEqual(['Active']);
  });
});
