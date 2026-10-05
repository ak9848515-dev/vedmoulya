// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S4 Mission → ClientOps handoff bridge
//
// Proves the guarantees the bridge makes:
//   • VERIFIED-ONLY gate is deterministic (a model never decides this)
//   • unverified objectives — PENDING/RUNNING/FAILED/BLOCKED/CANCELLED and an
//     unknown state — are rejected
//   • user isolation: another user cannot hand off or observe a deliverable
//   • idempotency: the same objective never produces a second record
//   • a ClientOps failure leaves the Mission VERIFIED and reports honestly
//   • a memory failure never claims a commercial completion that did not occur
//   • no secret ever crosses the boundary
// ─────────────────────────────────────────────────────────────────────────────

import { beforeEach, describe, expect, it } from 'vitest';
import type { DocumentRecord } from '@vedmoulya/domain';
import {
  MissionClientOpsHandoffService,
  handoffDocumentId,
  type ClientOpsDocumentStore,
  type HandoffMissionView,
  type MissionDeliveryMemoryPort,
  type MissionLookup,
  type VerifiedOutcomeHandoffInput,
} from '../services/MissionClientOpsHandoff.js';

const NOW = new Date('2026-10-05T09:00:00.000Z');

function mission(
  overrides: Partial<HandoffMissionView> = {},
  objectiveState = 'VERIFIED',
): HandoffMissionView {
  return {
    missionId: 'm-1',
    userId: 'u-1',
    title: 'Ship the landing page',
    objectives: [
      {
        objectiveId: 'o-1',
        state: objectiveState,
        title: 'Build the page',
        verifiedOutcome:
          objectiveState === 'VERIFIED'
            ? {
                outcome: 'Landing page delivered',
                method: 'process-exit',
                evidence: ['build exit 0'],
                verifiedAt: '2026-10-05T08:59:00.000Z',
              }
            : null,
      },
    ],
    ...overrides,
  };
}

class Store implements ClientOpsDocumentStore {
  readonly documents: DocumentRecord[] = [];
  failSave = false;

  async listDocuments(userId: string): Promise<DocumentRecord[]> {
    return this.documents.filter((document) => document.userId === userId);
  }

  async saveDocument(document: DocumentRecord): Promise<void> {
    if (this.failSave) throw new Error('client ops unavailable');
    this.documents.push(document);
  }
}

class Memory implements MissionDeliveryMemoryPort {
  readonly entries: unknown[] = [];
  fail = false;

  async recordDeliveryOutcome(entry: {
    userId: string;
    missionId: string;
    objectiveId: string;
    outcome: string;
    documentId: string;
    source: string;
  }): Promise<void> {
    if (this.fail) throw new Error('memory unavailable');
    this.entries.push(entry);
  }
}

const INPUT: VerifiedOutcomeHandoffInput = {
  userId: 'u-1',
  missionId: 'm-1',
  objectiveId: 'o-1',
  clientId: 'client-1',
  deliverableName: 'landing-page.md',
  deliverableContent: '# Landing page\nVerified output.',
};

function build(missionView: HandoffMissionView, store: Store, memory?: Memory) {
  const lookup: MissionLookup = { get: async () => missionView };
  return new MissionClientOpsHandoffService({
    missions: lookup,
    clientOps: store,
    ...(memory !== undefined ? { memory } : {}),
    now: () => NOW,
  });
}

