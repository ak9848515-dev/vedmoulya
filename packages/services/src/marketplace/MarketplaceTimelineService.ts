// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Timeline Service
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type { MarketplaceTimelineEntryDTO } from './MarketplaceDTO.js';

export class MarketplaceTimelineService {
  buildTimeline(
    entries: Array<{
      id: string;
      type: MarketplaceTimelineEntryDTO['type'];
      title: string;
      description: string;
      timestamp: string;
      importance: number;
      icon: string;
      assetId?: string;
    }>,
  ): MarketplaceTimelineEntryDTO[] {
    return entries.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  getRecentEntries(
    entries: MarketplaceTimelineEntryDTO[],
    days: number = 7,
  ): MarketplaceTimelineEntryDTO[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return entries.filter((e) => new Date(e.timestamp).getTime() > cutoff);
  }
}
