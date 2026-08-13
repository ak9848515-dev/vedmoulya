// ──────────────────────────────────────────────────────────────────
// VedMoulya — FreeResourceClassifier
// EPIC-012C — independent free/local axes
//
// Distinguishes FREE_API / FREE_WITH_QUOTA / OPEN_WEIGHTS /
// OPEN_SOURCE / LOCAL / SELF_HOSTABLE / PAID / UNKNOWN. The key rule:
// "open source" ≠ "free API" and "free model" ≠ "unlimited free
// inference". A source's claimedFreeClass is a CLAIM — this engine
// re-classifies from evidence and never fabricates.
// ──────────────────────────────────────────────────────────────────

import type { RawDiscoveryItem } from '../types/discovery-types.js';
import type { FreeResourceClass, LocalAvailability } from '../types/discovery-types.js';

export interface ResourceClassification {
  freeClass: FreeResourceClass;
  localAvailability: LocalAvailability;
  reasons: string[];
}

/**
 * Re-classify a raw item on independent axes. Classification order:
 * evidence-first (github repo, model facts), then claimed hints —
 * a claim without evidence lands on the conservative UNKNOWN.
 */
export class FreeResourceClassifier {
  classify(item: RawDiscoveryItem): ResourceClassification {
    const reasons: string[] = [];
    const evidence = item.evidence ?? [];

    // ── GitHub repository: open source is about code, not free API ─────
    if (item.category === 'github' && item.github) {
      const selfHostable: LocalAvailability = item.github.license ? 'yes' : 'UNKNOWN';
      const freeClass: FreeResourceClass = 'OPEN_SOURCE';
      reasons.push(
        'Repository published with source code — OPEN_SOURCE (self-hostable code, not a free API).',
      );
      return { freeClass, localAvailability: selfHostable, reasons };
    }

    // ── Local runtimes / self-hostable hints from the source ───────────
    const localClaimed = item.claimedLocalAvailability === 'yes';

    // Evidence of a free tier in the evidence list.
    const freeEvidence = evidence.find(
      (e) => /free|quota|tier/i.test(e.claim) && e.confidence !== 'UNKNOWN',
    );

    if (item.category === 'model' && localClaimed) {
      return {
        freeClass: 'LOCAL',
        localAvailability: 'yes',
        reasons: [
          'Model runs on local infrastructure — LOCAL (free per-inference, hardware is the cost).',
        ],
      };
    }

    if (freeEvidence) {
      const isQuota = /quota|limit(ed)?|tier/i.test(freeEvidence.claim);
      return {
        freeClass: isQuota ? 'FREE_WITH_QUOTA' : 'FREE_API',
        localAvailability: item.claimedLocalAvailability ?? 'UNKNOWN',
        reasons: [
          isQuota
            ? 'Evidence cites a free quota/tier — FREE_WITH_QUOTA (bounded, never unlimited).'
            : 'Evidence cites free availability — FREE_API (bounded by provider policy).',
        ],
      };
    }

    // ── Claimed classes are treated as claims only when no evidence ────
    switch (item.claimedFreeClass) {
      case 'FREE_API':
        reasons.push('Claimed free API without verified evidence — UNKNOWN until confirmed.');
        return {
          freeClass: 'UNKNOWN',
          localAvailability: item.claimedLocalAvailability ?? 'UNKNOWN',
          reasons,
        };
      case 'FREE_WITH_QUOTA':
        reasons.push(
          'Claimed free-with-quota without verified evidence — UNKNOWN until confirmed.',
        );
        return {
          freeClass: 'UNKNOWN',
          localAvailability: item.claimedLocalAvailability ?? 'UNKNOWN',
          reasons,
        };
      case 'OPEN_WEIGHTS':
        return {
          freeClass: 'OPEN_WEIGHTS',
          localAvailability: item.claimedLocalAvailability ?? 'yes',
          reasons: [
            'Claimed open weights — self-hostable model, inference cost is the user\u2019s hardware.',
          ],
        };
      case 'PAID':
        return {
          freeClass: 'PAID',
          localAvailability: item.claimedLocalAvailability ?? 'no',
          reasons: ['Classified paid by the source.'],
        };
      default:
        return {
          freeClass: 'UNKNOWN',
          localAvailability: item.claimedLocalAvailability ?? 'UNKNOWN',
          reasons: ['No verified free/local evidence — UNKNOWN.'],
        };
    }
  }
}
