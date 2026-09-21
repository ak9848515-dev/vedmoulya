// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Mission Provider-Wait Watchdog
// FINAL-04 — DURABLE AUTONOMY · PROVIDER-WAIT RECONCILIATION.
//
// The autonomous mission loop stops cleanly when no capable provider is
// available (the mission reaches the persisted WAITING_FOR_PROVIDER hold).
// Historically that hold was only re-checked at process boot, so a mission
// could remain WAITING_FOR_PROVIDER forever if no process happened to revisit
// it. This driver is the bounded heartbeat that gives reconciliation a REAL
// runtime caller — restart-safe, because every pass re-reads persisted state.
//
// Architectural rules preserved (identical posture to the other cadence
// drivers — scheduler-cadence.ts / os-health-scheduler.ts):
//   • ONE state machine — the driver calls MissionService.runWatchdogPass(),
//     which delegates to the frozen MissionControllerService. The driver
//     implements NO mission policy: it never plans, executes, mutates a
//     workspace, touches a provider, grants a permission or invents a state.
//   • ONE execution engine — a resumed mission is driven by the SAME detached
//     autonomous loop the operator path uses; the driver never spawns work of
//     its own and never starts a second loop for an in-flight mission.
//   • BOUNDED — a self-rescheduling timer with exponential backoff (base →
//     max) when there is nothing to reconcile, and a fixed base cadence while
//     missions are genuinely waiting. Overlap-guarded: a tick never starts
//     while another pass is still running. No busy loop, no unbounded workers.
//   • OBSERVABLE — every pass reports aggregate counts + mission ids (never
//     mission contents) and is logged; the driven transitions are recorded on
//     each mission's own durable activity trail by the controller.
//   • SAFE ACROSS RESTARTS — no in-memory queue: a fresh process reconciles the
//     same persisted missions from the authoritative store.
//
// Deployment posture: exactly ONE process should run the driver while the
// gateway is single-instance. If the platform is deployed with multiple
// replicas, the reconciliation itself stays safe (the frozen state machine
// makes a second concurrent resume illegal), but operators may set
// MISSION_WATCHDOG_ENABLED=0 on all but one instance to avoid redundant polls.
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from '@vedmoulya/core';
import { envFlagEnabled } from './env-flags.js';
import { getServices } from '../router.js';

/** Default cadence while missions are genuinely waiting: 30 seconds. */
const DEFAULT_INTERVAL_MS = 30_000;
/** Idle backoff ceiling: at most one pass every 5 minutes. */
const DEFAULT_MAX_INTERVAL_MS = 5 * 60 * 1000;

/** Aggregate outcome of ONE pass (never mission contents). */
export interface MissionWatchdogPassOutcome {
  considered: number;
  resumed: number;
  stillWaiting: number;
  skipped: number;
  resumedMissionIds: string[];
  /** FINAL-05 — resumed after a crashed owner's lease expired (optional seam). */
  abandonedRecovered?: number;
  /** FINAL-05 — RUNNING missions still owned by a live lease (untouched). */
  stillOwned?: number;
}

/** Narrow target seam (satisfied by MissionService; injectable for tests). */
export interface MissionWatchdogTarget {
  runWatchdogPass(): Promise<MissionWatchdogPassOutcome>;
}

/** One completed pass, with timing (observability only). */
export interface MissionWatchdogTickResult extends MissionWatchdogPassOutcome {
  startedAt: number;
  finishedAt: number;
  durationMs: number;
}

/** Runtime state surfaced honestly to the gateway/UI. */
export interface MissionWatchdogStatus {
  active: boolean;
  reason: 'enabled' | 'disabled' | 'not_started';
  intervalMs?: number;
  maxIntervalMs?: number;
  startedAt?: number;
  lastTickAt?: number;
  lastTick?: MissionWatchdogTickResult;
  nextTickAt?: number;
}

/** Minimal logger seam (defaults to the platform logger — no secrets). */
export interface MissionWatchdogLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
}

export interface MissionWatchdogOptions {
  /** Disable the watchdog (env `MISSION_WATCHDOG_ENABLED=0|false|no|off` also disables). */
  enabled?: boolean;
  /** Base cadence in ms (env `MISSION_WATCHDOG_INTERVAL_MS` overrides). */
  intervalMs?: number;
  /** Idle backoff ceiling in ms (env `MISSION_WATCHDOG_MAX_INTERVAL_MS` overrides). */
  maxIntervalMs?: number;
  /** Run one pass immediately on start so reconciliation begins now. Default true. */
  runImmediately?: boolean;
  /** Target accessor. Defaults to the gateway singleton (getServices().mission). */
  getTarget?: () => MissionWatchdogTarget;
  /** Clock injection for hermetic tests. */
  now?: () => number;
  /** Logger injection for hermetic tests. */
  log?: MissionWatchdogLogger;
}

export interface MissionWatchdogDriver {
  /** Stop the watchdog, clear the timer and release the singleton. */
  stop(): void;
  /** Runtime state for the gateway/UI (honest about activation). */
  status(): MissionWatchdogStatus;
  /** Outcome of the most recent pass (undefined before the first run). */
  readonly lastTick: MissionWatchdogTickResult | undefined;
}

let instance: MissionWatchdogDriver | undefined;

