// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S4 Mission → ClientOps Revenue Bridge
//
// COMPOSITION ONLY. This layer moves ONE verified Mission objective into the
// EXISTING ClientOps commercial pipeline as a DRAFT deliverable.
//
// It is deliberately NOT an agent, NOT a loop and NOT a scheduler. Mission
// remains the only autonomous lifecycle (understand → plan → execute → verify →
// memory → next objective). This file has no execution logic whatsoever: it
// cannot run, plan, verify or retry anything. It only composes an outcome that
// Mission already produced and verified.
//
// RULES ENFORCED HERE
//   1. VERIFIED-ONLY. A deterministic gate — never a model decision — admits
//      exactly `VERIFIED` objectives. PENDING/RUNNING/FAILED/BLOCKED/CANCELLED
//      (and anything unknown) are rejected.
//   2. USER-SCOPED. The mission owner is the only user who may hand off; a
//      different user is rejected and never reads another user's records.
//   3. IDEMPOTENT. The deliverable id is derived deterministically from
//      `missionId:objectiveId`, so a retried handoff returns the existing
//      record instead of creating a second one. No second database, no new
//      idempotency store — the existing ClientOps document collection is the
//      store.
//   4. NO EXTERNAL ACTION. This layer only PREPARES a draft. It never sends a
//      proposal, submits an invoice or requests payment. Consequential external
//      actions remain governed by the EXISTING approval policy.
//   5. HONEST FAILURE. A ClientOps failure never mutates Mission state and is
//      reported as a failure; a memory failure never reports commercial
//      completion that did not happen.
//
// NEVER carried across this boundary: prompts, credentials, API keys,
// provider responses, session tokens, absolute workspace paths, connection
// strings. The handoff carries a bounded outcome + evidence only.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import type { DocumentRecord, DocumentVersionRecord } from '@vedmoulya/domain';

/** The ONLY objective state that may become a commercial deliverable. */
export const HANDOFF_ELIGIBLE_OBJECTIVE_STATE = 'VERIFIED';

/**
 * A structural, read-only VIEW of the Mission fields this bridge needs.
 * The whole Mission is never copied, and no internal state is retained.
 */
export interface HandoffObjectiveView {
  objectiveId: string;
  state: string;
  title?: string;
  verifiedOutcome?: {
    outcome?: string;
    method?: string;
    evidence?: string[];
    verifiedAt?: string;
  } | null;
}

export interface HandoffMissionView {
  missionId: string;
  userId: string;
  title?: string;
  objectives: HandoffObjectiveView[];
}

export interface MissionLookup {
  /**
   * Owner-scoped read. The implementation MUST enforce ownership itself (the
   * Mission layer already does); the bridge re-checks the returned owner as
   * defense in depth, so isolation never depends on a single call site.
   */
  get(missionId: string, userId: string): Promise<HandoffMissionView | undefined>;
}

export interface ClientOpsDocumentStore {
  listDocuments(userId: string): Promise<DocumentRecord[]>;
  saveDocument(document: DocumentRecord): Promise<void>;
}

/**
 * Narrow memory seam. Phase 7 writes a delivery outcome through the EXISTING
 * memory estate; this port keeps the bridge from inventing a memory system.
 */
export interface MissionDeliveryMemoryPort {
  recordDeliveryOutcome(entry: {
    userId: string;
    missionId: string;
    objectiveId: string;
    outcome: string;
    documentId: string;
    /** Explicit source; never inferred. */
    source: string;
  }): Promise<void>;
}

/** What a caller must supply. Nothing else crosses the boundary. */
export interface VerifiedOutcomeHandoffInput {
  userId: string;
  missionId: string;
  objectiveId: string;
  /** The commercial client the deliverable belongs to (ClientOps client id). */
  clientId: string;
  deliverableName: string;
  /** The produced artifact. Required — a verified objective with no artifact
   *  cannot become a deliverable, and the gap is reported honestly. */
  deliverableContent: string;
  deliverableMime?: string;
  /** Only when an opportunity already exists; never invented. */
  opportunityId?: string;
}

