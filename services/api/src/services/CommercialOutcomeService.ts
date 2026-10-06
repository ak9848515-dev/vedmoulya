// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S6.0 · Governed post-delivery Commercial Outcome
//
// COMPOSITION ONLY. After the EXISTING S4 verified handoff has created a
// ClientOps draft deliverable, this service records the ONE fact the platform
// may assert by itself: the verified delivery has a commercial outcome PENDING
// HUMAN ACTION.
//
// It is NOT an engine, NOT a loop, NOT a scheduler and NOT a second approval
// authority. It runs no agent and produces no money. Mission remains the ONLY
// autonomous lifecycle; the Brain remains the ONLY approval authority; the
// existing ClientOps / content-agency invoice & payment flows remain the ONLY
// way a commercial outcome advances.
//
// RULES ENFORCED HERE
//   1. VERIFIED-ONLY. The objective's canonical Mission state must be exactly
//      `VERIFIED`; PENDING/RUNNING/FAILED/BLOCKED/CANCELLED and anything
//      unknown are rejected. Never read from a client-supplied "verified" flag.
//   2. SESSION OWNERSHIP. `userId` is the authenticated owner. The owner is
//      re-checked against the Mission and every derived reference (the
//      deliverable document) is read through the owner-scoped ClientOps store.
//      Cross-user access fails closed and never leaks existence.
//   3. DELIVERED-ONLY ORIGIN. The commercial outcome may only be recorded when
//      the S4 handoff deliverable actually EXISTS for this (user, mission,
//      objective). No deliverable, no commercial outcome.
//   4. IDEMPOTENT. `outcomeId` is derived deterministically from
//      (user, mission, objective); the store is idempotent by that key, so a
//      repeated or concurrent request converges on ONE record.
//   5. NO AUTOMATIC EXTERNAL ACTION. It never sends an invoice/proposal/
//      quotation/email, never charges a payment, never transfers money, never
//      contacts a client and never marks anything paid. The minted state is
//      always `COMMERCIAL_PENDING` (human action required).
//   6. HONEST FAILURE. Nothing is fabricated: no invoice id, payment id,
//      client acceptance, payment confirmation or revenue. A store/ClientOps
//      failure is reported as a failure, never as a created outcome.
//
// NEVER carried across this boundary: prompts, credentials, API keys, provider
// responses, session tokens, absolute workspace paths, deliverable contents.
// Only references (ids), the governed status and timestamps are stored.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import { reconcileCommercialOutcomeStatus } from '@vedmoulya/control-plane';
import type {
  CanonicalInvoiceStatus,
  CommercialOutcomeRecord,
  CommercialOutcomeStatus,
  CommercialOutcomeStore,
} from '@vedmoulya/control-plane';
import {
  HANDOFF_ELIGIBLE_OBJECTIVE_STATE,
  handoffDocumentId,
  type ClientOpsDocumentStore,
  type MissionLookup,
} from './MissionClientOpsHandoff.js';

/** The ONLY status S6.0 mints. A human is required to advance it further. */
export const COMMERCIAL_OUTCOME_INITIAL_STATUS: CommercialOutcomeStatus = 'COMMERCIAL_PENDING';

/**
 * Deterministic idempotency key for one (user, mission, objective) commercial
 * outcome. The owner is part of the key so a replay is idempotent for ITS owner
 * and collision-free across owners.
 */
export function commercialOutcomeId(
  userId: string,
  missionId: string,
  objectiveId: string,
): string {
  const digest = createHash('sha256')
    .update(`${userId}:${missionId}:${objectiveId}`)
    .digest('hex')
    .slice(0, 32);
  return `co_${digest}`;
}

export type CommercialOutcomeRejectionReason =
  | 'MISSION_NOT_FOUND'
  | 'NOT_OWNER'
  | 'OBJECTIVE_NOT_FOUND'
  | 'OBJECTIVE_NOT_VERIFIED'
  | 'DELIVERABLE_NOT_FOUND'
  | 'CLIENTOPS_FAILURE'
  | 'STORE_FAILURE';

/** What a caller supplies. Identity is NEVER an input — it is the session. */
export interface RecordCommercialOutcomeInput {
  userId: string;
  missionId: string;
  objectiveId: string;
}

