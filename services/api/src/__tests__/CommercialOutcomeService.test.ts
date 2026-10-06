// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S6.0 governed post-delivery commercial outcome
//
// Proves the guarantees of the boundary:
//   • VERIFIED-only origin (PENDING/RUNNING/FAILED/BLOCKED/CANCELLED/unknown all
//     rejected — deterministic, never a model decision, never a client flag)
//   • the deliverable must actually exist (S4 handoff ran)
//   • session ownership + cross-user isolation fail closed
//   • idempotency + concurrent requests never duplicate the commercial record
//   • correct mission/objective/client/document references are retained
//   • NO automatic external action, NO fabricated invoice/payment/revenue
//   • a human is always required to advance the outcome
//   • only references are stored — never credentials/prompts/provider responses
// ─────────────────────────────────────────────────────────────────────────────

import { beforeEach, describe, expect, it } from 'vitest';
import type { DocumentRecord } from '@vedmoulya/domain';
import { InMemoryCommercialOutcomeStore } from '@vedmoulya/control-plane';
import {
  CommercialOutcomeService,
  commercialOutcomeId,
  COMMERCIAL_OUTCOME_INITIAL_STATUS,
} from '../services/CommercialOutcomeService.js';
import {
  handoffDocumentId,
  type ClientOpsDocumentStore,
  type HandoffMissionView,
  type MissionLookup,
} from '../services/MissionClientOpsHandoff.js';

const NOW = new Date('2026-10-06T09:00:00.000Z');
const USER = 'u-1';
const MISSION = 'm-1';
const OBJECTIVE = 'o-1';

function mission(objectiveState = 'VERIFIED', owner = USER): HandoffMissionView {
  return {
    missionId: MISSION,
    userId: owner,
    title: 'Ship the landing page',
    objectives: [
      {
        objectiveId: OBJECTIVE,
        state: objectiveState,
        title: 'Build the page',
        verifiedOutcome:
          objectiveState === 'VERIFIED'
            ? {
                outcome: 'Landing page delivered',
                method: 'process-exit',
                evidence: ['build exit 0'],
                verifiedAt: '2026-10-06T08:59:00.000Z',
              }
            : null,
      },
    ],
  };
}

