// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S4.1 governed `mission.deliver` API
//
// Exercises the exposed operation the way a caller must use it: the identity
// comes from the AUTHENTICATED CONTEXT, never from the request body.
//
// Proves: authenticated success · wrong-user rejection · non-VERIFIED rejection
// · objective-not-in-mission rejection · missing artifact · API idempotency ·
// per-user isolation · memory persisted · memory replay idempotent · honest
// partial state on memory failure · approval still required.
// ─────────────────────────────────────────────────────────────────────────────

import { beforeEach, describe, expect, it } from 'vitest';
import type { DocumentRecord } from '@vedmoulya/domain';
import { InMemoryClientOpsRepository } from '@vedmoulya/services';
import {
  MissionClientOpsHandoffService,
  type HandoffMissionView,
} from '../services/MissionClientOpsHandoff.js';
import { DeliveryOutcomeMemory } from '../services/DeliveryOutcomeMemory.js';
import type { ExecutionMemoryStore, MemoryEntry } from '@vedmoulya/execution-memory';

const NOW = new Date('2026-10-05T10:00:00.000Z');

class Store implements ExecutionMemoryStore {
  readonly entries: MemoryEntry[] = [];
  fail = false;

  async save(entry: MemoryEntry): Promise<void> {
    if (this.fail) throw new Error('memory store unavailable');
    const i = this.entries.findIndex((e) => e.fingerprint === entry.fingerprint);
    if (i >= 0) this.entries[i] = entry;
    else this.entries.push(entry);
  }
  async get(): Promise<MemoryEntry | undefined> {
    return undefined;
  }
  async getByFingerprint(f: string): Promise<MemoryEntry | undefined> {
    return this.entries.find((e) => e.fingerprint === f);
  }
  async list(): Promise<MemoryEntry[]> {
    return [...this.entries];
  }
  async delete(): Promise<void> {
    /* unused */
  }
}

function missionView(
  userId: string,
  objectiveState = 'VERIFIED',
  objectiveIds: string[] = ['o-1'],
): HandoffMissionView {
  return {
    missionId: 'm-1',
    userId,
    objectives: objectiveIds.map((objectiveId) => ({
      objectiveId,
      state: objectiveState,
      title: `Objective ${objectiveId}`,
      verifiedOutcome:
        objectiveState === 'VERIFIED'
          ? { outcome: `done ${objectiveId}`, method: 'process-exit', evidence: ['exit 0'] }
          : null,
    })),
  };
}

/**
 * The governed operation, exactly as RouterRegistry exposes it: userId is taken
 * from the authenticated context and merged AFTER the client input, so a
 * client-supplied userId could never win.
 */
function api(ownerId: string) {
  const clientOps = new InMemoryClientOpsRepository();
  const store = new Store();
  const service = new MissionClientOpsHandoffService({
    missions: { get: async () => missions.get(ownerId) },
    clientOps,
    memory: new DeliveryOutcomeMemory({ store, now: () => NOW }),
    now: () => NOW,
  });

  async function deliver(
    input: {
      missionId: string;
      objectiveId: string;
      clientId: string;
      deliverableName: string;
      deliverableContent: string;
    },
    // The authenticated session identity.
    sessionUserId: string = ownerId,
  ) {
    return service.handoffVerifiedOutcome({
      ...input,
      ...(input as Record<string, never>),
      userId: sessionUserId,
    } as Parameters<typeof service.handoffVerifiedOutcome>[0]);
  }

  return { deliver, clientOps, store, service };
}

const missions = new Map<string, HandoffMissionView>();
const VALID = {
  missionId: 'm-1',
  objectiveId: 'o-1',
  clientId: 'client-1',
  deliverableName: 'deliverable.md',
  deliverableContent: '# Deliverable',
};

