// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Controller: Objective lease heartbeat (LEASE-01)
//
// WHY THIS EXISTS
// ---------------
// BLD-025 gave every executing objective a durable ownership LEASE with a
// fixed TTL. The lease was written once, at acquisition, and never refreshed,
// so an objective that legitimately runs longer than the TTL (slow planning,
// slow execution, slow verification, evidence persistence) LOOKED abandoned:
// any recovery pass healed it to READY and the still-working owner later
// overwrote the record with its own stale snapshot — the interrupted objective
// and the lost `Last Verification` result.
//
// This heartbeat keeps the SAME lease alive for as long as this execution is
// genuinely working, through the store's ownership-checked renewal. It is NOT
// a new scheduler and NOT a worker: one bounded timer per running objective,
// no polling loop, no queue.
//
// TWO DIFFERENT QUESTIONS (deliberately separated):
//   • "May I extend my lease?"   — `renewNow()`. Refused once the lease has
//     expired: a late renewal must never reclaim authority that recovery may
//     already have taken.
//   • "Am I still the recorded owner?" — `stillOwnsObjective()`. Answered by
//     the store against the authoritative document. An EXPIRED lease that was
//     never released or replaced is still OUR acquisition (nobody else can own
//     it), so completed work may still be acknowledged — while a lease that was
//     healed, replaced or released never may be.
//
// CONTRACT (deliberately narrow):
//   • renews at 1/3 of the configured TTL — comfortably before expiry;
//   • NEVER overlaps requests (a renewal is awaited before the next is
//     scheduled; an explicit caller also joins the in-flight request);
//   • RETRIES a TRANSIENT renewal failure (timeout / thrown error) only while
//     it can still prove it is allowed to: the store still records this exact
//     acquisition as the owner AND the lease it knows about has not expired.
//     A REFUSAL from the store (it answered "you are not the owner") is never
//     retried, and neither is anything once the known expiry has passed — a
//     late renewal must never reclaim authority recovery may already have
//     taken. Retrying grants nothing: every attempt is re-validated by the
//     store against the authoritative record;
//   • stops renewing for good once the attempts are exhausted (or the refusal
//     is final) and never silently assumes ownership again;
//   • `stop()` clears the timer and awaits the in-flight renewal, so it is
//     safe in every exit path (success, exception, hold, cancellation);
//   • it grants nothing: renewal never changes objective state, budget,
//     permissions or verification — only the lease expiration.
// ──────────────────────────────────────────────────────────────────

import type { ClockPort, MissionStore } from '../contracts/mission-ports.js';
import type { MissionObjectiveLease } from '../types/mission-types.js';

/**
 * Schedules heartbeat ticks. The default uses `setTimeout`; tests inject a
 * manual scheduler so renewal is deterministic (no real-time sleeps).
 */
