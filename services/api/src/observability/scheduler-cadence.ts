// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: AI World Scheduler Cadence Driver
// EPIC-018 — RUNTIME CLOSURE · EPIC-021 — SCHEDULED OPPORTUNITY REFRESH.
//
// The scheduler domain (DiscoveryScheduler) decides WHEN each job may run;
// this driver is the process-level heartbeat that gives scheduler.tick() a
// REAL runtime caller so 6-hour / daily / weekly discovery actually executes
// without a user pressing "Run now".
//
// EPIC-021: the same heartbeat also gives the Brain's continuous bridge
// (brain.discoverIntelligence) a real runtime caller — AI World events are
// screened into opportunities on a schedule, and NEW opportunities surface
// through the EXISTING EPIC-015 notification surface (relevance-gated, same
// store the AI World bell reads). No second notification engine.
//
// Architectural rules preserved (verified against the EPIC-018/021 audit):
//   • ONE scheduler  — the driver only calls SchedulerApplicationService.tick()
//     (the same seam the benchmark + manual Run now use). It implements NO
//     scheduling policy: due-ness, enabled/disabled, cooldowns, rate limits,
//     retry/backoff, duplicate-run and concurrent-run protection, budgets and
//     cancellation all stay in DiscoveryScheduler / SourcePolicyEngine /
//     RunBudgetGuard (frozen LoopBudget).
//   • ONE budget engine — the driver adds no budget; every run stays bounded
//     by the scheduler's RunBudgetGuard over @vedmoulya/loop-engine LoopBudget.
//   • ONE brain bridge — the driver calls the Brain's EXISTING
//     discoverIntelligence (idempotent: events dedupe by id, opportunities are
//     detected only from fresh events) — it never re-implements discovery or
//     opportunity logic.
//   • No second notification / store / execution engine.
//   • Users come from the EXISTING identity directory (IdentityApplicationService
//     listUsers — paginated, bounded). No new store.
//
// Runtime posture (same pattern as os-health-scheduler):
//   singleton + idempotent start · unref'd interval (never holds the process
//   open) · overlap guard (a tick never starts while another is running) ·
//   error isolation (one user's failure never breaks the tick, and a tick
//   failure is recorded + logged — never thrown) · graceful stop() · structured
//   logs with AGGREGATE numbers only (no user ids, no secrets).
//
// Deployment posture: the current deployment is a SINGLE Next.js server
// process (the gateway runs inside it — see the tRPC route handler). Exactly
// ONE process must run the driver: `next start`/`next dev` per host. If the
// platform is later deployed with multiple replicas, only one instance must
// run the driver (e.g. set AI_WORLD_CADENCE_ENABLED=0 on all but one) until
// scheduler state + a distributed lock are in place (documented operator step).
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from '@vedmoulya/core';
import type { SchedulerApplicationService } from '@vedmoulya/ai-world-scheduler';
import { getServices } from '../router.js';

/** Default cadence: check the scheduler every 10 minutes. */
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;
/** Hard safety bound on users ticked per pass (identity is paginated anyway). */
const DEFAULT_MAX_USERS_PER_TICK = 200;
/** Fail-closed wall-clock bound for ONE tick pass (interval is 10 min). */
const DEFAULT_MAX_TICK_DURATION_MS = 5 * 60 * 1000;
/** Identity page size + absolute enumeration bound (never an unbounded crawl). */
const IDENTITY_PAGE_SIZE = 100;
const IDENTITY_HARD_CAP = 500;
/** Bounded error sample kept on the result (aggregate count is always exact). */
const ERROR_SAMPLE_LIMIT = 5;

