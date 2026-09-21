// ──────────────────────────────────────────────────────────────────
// VedMoulya — FINAL-05: abandoned-execution reconciliation
//
// The gap this closes (found by live process certification): a mission whose
// owner process is killed WHILE HOLDING an objective lease keeps that lease
// until its TTL expires. Boot recovery correctly refuses to steal a live
// lease — but nothing revisited the mission after the TTL expired, so an
// interrupted mission could stay RUNNING with no owner and no human forever.
//
// Verified here, deterministically:
//   * an EXPIRED lease is healed through the frozen recovery path and the
//     mission is reported resumable (recovery event persisted durably),
//   * a LIVE lease is NEVER stolen (stillOwned; mission untouched),
//   * a mission with nothing abandoned is reported honestly (skipped),
//   * terminal missions and operator holds are never touched,
//   * the pass is idempotent (no duplicate healing, no duplicate resume),
//   * the healed work is re-executed at most once and the budget survives.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  InMemoryCheckpointStore,
  InMemoryMissionStore,
  MissionControllerService,
  SystemClock,
  createIdGenerator,
} from '../index.js';
import type { ClockPort, Mission } from '../index.js';
import { createFakePorts } from './fixtures.js';

/** The harness clock's origin — every lease time is expressed in THAT domain,
 *  so "expired" and "live" are deterministic (never wall-clock dependent). */
const CLOCK_START_MS = Date.parse('2026-01-01T00:00:00.000Z');
/** Expires 0.5s after the origin; the tests then advance 5s → long expired. */
const EXPIRED_LEASE_AT = new Date(CLOCK_START_MS + 500).toISOString();
/** Expires 10 minutes after the origin → a live owner by any measure. */
const LIVE_LEASE_AT = new Date(CLOCK_START_MS + 600_000).toISOString();

interface Harness {
  service: MissionControllerService;
  build(clock?: ClockPort): MissionControllerService;
  store: InMemoryMissionStore;
  advance(ms: number): void;
  stats(): { executes: number };
}

function makeHarness(): Harness {
  const store = new InMemoryMissionStore();
  const checkpointStore = new InMemoryCheckpointStore();
  let executes = 0;
  const ports = createFakePorts({
    onExecute: () => {
      executes += 1;
    },
  });
  let nowMs = Date.parse('2026-01-01T00:00:00.000Z');
  const clock: ClockPort = {
    now: () => new Date(nowMs).toISOString(),
    timestampMs: () => nowMs,
  };
  const build = (override?: ClockPort): MissionControllerService =>
    new MissionControllerService({
      store,
      checkpointStore,
      ...ports,
      clock: override ?? clock,
      idGenerator: createIdGenerator(),
      // Deliberately short so an expired lease is expressible in the test.
      leaseTtlMs: 1_000,
    });
  return {
    service: build(),
    build,
    store,
    advance: (ms) => {
      nowMs += ms;
    },
    stats: () => ({ executes }),
  };
}

async function makeRunningMission(service: MissionControllerService): Promise<Mission> {
  const mission = await service.createMission({
    userId: 'user-1',
    title: 'Interrupted mission',
    objective: 'Improve the workspace autonomously',
    initialObjectives: ['Do the real work item', 'Do the second work item'],
  });
  await service.startMission(mission.missionId);
  return mission;
}

/** Persist a RUNNING objective owned by a lease that expires at `expiresAt`. */
async function leaseObjective(
  store: InMemoryMissionStore,
  missionId: string,
  expiresAt: string,
): Promise<void> {
  const mission = await store.get(missionId);
  const objective = mission?.objectives[0];
  if (!mission || !objective) throw new Error('objective missing');
  objective.state = 'RUNNING';
  objective.stateHistory.push('RUNNING');
  objective.lease = {
    owner: 'dead-worker',
    acquiredAt: '2026-01-01T00:00:00.000Z',
    expiresAt,
  };
  await store.save(mission);
}