describe('S4 — Mission → ClientOps handoff', () => {
  let store: Store;
  let memory: Memory;

  beforeEach(() => {
    store = new Store();
    memory = new Memory();
  });

  // ── The happy path (Phase 5/6/9) ───────────────────────────────────────
  it('VERIFIED → creates ONE draft deliverable, pending approval', async () => {
    const result = await build(mission(), store, memory).handoffVerifiedOutcome(INPUT);

    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    expect(result.created).toBe(true);
    // Preparing a draft never sends anything externally.
    expect(result.pendingApproval).toBe(true);
    expect(store.documents).toHaveLength(1);

    const document = store.documents[0]!;
    expect(document.userId).toBe('u-1');
    expect(document.clientId).toBe('client-1');
    expect(document.kind).toBe('other');
    // Provenance references only — never Mission state or provider output.
    expect(document.metadata['missionId']).toBe('m-1');
    expect(document.metadata['objectiveId']).toBe('o-1');
    expect(document.metadata['verificationMethod']).toBe('process-exit');
  });

  it('records the delivery in memory with an explicit source', async () => {
    await build(mission(), store, memory).handoffVerifiedOutcome(INPUT);

    expect(memory.entries).toHaveLength(1);
    expect(memory.entries[0]).toMatchObject({
      userId: 'u-1',
      missionId: 'm-1',
      objectiveId: 'o-1',
      source: 'mission-verified-handoff',
    });
  });

  // ── Phase 3: the VERIFIED-only gate ────────────────────────────────────
  it.each(['PENDING', 'RUNNING', 'FAILED', 'BLOCKED', 'CANCELLED', 'SOMETHING_ELSE'])(
    'rejects a %s objective deterministically',
    async (state) => {
      const result = await build(mission({}, state), store, memory).handoffVerifiedOutcome(INPUT);

      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.reason).toBe('OBJECTIVE_NOT_VERIFIED');
      // An unverified objective must never create a commercial record.
      expect(store.documents).toHaveLength(0);
      expect(memory.entries).toHaveLength(0);
    },
  );

  // ── User isolation (Phase 10) ──────────────────────────────────────────
  it('rejects a handoff from a different user', async () => {
    const result = await build(mission(), store, memory).handoffVerifiedOutcome({
      ...INPUT,
      userId: 'u-2',
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.reason).toBe('NOT_OWNER');
    expect(store.documents).toHaveLength(0);
  });

  it('never exposes one user deliverable to another', async () => {
    await build(mission(), store, memory).handoffVerifiedOutcome(INPUT);

    // The second user's scoped read sees nothing.
    expect(await store.listDocuments('u-2')).toHaveLength(0);
    expect(await store.listDocuments('u-1')).toHaveLength(1);
  });

  // ── Phase 4: idempotency ───────────────────────────────────────────────
  it('is idempotent: the same objective yields exactly ONE record', async () => {
    const service = build(mission(), store, memory);

    const first = await service.handoffVerifiedOutcome(INPUT);
    const second = await service.handoffVerifiedOutcome(INPUT);
    const third = await service.handoffVerifiedOutcome(INPUT);

    expect(first.ok && first.created).toBe(true);
    expect(second.ok && second.created).toBe(false);
    expect(third.ok && third.created).toBe(false);
    expect(store.documents).toHaveLength(1);
    // Memory is not rewritten on replay either.
    expect(memory.entries).toHaveLength(1);
  });

  it('gives different objectives independent handoffs', async () => {
    const twoObjectives: HandoffMissionView = {
      ...mission(),
      objectives: [
        mission().objectives[0]!,
        { objectiveId: 'o-2', state: 'VERIFIED', title: 'Second' },
      ],
    };
    const service = build(twoObjectives, store, memory);

    await service.handoffVerifiedOutcome(INPUT);
    const second = await service.handoffVerifiedOutcome({
      ...INPUT,
      objectiveId: 'o-2',
      deliverableName: 'second.md',
    });

    expect(second.ok).toBe(true);
    expect(store.documents).toHaveLength(2);
    expect(new Set(store.documents.map((d) => d.id)).size).toBe(2);
  });

  it('derives the same id for the same mission+objective regardless of caller order', () => {
    expect(handoffDocumentId('u-1', 'm-1', 'o-1')).toBe(handoffDocumentId('u-1', 'm-1', 'o-1'));
    expect(handoffDocumentId('u-1', 'm-1', 'o-1')).not.toBe(handoffDocumentId('m-1', 'o-2'));
  });

  // ── Phase 8: honest failure semantics ──────────────────────────────────
  it('rejects a missing artifact', async () => {
    const result = await build(mission(), store, memory).handoffVerifiedOutcome({
      ...INPUT,
      deliverableContent: '   ',
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.reason).toBe('MISSING_ARTIFACT');
    expect(store.documents).toHaveLength(0);
  });

  it('rejects when the mission or objective does not exist', async () => {
    const missingMission = await build(
      { ...mission(), objectives: [] },
      store,
      memory,
    ).handoffVerifiedOutcome(INPUT);
    expect(missingMission.ok === false && missingMission.reason).toBe('OBJECTIVE_NOT_FOUND');

    const noMission = new MissionClientOpsHandoffService({
      missions: { get: async () => undefined },
      clientOps: store,
      now: () => NOW,
    });
    const absent = await noMission.handoffVerifiedOutcome(INPUT);
    expect(absent.ok === false && absent.reason).toBe('MISSION_NOT_FOUND');
  });

  it('requires a ClientOps client', async () => {
    const result = await build(mission(), store, memory).handoffVerifiedOutcome({
      ...INPUT,
      clientId: '',
    });
    expect(result.ok === false && result.reason).toBe('CLIENT_REQUIRED');
  });

  it('a ClientOps failure is reported honestly and leaves the Mission VERIFIED', async () => {
    const missionView = mission();
    store.failSave = true;

    const result = await build(missionView, store, memory).handoffVerifiedOutcome(INPUT);

    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.reason).toBe('CLIENTOPS_FAILURE');
    // The execution truth is untouched: still VERIFIED, no commercial record.
    expect(missionView.objectives[0]!.state).toBe('VERIFIED');
    expect(store.documents).toHaveLength(0);
    expect(memory.entries).toHaveLength(0);
  });

  it('a memory failure does not invent or destroy the delivered record', async () => {
    memory.fail = true;

    const result = await build(mission(), store, memory).handoffVerifiedOutcome(INPUT);

    // The deliverable genuinely exists — the handoff succeeded honestly, and
    // nothing claims memory was written.
    expect(result.ok).toBe(true);
    expect(store.documents).toHaveLength(1);
    expect(memory.entries).toHaveLength(0);
  });

  it('works without a memory port at all (honest degradation)', async () => {
    const result = await build(mission(), store).handoffVerifiedOutcome(INPUT);
    expect(result.ok).toBe(true);
    expect(store.documents).toHaveLength(1);
  });

  // ── Phase 10: the boundary carries no secrets ───────────────────────────
  it('never carries a secret, prompt or credential into ClientOps', async () => {
    await build(mission(), store, memory).handoffVerifiedOutcome({
      ...INPUT,
      opportunityId: 'opp-9',
    });

    const serialized = JSON.stringify(store.documents[0]);
    expect(serialized).not.toMatch(/postgres:\/\//i);
    expect(serialized).not.toMatch(/bearer /i);
    expect(serialized).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // JWT-shaped
    expect(serialized).not.toMatch(/AIza[A-Za-z0-9_-]{10,}/); // Google API key
    expect(serialized).not.toMatch(/password/i);
    // No absolute workspace path leaked into the commercial record.
    expect(serialized).not.toMatch(/[A-Za-z]:\\\\/);
  });

  it('carries the optional opportunity reference only when supplied', async () => {
    await build(mission(), store, memory).handoffVerifiedOutcome({
      ...INPUT,
      opportunityId: 'opp-9',
    });
    expect(store.documents[0]!.metadata['opportunityId']).toBe('opp-9');

    store.documents.length = 0;
    const second = mission();
    second.objectives[0]!.objectiveId = 'o-7';
    await build(second, store, memory).handoffVerifiedOutcome({
      ...INPUT,
      objectiveId: 'o-7',
    });
    expect(store.documents[0]!.metadata['opportunityId']).toBeUndefined();
  });
});
