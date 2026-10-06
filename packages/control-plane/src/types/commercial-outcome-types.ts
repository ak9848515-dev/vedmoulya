// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S6.0 · Post-delivery Commercial Outcome (BOUNDARY, not an engine)
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
  /** A canonical ClientOps/content-agency invoice id, ONLY once a human made one. */
  invoiceId?: string;
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
  get(userId: string, outcomeId: string): CommercialOutcomeRecord | undefined;
  list(userId: string): CommercialOutcomeRecord[];
}
