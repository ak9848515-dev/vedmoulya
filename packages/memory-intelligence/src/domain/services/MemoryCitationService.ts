// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Citation Service
// EI-010 — Enterprise Memory Intelligence Platform
// Attaches evidence to memories. A memory citation points back at the
// knowledge item (EI-009), provider registry entry, execution session,
// or event that produced the experience — the memory/knowledge
// integration seam. Citations are verified when the referenced source
// type is intrinsic-reliable or when the caller marks them verified.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   the only indexed accesses are typed Record lookups keyed by the closed
   MemorySourceType union (MEMORY_SOURCE_RELIABILITY[sourceType]) — no runtime
   attacker-controlled keys. */

import type { MemoryCitation, MemoryItem } from '../../types/memory-types.js';
import { MEMORY_SOURCE_RELIABILITY } from '../../types/memory-types.js';

export interface CitationInput {
  sourceId: string;
  sourceTitle: string;
  reference: string;
  sourceType?: MemoryItem['sourceType'];
  verified?: boolean;
}

export class MemoryCitationService {
  /** Verify a list of citations against the source reliability table. */
  verify(citations: MemoryCitation[], sourceType: MemoryItem['sourceType']): MemoryCitation[] {
    const reliability = MEMORY_SOURCE_RELIABILITY[sourceType];
    return citations.map((citation) => ({
      ...citation,
      // A citation is trusted when it is marked verified OR its source
      // type is intrinsic-reliable (system/business/execution/observation).
      verified: citation.verified || reliability >= 0.85,
    }));
  }

  /** Build a verified citation pointing at a knowledge/registry entity. */
  cite(input: CitationInput, now = new Date().toISOString()): MemoryCitation {
    const sourceType = input.sourceType ?? 'system';
    return {
      citationId: `mcit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      sourceId: input.sourceId,
      sourceTitle: input.sourceTitle,
      sourceType,
      reference: input.reference,
      retrievedAt: now,
      verified: input.verified ?? MEMORY_SOURCE_RELIABILITY[sourceType] >= 0.85,
    };
  }
}
