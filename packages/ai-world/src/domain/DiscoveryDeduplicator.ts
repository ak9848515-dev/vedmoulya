// ──────────────────────────────────────────────────────────────────
// VedMoulya — DiscoveryDeduplicator
// EPIC-012C — no duplicate discovery
//
// A newly normalized item is a duplicate when its stable id (source +
// url/title hash) already exists in the retained store, or when an
// existing item has the same canonical URL. Duplicates are skipped,
// never overwritten.
// ──────────────────────────────────────────────────────────────────

import type { DiscoveryItem } from '../types/discovery-types.js';

export interface DedupResult {
  isDuplicate: boolean;
  matchId?: string;
}

export class DiscoveryDeduplicator {
  dedupe(item: DiscoveryItem, existing: DiscoveryItem[]): DedupResult {
    const byId = existing.find((e) => e.id === item.id);
    if (byId) return { isDuplicate: true, matchId: byId.id };

    if (item.sourceUrl) {
      const byUrl = existing.find((e) => e.sourceUrl === item.sourceUrl);
      if (byUrl) return { isDuplicate: true, matchId: byUrl.id };
    }
    return { isDuplicate: false };
  }
}