export interface CommercialOutcomeAccepted {
  ok: true;
  outcomeId: string;
  /** False when this exact commercial outcome already existed (idempotent replay). */
  created: boolean;
  status: CommercialOutcomeStatus;
  /** Always true: the outcome awaits an explicit human commercial action. */
  pendingHumanAction: true;
}

export interface CommercialOutcomeRejected {
  ok: false;
  reason: CommercialOutcomeRejectionReason;
  message: string;
}

export type CommercialOutcomeResult = CommercialOutcomeAccepted | CommercialOutcomeRejected;

/** S6.1 — why a human-driven reconciliation was refused. Never fabricates state. */
export type CommercialOutcomeReconciliationReason =
  | 'OUTCOME_NOT_FOUND'
  | 'INVOICE_REQUIRED'
  | 'INVOICE_NOT_FOUND'
  | 'INVOICE_LOOKUP_UNAVAILABLE'
  | 'CLIENT_MISMATCH'
  | 'PAYMENT_NOT_FOUND'
  | 'PAYMENT_LOOKUP_UNAVAILABLE'
  | 'PAYMENT_MISMATCH'
  | 'STORE_FAILURE';

/** A structural, owner-scoped view of the canonical invoice this layer needs. */
export interface CommercialInvoiceView {
  id: string;
  clientId: string;
  status: CanonicalInvoiceStatus;
}

/** Owner-scoped canonical invoice read (the content-agency invoice store). */
export interface CommercialInvoiceLookup {
  getInvoice(userId: string, invoiceId: string): Promise<CommercialInvoiceView | undefined>;
}

/** A structural, owner-scoped view of a manually recorded canonical payment. */
export interface CommercialPaymentView {
  id: string;
  invoiceId: string;
}

/** Owner-scoped canonical payment read (the ClientOps payment store). */
export interface CommercialPaymentLookup {
  getPayment(userId: string, paymentId: string): Promise<CommercialPaymentView | undefined>;
}

/** Associate a canonical invoice (and optionally a recorded payment) and
 *  reconcile the outcome status from the CANONICAL invoice status. */
export interface ReconcileCommercialOutcomeInput {
  userId: string;
  outcomeId: string;
  /** Canonical content-agency invoice to attach. Optional only when the
   *  outcome is ALREADY linked to one. */
  invoiceId?: string;
  /** A manually recorded canonical payment reference (never proof of receipt). */
  paymentId?: string;
}

export interface CommercialOutcomeReconciled {
  ok: true;
  outcomeId: string;
  /** False when the outcome was already in this exact reconciled state. */
  reconciled: boolean;
  status: CommercialOutcomeStatus;
  invoiceId: string;
}

export interface CommercialOutcomeReconcileRejected {
  ok: false;
  reason: CommercialOutcomeReconciliationReason;
  message: string;
}

export type CommercialOutcomeReconcileResult =
  CommercialOutcomeReconciled | CommercialOutcomeReconcileRejected;

export interface CommercialOutcomeServiceOptions {
  missions: MissionLookup;
  clientOps: ClientOpsDocumentStore;
  outcomes: CommercialOutcomeStore;
  /** S6.1 — canonical invoice lookup (content-agency). Optional so S6.0 callers
   *  stay valid; reconciliation reports UNAVAILABLE when absent. */
  invoices?: CommercialInvoiceLookup;
  /** S6.1 — canonical payment lookup (ClientOps). Optional, same rationale. */
  payments?: CommercialPaymentLookup;
  now?: () => Date;
}

export class CommercialOutcomeService {
  private readonly now: () => Date;

  constructor(private readonly options: CommercialOutcomeServiceOptions) {
    this.now = options.now ?? ((): Date => new Date());
  }

