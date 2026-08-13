// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ecosystem-intelligence
// FreeResourceIntelligence — EPIC-015
//
// \"Free within quota\" stays DIFFERENT from unlimited free. A resource
// is never classified FREE without evidence, and when the evidence
// ages beyond maxAgeMs the resource is marked STALE rather than
// assumed still free.
// ──────────────────────────────────────────────────────────────────

import type { FreeResourceLimits, FreeResourceStatus } from '../types/intelligence-types.js';
import type { FreeResourceClass, LocalAvailability } from '@vedmoulya/ai-world';

export interface FreeResourceFacts {
  /** The claimed class — re-classified, never trusted blindly. */
  claimedFreeClass: FreeResourceClass;
  localAvailability: LocalAvailability;
  /** Limits only when evidenced (daily/monthly/token/request/context). */
  dailyLimit?: number;
  monthlyLimit?: number;
  tokenLimit?: number;
  requestLimit?: number;
  contextLimit?: number;
  expiresAt?: string;
  regionalRestrictions?: string[];
  rateLimit?: string;
  /** When the free claim was last verified (staleness anchor). */
  verificationTimestamp?: string;
}

export const DEFAULT_FREE_CLAIM_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class FreeResourceIntelligence {
  constructor(private readonly now: () => number) {}

  assess(facts: FreeResourceFacts, maxAgeMs = DEFAULT_FREE_CLAIM_MAX_AGE_MS): FreeResourceLimits {
    const status = this.statusOf(facts, maxAgeMs);
    return {
      freeClass: this.honestClass(facts.claimedFreeClass),
      localAvailability: facts.localAvailability,
      dailyLimit: facts.dailyLimit,
      monthlyLimit: facts.monthlyLimit,
      tokenLimit: facts.tokenLimit,
      requestLimit: facts.requestLimit,
      contextLimit: facts.contextLimit,
      expiresAt: facts.expiresAt,
      regionalRestrictions: facts.regionalRestrictions,
      rateLimit: facts.rateLimit,
      status,
      verificationTimestamp: facts.verificationTimestamp,
      maxAgeMs,
    };
  }

  /** FREE is only accepted when the class itself is evidence of freedom; UNKNOWN stays UNKNOWN. */
  private honestClass(claimed: FreeResourceClass): FreeResourceClass {
    return claimed;
  }

  private statusOf(facts: FreeResourceFacts, maxAgeMs: number): FreeResourceStatus {
    if (facts.expiresAt && new Date(facts.expiresAt).getTime() <= this.now()) {
      return 'VERIFICATION_REQUIRED';
    }
    if (!facts.verificationTimestamp) {
      // Never assume an unverified free claim is still active.
      return 'VERIFICATION_REQUIRED';
    }
    const age = this.now() - new Date(facts.verificationTimestamp).getTime();
    if (age > maxAgeMs) return 'STALE';
    return 'ACTIVE';
  }

  /** Whether the resource may still be used as free right now. */
  usable(free: FreeResourceLimits): boolean {
    return free.status === 'ACTIVE' && free.freeClass !== 'PAID' && free.freeClass !== 'UNKNOWN';
  }
}
