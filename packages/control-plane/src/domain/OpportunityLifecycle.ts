// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Control Plane · OpportunityLifecycle
// SPRINT-031 — a typed, guarded lifecycle for opportunities VedMoulya
// discovers. The state machine is deterministic; transitions are the ONLY way
// status changes. Guarded transitions:
//
//   • APPROVED requires an EXISTING approval-authority record (never granted
//     by this layer, never by a model, never by voice).
//   • EXECUTED requires EXECUTION evidence from the EXISTING execution
//     authority (this layer never executes).
//   • REJECTED/COMPLETED are terminal.
//   • Idempotent: a stable key (owner + title) maps to ONE record.
//
// This is NOT a business engine — it only tracks state and refuses illegal
// moves. Discovery/scoring/execution live in the frozen estate.
// ─────────────────────────────────────────────────────────────────────────────

import type { OpportunityLifecycleRecord, OpportunityStatus } from '../types/control-types.js';
import { OPPORTUNITY_TRANSITIONS } from '../types/control-types.js';

export interface OpportunityStore {
  save(record: OpportunityLifecycleRecord): void;
  get(ownerId: string, id: string): OpportunityLifecycleRecord | undefined;
  getByKey(ownerId: string, stableKey: string): OpportunityLifecycleRecord | undefined;
  list(ownerId: string): OpportunityLifecycleRecord[];
}

export interface ApprovalRecord {
  id: string;
  grantedBy: string;
  grantedAt: string;
  scope: string;
}

export interface ExecutionRecord {
  id: string;
  completedAt: string;
  verified: boolean;
}

export type TransitionResult =
  | { success: true; record: OpportunityLifecycleRecord }
  | {
      success: false;
      error: string;
      code:
        | 'NOT_FOUND'
        | 'ILLEGAL_TRANSITION'
        | 'APPROVAL_REQUIRED'
        | 'EXECUTION_REQUIRED'
        | 'ALREADY_TERMINAL';
    };

export class OpportunityLifecycle {
  constructor(
    private readonly store: OpportunityStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /** Create or re-key (idempotent) an opportunity. Never overwrites a
   *  terminal record's history; a re-discovery of the same key returns the
   *  existing record unchanged (duplicate suppression). */
  discover(input: {
    ownerId: string;
    title: string;
    description: string;
    category: string;
    evidence: Array<{ label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' }>;
    confidence?: number;
    estimatedValue?: { label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' };
    estimatedCost?: { label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' };
    estimatedEffort?: { label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' };
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
    automationPotential: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
    recommendedWorkflow?: string[];
  }): OpportunityLifecycleRecord {
    const stableKey = `${input.ownerId}:${input.title.trim().toLowerCase()}`;
    const existing = this.store.getByKey(input.ownerId, stableKey);
    if (existing) return existing;

    const ts = this.now();
    const record: OpportunityLifecycleRecord = {
      id: `opp-${Math.random().toString(36).slice(2, 10)}`,
      ownerId: input.ownerId,
      stableKey,
      title: input.title.slice(0, 160),
      description: input.description.slice(0, 1000),
      category: input.category,
      status: 'DISCOVERED',
      evidence: input.evidence.slice(0, 8),
      confidence:
        input.confidence !== undefined ? Math.max(0, Math.min(1, input.confidence)) : undefined,
      estimatedValue: input.estimatedValue,
      estimatedCost: input.estimatedCost,
      estimatedEffort: input.estimatedEffort,
      riskLevel: input.riskLevel,
      automationPotential: input.automationPotential,
      recommendedWorkflow: input.recommendedWorkflow,
      transitions: [],
      createdAt: ts,
      updatedAt: ts,
    };
    this.store.save(record);
    return record;
  }

  get(ownerId: string, id: string): OpportunityLifecycleRecord | undefined {
    return this.store.get(ownerId, id);
  }

  list(ownerId: string): OpportunityLifecycleRecord[] {
    return this.store.list(ownerId);
  }

  /** The ONLY status-change path. Every transition is validated against the
   *  legal table; APPROVED and EXECUTED additionally require evidence records
   *  from the EXISTING authorities. */
  transition(input: {
    ownerId: string;
    id: string;
    to: OpportunityStatus;
    note: string;
    approval?: ApprovalRecord;
    execution?: ExecutionRecord;
  }): TransitionResult {
    const record = this.store.get(input.ownerId, input.id);
    if (!record) return { success: false, error: 'Opportunity not found.', code: 'NOT_FOUND' };

    if (record.status === input.to) {
      return { success: true, record };
    }
    const legal = OPPORTUNITY_TRANSITIONS[record.status];
    if (!legal.includes(input.to)) {
      return {
        success: false,
        error: `Illegal transition ${record.status} → ${input.to}.`,
        code: 'ILLEGAL_TRANSITION',
      };
    }
    if (input.to === 'APPROVED' && !input.approval) {
      return {
        success: false,
        error:
          'APPROVED requires an approval record from the EXISTING approval authority — this layer can never grant it.',
        code: 'APPROVAL_REQUIRED',
      };
    }
    if (input.to === 'EXECUTED' && !input.execution) {
      return {
        success: false,
        error:
          'EXECUTED requires execution evidence from the EXISTING execution authority — this layer never executes.',
        code: 'EXECUTION_REQUIRED',
      };
    }
    if (input.to === 'VERIFIED' && record.status !== 'EXECUTED') {
      return {
        success: false,
        error: 'VERIFIED can only follow EXECUTED.',
        code: 'ILLEGAL_TRANSITION',
      };
    }

    const ts = this.now();
    const updated: OpportunityLifecycleRecord = {
      ...record,
      status: input.to,
      approval: input.approval ?? record.approval,
      execution: input.execution ?? record.execution,
      transitions: [
        ...record.transitions,
        { from: record.status, to: input.to, at: ts, note: input.note.slice(0, 400) },
      ].slice(-50),
      updatedAt: ts,
    };
    this.store.save(updated);
    return { success: true, record: updated };
  }
}
