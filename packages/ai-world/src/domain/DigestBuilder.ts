// ──────────────────────────────────────────────────────────────────
// VedMoulya — DigestBuilder
// EPIC-012C — concise daily/periodic AI World digest
//
// The digest is a short, scannable "AI WORLD — TODAY" list of the few
// items that matter most (by recommendation strength, then relevance).
// It deliberately avoids a long news feed.
// ──────────────────────────────────────────────────────────────────

import type {
  DiscoveryDigest,
  DiscoveryItem,
  RecommendationState,
} from '../types/discovery-types.js';

const STATE_ORDER: Record<RecommendationState, number> = {
  INTEGRATE: 0,
  CONFIGURE: 1,
  TRY: 2,
  REVIEW: 3,
  WATCH: 4,
  IGNORE: 5,
};

export interface DigestOptions {
  date?: string;
  maxEntries?: number;
}

export class DigestBuilder {
  build(items: DiscoveryItem[], options: DigestOptions = {}): DiscoveryDigest {
    const date = options.date ?? new Date().toISOString().slice(0, 10);
    const maxEntries = options.maxEntries ?? 5;

    const relevant = items
      .filter((item) => item.recommendation !== 'IGNORE' && item.securityFlags.length === 0)
      .sort((a, b) => {
        const stateDiff = STATE_ORDER[a.recommendation] - STATE_ORDER[b.recommendation];
        if (stateDiff !== 0) return stateDiff;
        return b.relevance - a.relevance;
      })
      .slice(0, maxEntries);

    const entries = relevant.map((item) => ({
      item,
      why: this.why(item),
    }));

    return {
      date,
      entries,
      summary: this.summary(entries.length),
    };
  }

  private why(item: DiscoveryItem): string {
    const state = item.recommendation.toLowerCase();
    const base = `Recommended: ${state}`;
    if (item.recommendation === 'CONFIGURE') return `${base} — can be configured in VedMoulya now.`;
    if (item.recommendation === 'TRY') return `${base} — worth a hands-on evaluation.`;
    if (item.recommendation === 'REVIEW') return `${base} — evaluate before acting.`;
    return `${base} — monitor.`;
  }

  private summary(count: number): string {
    if (count === 0) return 'Nothing new that matters today.';
    return `${count} important update${count === 1 ? '' : 's'} worth your attention.`;
  }
}
