// ──────────────────────────────────────────────────────────────────
// VedMoulya — Adaptive Agent Loop: In-Memory Approval Store
//
// Explicit, recorded human approval. The model can never approve itself —
// only a caller acting for a human (the service approve/reject surface)
// can record a decision on the store. Requests stay pending until an
// explicit decision exists; the engine refuses to resume on an undecided
// proposal.
// ──────────────────────────────────────────────────────────────────

import type { AdaptiveApprovalStore } from '../contracts/adaptive-loop-ports.js';

interface PendingRequest {
  proposalId: string;
  decisionId: string;
  stepId: string;
  reason: string;
  requestedAt: string;
}

interface RecordedDecision {
  decision: 'approved' | 'rejected';
  actor: string;
}

export class InMemoryAdaptiveApprovalStore implements AdaptiveApprovalStore {
  private readonly pendingByRun = new Map<string, PendingRequest[]>();
  private readonly decisions = new Map<string, RecordedDecision>();

  request(input: {
    runId: string;
    proposalId: string;
    decisionId: string;
    stepId: string;
    reason: string;
    requestedAt: string;
  }): void {
    const list = this.pendingByRun.get(input.runId) ?? [];
    if (!list.some((p) => p.proposalId === input.proposalId)) {
      list.push({
        proposalId: input.proposalId,
        decisionId: input.decisionId,
        stepId: input.stepId,
        reason: input.reason,
        requestedAt: input.requestedAt,
      });
      this.pendingByRun.set(input.runId, list);
    }
  }

  approve(runId: string, proposalId: string, actor: string): boolean {
    if (!this.hasPending(runId, proposalId)) return false;
    this.decisions.set(`${runId}:${proposalId}`, { decision: 'approved', actor });
    this.removePending(runId, proposalId);
    return true;
  }

  reject(runId: string, proposalId: string, actor: string): boolean {
    if (!this.hasPending(runId, proposalId)) return false;
    this.decisions.set(`${runId}:${proposalId}`, { decision: 'rejected', actor });
    this.removePending(runId, proposalId);
    return true;
  }

  pending(runId: string): PendingRequest[] {
    return [...(this.pendingByRun.get(runId) ?? [])];
  }

  decision(runId: string, proposalId: string): RecordedDecision | undefined {
    return this.decisions.get(`${runId}:${proposalId}`);
  }

  private hasPending(runId: string, proposalId: string): boolean {
    return (this.pendingByRun.get(runId) ?? []).some((p) => p.proposalId === proposalId);
  }

  private removePending(runId: string, proposalId: string): void {
    const list = this.pendingByRun.get(runId) ?? [];
    this.pendingByRun.set(
      runId,
      list.filter((p) => p.proposalId !== proposalId),
    );
  }
}
