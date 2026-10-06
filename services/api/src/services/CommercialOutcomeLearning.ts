// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S6.2 Commercial Outcome → Truthful Learning Signal
//
// Persists ONE learning signal per (owner, commercial outcome, canonical
// commercial state) through the EXISTING execution-memory architecture. This
// introduces no new memory platform and no second category: it reuses the
// canonical `ExecutionMemoryStore` contract, its `fingerprintFor` aggregation
// key and its `computeConfidence`, exactly like S4.1's DeliveryOutcomeMemory.
//
// SEMANTICS. The entry extends the existing `DELIVERY_OUTCOME` category (a
// verified delivery's commercial outcome) with a DISTINCT predicate per
// canonical state — `COMMERCIAL_<STATUS>`. It never duplicates the S4.1
// `DELIVERED` signal, is never a `USER_PREFERENCE` and never becomes a
// financial ledger.
//
//   Verified delivery + draft invoice  → predicate COMMERCIAL_MANUAL_REVIEW
//   Verified delivery + sent invoice   → predicate COMMERCIAL_INVOICE_PENDING
//   Verified delivery + paid invoice   → predicate COMMERCIAL_PAID (success)
//
// TRUTH. Only the CANONICAL commercial state (already established by S6.1 from
// the canonical invoice status) reaches this layer. A recorded payment never
// becomes proof of receipt; the existence of an invoice never becomes paid.
//
// PAYLOAD. A durable REFERENCE, never the record itself: ids, the governed
// state and a timestamp only. No invoice/payment contents, no amount, no
// deliverable content, no prompts, no provider responses, no credentials, no
// workspace paths.
//
// IDEMPOTENCY. `fingerprintFor` makes the key deterministic on
// (owner, outcomeId, state), and the store is idempotent by that key, so a
// replayed reconciliation overwrites the SAME entry instead of duplicating it.
// A state CHANGE yields a new predicate → exactly one new signal per state.
// ─────────────────────────────────────────────────────────────────────────────

import {
  computeConfidence,
  fingerprintFor,
  type ExecutionMemoryStore,
  type MemoryEntry,
} from '@vedmoulya/execution-memory';
import type { CommercialOutcomeStatus } from '@vedmoulya/control-plane';

/** The existing S4.1 category, extended (never duplicated) for S6.2. */
export const COMMERCIAL_LEARNING_CATEGORY = 'DELIVERY_OUTCOME';

/**
 * One truthful commercial learning signal. References and the governed state
 * only — never a copy of the invoice/payment or any financial payload.
 */
export interface CommercialLearningSignal {
  /** Owner. Every read/write is scoped to this user; never client-supplied. */
  userId: string;
  /** The deterministic commercial-outcome id this signal describes. */
  outcomeId: string;
  missionId: string;
  objectiveId: string;
  /** The CANONICAL commercial state (from S6.1 reconciliation). */
  status: CommercialOutcomeStatus;
  occurredAt: string;
  /** Carried only when the outcome already recorded one. */
  opportunityId?: string;
  clientId?: string;
  invoiceId?: string;
  paymentId?: string;
}

/**
 * Narrow learning seam. The reconciliation service writes through this port so
 * it never invents a memory system. Returns `true` when the signal is durably
 * present (newly written OR already recorded); it throws when persistence fails
 * so the caller can report an honest partial result.
 */
export interface CommercialOutcomeLearningPort {
  record(signal: CommercialLearningSignal): Promise<boolean>;
}

export interface CommercialOutcomeLearningOptions {
  store: ExecutionMemoryStore;
}

/**
 * Bridges a canonical commercial state onto the existing memory store.
 * Idempotent per (owner, outcome, state): a repeated reconciliation reinforces
 * the SAME entry rather than creating a second one.
 */
export class CommercialOutcomeLearning implements CommercialOutcomeLearningPort {
  constructor(private readonly options: CommercialOutcomeLearningOptions) {}

  /**
   * The predicate that distinguishes a canonical commercial state. Every
   * predicate carries the `COMMERCIAL_` namespace and is unique per state —
   * `COMMERCIAL_PENDING` is not doubled to `COMMERCIAL_COMMERCIAL_PENDING`.
   */
  static predicateFor(status: CommercialOutcomeStatus): string {
    return status.startsWith('COMMERCIAL_') ? status : `COMMERCIAL_${status}`;
  }

  /** Deterministic aggregation key for one (owner, outcome, state) signal. */
  static fingerprint(
    signal: Pick<CommercialLearningSignal, 'userId' | 'outcomeId' | 'status'>,
  ): string {
    return fingerprintFor({
      category: COMMERCIAL_LEARNING_CATEGORY,
      scope: 'USER',
      // One commercial signal per outcome; the state is the predicate.
      subject: `commercialOutcome:${signal.outcomeId}`,
      predicate: CommercialOutcomeLearning.predicateFor(signal.status),
      userId: signal.userId,
    });
  }

  /** Map one signal onto the validated, persisted MemoryEntry shape. */
  static toMemoryEntry(signal: CommercialLearningSignal): MemoryEntry {
    const fingerprint = CommercialOutcomeLearning.fingerprint(signal);
    // Commercial success is asserted ONLY by the canonical PAID state. Every
    // other state is honestly non-success (never fabricated, never a failure).
    const successCount = signal.status === 'PAID' ? 1 : 0;
    const verifiedCount = 1;
    return {
      entryId: `mem_${fingerprint.replace(/[^A-Za-z0-9_]/g, '_')}`,
      fingerprint,
      category: COMMERCIAL_LEARNING_CATEGORY,
      scope: 'USER',
      subject: `commercialOutcome:${signal.outcomeId}`,
      predicate: CommercialOutcomeLearning.predicateFor(signal.status),
      value: successCount,
      userId: signal.userId,
      sampleCount: 1,
      successCount,
      failureCount: 0,
      verifiedCount,
      // Reference only — the canonical commercial-outcome id is the evidence.
      evidence: { executionIds: [signal.outcomeId], evidenceCount: 1 },
      confidence: computeConfidence({
        sampleCount: 1,
        successCount,
        verifiedCount,
        recency: 1,
      }),
      recency: 1,
      provenance: {
        executionIds: [signal.outcomeId],
        // 'user' is the honest source type: the state originates from an
        // explicit human commercial action, never from an execution run.
        sourceType: 'user',
      },
      createdAt: signal.occurredAt,
      updatedAt: signal.occurredAt,
    };
  }

  /**
   * Persist (or reaffirm) one signal. Idempotent by the deterministic key: a
   * replay of the SAME canonical state returns without a write, so no duplicate
   * learning record is ever produced. A persistence failure propagates.
   */
  async record(signal: CommercialLearningSignal): Promise<boolean> {
    const fingerprint = CommercialOutcomeLearning.fingerprint(signal);
    const existing = await this.options.store.getByFingerprint(fingerprint);
    if (existing !== undefined) return true;
    await this.options.store.save(CommercialOutcomeLearning.toMemoryEntry(signal));
    return true;
  }

  /** Read one signal back by its deterministic key (idempotency evidence). */
  async getForSignal(
    userId: string,
    outcomeId: string,
    status: CommercialOutcomeStatus,
  ): Promise<MemoryEntry | undefined> {
    return this.options.store.getByFingerprint(
      CommercialOutcomeLearning.fingerprint({ userId, outcomeId, status }),
    );
  }
}
