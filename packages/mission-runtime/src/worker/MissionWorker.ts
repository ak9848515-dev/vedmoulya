// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: DURABLE EXECUTION WORKER (WORKER-01)
//
// WHY THIS EXISTS
// ---------------
// The autonomous mission loop currently has no host that outlives an HTTP
// response: it is launched as a floating promise inside the Next.js route
// handler (services/api MissionService.startAutonomousLoop → `void (async …)()`),
// and the web app is deployed to a serverless host that freezes the function
// once the response is returned. A mission therefore only progresses while
// some unrelated request keeps the instance alive — the architectural half of
// the reported `RECOVERY_LEASE_EXPIRED` incident.
//
// This module is the INTERFACE + a LOCAL implementation of the missing piece:
// a worker that claims ONE objective at a time per mission, recovers abandoned
// work before executing it, and reports honest status. It is not a scheduler,
// not a queue and not a second mission engine — every durability guarantee
// still comes from the existing mission store (leases, fencing, conditional
// publication) and the workspace lease.
//
// ── HONEST SCOPE (READ THIS BEFORE WIRING IT ANYWHERE) ─────────────
// This is NOT production-ready and does not claim to be:
//   • there is no persistent hosting target (no always-on process, no
//     platform job, no container) — `LocalMissionWorker` lives inside whatever
//     process creates it;
//   • there is no lifecycle definition (who starts it, who restarts it, what
//     happens on deploy, how two workers coordinate beyond their leases);
//   • there is no health/readiness contract for an operator (no endpoint, no
//     alerting) — `status()` is a local snapshot, nothing more.
// Until those three are defined and verified, this interface is exercised by
// tests and local runs ONLY. Do not present it as durable production
// execution. (The sprint report lists exactly these blockers.)
//
// WHAT THE INTERFACE GUARANTEES (and a future host must preserve)
// --------------------------------------------------------------
//   1. at most ONE objective executes per mission at a time — enforced by the
//      store's objective lease, not by the worker;
//   2. abandoned work is RECOVERED (lease expiry) before it is re-executed;
//   3. a tick is bounded and never overlaps another tick of the same worker;
//   4. `stop()` waits for the in-flight tick and prevents new claims;
//   5. status is a snapshot of what really happened — never a claim of health.
// ──────────────────────────────────────────────────────────────────

import type { ClockPort, MissionStore } from '@vedmoulya/mission-controller';
import type { MissionControllerService } from '@vedmoulya/mission-controller';

/** One bounded unit of durable execution. */
export interface MissionWorkerTickResult {
  /** Active missions this tick looked at. */
  considered: number;
  /** Missions whose recovery pass healed at least one abandoned objective. */
  recovered: string[];
  /** Missions whose objective state actually moved (started or finished). */
  progressed: string[];
  /** Missions that reached a terminal state during this tick. */
  completed: string[];
  /** Missions intentionally left alone, with the honest reason. */
  skipped: Array<{ missionId: string; reason: string }>;
}

/**
 * The durable-execution worker contract a future host must implement/own.
 * `LocalMissionWorker` is the in-process implementation used by tests and
 * local runs; a hosted worker would implement the same surface over a durable
 * trigger (platform job, container, queue consumer…).
 */
export interface DurableMissionWorker {
  /** Stable identity of THIS worker instance (never a lease token). */
  readonly instanceId: string;
  /** Begin ticking. Idempotent; a stopped worker does not restart. */
  start(): void;
  /** Stop claiming work; waits for the in-flight tick (bounded by it). */
  stop(reason?: string): Promise<void>;
  /** Run exactly one bounded tick (used by tests and by hosted one-shot jobs). */
  runOnce(): Promise<MissionWorkerTickResult>;
  /** Local snapshot — NOT a readiness/health contract. */
  status(): MissionWorkerStatus;
}

export interface MissionWorkerStatus {
  instanceId: string;
  running: boolean;
  ticks: number;
  inFlight: boolean;
  lastTickAt?: string;
  lastError?: string;
  stoppedReason?: string;
  /**
   * Deliberately absent until a hosting target defines it: a real health
   * contract (liveness/readiness) belongs to that host, not to this loop.
   */
}