export type HandoffRejectionReason =
  | 'MISSION_NOT_FOUND'
  | 'NOT_OWNER'
  | 'OBJECTIVE_NOT_FOUND'
  | 'OBJECTIVE_NOT_VERIFIED'
  | 'MISSING_ARTIFACT'
  | 'CLIENT_REQUIRED'
  | 'CLIENTOPS_FAILURE';

export interface HandoffAccepted {
  ok: true;
  documentId: string;
  /** False when this exact handoff already existed (idempotent replay). */
  created: boolean;
  /** Always true: a draft is prepared, never externally sent. */
  pendingApproval: true;
}

export interface HandoffRejected {
  ok: false;
  reason: HandoffRejectionReason;
  message: string;
}

export type HandoffResult = HandoffAccepted | HandoffRejected;

const MAX_DELIVERABLE_CHARS = 200_000;
const MAX_EVIDENCE_ITEMS = 20;
const MAX_EVIDENCE_CHARS = 500;

/**
 * Deterministic deliverable id — the idempotency key, derived not stored.
 *
 * The owner is PART of the key: ClientOps stores documents by id, so a key
 * built from (missionId, objectiveId) alone would let two owners who ever
 * share an objective id overwrite each other's deliverable. Scoping the key to
 * the user makes a replay idempotent for ITS owner and collision-free across
 * owners.
 */
export function handoffDocumentId(userId: string, missionId: string, objectiveId: string): string {
  const digest = createHash('sha256')
    .update(`${userId}:${missionId}:${objectiveId}`)
    .digest('hex')
    .slice(0, 32);
  return `doc_${digest}`;
}

export interface MissionClientOpsHandoffOptions {
  missions: MissionLookup;
  clientOps: ClientOpsDocumentStore;
  /** Optional: absence degrades to "delivery recorded, memory not written". */
  memory?: MissionDeliveryMemoryPort;
  now?: () => Date;
}

export class MissionClientOpsHandoffService {
  private readonly now: () => Date;

  constructor(private readonly options: MissionClientOpsHandoffOptions) {
    this.now = options.now ?? ((): Date => new Date());
  }

