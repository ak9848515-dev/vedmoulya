// ──────────────────────────────────────────────────────────────────
// VedMoulya — RelevanceScorer
// EPIC-012C — QUALITY and USEFULNESS over volume
//
// A viral AI product is not automatically useful to VedMoulya.
// Scoring considers: VedMoulya relevance, technical usefulness,
// quality, recency, evidence confidence, free availability, local
// usability, integration potential, adoption signals, strategic
// importance. Adoption (stars) is a minor factor — never popularity-
// only ranking.
// ──────────────────────────────────────────────────────────────────

import type { RawDiscoveryItem } from '../types/discovery-types.js';
import type { DiscoveryItem } from '../types/discovery-types.js';

export interface RelevanceScore {
  score: number; // 0..100
  label: 'high' | 'medium' | 'low';
  reasons: string[];
}

export interface ScoringContext {
  now: () => Date;
  /** Which capability families VedMoulya actually uses (integration).
   *  Optional — the scorer's own constructor default applies. */
  vedMoulyaCapabilities?: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** VedMoulya's integration-relevant capability vocabulary. */
const VEDMOULYA_CAPABILITIES = [
  'reasoning',
  'coding',
  'vision',
  'embeddings',
  'summarization',
  'classification',
  'translation',
  'speech',
  'image_understanding',
  'content_generation',
  'tool_use',
  'rag',
  'agents',
  'orchestration',
  'local_inference',
  'video',
  'image_generation',
  'browser_automation',
  'workflow',
  'evaluation',
  'observability',
];

export class RelevanceScorer {
  constructor(private readonly vedMoulyaCapabilities: string[] = VEDMOULYA_CAPABILITIES) {}

  score(item: RawDiscoveryItem, context: ScoringContext): RelevanceScore {
    const reasons: string[] = [];
    let score = 0;

    // 1. Relevance to VedMoulya (capability overlap) — heaviest factor.
    const capabilities = item.capabilities ?? [];
    const overlap = capabilities.filter((cap) =>
      this.vedMoulyaCapabilities.some(
        (known) => known === cap || known.includes(cap) || cap.includes(known),
      ),
    );
    const overlapRatio = capabilities.length === 0 ? 0.3 : overlap.length / capabilities.length;
    const relevancePoints = Math.round(overlapRatio * 30);
    score += relevancePoints;
    if (overlap.length > 0) {
      reasons.push(
        `Directly relevant to VedMoulya capabilities: ${overlap.slice(0, 3).join(', ')}.`,
      );
    } else if (capabilities.length === 0) {
      reasons.push('Capabilities unknown — relevance assumed moderate until evidence arrives.');
    }

    // 2. Technical usefulness (capability breadth).
    score += Math.min(10, capabilities.length * 2);
    if (capabilities.length >= 3) reasons.push('Broad capability set — potentially multi-purpose.');

    // 3. Evidence confidence — never reward fabricated certainty.
    const evidence = item.evidence ?? [];
    const verifiedCount = evidence.filter((e) => e.confidence === 'VERIFIED').length;
    const unknownEvidence = evidence.filter((e) => e.confidence === 'UNKNOWN').length;
    score += Math.min(10, verifiedCount * 3);
    score -= Math.min(10, unknownEvidence * 2);
    if (verifiedCount > 0) reasons.push(`${verifiedCount} verified evidence points.`);

    // 4. Recency (publishedAt / discoveredAt).
    const published = item.publishedAt ? Date.parse(item.publishedAt) : Date.now();
    const ageDays = Number.isFinite(published)
      ? Math.max(0, (context.now().getTime() - published) / DAY_MS)
      : 0;
    score += Math.max(0, 10 - Math.floor(ageDays / 30));
    if (ageDays <= 30) reasons.push('Recent — published within the last month.');

    // 5. Free availability (a useful free resource is more actionable).
    if (item.claimedFreeClass === 'FREE_API' || item.claimedFreeClass === 'FREE_WITH_QUOTA') {
      score += 6;
      reasons.push('Free availability improves actionability.');
    }

    // 6. Local usability.
    if (item.claimedLocalAvailability === 'yes') {
      score += 6;
      reasons.push('Runs locally — no external API dependency.');
    }

    // 7. Integration potential (github repos are inherently integrable).
    if (item.category === 'github') score += 5;
    if (item.category === 'provider' || item.category === 'model') score += 6;
    // Concrete integration: a suggested registry family means the provider/
    // model can be configured into the EXISTING provider experience today
    // (EPIC-012C §11 — discovery → configure). Evidence-driven, never assumed.
    if (item.modelFacts?.suggestedFamily) {
      score += 8;
      reasons.push('One-click configurable — links into the existing provider configuration.');
    }

    // 8. Adoption signals (stars) — small, never dominant.
    const stars = item.github?.stars ?? 0;
    score += Math.min(5, Math.floor(Math.log10(stars + 1)));

    // 9. Strategic importance (news about pricing/capabilities).
    if (item.category === 'news' && /pricing|free tier|deprecat|discontinu/i.test(item.summary)) {
      score += 8;
      reasons.push('Strategic — pricing/availability change affects provider economics.');
    }

    const clamped = Math.max(0, Math.min(100, score));
    const label: 'high' | 'medium' | 'low' =
      clamped >= 60 ? 'high' : clamped >= 35 ? 'medium' : 'low';
    if (reasons.length === 0) reasons.push('Limited signal — scored conservatively.');

    return { score: clamped, label, reasons: reasons.slice(0, 4) };
  }
}

/** Reuse the same engine on a normalized item (used at world-build time). */
export function relevanceFromItem(item: DiscoveryItem): RelevanceScore {
  return {
    score: item.relevance,
    label: item.relevanceLabel,
    reasons: item.relevanceReasons,
  };
}