/** A deliverable document exactly as the S4 handoff would have produced it. */
function deliverable(
  userId = USER,
  metadata: Record<string, unknown> = { source: 'mission-verified-handoff' },
): DocumentRecord {
  const documentId = handoffDocumentId(userId, MISSION, OBJECTIVE);
  return {
    id: documentId,
    userId,
    clientId: 'client-1',
    name: 'landing-page.md',
    kind: 'other',
    mime: 'text/markdown',
    size: 42,
    storageKey: documentId,
    metadata,
    currentVersion: 1,
    versions: [],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

class DocumentStore implements ClientOpsDocumentStore {
  readonly documents: DocumentRecord[] = [];
  failList = false;

  async listDocuments(userId: string): Promise<DocumentRecord[]> {
    if (this.failList) throw new Error('client ops unavailable');
    return this.documents.filter((document) => document.userId === userId);
  }

  async saveDocument(document: DocumentRecord): Promise<void> {
    this.documents.push(document);
  }
}

function build(
  missionView: HandoffMissionView,
  store: DocumentStore,
  outcomes = new InMemoryCommercialOutcomeStore(),
) {
  const lookup: MissionLookup = { get: async () => missionView };
  const service = new CommercialOutcomeService({
    missions: lookup,
    clientOps: store,
    outcomes,
    now: () => NOW,
  });
  return { service, outcomes };
}

describe('S6.0 — governed post-delivery commercial outcome', () => {
  let store: DocumentStore;

  beforeEach(() => {
    store = new DocumentStore();
    store.documents.push(deliverable());
  });

  // ── 1. VERIFIED delivery accepted ──────────────────────────────────────
  it('records ONE commercial outcome for a VERIFIED, delivered objective', async () => {
    const { service, outcomes } = build(mission(), store);
    const result = await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });

    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    expect(result.created).toBe(true);
    expect(result.status).toBe(COMMERCIAL_OUTCOME_INITIAL_STATUS);
    expect(result.status).toBe('COMMERCIAL_PENDING');
    // Always pending human action — never auto-complete.
    expect(result.pendingHumanAction).toBe(true);

    const records = outcomes.list(USER);
    expect(records).toHaveLength(1);
    expect(records[0]!.status).toBe('COMMERCIAL_PENDING');
  });

  // ── 2–7. Non-VERIFIED / unknown states rejected ────────────────────────
  for (const state of ['PENDING', 'RUNNING', 'FAILED', 'BLOCKED', 'CANCELLED', 'SOMETHING_ELSE']) {
    it(`rejects a ${state} objective (VERIFIED-only gate)`, async () => {
      const { service, outcomes } = build(mission(state), store);
      const result = await service.recordCommercialOutcome({
        userId: USER,
        missionId: MISSION,
        objectiveId: OBJECTIVE,
      });
      expect(result.ok).toBe(false);
      if (result.ok === true) return;
      expect(result.reason).toBe('OBJECTIVE_NOT_VERIFIED');
      expect(outcomes.list(USER)).toHaveLength(0);
    });
  }

  it('rejects an objective that does not exist on the mission', async () => {
    const { service } = build(mission(), store);
    const result = await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: 'does-not-exist',
    });
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.reason).toBe('OBJECTIVE_NOT_FOUND');
  });

  // ── 8. Wrong owner rejected ────────────────────────────────────────────
  it('rejects a different owner (NOT_OWNER) and never records', async () => {
    const { service, outcomes } = build(mission('VERIFIED', 'u-2'), store);
    const result = await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.reason).toBe('NOT_OWNER');
    expect(outcomes.list(USER)).toHaveLength(0);
  });

  // ── 9. No existence leak when the mission is not visible ───────────────
  it('reports MISSION_NOT_FOUND (never NOT_OWNER) when the read fails', async () => {
    const lookup: MissionLookup = {
      get: async () => {
        throw new Error('not visible');
      },
    };
    const service = new CommercialOutcomeService({
      missions: lookup,
      clientOps: store,
      outcomes: new InMemoryCommercialOutcomeStore(),
      now: () => NOW,
    });
    const result = await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.reason).toBe('MISSION_NOT_FOUND');
  });

  it('does not observe another user’s deliverable (owner-scoped read)', async () => {
    // The only deliverable belongs to u-2; u-1's read sees nothing.
    store.documents.length = 0;
    store.documents.push(deliverable('u-2'));
    const { service, outcomes } = build(mission(), store);
    const result = await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.reason).toBe('DELIVERABLE_NOT_FOUND');
    expect(outcomes.list(USER)).toHaveLength(0);
  });

  // ── 3. Delivery must precede the commercial outcome ────────────────────
  it('rejects when the verified deliverable does not exist yet', async () => {
    store.documents.length = 0;
    const { service } = build(mission(), store);
    const result = await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.reason).toBe('DELIVERABLE_NOT_FOUND');
  });

  it('reports CLIENTOPS_FAILURE honestly when the deliverable read throws', async () => {
    store.failList = true;
    const { service } = build(mission(), store);
    const result = await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.reason).toBe('CLIENTOPS_FAILURE');
  });

  it('reports STORE_FAILURE honestly when the outcome cannot be persisted', async () => {
    const outcomes = new InMemoryCommercialOutcomeStore();
    const failing = {
      save: (): never => {
        throw new Error('store unavailable');
      },
      get: (): undefined => undefined,
      list: (): never[] => [],
    };
    const service = new CommercialOutcomeService({
      missions: { get: async () => mission() },
      clientOps: store,
      outcomes: failing,
      now: () => NOW,
    });
    const result = await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.reason).toBe('STORE_FAILURE');
    // Nothing was fabricated as persisted.
    expect(outcomes.list(USER)).toHaveLength(0);
  });

  // ── 10. Idempotency ────────────────────────────────────────────────────
  it('is idempotent — a repeated request creates no second record', async () => {
    const { service, outcomes } = build(mission(), store);
    const first = await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });
    const second = await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (second.ok === false) return;
    expect(second.created).toBe(false);
    expect(outcomes.list(USER)).toHaveLength(1);
  });

  // ── 11. Concurrency ────────────────────────────────────────────────────
  it('concurrent requests converge on ONE record', async () => {
    const { service, outcomes } = build(mission(), store);
    const [a, b] = await Promise.all([
      service.recordCommercialOutcome({ userId: USER, missionId: MISSION, objectiveId: OBJECTIVE }),
      service.recordCommercialOutcome({ userId: USER, missionId: MISSION, objectiveId: OBJECTIVE }),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(outcomes.list(USER)).toHaveLength(1);
  });

  // ── 12. References ─────────────────────────────────────────────────────
  it('retains the correct mission/objective/client/document references', async () => {
    store.documents.length = 0;
    store.documents.push(
      deliverable(USER, { source: 'mission-verified-handoff', opportunityId: 'opp-9' }),
    );
    const { service, outcomes } = build(mission(), store);
    await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });

    const record = outcomes.list(USER)[0]!;
    expect(record.outcomeId).toBe(commercialOutcomeId(USER, MISSION, OBJECTIVE));
    expect(record.userId).toBe(USER);
    expect(record.missionId).toBe(MISSION);
    expect(record.objectiveId).toBe(OBJECTIVE);
    expect(record.clientId).toBe('client-1');
    expect(record.documentId).toBe(handoffDocumentId(USER, MISSION, OBJECTIVE));
    expect(record.opportunityId).toBe('opp-9');
  });

  // ── 13. No secrets/content leakage ─────────────────────────────────────
  it('stores references and status only — no credentials/prompts/content', async () => {
    const { service, outcomes } = build(mission(), store);
    await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });

    const record = outcomes.list(USER)[0]!;
    expect(Object.keys(record).sort()).toEqual(
      [
        'clientId',
        'createdAt',
        'documentId',
        'missionId',
        'objectiveId',
        'outcomeId',
        'recordedBy',
        'status',
        'updatedAt',
        'userId',
      ].sort(),
    );
    const serialized = JSON.stringify(record).toLowerCase();
    for (const forbidden of ['password', 'api_key', 'apikey', 'secret', 'token', 'prompt', 'sk-']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  // ── 14. No automatic external action ───────────────────────────────────
  it('takes no external action and fabricates no invoice/payment/revenue', async () => {
    const { service, outcomes } = build(mission(), store);
    const result = await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });
    expect(result.ok).toBe(true);

    const record = outcomes.list(USER)[0]!;
    // No commercial document, no amount, no external confirmation is minted.
    expect(record.invoiceId).toBeUndefined();
    expect(record).not.toHaveProperty('amount');
    expect(record).not.toHaveProperty('paidAt');
    expect(record).not.toHaveProperty('paymentId');
  });

  // ── 15. Human remains required ─────────────────────────────────────────
  it('leaves the outcome at COMMERCIAL_PENDING (human action required)', async () => {
    const { service, outcomes } = build(mission(), store);
    await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });
    // A second call cannot advance it either — S6.0 never transitions states.
    const replay = await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });
    expect(replay.ok).toBe(true);
    if (replay.ok === false) return;
    expect(replay.status).toBe('COMMERCIAL_PENDING');
    expect(outcomes.list(USER)[0]!.status).toBe('COMMERCIAL_PENDING');
  });

  // ── 16. Memory behaviour ───────────────────────────────────────────────
  it('never fabricates a completed commercial fact (no PAID, no success claim)', async () => {
    const { service, outcomes } = build(mission(), store);
    await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });
    const record = outcomes.list(USER)[0]!;
    expect(['PAID', 'CLOSED']).not.toContain(record.status);
    expect(record.status).toBe('COMMERCIAL_PENDING');
  });

  // ── Owner-scoped reads ─────────────────────────────────────────────────
  it('scopes reads to the owner — a foreign user sees nothing', async () => {
    const { service, outcomes } = build(mission(), store);
    await service.recordCommercialOutcome({
      userId: USER,
      missionId: MISSION,
      objectiveId: OBJECTIVE,
    });
    const id = commercialOutcomeId(USER, MISSION, OBJECTIVE);
    expect(service.getCommercialOutcome(USER, id)).toBeDefined();
    expect(service.getCommercialOutcome('u-2', id)).toBeUndefined();
    expect(service.listCommercialOutcomes('u-2')).toHaveLength(0);
    expect(outcomes.list('u-2')).toHaveLength(0);
  });
});