export interface LeaseRenewalScheduler {
  /** Schedules one tick; the returned handle is passed back to `cancel`. */
  schedule(tick: () => Promise<void>, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

export const systemLeaseRenewalScheduler: LeaseRenewalScheduler = {
  schedule: (tick, delayMs) => {
    return setTimeout(() => {
      void tick();
    }, delayMs);
  },
  cancel: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

/**
 * LEASE-02 — hard bound on ONE renewal attempt and therefore on heartbeat
 * shutdown. A renewal that cannot settle must never block objective cleanup
 * forever; it also never counts as proof of ownership.
 */
export const DEFAULT_LEASE_RENEWAL_TIMEOUT_MS = 5_000;

export function resolveLeaseRenewalTimeoutMs(explicit?: number): number {
  if (explicit !== undefined && Number.isFinite(explicit) && explicit > 0) return explicit;
  const envVal = process.env.MISSION_LEASE_RENEWAL_TIMEOUT_MS?.trim();
  if (envVal && /^\d+$/.test(envVal)) {
    const parsed = Number.parseInt(envVal, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_LEASE_RENEWAL_TIMEOUT_MS;
}

/**
 * RETRY-01 — bounded retries for ONE renewal that failed TRANSIENTLY (a
 * timeout or a driver error such as a dropped connection). A single transient
 * failure used to stop the heartbeat permanently, so a 5 s scheduling hiccup
 * on a healthy lease ended all renewal for the rest of the attempt — the exact
 * mechanism that let a working process look abandoned.
 *
 * 3 attempts covers an isolated hiccup without turning the heartbeat into a
 * retry loop: the whole chain is still bounded by the SAME
 * `renewalTimeoutMs` budget per attempt and by the lease expiry.
 */
export const DEFAULT_LEASE_RENEWAL_MAX_ATTEMPTS = 3;

/** Pause between transient renewal attempts (short — the lease is ticking). */
export const DEFAULT_LEASE_RENEWAL_RETRY_DELAY_MS = 25;

/** Unique sentinel for the timeout branch (never a valid renewal result). */
const TIMED_OUT = Symbol('lease-renewal-timeout');

/** Outcome of ONE bounded renewal attempt (never a grant of authority). */
type RenewalOutcome =
  { kind: 'confirmed' } | { kind: 'refused' } | { kind: 'transient'; reason: string };

export interface ObjectiveLeaseHeartbeatOptions {
  store: MissionStore;
  clock: ClockPort;
  missionId: string;
  objectiveId: string;
  /** The EXACT acquisition this execution holds (owner + fencing token). */
  lease: MissionObjectiveLease;
  /** The configured lease TTL in ms (never a hard-coded value). */
  ttlMs: number;
  /** Scheduler seam (defaults to `setTimeout`). */
  scheduler?: LeaseRenewalScheduler;
  /**
   * Bounded renewal/shutdown budget (defaults to
   * `DEFAULT_LEASE_RENEWAL_TIMEOUT_MS`, never more than the TTL itself).
   */
  renewalTimeoutMs?: number;
  /**
   * RETRY-01 — transient-failure retry policy. `maxAttempts` counts ALL
   * attempts of one renewal (1 disables retrying); `retryDelayMs` is the pause
   * between them. Both are clamped to sane bounds and never override the
   * ownership/expiry preconditions.
   */
  retry?: { maxAttempts?: number; retryDelayMs?: number };
  /** Sleep seam for the retry pause (tests inject a deterministic one). */
  sleep?: (ms: number) => Promise<void>;
  /**
   * WORKSPACE-01 — companion renewal, run after every CONFIRMED objective
   * renewal (the workspace lease is extended on the same tick, so there is one
   * timer, never a second scheduler). Failures are the caller's to absorb: a
   * companion that cannot renew must never stop the objective lease.
   */
  onRenewed?: (renewal: { expiresAtMs: number }) => Promise<void> | void;
}

export class ObjectiveLeaseHeartbeat {
  /** Renewal delay: 1/3 of the TTL, so two renewals can be missed safely. */
  readonly intervalMs: number;
  /** Bounded renewal attempt / shutdown budget (ms). */
  readonly renewalTimeoutMs: number;
  private readonly scheduler: LeaseRenewalScheduler;
  private handle: unknown;
  private inFlight: Promise<boolean> | undefined;
  private stopped = false;
  private failureReason: string | undefined;
  private successCount = 0;
  private readonly maxRenewalAttempts: number;
  private readonly retryDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  /**
   * RETRY-01 — the latest expiry this heartbeat KNOWS about: the acquisition's
   * expiry at construction, replaced by each confirmed renewal. Retry decisions
   * and the initiation gate use it, so they are never based on a stale
   * acquisition after a successful extension.
   */
  private currentExpiresAtMs: number;

  constructor(private readonly options: ObjectiveLeaseHeartbeatOptions) {
    this.scheduler = options.scheduler ?? systemLeaseRenewalScheduler;
    this.intervalMs = Math.max(1, Math.floor(options.ttlMs / 3));
    const requested = resolveLeaseRenewalTimeoutMs(options.renewalTimeoutMs);
    // Never wait longer than the lease itself can possibly live.
    const ceiling = options.ttlMs > 0 ? options.ttlMs : requested;
    this.renewalTimeoutMs = Math.max(1, Math.min(requested, ceiling));
    this.maxRenewalAttempts = Math.max(
      1,
      Math.floor(options.retry?.maxAttempts ?? DEFAULT_LEASE_RENEWAL_MAX_ATTEMPTS),
    );
    this.retryDelayMs = Math.max(
      0,
      Math.floor(options.retry?.retryDelayMs ?? DEFAULT_LEASE_RENEWAL_RETRY_DELAY_MS),
    );
    this.sleep =
      options.sleep ??
      ((ms: number): Promise<void> =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, ms);
        }));
    const acquiredExpiry = Date.parse(options.lease.expiresAt);
    this.currentExpiresAtMs = Number.isFinite(acquiredExpiry)
      ? acquiredExpiry
      : Number.POSITIVE_INFINITY;
  }

  /**
   * Whether this heartbeat can actually prove ownership: the store must offer
   * ownership-checked operations, the lease must carry its fencing token, and
   * the TTL must be a real (positive) duration. Otherwise the heartbeat is
   * INERT and the frozen pre-LEASE-01 behavior (a fixed-TTL lease) is
   * preserved — existing custom stores keep working unchanged.
   */
  get supported(): boolean {
    return (
      typeof this.options.store.renewObjectiveLease === 'function' &&
      this.options.lease.token !== undefined &&
      this.options.lease.token.length > 0 &&
      this.options.ttlMs > 0
    );
  }

  /** The first renewal failure (refused or thrown), if any — never cleared. */
  get renewalFailureReason(): string | undefined {
    return this.failureReason;
  }

  /** Number of successful renewals (observability/tests; never authority). */
  get renewals(): number {
    return this.successCount;
  }

  /** The latest lease expiry this heartbeat knows about (ms since epoch). */
  get knownExpiresAtMs(): number {
    return this.currentExpiresAtMs;
  }

  /** How many attempts one renewal may make (1 = no retry). */
  get renewalAttemptLimit(): number {
    return this.maxRenewalAttempts;
  }

  /**
   * INITIATION GATE — may this execution start `operation` (a workspace
   * mutation, a command, a verification that runs one)?
   *
   * Returns `undefined` when the caller may proceed, or the honest reason it
   * may not. The criterion is OWNERSHIP against authority — deliberately the
   * same one LEASE-01 uses for acknowledging finished work:
   *   • the store still records THIS acquisition (owner + fencing token) as the
   *     objective's owner (an authoritative read).
   *
   * LOCAL EXPIRY IS NOT A DENIAL HERE, on purpose. An expired lease that was
   * never healed, released or replaced still belongs to this execution (nobody
   * else can own it), so its own work may continue to completion — that is the
   * documented LEASE-01/LEASE-02 semantics, and it is what keeps a slow
   * verification from throwing away work whose ownership is still provable.
   * Expiry only ever blocks a new RENEWAL attempt (`retryRefusal`) and lets
   * recovery heal an abandoned objective.
   *
   * A failed renewal alone does NOT deny initiation either (a renewal outage
   * must not discard work while ownership is still provable).
   * Stores without an ownership check (legacy) cannot answer, so the gate
   * keeps the frozen behavior and allows the caller.
   */
  async ownershipRefusal(operation: string): Promise<string | undefined> {
    if (!this.supported) return undefined;
    if (!(await this.stillOwnsObjective())) {
      return `this execution no longer owns objective ${this.options.objectiveId} — ${operation} was not initiated`;
    }
    return undefined;
  }

  /** Start the bounded heartbeat. Idempotent and a no-op when unsupported. */
  start(): void {
    if (this.stopped || this.failureReason !== undefined || !this.supported) return;
    this.scheduleNext();
  }

  /**
   * Stop the heartbeat: no further ticks are scheduled and an in-flight
   * renewal is awaited before returning, so nothing keeps renewing after the
   * owner has finished (or failed).
   */
  async stop(): Promise<void> {
    this.stopped = true;
    this.clearTimer();
    if (this.inFlight) {
      try {
        await this.inFlight;
      } catch {
        // A failed renewal is recorded on the heartbeat; stopping never throws.
      }
    }
  }

  /**
   * Force ONE renewal now. Returns `true` only when the store confirmed the
   * extension (or when there is nothing to prove: an unsupported store).
   */
  async renewNow(): Promise<boolean> {
    if (!this.supported) return true;
    return this.renewOnce();
  }

  /**
   * Ask the STORE whether this exact acquisition is still the recorded owner
   * of the objective (RUNNING + matching owner + matching fencing token).
   *
   * Only meaningful after a refused renewal: it is what distinguishes "my lease
   * expired while I was still working and NOBODY took it" (still ours, so its
   * completed work may be acknowledged) from "recovery healed it / another
   * execution acquired it" (never ours again — no write may be persisted).
   * A store that cannot answer, or an error, is treated as NOT owned.
   */
  async stillOwnsObjective(): Promise<boolean> {
    if (!this.supported) return true;
    const store = this.options.store;
    const token = this.options.lease.token;
    if (typeof store.holdsObjectiveLease !== 'function' || token === undefined) return false;
    try {
      return await store.holdsObjectiveLease(this.options.missionId, this.options.objectiveId, {
        owner: this.options.lease.owner,
        token,
      });
    } catch {
      return false; // ownership that cannot be proven is not ownership
    }
  }

  private scheduleNext(): void {
    if (this.stopped || this.failureReason !== undefined) return;
    this.handle = this.scheduler.schedule(() => this.tick(), this.intervalMs);
  }

  private clearTimer(): void {
    if (this.handle === undefined) return;
    this.scheduler.cancel(this.handle);
    this.handle = undefined;
  }

  /** One tick: renew, then schedule the next one (never concurrently). */
  private async tick(): Promise<void> {
    this.handle = undefined;
    if (this.stopped || this.failureReason !== undefined) return;
    await this.renewOnce();
    this.scheduleNext();
  }

  private renewOnce(): Promise<boolean> {
    if (this.inFlight) return this.inFlight;
    const attempt = this.runRenewal().finally(() => {
      this.inFlight = undefined;
    });
    this.inFlight = attempt;
    return attempt;
  }

  /**
   * RETRY-01 — one renewal, with bounded retries for TRANSIENT failures only.
   *
   * The distinction is the whole fix:
   *   • `confirmed` → extension durable; record it and continue;
   *   • `refused`   → the STORE answered "this acquisition does not own the
   *                   objective" (released, healed, replaced or expired). That
   *                   is an authoritative answer — retrying it would be
   *                   arguing with the database, so the heartbeat stops;
   *   • `transient` → timeout / thrown error: the store did not answer. Retry
   *                   ONLY while the lease has not expired AND ownership is
   *                   still provable (see `retryRefusal`).
   *
   * Nothing here grants authority: every attempt is re-validated by the store
   * against the authoritative record.
   */
  private async runRenewal(): Promise<boolean> {
    let transientReason: string | undefined;
    for (let attempt = 1; attempt <= this.maxRenewalAttempts; attempt += 1) {
      if (this.stopped || this.failureReason !== undefined) return false;
      const outcome = await this.performRenewalWithinBudget();
      // A stop() that landed while the attempt was in flight is not a failure.
      // `stopped` is NOT narrowed away by the guard at the top of the loop:
      // the await above can have run stop(), which sets it.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cleared by an awaited stop()
      if (this.stopped) return false;
      if (outcome.kind === 'confirmed') {
        this.successCount += 1;
        this.currentExpiresAtMs = this.options.clock.timestampMs() + this.options.ttlMs;
        // Companion renewal (workspace lease): best effort — a failure here
        // never turns a confirmed objective renewal into a failure.
        try {
          await this.options.onRenewed?.({ expiresAtMs: this.currentExpiresAtMs });
        } catch {
          // Absorbed deliberately; the initiation gate re-verifies the lease.
        }
        return true;
      }
      if (outcome.kind === 'refused') {
        this.stopRenewing('lease renewal was refused by the store');
        return false;
      }
      transientReason = outcome.reason;
      if (attempt >= this.maxRenewalAttempts) break;
      const retryRefusal = await this.retryRefusal();
      if (retryRefusal !== undefined) {
        this.stopRenewing(`${transientReason}; not retried — ${retryRefusal}`);
        return false;
      }
      await this.sleep(this.retryDelayMs);
    }
    this.stopRenewing(
      `${transientReason ?? 'lease renewal failed'}; gave up after ${String(
        this.maxRenewalAttempts,
      )} attempt(s) — ownership is NOT confirmed by renewal`,
    );
    return false;
  }

  /**
   * RETRY-01 — may another attempt be made? Only while the two facts the sprint
   * requires still hold:
   *   • the lease this heartbeat knows about has not expired;
   *   • the store still records this exact acquisition as the owner.
   * A store that cannot answer the ownership question (legacy) is not treated as
   * "lost": the retry itself is harmless because the store re-validates.
   * A retry that could not finish before expiry is pointless, so it is skipped.
   */
  private async retryRefusal(): Promise<string | undefined> {
    if (this.stopped) return 'the heartbeat was stopped';
    const nowMs = this.options.clock.timestampMs();
    if (nowMs >= this.currentExpiresAtMs) return 'the lease expired during the retry window';
    if (nowMs + this.renewalTimeoutMs > this.currentExpiresAtMs) {
      return 'no time remains to complete another renewal before expiry';
    }
    const canAsk = typeof this.options.store.holdsObjectiveLease === 'function';
    if (canAsk && !(await this.stillOwnsObjective())) return 'ownership was lost';
    return undefined;
  }

  /**
   * LEASE-02/RETRY-01 — ONE attempt, bounded by the renewal budget.
   *
   * A renewal that does not settle within the budget is TRANSIENT (not
   * confirmed, not refused): the caller decides whether it may be retried.
   * The late settlement of an abandoned attempt can never schedule another
   * attempt or restore authority — the outcome is already classified.
   *
   * LEASE-DEADLINE — the abandoned attempt is NOT left as an unhandled
   * promise: its settlement (or rejection, e.g. a database connection error
   * long after the budget expired) is absorbed here. The store's own
   * ownership checks already refuse a late renewal, so absorbing the RESULT
   * cannot revive authority; it only prevents an unhandled rejection.
   */
  private async performRenewalWithinBudget(): Promise<RenewalOutcome> {
    try {
      if (this.renewalTimeoutMs <= 0) {
        return (await this.performRenewal()) ? { kind: 'confirmed' } : { kind: 'refused' };
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => {
          resolve(TIMED_OUT);
        }, this.renewalTimeoutMs);
      });
      // One reference to the attempt, so a LATE rejection is observed even
      // when the race has already been decided by the timeout.
      const attempt = this.performRenewal();
      attempt.catch(() => {
        // Absorbed: `Promise.race` already settled (timeout) or handles it
        // below; a late driver error must never surface as unhandled.
      });
      try {
        const outcome = await Promise.race([attempt, timeout]);
        if (outcome === TIMED_OUT) {
          return {
            kind: 'transient',
            reason: `lease renewal did not settle within ${String(this.renewalTimeoutMs)}ms — ownership is NOT confirmed`,
          };
        }
        return outcome ? { kind: 'confirmed' } : { kind: 'refused' };
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    } catch (error: unknown) {
      return {
        kind: 'transient',
        reason: `lease renewal failed (${
          error instanceof Error ? error.message : String(error)
        }) — ownership can no longer be confirmed by renewal`,
      };
    }
  }

  private async performRenewal(): Promise<boolean> {
    if (this.stopped || this.failureReason !== undefined) return false;
    const store = this.options.store;
    const token = this.options.lease.token;
    if (typeof store.renewObjectiveLease !== 'function' || token === undefined) return true;
    const nowMs = this.options.clock.timestampMs();
    const renewed = await store.renewObjectiveLease(
      this.options.missionId,
      this.options.objectiveId,
      {
        owner: this.options.lease.owner,
        token,
        nowMs,
        expiresAt: new Date(nowMs + this.options.ttlMs).toISOString(),
      },
    );
    return renewed !== undefined;
  }

  private stopRenewing(reason: string): void {
    if (this.failureReason === undefined) this.failureReason = reason;
    this.clearTimer();
  }
}