/** Default target: the gateway's mission service (lazy — never at module scope). */
const defaultTarget: MissionWatchdogTarget = {
  runWatchdogPass: () => getServices().mission.runWatchdogPass(),
};

/**
 * Start the mission provider-wait watchdog. Idempotent — subsequent calls
 * return the existing driver. Each pass asks the EXISTING controller to
 * reconcile WAITING_FOR_PROVIDER missions; the driver only supplies the
 * heartbeat, the backoff and failure isolation. A failed pass is recorded and
 * logged — it can never take the gateway down or throw into the timer.
 */
export function startMissionWatchdog(options: MissionWatchdogOptions = {}): MissionWatchdogDriver {
  if (instance) return instance;

  const enabled = options.enabled ?? envFlagEnabled(process.env.MISSION_WATCHDOG_ENABLED);
  if (!enabled) {
    return {
      stop: () => undefined,
      status: () => ({ active: false, reason: 'disabled' }),
      lastTick: undefined,
    };
  }

  const envInterval = Number(process.env.MISSION_WATCHDOG_INTERVAL_MS);
  const intervalMs =
    options.intervalMs ??
    (Number.isFinite(envInterval) && envInterval > 0 ? envInterval : DEFAULT_INTERVAL_MS);
  const envMaxInterval = Number(process.env.MISSION_WATCHDOG_MAX_INTERVAL_MS);
  const maxIntervalMs =
    options.maxIntervalMs ??
    (Number.isFinite(envMaxInterval) && envMaxInterval > 0
      ? envMaxInterval
      : DEFAULT_MAX_INTERVAL_MS);
  const getTarget = options.getTarget ?? ((): MissionWatchdogTarget => defaultTarget);
  const now = options.now ?? ((): number => Date.now());
  const log = options.log ?? logger;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastTick: MissionWatchdogTickResult | undefined;
  let running = false;
  let stopped = false;
  /** Current scheduling delay; grows (bounded) while there is nothing to do. */
  let nextDelayMs = intervalMs;
  let nextTickAt: number | undefined;
  const startedAt = now();

  const schedule = (delayMs: number): void => {
    if (stopped) return;
    nextTickAt = now() + delayMs;
    timer = setTimeout(() => {
      void runPass();
    }, delayMs);
    // A background heartbeat must never hold the process open.
    timer.unref();
  };

  const runPass = async (): Promise<void> => {
    if (running) return; // never overlap passes
    running = true;
    const tickStartedAt = now();
    try {
      const outcome = await getTarget().runWatchdogPass();
      const finishedAt = now();
      lastTick = {
        ...outcome,
        startedAt: tickStartedAt,
        finishedAt,
        durationMs: finishedAt - tickStartedAt,
      };
      if (outcome.resumed > 0 || outcome.stillWaiting > 0) {
        // Real work observed — stay on the base cadence.
        nextDelayMs = intervalMs;
      } else {
        // Idle — back off (bounded), but never stop looking.
        nextDelayMs = Math.min(maxIntervalMs, Math.max(intervalMs, nextDelayMs * 2));
      }
      if (outcome.resumed > 0) {
        log.info('Mission watchdog resumed held/abandoned missions', {
          considered: outcome.considered,
          resumed: outcome.resumed,
          stillWaiting: outcome.stillWaiting,
          skipped: outcome.skipped,
          missionIds: outcome.resumedMissionIds,
          // FINAL-05 — how many were rescued after a crashed owner's lease
          // expired (as opposed to a provider returning).
          abandonedRecovered: outcome.abandonedRecovered ?? 0,
          stillOwned: outcome.stillOwned ?? 0,
        });
      } else if (outcome.stillWaiting > 0) {
        log.info('Mission watchdog pass — missions still waiting for a provider', {
          considered: outcome.considered,
          stillWaiting: outcome.stillWaiting,
        });
      }
    } catch (error) {
      // A failed pass is isolated: record honestly, keep the bounded cadence.
      const finishedAt = now();
      lastTick = {
        considered: 0,
        resumed: 0,
        stillWaiting: 0,
        skipped: 0,
        resumedMissionIds: [],
        startedAt: tickStartedAt,
        finishedAt,
        durationMs: finishedAt - tickStartedAt,
      };
      nextDelayMs = intervalMs;
      log.warn('Mission watchdog pass failed (isolated — next pass will retry)', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      running = false;
      schedule(nextDelayMs);
    }
  };

  const stop = (): void => {
    stopped = true;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    nextTickAt = undefined;
    instance = undefined;
  };

  schedule(intervalMs);

  if (options.runImmediately ?? true) {
    void runPass();
  }

  instance = {
    stop,
    status: (): MissionWatchdogStatus => ({
      active: true,
      reason: 'enabled',
      intervalMs,
      maxIntervalMs,
      startedAt,
      lastTickAt: lastTick?.finishedAt,
      lastTick,
      nextTickAt,
    }),
    get lastTick(): MissionWatchdogTickResult | undefined {
      return lastTick;
    },
  };
  return instance;
}

/** Stop the mission watchdog driver and reset the singleton (no-op when idle). */
export function stopMissionWatchdog(): void {
  instance?.stop();
}

/** Current driver state (undefined when not running). */
export function getMissionWatchdog(): MissionWatchdogDriver | undefined {
  return instance;
}
