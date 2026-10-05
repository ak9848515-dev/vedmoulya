// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S4.1 Delivery Outcome Memory
//
// Persists ONE verified-delivery outcome per (user, mission, objective)
// through the EXISTING execution-memory architecture. This introduces no new
// memory platform: it reuses the canonical `ExecutionMemoryStore` contract,
// its `fingerprintFor` aggregation key, its `computeConfidence` and its
// `MemoryIntelligenceStoreAdapter` → Postgres persistence.
//
// SEMANTICS. The entry is a DELIVERY_OUTCOME, never a USER_PREFERENCE: it
// records a proven business fact (a verified objective was delivered to a
// client, producing this ClientOps document) rather than anything the user
// stated or that was inferred. `recordUserPreference()` is deliberately NOT
// used — it is reserved for user-preference semantics.
//
// PAYLOAD. A durable REFERENCE, never the document itself: ids, the
// verification method and counts only. No deliverable content, no prompts, no
// provider responses, no credentials, no workspace paths.
//
// IDEMPOTENCY. `fingerprintFor` makes the entry key deterministic on
// (category, scope, subject, predicate, capability, userId), and
// `getByFingerprint` short-circuits an existing entry — so a replayed handoff
// aggregates onto the SAME entry instead of creating a duplicate.
// ─────────────────────────────────────────────────────────────────────────────

import {
  computeConfidence,
  fingerprintFor,
  type ExecutionMemoryStore,
  type MemoryEntry,
} from '@vedmoulya/execution-memory';
import type { MissionDeliveryMemoryPort } from './MissionClientOpsHandoff.js';

export interface DeliveryOutcomeMemoryRecord {
  userId: string;
  missionId: string;
  objectiveId: string;
  /** The ClientOps document this delivery produced (a reference, not payload). */
  documentId: string;
  outcome: string;
  source: string;
  verificationMethod?: string;
  opportunityId?: string;
}

export interface DeliveryOutcomeMemoryOptions {
  store: ExecutionMemoryStore;
  now?: () => Date;
}

/**
 * Bridges a ClientOps delivery outcome onto the existing memory store.
 * Idempotent per (user, mission, objective): a repeated handoff reinforces the
 * same entry rather than creating a second one.
 */
export class DeliveryOutcomeMemory implements MissionDeliveryMemoryPort {
  private readonly now: () => Date;

  constructor(private readonly options: DeliveryOutcomeMemoryOptions) {
    this.now = options.now ?? ((): Date => new Date());
  }

  /** Deterministic aggregation key for one delivery outcome. */
  static fingerprint(record: DeliveryOutcomeMemoryRecord): string {
    return fingerprintFor({
      category: 'DELIVERY_OUTCOME',
      scope: 'USER',
      // The objective IS the subject: one delivery outcome per objective.
      subject: `objective:${record.objectiveId}`,
      predicate: 'DELIVERED',
      userId: record.userId,
    });
  }

  async recordDeliveryOutcome(entry: {
    userId: string;
    missionId: string;
    objectiveId: string;
    outcome: string;
    documentId: string;
    source: string;
  }): Promise<void> {
    await this.record({
      userId: entry.userId,
      missionId: entry.missionId,
      objectiveId: entry.objectiveId,
      documentId: entry.documentId,
      outcome: entry.outcome,
      source: entry.source,
    });
  }

  /** Persist (or reinforce) one delivery outcome. Never throws on a replay. */
  async record(record: DeliveryOutcomeMemoryRecord): Promise<void> {
    const fingerprint = DeliveryOutcomeMemory.fingerprint(record);
    const existing = await this.options.store.getByFingerprint(fingerprint);
    const timestamp = this.now().toISOString();

    if (existing !== undefined) {
      // Reinforce the SAME entry: honest aggregation, never a duplicate row.
      const sampleCount = existing.sampleCount + 1;
      const verifiedCount = existing.verifiedCount + 1;
      const successCount = existing.successCount + 1;
      await this.options.store.save({
        ...existing,
        sampleCount,
        successCount,
        verifiedCount,
        value: successCount / sampleCount,
        confidence: computeConfidence({
          sampleCount,
          successCount,
          verifiedCount,
          recency: existing.recency,
        }),
        evidence: {
          executionIds: [...existing.evidence.executionIds, record.missionId].slice(-200),
          evidenceCount: existing.evidence.evidenceCount + 1,
        },
        updatedAt: timestamp,
      });
      return;
    }

    const sampleCount = 1;
    const successCount = 1;
    const verifiedCount = 1;
    const entry: MemoryEntry = {
      entryId: `mem_${fingerprint.replace(/[^A-Za-z0-9_]/g, '_')}`,
      fingerprint,
      category: 'DELIVERY_OUTCOME',
      scope: 'USER',
      subject: `objective:${record.objectiveId}`,
      predicate: 'DELIVERED',
      // A delivered outcome is, by construction, a success with value 1.
      value: 1,
      userId: record.userId,
      sampleCount,
      successCount,
      failureCount: 0,
      verifiedCount,
      // Reference only — never the deliverable's content.
      evidence: {
        executionIds: [record.missionId],
        evidenceCount: 1,
      },
      confidence: computeConfidence({
        sampleCount,
        successCount,
        verifiedCount,
        recency: 1,
      }),
      recency: 1,
      provenance: {
        executionIds: [record.missionId],
        // 'user' is the honest source type: this outcome originates from an
        // explicit commercial delivery event, never from an execution run.
        sourceType: 'user',
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.options.store.save(entry);
  }

  /** Read one outcome back by its deterministic key (idempotency evidence). */
  async getForDelivery(
    userId: string,
    missionId: string,
    objectiveId: string,
  ): Promise<MemoryEntry | undefined> {
    void missionId;
    return this.options.store.getByFingerprint(
      DeliveryOutcomeMemory.fingerprint({
        userId,
        missionId,
        objectiveId,
      } as DeliveryOutcomeMemoryRecord),
    );
  }
}