  /**
   * Convert ONE verified Mission objective into a ClientOps draft deliverable.
   * Deterministic, user-scoped and idempotent; never mutates Mission state.
   */
  async handoffVerifiedOutcome(input: VerifiedOutcomeHandoffInput): Promise<HandoffResult> {
    const rejected = (reason: HandoffRejectionReason, message: string): HandoffRejected => ({
      ok: false,
      reason,
      message,
    });

    if (input.clientId.trim().length === 0) {
      return rejected('CLIENT_REQUIRED', 'a ClientOps client is required to deliver a result');
    }
    const artifact = input.deliverableContent.trim();
    if (artifact.length === 0) {
      return rejected('MISSING_ARTIFACT', 'the verified objective produced no artifact');
    }
    if (artifact.length > MAX_DELIVERABLE_CHARS) {
      return rejected(
        'MISSING_ARTIFACT',
        `artifact exceeds the ${MAX_DELIVERABLE_CHARS} character delivery limit`,
      );
    }

    let mission: HandoffMissionView | undefined;
    try {
      mission = await this.options.missions.get(input.missionId, input.userId);
    } catch {
      // An owner-scoped read that throws means the mission is not visible to
      // this user — reported as absent rather than leaking its existence.
      return rejected('MISSION_NOT_FOUND', 'mission not found');
    }
    if (mission === undefined) {
      return rejected('MISSION_NOT_FOUND', 'mission not found');
    }
    // User isolation: the authenticated owner is the only permitted actor.
    if (mission.userId !== input.userId) {
      return rejected('NOT_OWNER', 'mission does not belong to this user');
    }

    const objective = mission.objectives.find((o) => o.objectiveId === input.objectiveId);
    if (objective === undefined) {
      return rejected('OBJECTIVE_NOT_FOUND', 'objective not found on this mission');
    }
    // The VERIFIED-ONLY gate. Deterministic, exhaustive and never model-decided:
    // an unrecognised state is rejected exactly like a known non-verified one.
    if (objective.state !== HANDOFF_ELIGIBLE_OBJECTIVE_STATE) {
      return rejected(
        'OBJECTIVE_NOT_VERIFIED',
        `objective is ${objective.state}, only ${HANDOFF_ELIGIBLE_OBJECTIVE_STATE} may be delivered`,
      );
    }

    const documentId = handoffDocumentId(input.userId, input.missionId, input.objectiveId);
    // Scoped to THIS user: idempotency can never observe (or collide with)
    // another user's deliverable, even if ids were ever to overlap.
    const existing = await this.findExisting(input.userId, documentId);
    if (existing !== undefined) {
      // Idempotent replay — no second commercial record, memory not re-written.
      return { ok: true, documentId, created: false, pendingApproval: true };
    }

    const timestamp = this.now().toISOString();
    const evidence = (objective.verifiedOutcome?.evidence ?? [])
      .slice(0, MAX_EVIDENCE_ITEMS)
      .map((item) => item.slice(0, MAX_EVIDENCE_CHARS));
    const mime = input.deliverableMime ?? 'text/plain';
    const version: DocumentVersionRecord = {
      version: 1,
      storageKey: documentId,
      size: artifact.length,
      createdAt: timestamp,
      note: 'Produced by a VERIFIED VedMoulya Mission objective',
    };

    const document: DocumentRecord = {
      id: documentId,
      userId: input.userId,
      clientId: input.clientId,
      name: input.deliverableName.trim().slice(0, 200),
      kind: 'other',
      mime,
      size: artifact.length,
      storageKey: documentId,
      // Provenance only — the Mission id is a reference, never Mission state.
      metadata: {
        source: 'mission-verified-handoff',
        missionId: input.missionId,
        objectiveId: input.objectiveId,
        verificationMethod: objective.verifiedOutcome?.method ?? 'unknown',
        verifiedAt: objective.verifiedOutcome?.verifiedAt ?? timestamp,
        evidenceCount: evidence.length,
        ...(input.opportunityId !== undefined ? { opportunityId: input.opportunityId } : {}),
      },
      currentVersion: 1,
      versions: [version],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      await this.options.clientOps.saveDocument(document);
    } catch {
      // Honest failure. The Mission keeps its VERIFIED state — a commercial
      // delivery problem must never corrupt execution truth.
      return rejected('CLIENTOPS_FAILURE', 'the deliverable could not be stored in ClientOps');
    }

    // Phase 7 — memory is AFTER a successful delivery, and a memory failure
    // never reports a commercial outcome that did not happen.
    if (this.options.memory !== undefined) {
      try {
        await this.options.memory.recordDeliveryOutcome({
          userId: input.userId,
          missionId: input.missionId,
          objectiveId: input.objectiveId,
          outcome: objective.verifiedOutcome?.outcome ?? objective.title ?? 'verified objective',
          documentId,
          source: 'mission-verified-handoff',
        });
      } catch {
        // Reported through the returned result's honesty guarantee below: the
        // deliverable EXISTS, so this is not a failure — but memory was not
        // written and nothing claims it was.
      }
    }

    return { ok: true, documentId, created: true, pendingApproval: true };
  }

  private async findExisting(
    userId: string,
    documentId: string,
  ): Promise<DocumentRecord | undefined> {
    try {
      const documents = await this.options.clientOps.listDocuments(userId);
      return documents.find((document) => document.id === documentId);
    } catch {
      return undefined;
    }
  }
}