/** Outcome of one cadence pass. Aggregate-only — never user-scoped data. */
export interface SchedulerCadenceTickResult {
  startedAt: number;
  finishedAt: number;
  /** Users whose scheduler was evaluated this pass. */
  usersProcessed: number;
  /** Jobs actually started (sum of ran across users — scheduler-decided). */
  runsStarted: number;
  /** Jobs skipped by the scheduler's own NOT_DUE/disabled logic. */
  runsSkipped: number;
  /** EPIC-021 — new opportunities surfaced by the Brain's continuous bridge. */
  opportunitiesFound: number;
  /** EPIC-021 — EPIC-015 notifications actually emitted for new opportunities
   *  (relevance-gated; in steady state duplicates are impossible — only fresh
   *  events detect; the Postgres-outage recovery edge is documented on
   *  createBrainIntelligenceRefresh). */
  notificationsEmitted: number;
  /** Users whose scheduler tick or intelligence refresh failed (isolated —
   *  never aborts the pass; the two share one per-user failure counter). */
  errors: number;
  /** First few failure messages (never user ids; capped + count always exact). */
  errorSample: string[];
  /** True when the pass hit maxTickDurationMs and stopped early (fail-closed). */
  truncated: boolean;
  /** Set when the user directory could not be enumerated (tick aborted honestly). */
  userDirectoryError?: string;
}

/** Runtime state surfaced to the gateway + UI (honest about activation). */
export interface SchedulerRuntimeStatus {
  active: boolean;
  reason: 'enabled' | 'disabled' | 'not_started';
  intervalMs?: number;
  maxUsersPerTick: number;
  /** EPIC-021 — whether the Brain opportunity refresh runs on this heartbeat. */
  refreshIntelligenceEnabled: boolean;
  startedAt?: number;
  lastTickAt?: number;
  lastTick?: SchedulerCadenceTickResult;
  nextTickAt?: number;
}

/** Where the driver learns which users to tick (default: identity directory). */
export interface SchedulerCadenceUserSource {
  /** Registered user ids (bounded by the caller's maxUsersPerTick). */
  listUserIds(): Promise<string[]>;
}

/** EPIC-021 — per-user Brain opportunity refresh (idempotent in steady state:
 *  events dedupe by id, so a repeat tick surfaces nothing new; the narrow
 *  Postgres-outage recovery edge is documented on createBrainIntelligenceRefresh). */
export interface SchedulerIntelligenceRefreshPort {
  /** Refresh the Brain's continuous intelligence for one user; returns the
   *  number of NEW opportunities surfaced + notifications emitted. */
  refresh(userId: string): Promise<{ newOpportunities: number; notificationsEmitted: number }>;
}

/** Minimal logger seam (defaults to the platform logger — no secrets). */
export interface SchedulerCadenceLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export interface SchedulerCadenceDriverOptions {
  /** Cadence in ms. Default 10 min (env `AI_WORLD_CADENCE_INTERVAL_MS` overrides). */
  intervalMs?: number;
  /** Disable the cadence (env `AI_WORLD_CADENCE_ENABLED=0` also disables). */
  enabled?: boolean;
  /** Run one tick immediately on start so discovery begins now. Default true. */
  runImmediately?: boolean;
  /** Hard cap on users per pass (default 200). */
  maxUsersPerTick?: number;
  /** Fail-closed wall-clock bound per pass (default 5 min). */
  maxTickDurationMs?: number;
  /** EPIC-021 — enable the Brain opportunity refresh on this heartbeat.
   *  Default true; env `AI_WORLD_CADENCE_REFRESH_INTELLIGENCE=0` disables. */
  refreshIntelligenceEnabled?: boolean;
  /** EPIC-021 — the Brain bridge. Defaults to the gateway singleton
   *  (brain.discoverIntelligence + ecosystemIntelligence.notify). */
  refreshIntelligence?: SchedulerIntelligenceRefreshPort;
  /** Scheduler accessor. Defaults to the gateway singleton (getServices()). */
  getScheduler?: () => SchedulerApplicationService;
  /** User source. Defaults to the identity directory (registered users). */
  userSource?: SchedulerCadenceUserSource;
  /** Clock injection for hermetic tests. */
  now?: () => number;
  /** Logger injection for hermetic tests. */
  log?: SchedulerCadenceLogger;
}

