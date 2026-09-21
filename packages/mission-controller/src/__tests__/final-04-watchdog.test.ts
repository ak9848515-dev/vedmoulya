// ──────────────────────────────────────────────────────────────────
// VedMoulya — FINAL-04: Provider-Wait Watchdog + Durable Observability
//
// Deterministic unit coverage for the FINAL-04 watchdog semantics owned
// by the frozen MissionControllerService:
//   C. reconciliation discovers persisted WAITING_FOR_PROVIDER missions,
//   D. it never duplicates execution (idempotent; concurrent passes resume
//      exactly once),
//   E. genuinely unavailable providers are LEFT waiting (honest hold),
//   B/Q. mission events + recovery events survive controller recreation,
//   K/L. terminal missions (COMPLETED/CANCELLED) are never resumed,
//   M. ownership boundaries are preserved,
//   N/O. the watchdog is orchestration only — it grants nothing and uses
//        only the existing mission state machine,
//   plus a provider-check failure degrades to an observable skip.
//
// "Process restart" is modelled the only way a unit test can: a FRESH
// controller over the SAME authoritative stores (no in-memory queue is
// relied on — every pass re-reads persisted state).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  InMemoryCheckpointStore,
  InMemoryMissionStore,
  MissionControllerService,
  SimpleProviderAvailability,
  SystemClock,
  createIdGenerator,
} from '../index.js';
import type { Mission } from '../index.js';
import { createFakePorts } from './fixtures.js';

const CAPABLE_PROVIDER = {
  providerId: 'mock',
  modelId: 'mock-1',
  capabilities: ['coding', 'testing', 'debugging', 'research'],
  healthy: true,
};

type ProviderAvailabilityOverride = {
  getProviderStatus(requiredCapabilities: string[]): Promise<{
    available: boolean;
    capableProviders: Array<{
      providerId: string;
      modelId: string;
      capabilities: string[];
      healthy: boolean;
    }>;
    unhealthyProviders: string[];
  }>;
};

interface Harness {
  /** The controller under test. */
  service: MissionControllerService;
  /** A FRESH controller over the SAME stores (models a process restart). */
  restart(): MissionControllerService;
  store: InMemoryMissionStore;
  checkpointStore: InMemoryCheckpointStore;
  providerAvailability: SimpleProviderAvailability;
  stats(): { executes: number; plans: number };
}

function makeHarness(
  overrides: {
    /** Replaces the provider check entirely (e.g. to model a failure). */
    providerAvailabilityOverride?: ProviderAvailabilityOverride;
    providersAvailable?: boolean;
  } = {},
): Harness {
  const store = new InMemoryMissionStore();
  const checkpointStore = new InMemoryCheckpointStore();
  let executes = 0;
  let plans = 0;
  const ports = createFakePorts({
    onExecute: () => {
      executes += 1;
    },
    onPlan: () => {
      plans += 1;
    },
  });
  const providerAvailability = new SimpleProviderAvailability(
    overrides.providersAvailable ? [CAPABLE_PROVIDER] : [],
  );

  const build = (): MissionControllerService =>
    new MissionControllerService({
      store,
      checkpointStore,
      ...ports,
      providerAvailability: overrides.providerAvailabilityOverride ?? providerAvailability,
      clock: new SystemClock(),
      idGenerator: createIdGenerator(),
    });

  return {
    service: build(),
    restart: build,
    store,
    checkpointStore,
    providerAvailability,
    stats: () => ({ executes, plans }),
  };
}

async function makeWaitingMission(
  service: MissionControllerService,
  userId = 'user-1',
): Promise<Mission> {
  const mission = await service.createMission({
    userId,
    title: 'Wait mission',
    objective: 'Improve the workspace autonomously',
    initialObjectives: ['Do the real work item'],
  });
  await service.startMission(mission.missionId);
  const waiting = await service.runNextObjective(mission.missionId);
  expect(waiting.state).toBe('WAITING_FOR_PROVIDER');
  return waiting;
}

