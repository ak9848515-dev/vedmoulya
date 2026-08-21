// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · FounderBriefing
// SPRINT-033 (Part A) — FOUNDER / EXECUTIVE INTELLIGENCE.
//
// Advisory-first composition that answers:
//   1. What is happening?    2. What changed?        3. What opportunities exist?
//   4. What needs attention? 5. What should be next? 6. What could generate revenue?
//   7. What can be automated? 8. What requires founder approval?
//
// It composes ONLY the existing estate through narrow ports — control plane
// posture, opportunity pipeline (control + brain), revenue snapshot, cost
// snapshot, recent world observations and signal status. Nothing here
// approves, spends, executes, communicates externally or creates a business.
// `hasContent:false` → the caller must NOT notify (no-spam, same discipline
// as the proactive briefing).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  FounderBriefing,
  OpportunityPipelineEntry,
  WorldEntity,
  WorldSignalKind,
  WorldSignalSourceResult,
} from '../types/world-types.js';

export interface BriefingInput {
  ownerId: string;
  generatedAt: string;
  pendingApprovals: Array<{ title: string; category: string; status: string }>;
  pipeline: OpportunityPipelineEntry[];
  revenue: {
    streamCount: number;
    totalEstimatedMonthlyRevenueUsd?: number;
  };
  cost: { dailyUsd?: number };
  posture: {
    emergencyStopEngaged: boolean;
    autonomyLevel: number;
    settingsConfirmed: boolean;
  };
  recentChanges: WorldEntity[];
  signals: WorldSignalSourceResult[];
}

const MAX_CHANGES = 5;
const MAX_ATTENTION = 6;
const MAX_APPROVALS = 6;

/** Compose the bounded advisory briefing. Deterministic, evidence-only,
 *  no-spam: `hasContent` is false when nothing meaningful is present. */
export function buildFounderBriefing(input: BriefingInput): FounderBriefing {
  const active = input.pipeline.filter(
    (entry) =>
      entry.status !== 'REJECTED' && entry.status !== 'COMPLETED' && entry.status !== 'DISMISSED',
  );
  const highRisk = active.filter((entry) => entry.riskLevel === 'HIGH');
  // Pending approvals = pipeline entries needing the existing approval
  // authority (deduped by title) UNION explicit pending approvals.
  const pipelineApprovals = active
    .filter((entry) => entry.approvalRequired && entry.status !== 'APPROVED')
    .map((entry) => ({ title: entry.title, category: entry.category, status: entry.status }));
  const seen = new Set(pipelineApprovals.map((a) => a.title));
  const explicitApprovals = input.pendingApprovals.filter((a) => {
    if (seen.has(a.title)) return false;
    seen.add(a.title);
    return true;
  });
  const approvals = [...pipelineApprovals, ...explicitApprovals].slice(0, MAX_APPROVALS);

  const attention: FounderBriefing['attention'] = [];
  if (input.posture.emergencyStopEngaged) {
    attention.push({
      category: 'EMERGENCY_STOP',
      title: 'Emergency stop is engaged',
      reason: 'Autonomous activity is halted until the founder releases it.',
      approvalRequired: true,
    });
  }
  if (!input.posture.settingsConfirmed) {
    attention.push({
      category: 'AUTONOMY_SETTINGS',
      title: 'Autonomy settings not confirmed',
      reason:
        'The founder has not explicitly confirmed the autonomy shape — the system stays fail-closed (level 0).',
      approvalRequired: true,
    });
  }
  for (const entry of highRisk.slice(0, MAX_ATTENTION - attention.length)) {
    attention.push({
      category: 'RISK',
      title: entry.title,
      reason: 'Classified HIGH risk by the opportunity pipeline.',
      approvalRequired: entry.approvalRequired,
    });
  }
  for (const entry of active.slice(0, MAX_ATTENTION - attention.length)) {
    if (entry.approvalRequired && entry.status !== 'APPROVED') {
      attention.push({
        category: 'OPPORTUNITY',
        title: entry.title,
        reason: 'Active opportunity — acting on it requires founder approval.',
        approvalRequired: true,
      });
    }
  }

  // No-spam: content exists only when something meaningful is present.
  // Unconfirmed autonomy settings alone DO count (the founder should act),
  // but an empty briefing with confirmed settings stays hasContent:false.
  const hasContent =
    attention.length > 0 ||
    approvals.length > 0 ||
    input.revenue.streamCount > 0 ||
    input.revenue.totalEstimatedMonthlyRevenueUsd !== undefined ||
    input.cost.dailyUsd !== undefined ||
    input.recentChanges.length > 0;

  return {
    ownerId: input.ownerId,
    generatedAt: input.generatedAt,
    advisory: true,
    today: {
      pendingApprovals: approvals,
      activeOpportunities: active.length,
      highRiskOpportunities: highRisk.length,
      revenueStreams: input.revenue.streamCount,
      totalEstimatedMonthlyRevenueUsd: input.revenue.totalEstimatedMonthlyRevenueUsd,
      costDailyUsd: input.cost.dailyUsd,
      emergencyStopEngaged: input.posture.emergencyStopEngaged,
      autonomyLevel: input.posture.autonomyLevel,
      settingsConfirmed: input.posture.settingsConfirmed,
    },
    whatChanged: input.recentChanges.slice(0, MAX_CHANGES).map((entity) => ({
      type: entity.type,
      label: entity.label,
      updatedAt: entity.updatedAt,
    })),
    attention,
    signals: input.signals.map((s) => ({ kind: s.kind, status: s.status })),
    hasContent,
  };
}

/** The signal kinds the briefing reports (closed vocabulary). */
export const BRIEFING_SIGNAL_KINDS: ReadonlyArray<WorldSignalKind> = [
  'market_trends',
  'ai_model_releases',
  'pricing_changes',
  'customer_demand',
  'competitor_changes',
];