export interface SchedulerCadenceDriver {
  /** Stop the cadence, clear the interval and release the singleton. */
  stop(): void;
  /** Runtime state for the gateway/UI (honest about activation). */
  status(): SchedulerRuntimeStatus;
  /** Outcome of the most recent pass (undefined before the first run). */
  readonly lastTick: SchedulerCadenceTickResult | undefined;
}

let instance: SchedulerCadenceDriver | undefined;

/** Default user source: registered users from the EXISTING identity directory. */
const identityUserSource: SchedulerCadenceUserSource = {
  async listUserIds(): Promise<string[]> {
    const services = getServices();
    const ids: string[] = [];
    let page = 1;
    for (;;) {
      const result = await services.identity.listUsers({ page, limit: IDENTITY_PAGE_SIZE });
      for (const user of result.users) ids.push(user.id);
      if (ids.length >= IDENTITY_HARD_CAP) break;
      if (page >= result.totalPages || result.totalPages === 0) break;
      page += 1;
    }
    return ids;
  },
};

/**
 * EPIC-021 — Brain bridge dependencies (structural — satisfied by the gateway
 * services; injectable so the mapping/gating logic is hermetically tested).
 */
export interface BrainIntelligenceRefreshDeps {
  brain: {
    discoverIntelligence(userId: string): Promise<{
      success: boolean;
      data?: {
        opportunities: Array<{
          id: string;
          title: string;
          description: string;
          uncertainty: number;
        }>;
      };
    }>;
  };
  ecosystemIntelligence: {
    notify(
      userId: string,
      opts: {
        kind: 'NEW_OPPORTUNITY';
        title: string;
        body: string;
        relevance: number;
        itemId?: string;
      },
    ): { dropped: true; reason: string } | { id: string };
  };
}

/**
 * EPIC-021 — default Brain bridge: the gateway's continuous intelligence.
 * Calls the Brain's EXISTING discoverIntelligence (idempotent: events dedupe
 * by id, opportunities are detected only from fresh events) and surfaces NEW
 * opportunities through the EXISTING EPIC-015 relevance-gated notify() — the
 * same store the AI World bell reads. Never re-implements discovery or
 * opportunity logic; never fabricates. The returned count is exact; the
 * notify() gate decides what is meaningful (relevance >= 60).
 *
 * Honesty note: after a Postgres outage where hydration failed at boot, the
 * events mirror starts empty and the first recovered refresh could re-detect
 * events that were already notified pre-outage (duplicates ARE possible in
 * that narrow case). The relevance gate bounds the blast radius; the events
 * mirror catches up on the next successful hydration.
 */
export function createBrainIntelligenceRefresh(
  deps: BrainIntelligenceRefreshDeps,
): SchedulerIntelligenceRefreshPort {
  return {
    async refresh(userId): Promise<{ newOpportunities: number; notificationsEmitted: number }> {
      const result = await deps.brain.discoverIntelligence(userId);
      if (!result.success || !result.data) {
        return { newOpportunities: 0, notificationsEmitted: 0 };
      }
      const newOpportunities = result.data.opportunities.length;
      let notificationsEmitted = 0;
      for (const opportunity of result.data.opportunities) {
        const outcome = deps.ecosystemIntelligence.notify(userId, {
          kind: 'NEW_OPPORTUNITY',
          title: opportunity.title,
          body: opportunity.description.slice(0, 200),
          // Honest relevance: an opportunity's uncertainty (0..1, higher = less
          // certain) maps to the gate's 0..100 scale — confident opportunities
          // notify, speculative ones are dropped by the existing gate.
          relevance: Math.round((1 - opportunity.uncertainty) * 100),
          itemId: opportunity.id,
        });
        if (!('dropped' in outcome)) notificationsEmitted += 1;
      }
      return { newOpportunities, notificationsEmitted };
    },
  };
}