  /**
   * Record the commercial outcome of ONE VERIFIED, already-delivered objective.
   * Deterministic, owner-scoped, idempotent; never advances the outcome, never
   * touches Mission state and never performs an external action.
   */
  async recordCommercialOutcome(
    input: RecordCommercialOutcomeInput,
  ): Promise<CommercialOutcomeResult> {
    const rejected = (
      reason: CommercialOutcomeRejectionReason,
      message: string,
    ): CommercialOutcomeRejected => ({ ok: false, reason, message });

    // 1. Owner-scoped Mission read. A throw means the mission is not visible to
    //    this user — reported as absent rather than leaking its existence.
    let mission;
    try {
      mission = await this.options.missions.get(input.missionId, input.userId);
    } catch {
      return rejected('MISSION_NOT_FOUND', 'mission not found');
    }
    if (mission === undefined) {
      return rejected('MISSION_NOT_FOUND', 'mission not found');
    }
    if (mission.userId !== input.userId) {
      return rejected('NOT_OWNER', 'mission does not belong to this user');
    }

    const objective = mission.objectives.find((o) => o.objectiveId === input.objectiveId);
    if (objective === undefined) {
      return rejected('OBJECTIVE_NOT_FOUND', 'objective not found on this mission');
    }
    // 2. The VERIFIED-ONLY gate. Deterministic and exhaustive; an unrecognised
    //    state is rejected exactly like a known non-verified one.
    if (objective.state !== HANDOFF_ELIGIBLE_OBJECTIVE_STATE) {
      return rejected(
        'OBJECTIVE_NOT_VERIFIED',
        `objective is ${objective.state}, only ${HANDOFF_ELIGIBLE_OBJECTIVE_STATE} has a commercial outcome`,
      );
    }

    // 3. The verified deliverable MUST already exist (S4 handoff). Its id is
    //    deterministic, and it is read through the owner-scoped ClientOps store,
    //    so a foreign deliverable can never be observed.
    const documentId = handoffDocumentId(input.userId, input.missionId, input.objectiveId);
    let deliverable;
    try {
      const documents = await this.options.clientOps.listDocuments(input.userId);
      deliverable = documents.find((document) => document.id === documentId);
    } catch {
      return rejected('CLIENTOPS_FAILURE', 'the deliverable could not be read from ClientOps');
    }
    if (deliverable === undefined) {
      return rejected(
        'DELIVERABLE_NOT_FOUND',
        'no verified deliverable exists for this objective — deliver it first',
      );
    }

    const outcomeId = commercialOutcomeId(input.userId, input.missionId, input.objectiveId);
    const existing = this.options.outcomes.get(input.userId, outcomeId);
    if (existing !== undefined) {
      // Idempotent replay — no second commercial record.
      return {
        ok: true,
        outcomeId: existing.outcomeId,
        created: false,
        status: existing.status,
        pendingHumanAction: true,
      };
    }

    // Provenance only: the opportunity reference is carried through when the
    // handoff recorded one — it is never invented here.
    const opportunityRef = deliverable.metadata.opportunityId;
    const opportunityId =
      typeof opportunityRef === 'string' && opportunityRef.length > 0 ? opportunityRef : undefined;

    const timestamp = this.now().toISOString();
    const record: CommercialOutcomeRecord = {
      outcomeId,
      userId: input.userId,
      ...(opportunityId !== undefined ? { opportunityId } : {}),
      missionId: input.missionId,
      objectiveId: input.objectiveId,
      clientId: deliverable.clientId,
      documentId,
      status: COMMERCIAL_OUTCOME_INITIAL_STATUS,
      recordedBy: input.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    let saved: CommercialOutcomeRecord;
    try {
      saved = this.options.outcomes.save(record);
    } catch {
      return rejected('STORE_FAILURE', 'the commercial outcome could not be recorded');
    }

    return {
      ok: true,
      outcomeId: saved.outcomeId,
      created: true,
      status: saved.status,
      pendingHumanAction: true,
    };
  }

  /**
   * S6.1 — associate a CANONICAL, owner-scoped invoice (and optionally a
   * recorded payment) with the outcome and reconcile its status from the
   * canonical invoice status.
   *
   * The human performs the commercial action through the EXISTING
   * `contentAgency.createInvoice` / `updateInvoiceStatus` / `clientOps.addPayment`
   * flows; this method only LINKS the result and mirrors the canonical status.
   * It never creates an invoice/payment, never sets an amount, never marks paid
   * and never moves money. Idempotent: repeating the same association returns
   * the existing state without a write.
   */
  async reconcileCommercialOutcome(
    input: ReconcileCommercialOutcomeInput,
  ): Promise<CommercialOutcomeReconcileResult> {
    const rejected = (
      reason: CommercialOutcomeReconciliationReason,
      message: string,
    ): CommercialOutcomeReconcileRejected => ({ ok: false, reason, message });

    // Owner-scoped read: another user's outcome id is simply not visible.
    const existing = this.options.outcomes.get(input.userId, input.outcomeId);
    if (existing === undefined || existing.userId !== input.userId) {
      return rejected('OUTCOME_NOT_FOUND', 'commercial outcome not found');
    }

    const invoiceId = input.invoiceId ?? existing.invoiceId;
    if (invoiceId === undefined || invoiceId.trim().length === 0) {
      return rejected('INVOICE_REQUIRED', 'a canonical invoice is required to reconcile');
    }
    if (this.options.invoices === undefined) {
      return rejected('INVOICE_LOOKUP_UNAVAILABLE', 'invoice lookup is not available');
    }

    let invoice: CommercialInvoiceView | undefined;
    try {
      invoice = await this.options.invoices.getInvoice(input.userId, invoiceId);
    } catch {
      return rejected('INVOICE_NOT_FOUND', 'invoice not found');
    }
    if (invoice === undefined) {
      return rejected('INVOICE_NOT_FOUND', 'invoice not found');
    }
    // The invoice must belong to the SAME client as the delivered outcome — this
    // prevents attaching an unrelated invoice that merely happens to be owned.
    if (invoice.clientId !== existing.clientId) {
      return rejected('CLIENT_MISMATCH', 'invoice client does not match the delivered client');
    }

    const paymentId = input.paymentId ?? existing.paymentId;
    if (paymentId !== undefined) {
      if (this.options.payments === undefined) {
        return rejected('PAYMENT_LOOKUP_UNAVAILABLE', 'payment lookup is not available');
      }
      let payment: CommercialPaymentView | undefined;
      try {
        payment = await this.options.payments.getPayment(input.userId, paymentId);
      } catch {
        return rejected('PAYMENT_NOT_FOUND', 'payment not found');
      }
      if (payment === undefined) {
        return rejected('PAYMENT_NOT_FOUND', 'payment not found');
      }
      // A payment may only reference the invoice it belongs to.
      if (payment.invoiceId !== invoiceId) {
        return rejected('PAYMENT_MISMATCH', 'payment does not belong to the associated invoice');
      }
    }

    // Honest reconciliation: ONLY the canonical invoice status decides. A
    // recorded payment never becomes proof of receipt on its own.
    const status = reconcileCommercialOutcomeStatus(invoice.status);
    const unchanged =
      existing.invoiceId === invoiceId &&
      existing.paymentId === paymentId &&
      existing.status === status;
    if (unchanged) {
      return {
        ok: true,
        outcomeId: existing.outcomeId,
        reconciled: false,
        status: existing.status,
        invoiceId,
      };
    }

    const timestamp = this.now().toISOString();
    const updated: CommercialOutcomeRecord = {
      ...existing,
      invoiceId,
      ...(paymentId !== undefined ? { paymentId } : {}),
      status,
      reconciledAt: timestamp,
      updatedAt: timestamp,
    };

    let saved: CommercialOutcomeRecord;
    try {
      saved = this.options.outcomes.update(updated);
    } catch {
      return rejected('STORE_FAILURE', 'the reconciliation could not be recorded');
    }

    return {
      ok: true,
      outcomeId: saved.outcomeId,
      reconciled: true,
      status: saved.status,
      invoiceId,
    };
  }

  /** Owner-scoped read of one commercial outcome (never crosses users). */
  getCommercialOutcome(userId: string, outcomeId: string): CommercialOutcomeRecord | undefined {
    return this.options.outcomes.get(userId, outcomeId);
  }

  /** Owner-scoped list of this user's commercial outcomes (newest first). */
  listCommercialOutcomes(userId: string): CommercialOutcomeRecord[] {
    return this.options.outcomes.list(userId);
  }
}
