// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: OS Health Pass Scheduler
// Runs the Enterprise Operating System health pass (os.dashboard — a full
// health probe + snapshot persistence) on a fixed cadence so the OS snapshot
// history grows into a continuous monitoring feed.
// OS-003 — Version 1.0 Freeze (operational cadence — no new engines, no new
// dependencies; reuses the runtime-metrics setInterval + unref pattern).
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from '@vedmoulya/core';
import type { OSApplicationService } from '@vedmoulya/os-intelligence';
import { getServices } from '../router.js';

/** Default cadence: one OS health pass every 5 minutes. */
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

/** Outcome of one scheduled OS health pass. */
export interface OSHealthPassResult {
  /** Epoch ms when the pass started. */
  startedAt: number;
  /** Epoch ms when the pass finished. */
  finishedAt: number;
  /** Whether the os.dashboard call reported success. */
  success: boolean;
  /** Overall OS health score (0–100) when available. */
  overallScore?: number;
  /** Overall OS status ('healthy' | 'degraded' | 'unhealthy') when available. */
  status?: string;
  /** End-to-end pass latency in ms when reported. */
  latencyMs?: number;
  /** Failure reason when the pass did not succeed. */
  error?: string;
}

export interface OSHealthSchedulerOptions {
  /** Cadence in ms. Default 5 minutes (env `OS_HEALTH_INTERVAL_MS` overrides). */
  intervalMs?: number;
  /** Disable the cadence (env `OS_HEALTH_SCHEDULER_ENABLED=0` also disables). */
  enabled?: boolean;
  /**
   * Override the OS service accessor. Defaults to the gateway singleton
   * (`getServices().osIntelligence`). Injection keeps the scheduler hermetic
   * in tests and decoupled from production wiring.
   */
  getOS?: () => OSApplicationService;
  /** Run one pass immediately on start so the feed begins now. Default true. */
  runImmediately?: boolean;
}

export interface OSHealthScheduler {
  /** Stop the cadence, clear the interval and release the singleton. */
  stop(): void;
  /** Outcome of the most recent pass (undefined before the first run). */
  readonly lastRun: OSHealthPassResult | undefined;
}

let instance: OSHealthScheduler | undefined;

/**
 * Start the OS health-pass cadence. Idempotent — subsequent calls return the
 * existing scheduler. Each tick runs the full `os.dashboard` pass (live health
 * probe over every engine + snapshot persistence), so snapshot history
 * accumulates into a continuous monitoring feed. The interval is unref'd so it
 * never holds the process open, overlapping passes are skipped, and failures
 * are recorded + logged but never thrown — a monitoring pass must not take the
 * gateway down.
 */
export function startOSHealthScheduler(options: OSHealthSchedulerOptions = {}): OSHealthScheduler {
  if (instance) return instance;

  const enabled = options.enabled ?? process.env.OS_HEALTH_SCHEDULER_ENABLED !== '0';
  if (!enabled) {
    // No-op handle so callers (e.g. the route handler) need not branch. The
    // singleton stays unset so a later explicit start can enable the cadence.
    return { stop: () => undefined, lastRun: undefined };
  }

  const envInterval = Number(process.env.OS_HEALTH_INTERVAL_MS);
  const intervalMs =
    options.intervalMs ??
    (Number.isFinite(envInterval) && envInterval > 0 ? envInterval : DEFAULT_INTERVAL_MS);
  const getOS = options.getOS ?? ((): OSApplicationService => getServices().osIntelligence);

  let timer: ReturnType<typeof setInterval> | undefined;
  let lastRun: OSHealthPassResult | undefined;
  let running = false;

  const runPass = async (): Promise<void> => {
    if (running) return; // never overlap passes
    running = true;
    const startedAt = Date.now();
    try {
      const result = await getOS().dashboard();
      lastRun = {
        startedAt,
        finishedAt: Date.now(),
        success: result.success,
        overallScore: result.data?.health.overallScore,
        status: result.data?.health.status,
        latencyMs: result.latency,
        error: result.error,
      };
      if (lastRun.success) {
        logger.info('OS health pass complete', {
          overallScore: lastRun.overallScore,
          status: lastRun.status,
          latencyMs: lastRun.latencyMs,
        });
      } else {
        logger.warn('OS health pass failed', { error: lastRun.error });
      }
    } catch (error) {
      lastRun = {
        startedAt,
        finishedAt: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
      logger.error('OS health pass raised an error', { error: lastRun.error });
    } finally {
      running = false;
    }
  };

  const stop = (): void => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    instance = undefined;
  };

  timer = setInterval(() => {
    void runPass();
  }, intervalMs);
  timer.unref();

  if (options.runImmediately ?? true) {
    // Fire-and-forget first pass so the monitoring feed starts at boot rather
    // than after a full cadence.
    void runPass();
  }

  instance = {
    stop,
    get lastRun(): OSHealthPassResult | undefined {
      return lastRun;
    },
  };
  return instance;
}

/** Stop the OS health scheduler and reset the singleton (no-op when idle). */
export function stopOSHealthScheduler(): void {
  instance?.stop();
}

/** Current scheduler state (undefined when not running). */
export function getOSHealthScheduler(): OSHealthScheduler | undefined {
  return instance;
}