/** Default bridge wired to the gateway singleton (lazy — never constructed
 *  at module scope, so tests can inject the factory directly). */
const brainIntelligenceRefresh: SchedulerIntelligenceRefreshPort = createBrainIntelligenceRefresh({
  brain: {
    discoverIntelligence: (userId) => getServices().brain.discoverIntelligence(userId),
  },
  ecosystemIntelligence: {
    notify: (userId, opts) => getServices().ecosystemIntelligence.notify(userId, opts),
  },
});

/**
 * Start the AI World discovery cadence. Idempotent — subsequent calls return
 * the existing driver. Each tick asks the EXISTING SchedulerApplicationService
 * which jobs are due (the scheduler stays authoritative); the driver only
 * supplies the heartbeat and per-user isolation. Failures are recorded and
 * logged — a failed discovery source can never take the gateway down.
 */
export function startSchedulerCadenceDriver(
  options: SchedulerCadenceDriverOptions = {},
): SchedulerCadenceDriver {
  if (instance) return instance;

  const enabled = options.enabled ?? process.env.AI_WORLD_CADENCE_ENABLED !== '0';
  if (!enabled) {
    // No-op handle so callers need not branch; the singleton stays unset so a
    // later explicit start can enable the cadence.
    return {
      stop: () => undefined,
      status: () => ({
        active: false,
        reason: 'disabled',
        maxUsersPerTick: 0,
        refreshIntelligenceEnabled: false,
      }),
      lastTick: undefined,
    };
  }

  const envInterval = Number(process.env.AI_WORLD_CADENCE_INTERVAL_MS);
  const intervalMs =
    options.intervalMs ??
    (Number.isFinite(envInterval) && envInterval > 0 ? envInterval : DEFAULT_INTERVAL_MS);
  const maxUsersPerTick = options.maxUsersPerTick ?? DEFAULT_MAX_USERS_PER_TICK;
  const maxTickDurationMs = options.maxTickDurationMs ?? DEFAULT_MAX_TICK_DURATION_MS;
  const getScheduler =
    options.getScheduler ?? ((): SchedulerApplicationService => getServices().aiWorldScheduler);
  const userSource = options.userSource ?? identityUserSource;
  // EPIC-021 — the Brain opportunity refresh rides the SAME heartbeat. The
  // driver stays a heartbeat: it only counts results + isolates failures;
  // dedup and opportunity detection stay in the Brain's discoverIntelligence.
  const refreshIntelligenceEnabled =
    options.refreshIntelligenceEnabled ?? process.env.AI_WORLD_CADENCE_REFRESH_INTELLIGENCE !== '0';
  const refreshIntelligence = options.refreshIntelligence ?? brainIntelligenceRefresh;
  const now = options.now ?? ((): number => Date.now());
  const log = options.log ?? logger;

  let timer: ReturnType<typeof setInterval> | undefined;
  let lastTick: SchedulerCadenceTickResult | undefined;
  let running = false;
  const startedAt = now();

  const runTick = async (): Promise<void> => {
    if (running) return; // never overlap ticks
    running = true;
    const tickStartedAt = now();
    const result: SchedulerCadenceTickResult = {
      startedAt: tickStartedAt,
      finishedAt: tickStartedAt,
      usersProcessed: 0,
      runsStarted: 0,
      runsSkipped: 0,
      opportunitiesFound: 0,
      notificationsEmitted: 0,
      errors: 0,
      errorSample: [],
      truncated: false,
    };
    try {
      // ── 1. Enumerate users (identity directory — bounded). ────────────
      let users: string[];
      try {
        users = (await userSource.listUserIds()).slice(0, maxUsersPerTick);
      } catch (error) {
        // Directory unavailable (e.g. no database yet) — abort the pass
        // HONESTLY, never partially discover. The next interval retries.
        result.userDirectoryError = error instanceof Error ? error.message : String(error);
        log.warn('AI World cadence tick aborted — user directory unavailable', {
          error: result.userDirectoryError,
        });
        return;
      }

      // ── 2. Tick each user through the EXISTING scheduler (sequential — a
      //        bounded, failure-isolated crawl; never parallel stampede). ─
      for (const userId of users) {
        if (now() - tickStartedAt > maxTickDurationMs) {
          result.truncated = true;
          log.warn('AI World cadence tick truncated by wall-clock bound', {
            usersProcessed: result.usersProcessed,
            maxTickDurationMs,
          });
          break;
        }
        result.usersProcessed += 1;
        try {
          const outcome = await getScheduler().tick(userId);
          result.runsStarted += outcome.ran.length;
          result.runsSkipped += outcome.skipped.length;
        } catch (error) {
          result.errors += 1;
          if (result.errorSample.length < ERROR_SAMPLE_LIMIT) {
            result.errorSample.push(error instanceof Error ? error.message : String(error));
          }
          // Per-user failure is isolated — continue with the next user.
        }
        // EPIC-021 — Brain opportunity refresh on the same heartbeat. Isolated
        // exactly like the scheduler tick: one user's bridge failure never
        // breaks the pass, and the Brain's own dedup prevents duplicates.
        if (refreshIntelligenceEnabled) {
          try {
            const refreshed = await refreshIntelligence.refresh(userId);
            result.opportunitiesFound += refreshed.newOpportunities;
            result.notificationsEmitted += refreshed.notificationsEmitted;
          } catch (error) {
            result.errors += 1;
            if (result.errorSample.length < ERROR_SAMPLE_LIMIT) {
              result.errorSample.push(error instanceof Error ? error.message : String(error));
            }
          }
        }
      }
    } catch (error) {
      // The pass itself failed (defensive — the loop above already isolates
      // per user). Record + log; never throw into the timer.
      result.errors += 1;
      if (result.errorSample.length < ERROR_SAMPLE_LIMIT) {
        result.errorSample.push(error instanceof Error ? error.message : String(error));
      }
    } finally {
      result.finishedAt = now();
      lastTick = result;
      running = false;
    }

    if (
      result.runsStarted > 0 ||
      result.opportunitiesFound > 0 ||
      result.errors > 0 ||
      result.userDirectoryError
    ) {
      log.info('AI World cadence tick complete', {
        usersProcessed: result.usersProcessed,
        runsStarted: result.runsStarted,
        runsSkipped: result.runsSkipped,
        opportunitiesFound: result.opportunitiesFound,
        notificationsEmitted: result.notificationsEmitted,
        errors: result.errors,
        truncated: result.truncated,
        userDirectoryError: result.userDirectoryError,
      });
    } else {
      log.info('AI World cadence tick complete — no due jobs', {
        usersProcessed: result.usersProcessed,
      });
    }
  };

  const stop = (): void => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    instance = undefined;
  };

  timer = setInterval(() => {
    void runTick();
  }, intervalMs);
  timer.unref();

  if (options.runImmediately ?? true) {
    // First pass at boot so discovery starts now, not after a full cadence.
    void runTick();
  }

  instance = {
    stop,
    status: (): SchedulerRuntimeStatus => {
      const nextTickAt = lastTick
        ? Math.max(startedAt, lastTick.finishedAt) + intervalMs
        : startedAt + intervalMs;
      return {
        active: true,
        reason: 'enabled',
        intervalMs,
        maxUsersPerTick,
        refreshIntelligenceEnabled,
        startedAt,
        lastTickAt: lastTick?.finishedAt,
        lastTick,
        nextTickAt,
      };
    },
    get lastTick(): SchedulerCadenceTickResult | undefined {
      return lastTick;
    },
  };
  return instance;
}

/** Stop the AI World cadence driver and reset the singleton (no-op when idle). */
export function stopSchedulerCadenceDriver(): void {
  instance?.stop();
}

/** Current driver state (undefined when not running). */
export function getSchedulerCadenceDriver(): SchedulerCadenceDriver | undefined {
  return instance;
}
