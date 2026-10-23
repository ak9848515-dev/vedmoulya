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
//   • stops renewing the moment a renewal fails (refused or thrown) and never
//     silently assumes ownership again;
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
    setTimeout(() => {
      void tick();
    }, delayMs);
    return undefined;
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

/** Unique sentinel for the timeout branch (never a valid renewal result). */
const TIMED_OUT = Symbol('lease-renewal-timeout');

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

  constructor(private readonly options: ObjectiveLeaseHeartbeatOptions) {
    this.scheduler = options.scheduler ?? systemLeaseRenewalScheduler;
    this.intervalMs = Math.max(1, Math.floor(options.ttlMs / 3));
    const requested = options.renewalTimeoutMs ?? DEFAULT_LEASE_RENEWAL_TIMEOUT_MS;
    // Never wait longer than the lease itself can possibly live.
    const ceiling = options.ttlMs > 0 ? options.ttlMs : requested;
    this.renewalTimeoutMs = Math.max(1, Math.min(requested, ceiling));
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
    const attempt = this.performRenewalWithinBudget()
      .then((renewed) => {
        if (!renewed) this.stopRenewing('lease renewal was refused by the store');
        return renewed;
      })
      .catch((error: unknown) => {
        // A renewal that cannot be PROVEN stops the heartbeat: continuing to
        // assume ownership is exactly what lets a stale execution overwrite the
        // real owner's state. The caller still asks the store directly before
        // persisting anything.
        this.stopRenewing(
          `lease renewal failed (${
            error instanceof Error ? error.message : String(error)
          }) — ownership can no longer be confirmed by renewal`,
        );
        return false;
      })
      .finally(() => {
        this.inFlight = undefined;
      });
    this.inFlight = attempt;
    return attempt;
  }

  /**
   * LEASE-02 — ONE bounded renewal attempt.
   *
   * A renewal that does not settle within the budget is treated as NOT
   * confirmed: the heartbeat stops (so cleanup is bounded) and the late
   * settlement can never schedule another attempt or restore authority. The
   * controller never relies on this result to prove ownership — every write it
   * makes is validated atomically by the store.
   */
  private async performRenewalWithinBudget(): Promise<boolean> {
    if (this.renewalTimeoutMs <= 0) return this.performRenewal();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
      timer = setTimeout(() => {
        resolve(TIMED_OUT);
      }, this.renewalTimeoutMs);
    });
    try {
      const outcome = await Promise.race([this.performRenewal(), timeout]);
      if (outcome === TIMED_OUT) {
        this.stopRenewing(
          `lease renewal did not settle within ${String(this.renewalTimeoutMs)}ms — ownership is NOT confirmed`,
        );
        return false;
      }
      return outcome;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
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
    if (!renewed) return false;
    this.successCount += 1;
    return true;
  }

  private stopRenewing(reason: string): void {
    if (this.failureReason === undefined) this.failureReason = reason;
    this.clearTimer();
  }
}