describe('FINAL-04 — provider-wait watchdog reconciliation', () => {
  it('C: discovers a persisted WAITING_FOR_PROVIDER mission and resumes it when a provider returns (no execution duplicated)', async () => {
    const h = makeHarness();
    const mission = await makeWaitingMission(h.service);
    expect(h.stats().executes).toBe(0); // nothing executed while waiting

    // The provider comes back.
    h.providerAvailability.addProvider(CAPABLE_PROVIDER);

    const result = await h.service.reconcileProviderWaits();
    expect(result.considered).toBe(1);
    expect(result.resumed).toEqual([mission.missionId]);
    expect(result.stillWaiting).toHaveLength(0);

    const fresh = await h.store.get(mission.missionId);
    expect(fresh?.state).toBe('RUNNING');
    // Orchestration only: the watchdog scheduled no plan and executed nothing.
    expect(h.stats().executes).toBe(0);
    expect(h.stats().plans).toBe(0);
  });

  it('D: never duplicates execution — repeated and concurrent passes resume exactly once', async () => {
    const h = makeHarness();
    const mission = await makeWaitingMission(h.service);
    h.providerAvailability.addProvider(CAPABLE_PROVIDER);

    // Two concurrent watchdog passes race the same mission.
    const [a, b] = await Promise.all([
      h.service.reconcileProviderWaits(),
      h.service.reconcileProviderWaits(),
    ]);
    expect(a.resumed.length + b.resumed.length).toBe(1);

    // A later pass sees a RUNNING mission — not eligible, nothing re-driven.
    const third = await h.service.reconcileProviderWaits();
    expect(third.considered).toBe(0);
    expect(third.resumed).toHaveLength(0);

    const fresh = await h.store.get(mission.missionId);
    expect(fresh?.state).toBe('RUNNING');
    // Exactly two RUNNING entries: the START transition and the resume.
    expect(fresh?.stateHistory.filter((s) => s === 'RUNNING')).toHaveLength(2);
    expect(h.stats().executes).toBe(0);
  });

  it('E: leaves a genuinely unavailable provider waiting (hold + checkpoint preserved)', async () => {
    const h = makeHarness();
    const mission = await makeWaitingMission(h.service);
    const checkpointsBefore = (await h.store.get(mission.missionId))?.checkpoints.length;

    const result = await h.service.reconcileProviderWaits();
    expect(result.considered).toBe(1);
    expect(result.resumed).toHaveLength(0);
    expect(result.stillWaiting).toHaveLength(1);
    expect(result.stillWaiting[0]?.missionId).toBe(mission.missionId);

    const fresh = await h.store.get(mission.missionId);
    expect(fresh?.state).toBe('WAITING_FOR_PROVIDER');
    expect(fresh?.checkpoints.length).toBe(checkpointsBefore);
    expect(fresh?.outcomeReason).toContain('No capable provider');
  });

  it('a provider-check failure is an honest skip — never a resume, never a crash', async () => {
    let checks = 0;
    const h = makeHarness({
      // First check (mission start) honestly reports no provider; every later
      // check fails, modelling a provider registry that goes unreachable.
      providerAvailabilityOverride: {
        getProviderStatus: async () => {
          checks += 1;
          if (checks === 1) {
            return { available: false, capableProviders: [], unhealthyProviders: [] };
          }
          throw new Error('provider registry unavailable');
        },
      },
    });
    const mission = await makeWaitingMission(h.service);

    const result = await h.service.reconcileProviderWaits();
    expect(result.resumed).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toContain('provider check failed');

    const fresh = await h.store.get(mission.missionId);
    expect(fresh?.state).toBe('WAITING_FOR_PROVIDER');
  });

  it('K: a COMPLETED mission is never re-executed by the watchdog', async () => {
    const h = makeHarness({ providersAvailable: true });
    const mission = await h.service.createMission({
      userId: 'user-1',
      title: 'Complete mission',
      objective: 'Complete the work',
      initialObjectives: ['Do the real work item'],
    });
    await h.service.startMission(mission.missionId);
    const done = await h.service.runAutonomousLoop(mission.missionId);
    expect(done.state).toBe('COMPLETED');
    const verifiedAt = done.objectives[0]?.verifiedOutcome?.verifiedAt;
    const executesAfterLoop = h.stats().executes;

    const result = await h.service.reconcileProviderWaits();
    expect(result.considered).toBe(0);
    expect(result.resumed).toHaveLength(0);

    const fresh = await h.store.get(mission.missionId);
    expect(fresh?.state).toBe('COMPLETED');
    expect(fresh?.objectives[0]?.verifiedOutcome?.verifiedAt).toBe(verifiedAt);
    expect(h.stats().executes).toBe(executesAfterLoop); // no duplicate execution
  });

  it('L: a CANCELLED mission is never resumed', async () => {
    const h = makeHarness();
    const mission = await makeWaitingMission(h.service);
    await h.service.cancelMission(mission.missionId);
    h.providerAvailability.addProvider(CAPABLE_PROVIDER);

    const result = await h.service.reconcileProviderWaits();
    expect(result.considered).toBe(0);
    expect(result.resumed).toHaveLength(0);
    expect((await h.store.get(mission.missionId))?.state).toBe('CANCELLED');
  });

  it('M: ownership is preserved and the pass returns ids/counts only (no mission contents)', async () => {
    const h = makeHarness({ providersAvailable: true });
    const one = await h.service.createMission({
      userId: 'owner-a',
      title: 'Secret alpha mission',
      objective: 'Improve the workspace autonomously',
      initialObjectives: ['Do alpha work'],
    });
    const two = await h.service.createMission({
      userId: 'owner-b',
      title: 'Secret beta mission',
      objective: 'Improve the workspace autonomously',
      initialObjectives: ['Do beta work'],
    });
    // The provider is momentarily unhealthy → both missions wait honestly.
    h.providerAvailability.setProviderHealth('mock', false);
    await h.service.startMission(one.missionId);
    await h.service.startMission(two.missionId);
    await h.service.runNextObjective(one.missionId);
    await h.service.runNextObjective(two.missionId);
    h.providerAvailability.setProviderHealth('mock', true);

    const result = await h.service.reconcileProviderWaits();
    expect(result.resumed.sort()).toEqual([one.missionId, two.missionId].sort());
    expect((await h.store.get(one.missionId))?.userId).toBe('owner-a');
    expect((await h.store.get(two.missionId))?.userId).toBe('owner-b');
    // The aggregate carries no mission titles / objectives — ids + counts only.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('Secret alpha mission');
    expect(serialized).not.toContain('Secret beta mission');
  });

  it('N/O: the watchdog grants nothing and uses only the frozen state machine', async () => {
    const h = makeHarness();
    const mission = await makeWaitingMission(h.service);
    const before = await h.store.get(mission.missionId);
    const constraintsBefore = JSON.stringify(before?.constraints);
    const budgetBefore = JSON.stringify(before?.budget);

    h.providerAvailability.addProvider(CAPABLE_PROVIDER);
    await h.service.reconcileProviderWaits();

    const after = await h.store.get(mission.missionId);
    // Exactly the legal WAITING_FOR_PROVIDER → RUNNING transition.
    expect(after?.stateHistory.slice(-2)).toEqual(['WAITING_FOR_PROVIDER', 'RUNNING']);
    expect(after?.state).toBe('RUNNING');
    // No permission, tool, budget or approval was touched.
    expect(JSON.stringify(after?.constraints)).toBe(constraintsBefore);
    expect(JSON.stringify(after?.budget)).toBe(budgetBefore);
    // No plan, no execution, no tool call was ever started by the watchdog.
    expect(h.stats().plans).toBe(0);
    expect(h.stats().executes).toBe(0);
  });

  it('B/Q: mission + recovery events survive controller recreation (durable trail)', async () => {
    const h = makeHarness();
    const mission = await makeWaitingMission(h.service);
    // Snapshot the pre-restart durable trail.
    const beforeRestart = await h.store.get(mission.missionId);
    expect(beforeRestart?.activity?.some((e) => e.kind === 'MISSION_CREATED')).toBe(true);
    expect(beforeRestart?.activity?.some((e) => e.kind === 'WAITING_FOR_PROVIDER')).toBe(true);

    // ── Restart: a FRESH controller over the SAME stores ──
    const restarted = h.restart();
    h.providerAvailability.addProvider(CAPABLE_PROVIDER);
    const result = await restarted.reconcileProviderWaits();
    expect(result.resumed).toEqual([mission.missionId]);

    const after = await h.store.get(mission.missionId);
    const kinds = (after?.activity ?? []).map((e) => e.kind);
    // The creation/wait trail survived, and the recovery is now durable too.
    expect(kinds).toContain('MISSION_CREATED');
    expect(kinds).toContain('MISSION_RESUMED');
    expect(kinds).toContain('WATCHDOG_RESUMED');
    // The watchdog event explains WHY (which providers it observed).
    const watchdogEvent = after?.activity?.find((e) => e.kind === 'WATCHDOG_RESUMED');
    expect(watchdogEvent?.message).toContain('mock');
  });
});