describe('S4.1 API — mission.deliver', () => {
  beforeEach(() => {
    missions.clear();
    missions.set('owner-1', missionView('owner-1'));
    missions.set('owner-2', missionView('owner-2'));
  });

  it('an authenticated VERIFIED mission delivers and stays pending approval', async () => {
    const { deliver, clientOps, store } = api('owner-1');
    const result = await deliver(VALID);

    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    expect(result.created).toBe(true);
    // The API only PREPARES a draft — approval is never bypassed.
    expect(result.pendingApproval).toBe(true);
    expect(result.memoryRecorded).toBe(true);
    expect(await clientOps.listDocuments('owner-1')).toHaveLength(1);
    // The memory outcome was persisted.
    expect(store.entries).toHaveLength(1);
    expect(store.entries[0]!.category).toBe('DELIVERY_OUTCOME');
  });

  it('rejects a caller who does not own the mission', async () => {
    const { deliver, clientOps } = api('owner-2');
    // owner-2's session, but owner-1's mission id is not in owner-2's scope.
    missions.set('owner-2', missionView('owner-1'));

    const result = await deliver(VALID, 'owner-2');
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.reason).toBe('NOT_OWNER');
    expect(await clientOps.listDocuments('owner-2')).toHaveLength(0);
  });

  it('rejects an unauthenticated/unknown caller safely', async () => {
    const { deliver, clientOps } = api('owner-1');
    const result = await deliver(VALID, 'someone-else');
    expect(result.ok).toBe(false);
    expect(await clientOps.listDocuments('owner-1')).toHaveLength(0);
  });

  it('rejects a non-VERIFIED objective', async () => {
    missions.set('owner-1', missionView('owner-1', 'RUNNING'));
    const { deliver } = api('owner-1');

    const result = await deliver(VALID);
    expect(result.ok === false && result.reason).toBe('OBJECTIVE_NOT_VERIFIED');
  });

  it('rejects an objective that does not belong to the mission', async () => {
    const { deliver } = api('owner-1');
    const result = await deliver({ ...VALID, objectiveId: 'o-999' });
    expect(result.ok === false && result.reason).toBe('OBJECTIVE_NOT_FOUND');
  });

  it('rejects a missing artifact', async () => {
    const { deliver } = api('owner-1');
    const result = await deliver({ ...VALID, deliverableContent: '  ' });
    expect(result.ok === false && result.reason).toBe('MISSING_ARTIFACT');
  });

  it('a duplicate API request is idempotent (one document, one memory entry)', async () => {
    const { deliver, clientOps, store } = api('owner-1');

    const first = await deliver(VALID);
    const second = await deliver(VALID);

    expect(first.ok === true && first.created).toBe(true);
    expect(second.ok === true && second.created).toBe(false);
    expect(await clientOps.listDocuments('owner-1')).toHaveLength(1);
    // Replay reinforces the SAME memory entry — never a duplicate.
    expect(store.entries).toHaveLength(1);
    expect(store.entries[0]!.sampleCount).toBe(1);
  });

  it('keeps two owners isolated end to end', async () => {
    const a = api('owner-1');
    const b = api('owner-2');

    await a.deliver(VALID);
    await b.deliver({ ...VALID, clientId: 'client-2', deliverableContent: 'other' });

    expect((await a.clientOps.listDocuments('owner-1'))[0]!.clientId).toBe('client-1');
    expect((await b.clientOps.listDocuments('owner-2'))[0]!.clientId).toBe('client-2');
    // One memory entry each, belonging to its own owner.
    expect(a.store.entries.filter((e) => e.userId === 'owner-1')).toHaveLength(1);
    expect(b.store.entries.filter((e) => e.userId === 'owner-2')).toHaveLength(1);
  });

  it('reports an honest partial state when memory fails (document still exists)', async () => {
    const { deliver, clientOps, store } = api('owner-1');
    store.fail = true;

    const result = await deliver(VALID);

    // The ClientOps deliverable genuinely exists…
    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    expect((await clientOps.listDocuments('owner-1')) as DocumentRecord[]).toHaveLength(1);
    // …but the outcome is NOT claimed as fully completed.
    expect(result.memoryRecorded).toBe(false);
    expect(store.entries).toHaveLength(0);
  });
});