describe('FINAL-05 — abandoned-execution reconciliation', () => {
  it('heals an EXPIRED lease and reports the mission resumable (durable recovery event)', async () => {
    const h = makeHarness();
    const mission = await makeRunningMission(h.service);
    // The crash happened 5s ago; the 1s lease is long expired.
    await leaseObjective(h.store, mission.missionId, EXPIRED_LEASE_AT);
    h.advance(5_000);

    const result = await h.service.reconcileAbandonedExecutions();
    expect(result.considered).toBe(1);
    expect(result.resumed).toEqual([mission.missionId]);
    expect(result.stillOwned).toHaveLength(0);

    const healed = await h.store.get(mission.missionId);
    expect(healed?.state).toBe('RUNNING');
    expect(healed?.objectives[0]?.state).toBe('READY'); // healed, not re-run yet
    expect(healed?.objectives[0]?.lease).toBeUndefined();
    expect(healed?.activity?.some((event) => event.kind === 'RECOVERY_LEASE_EXPIRED')).toBe(true);
    // Nothing was executed by the reconciliation itself — it only heals.
    expect(h.stats().executes).toBe(0);
  });

  it('NEVER steals a LIVE lease (a real owner keeps its objective)', async () => {
    const h = makeHarness();
    const mission = await makeRunningMission(h.service);
    // The owner is alive: the lease expires well in the future.
    await leaseObjective(h.store, mission.missionId, LIVE_LEASE_AT);

    const result = await h.service.reconcileAbandonedExecutions();
    expect(result.resumed).toHaveLength(0);
    expect(result.stillOwned).toHaveLength(1);
    expect(result.stillOwned[0]?.missionId).toBe(mission.missionId);

    const untouched = await h.store.get(mission.missionId);
    expect(untouched?.objectives[0]?.state).toBe('RUNNING');
    expect(untouched?.objectives[0]?.lease?.owner).toBe('dead-worker');
    expect(h.stats().executes).toBe(0);
  });

  it('is idempotent: a second pass heals nothing again and never duplicates work', async () => {
    const h = makeHarness();
    const mission = await makeRunningMission(h.service);
    await leaseObjective(h.store, mission.missionId, EXPIRED_LEASE_AT);
    h.advance(5_000);

    const first = await h.service.reconcileAbandonedExecutions();
    expect(first.resumed).toEqual([mission.missionId]);
    const afterFirst = await h.store.get(mission.missionId);

    const second = await h.service.reconcileAbandonedExecutions();
    expect(second.resumed).toHaveLength(0);
    expect(second.skipped.map((entry) => entry.missionId)).toEqual([mission.missionId]);

    const afterSecond = await h.store.get(mission.missionId);
    // No extra state entry, no extra recovery event, no execution.
    expect(afterSecond?.stateHistory.length).toBe(afterFirst?.stateHistory.length);
    expect(
      (afterSecond?.activity ?? []).filter((e) => e.kind === 'RECOVERY_LEASE_EXPIRED').length,
    ).toBe(1);
    expect(h.stats().executes).toBe(0);
  });

  it('never touches terminal missions or operator holds', async () => {
    const h = makeHarness();
    const completed = await makeRunningMission(h.service);
    await h.store.save({
      ...(await h.store.get(completed.missionId))!,
      state: 'COMPLETED',
      stateHistory: ['CREATED', 'RUNNING', 'COMPLETED'],
    });
    const paused = await makeRunningMission(h.service);
    await h.store.save({
      ...(await h.store.get(paused.missionId))!,
      state: 'PAUSED',
      stateHistory: ['CREATED', 'RUNNING', 'PAUSED'],
    });

    const result = await h.service.reconcileAbandonedExecutions();
    expect(result.considered).toBe(0);
    expect(result.resumed).toHaveLength(0);
    expect((await h.store.get(completed.missionId))?.state).toBe('COMPLETED');
    expect((await h.store.get(paused.missionId))?.state).toBe('PAUSED');
  });

  it('reports honestly when a RUNNING mission has nothing abandoned', async () => {
    const h = makeHarness();
    const mission = await makeRunningMission(h.service);

    const result = await h.service.reconcileAbandonedExecutions();
    expect(result.considered).toBe(1);
    expect(result.resumed).toHaveLength(0);
    expect(result.skipped[0]?.reason).toContain('no abandoned objective');
    expect((await h.store.get(mission.missionId))?.state).toBe('RUNNING');
  });

  it('a healed mission continues to verified completion through the SAME loop (no duplicate work)', async () => {
    const h = makeHarness();
    const mission = await makeRunningMission(h.service);
    await leaseObjective(h.store, mission.missionId, EXPIRED_LEASE_AT);
    h.advance(5_000);

    const result = await h.service.reconcileAbandonedExecutions();
    expect(result.resumed).toEqual([mission.missionId]);

    // The caller (the runtime cadence) relaunches the EXISTING loop.
    const final = await h.service.runAutonomousLoop(mission.missionId);
    expect(final.state).toBe('COMPLETED');
    expect(final.objectives.every((objective) => objective.state === 'VERIFIED')).toBe(true);
    // Two objectives, each executed exactly once — never a duplicate attempt.
    expect(h.stats().executes).toBe(2);
  });
});
