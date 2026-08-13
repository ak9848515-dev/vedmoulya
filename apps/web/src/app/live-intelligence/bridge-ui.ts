// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Live Intelligence Bridge UI helpers (EPIC-017)
// Shared formatting + loop-advance logic for the /live-intelligence page.
// ─────────────────────────────────────────────────────────────────────────────

import type { BridgeLoopRun } from '@vedmoulya/live-intelligence-bridge';

export type BridgeStep = 'discover' | 'compare' | 'recommend' | 'approve' | 'handoff';

/** ISO → friendly local timestamp (never raw internals). */
export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Next actionable step for the loop (progressive disclosure). */
export function nextBridgeStepOf(loop: BridgeLoopRun): BridgeStep {
  const s = loop.stageStatuses;
  if (s.DISCOVER !== 'completed') return 'discover';
  if (s.COMPARE !== 'completed') return 'compare';
  if (s.RECOMMEND !== 'completed') return 'recommend';
  // Approval is only required while a pending recommendation still needs a
  // decision; once decided (or when nothing was recommended), the loop moves
  // to the configuration / execution hand-off.
  const pending = loop.recommendations.some((r) => r.state === 'PENDING' && r.approvalRequired);
  if (pending) return 'approve';
  return 'handoff';
}

export function nextBridgeStepLabel(step: BridgeStep): string {
  switch (step) {
    case 'discover':
      return 'Discover capabilities';
    case 'compare':
      return 'Compare options';
    case 'recommend':
      return 'Build recommendation';
    case 'approve':
      return 'Review recommendation';
    case 'handoff':
      return 'Hand off to execution';
    default:
      return 'Continue';
  }
}