// ── Recovery of interrupted execution (Part 5) ─────────────────────
describe('FINAL-04 — restart recovery events are durable', () => {
  it('heals an interrupted RUNNING objective after recreation and records the recovery event', async () => {
    const store = new InMemoryMissionStore();
    const checkpointStore = new InMemoryCheckpointStore();
    const ports = createFakePorts();
    const build = (): MissionControllerService =>
      new MissionControllerService({
        store,
        checkpointStore,
        ...ports,
        clock: new SystemClock(),
        idGenerator: createIdGenerator(),
      });

    const first = build();
    const mission = await first.createMission({
      userId: 'user-1',
      title: 'Interrupted mission',
      objective: 'Improve the workspace autonomously',
      initialObjectives: ['Do the work'],
    });
    await first.startMission(mission.missionId);

    // Simulate a process death mid-objective: persist RUNNING with an
    // EXPIRED lease directly (the previous owner is presumed dead).
    const persisted = await store.get(mission.missionId);
    const objective = persisted?.objectives[0];
    if (!persisted || !objective) throw new Error('objective missing');
    objective.state = 'RUNNING';
    objective.stateHistory.push('RUNNING');
    objective.lease = {
      owner: 'dead-worker',
      acquiredAt: '2020-01-01T00:00:00.000Z',
      expiresAt: '2020-01-01T00:01:00.000Z', // long expired
    };
    await store.save(persisted);

    // ── Restart ──
    const restarted = build();
    const recovered = await restarted.recoverMission(mission.missionId);
    expect(recovered.state).toBe('RUNNING');
    expect(recovered.objectives[0]?.state).toBe('READY');
    expect(recovered.objectives[0]?.lease).toBeUndefined();
    // The recovery is observable on the durable trail.
    expect(recovered.activity?.some((e) => e.kind === 'RECOVERY_LEASE_EXPIRED')).toBe(true);
  });
});
