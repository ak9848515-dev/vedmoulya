// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: LOCAL WORKER HARNESS (WORKER-01)
//
// A deterministic harness for exercising the durable-execution contract
// WITHOUT a hosting target: it wires one `LocalMissionWorker` to a controller
// over SHARED stores, exposes explicit ticks (no real timers), and can
// "restart" — a brand-new controller + worker over the SAME durable stores,
// with the same clock and workspace lease store.
//
// What it models honestly:
//   • a process restart (new in-memory controller state, same durable rows);
//   • one worker at a time per harness (add a second harness to model two).
// What it does NOT model (and does not claim):
//   • a platform crash between two awaits, arbitrary interleaving, or a real
//     network partition — those need a real host and real fault injection.
// ──────────────────────────────────────────────────────────────────

import type {
  CheckpointStore,
  ClockPort,
  MissionStore,
  WorkspaceLeasePort,
} from '@vedmoulya/mission-controller';
import { SystemClock } from '@vedmoulya/mission-controller';
import type { MissionControllerService } from '@vedmoulya/mission-controller';
import {
  LocalMissionWorker,
  type MissionWorkerStatus,
  type MissionWorkerTickResult,
  type MissionWorkerScheduler,
} from './MissionWorker.js';

/** A manual scheduler: ticks happen ONLY when the harness says so. */
export const manualWorkerScheduler: MissionWorkerScheduler = {
  schedule: () => undefined,
  cancel: () => undefined,
};

export interface LocalWorkerHarnessOptions {
  /** Durable stores shared by every restart. */
  missions: MissionStore;
  checkpoints?: CheckpointStore;
  workspaceLeases?: WorkspaceLeasePort;
  /** Builds a FRESH controller (called on construction and on `restart`). */
  controllerFactory: () => MissionControllerService;
  clock?: ClockPort;
  instanceId?: string;
  maxMissionsPerTick?: number;
}

export interface LocalWorkerHarness {
  readonly worker: LocalMissionWorker;
  readonly controller: MissionControllerService;
  /** One explicit, bounded tick. */
  tick(): Promise<MissionWorkerTickResult>;
  /** Run up to `count` ticks; stops early when every mission is terminal. */
  runTicks(count: number): Promise<MissionWorkerTickResult[]>;
  status(): MissionWorkerStatus;
  /** A fresh controller + worker over the SAME stores (models a restart). */
  restart(overrides?: { instanceId?: string }): LocalWorkerHarness;
}

export function createLocalWorkerHarness(options: LocalWorkerHarnessOptions): LocalWorkerHarness {
  const clock = options.clock ?? new SystemClock();
  const controller = options.controllerFactory();
  const worker = new LocalMissionWorker({
    controller,
    store: options.missions,
    clock,
    scheduler: manualWorkerScheduler,
    ...(options.instanceId !== undefined ? { instanceId: options.instanceId } : {}),
    ...(options.maxMissionsPerTick !== undefined
      ? { maxMissionsPerTick: options.maxMissionsPerTick }
      : {}),
  });

  const harness: LocalWorkerHarness = {
    worker,
    controller,
    tick: () => worker.runOnce(),
    async runTicks(count: number) {
      const results: MissionWorkerTickResult[] = [];
      for (let index = 0; index < count; index += 1) {
        const result = await worker.runOnce();
        results.push(result);
        if (result.considered === 0) break;
        const active = await options.missions.listActive();
        if (active.length === 0) break;
      }
      return results;
    },
    status: () => worker.status(),
    restart: (overrides = {}) =>
      createLocalWorkerHarness({
        ...options,
        clock,
        ...(overrides.instanceId !== undefined ? { instanceId: overrides.instanceId } : {}),
      }),
  };
  return harness;
}
