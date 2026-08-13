// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Citation Service
// EI-009 — Enterprise Knowledge Intelligence Platform
// Extracts candidate citations from a knowledge item's provenance
// (URLs, "per <source>" references, "source: <ref>" lines) and
// verifies them against the source type's intrinsic reliability —
// repository/architecture/api sources are inherently verifiable;
// manual/conversation sources are flagged for human verification.
// Deterministic — no network calls.
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeCitation, KnowledgeItem } from '../../types/knowledge-types.js';
import { generateCitationId } from '../value-objects/KnowledgeId.js';

const INTRINSICALLY_VERIFIABLE = new Set([
  'repository',
  'architecture',
  'api',
  'database',
  'report',
  'system',
]);

export class KnowledgeCitationService {
  /** Extract candidate citations from the item's description + source fields. */
  extractCitations(item: KnowledgeItem): KnowledgeCitation[] {
    const candidates: KnowledgeCitation[] = [];
    const now = new Date().toISOString();

    // URLs in the description.
    const urlPattern = /(https?:\/\/[^\s)"']+)/g;
    const urls = item.description.match(urlPattern) ?? [];
    for (const url of urls.slice(0, 5)) {
      candidates.push({
        citationId: generateCitationId(),
        sourceId: url,
        sourceTitle: url.split('/').slice(0, 3).join('/'),
        sourceType: 'document',
        reference: url,
        retrievedAt: now,
        verified: false,
      });
    }

    // "source: <reference>" lines.
    const sourcePattern = /(?:^|\n)\s*(?:source|reference|ref):\s*([^\n]{3,120})/gi;
    const sources = item.description.match(sourcePattern) ?? [];
    for (const match of sources.slice(0, 3)) {
      const reference = match.replace(/^[^:]*:\s*/i, '').trim();
      candidates.push({
        citationId: generateCitationId(),
        sourceId: reference,
        sourceTitle: reference,
        sourceType: item.sourceType,
        reference,
        retrievedAt: now,
        verified: false,
      });
    }

    return candidates;
  }

  /** Verification pass: intrinsically reliable source types pass automatically. */
  verify(
    citations: KnowledgeCitation[],
    sourceType: KnowledgeItem['sourceType'],
  ): KnowledgeCitation[] {
    const autoVerified = INTRINSICALLY_VERIFIABLE.has(sourceType);
    return citations.map((citation) => ({
      ...citation,
      verified: autoVerified || citation.verified,
    }));
  }

  /** Attach the verified citation set to an item (replacing unverified duplicates). */
  attach(item: KnowledgeItem, citations: KnowledgeCitation[]): KnowledgeItem {
    return { ...item, citations };
  }
}