/** Schedules worker ticks (tests inject a manual one). */
export interface MissionWorkerScheduler {
  schedule(tick: () => Promise<void>, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

export const systemMissionWorkerScheduler: MissionWorkerScheduler = {
  schedule: (tick, delayMs) => {
    const handle = setTimeout(() => {
      void tick();
    }, delayMs);
    return handle;
  },
  cancel: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

export interface LocalMissionWorkerOptions {
  controller: MissionControllerService;
  store: MissionStore;
  clock: ClockPort;
  /** Stable identity for logs/status; defaults to `mission-worker-<n>`. */
  instanceId?: string;
  /** Pause between ticks (default 1 000 ms). */
  pollIntervalMs?: number;
  /** Upper bound of missions examined per tick (default 5). */
  maxMissionsPerTick?: number;
  /** Scheduler seam (defaults to `setTimeout`). */
  scheduler?: MissionWorkerScheduler;
  /** Optional observer for a failed tick (never swallows the reason). */
  onError?: (error: unknown) => void;
}

/**
 * In-process durable-execution worker.
 *
 * Each tick: list ACTIVE missions → run the recovery pass (which heals only
 * genuinely abandoned leases) → execute at most ONE objective per mission
 * through the frozen controller. The controller's lease/fencing logic decides
 * whether this worker may execute; the worker never overrides it.
 */
export class LocalMissionWorker implements DurableMissionWorker {
  readonly instanceId: string;
  private readonly scheduler: MissionWorkerScheduler;
  private readonly pollIntervalMs: number;
  private readonly maxMissionsPerTick: number;
  private handle: unknown;
  private inFlight: Promise<MissionWorkerTickResult> | undefined;
  private stopped = false;
  private running = false;
  private tickCount = 0;
  private lastTickAt: string | undefined;
  private lastError: string | undefined;
  private stoppedReason: string | undefined;

  constructor(private readonly options: LocalMissionWorkerOptions) {
    this.instanceId = options.instanceId ?? 'mission-worker-local';
    this.scheduler = options.scheduler ?? systemMissionWorkerScheduler;
    this.pollIntervalMs = Math.max(1, options.pollIntervalMs ?? 1_000);
    this.maxMissionsPerTick = Math.max(1, options.maxMissionsPerTick ?? 5);
  }

  start(): void {
    if (this.running || this.stopped) return;
    this.running = true;
    this.scheduleNext();
  }

  async stop(reason = 'stopped by the operator'): Promise<void> {
    this.stopped = true;
    this.running = false;
    this.stoppedReason = reason;
    this.clearTimer();
    if (this.inFlight) {
      try {
        await this.inFlight;
      } catch {
        // The failure is already recorded in `lastError`; stopping never throws.
      }
    }
  }

  runOnce(): Promise<MissionWorkerTickResult> {
    // Ticks never overlap: a caller (timer or explicit) joins the in-flight one.
    if (this.inFlight) return this.inFlight;
    const tick = this.performTick().finally(() => {
      this.inFlight = undefined;
    });
    this.inFlight = tick;
    return tick;
  }

  status(): MissionWorkerStatus {
    return {
      instanceId: this.instanceId,
      running: this.running,
      ticks: this.tickCount,
      inFlight: this.inFlight !== undefined,
      ...(this.lastTickAt !== undefined ? { lastTickAt: this.lastTickAt } : {}),
      ...(this.lastError !== undefined ? { lastError: this.lastError } : {}),
      ...(this.stoppedReason !== undefined ? { stoppedReason: this.stoppedReason } : {}),
    };
  }

  private scheduleNext(): void {
    if (this.stopped || !this.running) return;
    this.handle = this.scheduler.schedule(async () => {
      this.handle = undefined;
      try {
        await this.runOnce();
      } catch {
        // `performTick` already recorded it; the loop must survive.
      }
      this.scheduleNext();
    }, this.pollIntervalMs);
  }

  private clearTimer(): void {
    if (this.handle === undefined) return;
    this.scheduler.cancel(this.handle);
    this.handle = undefined;
  }

  private async performTick(): Promise<MissionWorkerTickResult> {
    const result: MissionWorkerTickResult = {
      considered: 0,
      recovered: [],
      progressed: [],
      completed: [],
      skipped: [],
    };
    this.tickCount += 1;
    this.lastTickAt = this.options.clock.now();
    try {
      const active = await this.options.store.listActive();
      const considered = active.slice(0, this.maxMissionsPerTick);
      result.considered = considered.length;
      for (const mission of considered) {
        if (this.stopped) {
          result.skipped.push({ missionId: mission.missionId, reason: 'worker stopped' });
          continue;
        }
        const before = await this.options.store.get(mission.missionId);
        const beforeStates = objectiveStateSignature(before);
        try {
          // 1. RECOVER FIRST — an abandoned objective (expired lease) is healed
          //    to READY here, never blindly re-run from a stale snapshot.
          const recovered = await this.options.controller.recoverMission(mission.missionId);
          if (objectiveStateSignature(recovered) !== beforeStates) {
            result.recovered.push(mission.missionId);
          }
          if (recovered.state !== 'RUNNING' && recovered.state !== 'CREATED') {
            if (isTerminalState(recovered.state)) result.completed.push(mission.missionId);
            else result.skipped.push({ missionId: mission.missionId, reason: recovered.state });
            continue;
          }
          // 2. EXECUTE ONE objective. The controller refuses when another live
          //    owner exists (lease) or the workspace is claimed (workspace lease).
          const after = await this.options.controller.runNextObjective(mission.missionId);
          if (objectiveStateSignature(after) !== objectiveStateSignature(recovered)) {
            result.progressed.push(mission.missionId);
          }
          if (isTerminalState(after.state) && !result.completed.includes(mission.missionId)) {
            result.completed.push(mission.missionId);
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          this.lastError = reason;
          result.skipped.push({ missionId: mission.missionId, reason });
          this.options.onError?.(error);
        }
      }
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.lastError = reason;
      this.options.onError?.(error);
      throw error;
    }
  }
}

/** Stable comparison of every objective's state (progress detection only). */
function objectiveStateSignature(
  mission: { objectives?: Array<{ state: string }> } | undefined,
): string {
  return (mission?.objectives ?? []).map((objective) => objective.state).join('|');
}

function isTerminalState(state: string): boolean {
  return ['COMPLETED', 'PARTIALLY_COMPLETED', 'BLOCKED', 'CANCELLED', 'FAILED'].includes(state);
}
