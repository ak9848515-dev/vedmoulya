// ──────────────────────────────────────────────────────────────────
// VedMoulya — Live Intelligence Bridge · BridgeNotificationMapper
// EPIC-017 § Phase 11 — LIVE INTELLIGENCE / AI WORLD.
//
// Maps meaningful loop events to the EXISTING AI World notification
// surface — relevance-gated, never spam. Only materially relevant
// changes surface (NEW_MODEL, BETTER_MODEL, FREE_QUOTA_AVAILABLE,
// PROVIDER_DEGRADED, NEW_GITHUB_PROJECT, SECURITY_CHANGE,
// NEW_LOCAL_MODEL, BETTER_CAPABILITY, ...). The gate reuses the
// EPIC-015 meaningful-relevance threshold.
// ──────────────────────────────────────────────────────────────────

import type { BridgeNotificationEvent, BridgeNotificationKind } from '../types/bridge-types.js';

/** Same meaningful-relevance threshold as EPIC-015 NotificationGate. */
export const MIN_MEANINGFUL_RELEVANCE = 60;

export interface NotificationCandidate {
  kind: BridgeNotificationKind;
  title: string;
  body: string;
  /** 0..100 — derived from the event's material impact. */
  relevance: number;
}

export class BridgeNotificationMapper {
  /**
   * Gate + map a candidate event. Returns the event when it is
   * materially relevant; otherwise { dropped: true, reason }.
   */
  maybeNotify(
    candidate: NotificationCandidate,
    loopId: string,
    now: string,
  ): BridgeNotificationEvent | { dropped: true; reason: string } {
    if (candidate.relevance < MIN_MEANINGFUL_RELEVANCE) {
      return {
        dropped: true,
        reason: `Relevance ${candidate.relevance} below the meaningful threshold (${MIN_MEANINGFUL_RELEVANCE}).`,
      };
    }
    return {
      id: hashId(`${loopId}|${candidate.kind}|${candidate.title}|${now}`),
      loopId,
      kind: candidate.kind,
      title: candidate.title,
      body: candidate.body,
      relevance: Math.min(100, Math.max(0, Math.round(candidate.relevance))),
      createdAt: now,
    };
  }

  /**
   * Suggested notification for a completed loop outcome — a
   * materially-better capability that was approved and performed.
   * Only surfaces when it genuinely changes the user's options.
   */
  fromBetterCapability(opts: {
    capability: string;
    provider: string;
    quality?: number;
    currentQuality?: number;
    now: string;
    loopId: string;
  }): BridgeNotificationEvent | { dropped: true; reason: string } {
    const margin =
      opts.quality !== undefined && opts.currentQuality !== undefined
        ? opts.quality - opts.currentQuality
        : undefined;
    if (margin !== undefined && margin < 8) {
      return {
        dropped: true,
        reason: `Quality margin ${margin} below the material-improvement bar (8).`,
      };
    }
    return this.maybeNotify(
      {
        kind: 'BETTER_CAPABILITY',
        title: 'Better capability verified',
        body: `${opts.provider} performed better for ${opts.capability}${opts.quality !== undefined ? ` (quality ${opts.quality})` : ''}.`,
        relevance: 60 + Math.min(30, Math.max(0, margin ?? 8)),
      },
      opts.loopId,
      opts.now,
    );
  }
}

function hashId(seed: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < seed.length; i += 1) {
    const code = seed.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + code) >>> 0;
    h2 = ((h2 << 5) + h2 + code) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
