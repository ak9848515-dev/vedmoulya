// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S6.0/S6.1 · Post-delivery Commercial Outcome (BOUNDARY, not an
// engine)
//
// After a Mission produces a VERIFIED deliverable and the existing S4
// `mission.deliver` flow has created the ClientOps draft, this record states
// the ONLY next fact the platform may assert on its own:
//
//     "this VERIFIED deliverable has a commercial outcome pending human action."
//
// It is deliberately NOT a commercial engine and NOT a duplicate of the
// ClientOps commercial model. Invoice/Proposal/Quotation/Contract/Payment
// remain authoritative in `@vedmoulya/domain` (`content-agency`) and ClientOps;
// this record only REFERENCES them (e.g. `invoiceId`) once a human creates one.
// It never mints an amount, an invoice id, a payment id or any external
// confirmation — a human remains the only actor that can advance the outcome.
//
// References, not payloads: ids, status and timestamps only. Never prompts,
// provider responses, credentials, API keys or deliverable contents.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The governed states a verified delivery's commercial outcome may hold.
 *
 * S6.0 only ever MINTS `COMMERCIAL_PENDING` — the honest "human action
 * required" state. Advancing to `INVOICE_PENDING` / `PAID` / `CLOSED` requires
 * a real, human-produced commercial reference (via the EXISTING human-controlled
 * invoice/payment flows) and is intentionally NOT performed by this foundation.
 * No state may be reached automatically or from a model decision.
 */
export type CommercialOutcomeStatus =
  'COMMERCIAL_PENDING' | 'MANUAL_REVIEW' | 'INVOICE_PENDING' | 'PAID' | 'CLOSED' | 'CANCELLED';

/** The only status S6.0 is allowed to create. */
export const COMMERCIAL_OUTCOME_INITIAL_STATUS = 'COMMERCIAL_PENDING' as const;

/**
 * The canonical content-agency invoice status, mirrored here ONLY as an input to
 * reconciliation. The `InvoiceRecord` in `@vedmoulya/domain` remains the single
 * source of truth for an invoice's status; this union never duplicates it.
 */
export type CanonicalInvoiceStatus = 'draft' | 'sent' | 'paid';

/**
 * S6.1 — derive the commercial outcome status from the CANONICAL invoice status.
 *
 * Deterministic and honest by construction: it never infers "an invoice exists"
 * as paid. Only the canonical `paid` status (set by a human through the existing
 * invoice flow) maps to PAID. `draft` still needs human review before it is even
 * sent; `sent` is awaiting payment. Payment records never appear here — a
 * manually recorded payment does NOT by itself prove money was received.
 */
export function reconcileCommercialOutcomeStatus(
  invoiceStatus: CanonicalInvoiceStatus,
): CommercialOutcomeStatus {
  switch (invoiceStatus) {
    case 'paid':
      return 'PAID';
    case 'sent':
      return 'INVOICE_PENDING';
    case 'draft':
      return 'MANUAL_REVIEW';
  }
}

/**
 * One commercial outcome derived from a VERIFIED Mission deliverable.
 *
 * `outcomeId` is deterministic — `(userId, missionId, objectiveId)` — so a
 * repeated or concurrent request converges on ONE record and never duplicates
 * the commercial record (idempotency is the key, not a separate dedup store).
 */
export interface CommercialOutcomeRecord {
  /** Deterministic idempotency key: co_<sha256(user:mission:objective)[:32]>. */
  outcomeId: string;
  /** Owner. Every read/write is scoped to this user; never client-supplied. */
  userId: string;
  /** The opportunity this deliverable originated from, when one was linked. */
  opportunityId?: string;
  missionId: string;
  objectiveId: string;
  /** The ClientOps client the deliverable was delivered to. */
  clientId: string;
  /** The ClientOps deliverable document produced by the S4 verified handoff. */
  documentId: string;
  status: CommercialOutcomeStatus;
  /** A canonical content-agency invoice id, ONLY once a human made one. */
  invoiceId?: string;
  /** A canonical ClientOps payment id (a MANUALLY recorded payment reference —
   *  never treated as proof of receipt unless the canonical invoice is `paid`). */
  paymentId?: string;
  /** WHEN the outcome was last reconciled against a canonical commercial record. */
  reconciledAt?: string;
  /** WHO recorded the boundary (the authenticated owner). Auditability only. */
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Owner-scoped persistence seam for the commercial outcome. Synchronous, like
 * every other control-plane store port (the durable backend is write-through).
 */
export interface CommercialOutcomeStore {
  /** Idempotent by (userId, outcomeId): returns the EXISTING record when one is
   *  already present, so a repeated call never creates a second commercial
   *  record. */
  save(record: CommercialOutcomeRecord): CommercialOutcomeRecord;
  /** S6.1 — overwrite the record at its stable key (used to reconcile status /
   *  commercial references). Idempotent because the key is unchanged; a
   *  concurrent update can never create a second row (PRIMARY KEY (owner, key)). */
  update(record: CommercialOutcomeRecord): CommercialOutcomeRecord;
  get(userId: string, outcomeId: string): CommercialOutcomeRecord | undefined;
  list(userId: string): CommercialOutcomeRecord[];
}
