// ──────────────────────────────────────────────────────────────────
// VedMoulya — Scheduler: CooldownManager
// EPIC-018 — Phase 8 notification deduplication.
// Item-level notification cooldowns: a NEW item notifies once; an
// UPDATED item re-notifies only after its cooldown window. A
// successful run with no meaningful change never notifies (the
// ChangeDetector returns NO_CHANGE and no entries reach this manager).
// ──────────────────────────────────────────────────────────────────

import type { DiscoveryCooldown } from '../types/scheduler-types.js';
import type { CooldownStore } from '../contracts/scheduler-ports.js';

export class CooldownManager {
  private readonly store: CooldownStore;

  constructor(store: CooldownStore) {
    this.store = store;
  }

  /** Whether a notification for this key may be emitted now. */
  isEligible(userId: string, key: string, cooldownMs: number, nowMs: number): boolean {
    const existing = this.store.get(userId, key);
    if (!existing) return true;
    return nowMs >= existing.nextEligibleAtMs;
  }

  /** Record a notification emission (starts the cooldown window). */
  record(userId: string, key: string, nowIso: string, nowMs: number, cooldownMs: number): void {
    const cooldown: DiscoveryCooldown = {
      userId,
      key,
      lastNotifiedAt: nowIso,
      nextEligibleAtMs: nowMs + cooldownMs,
    };
    this.store.save(cooldown);
  }

  /** Current cooldown record (read view). */
  get(userId: string, key: string): DiscoveryCooldown | undefined {
    return this.store.get(userId, key);
  }
}
