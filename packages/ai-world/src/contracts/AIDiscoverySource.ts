// ──────────────────────────────────────────────────────────────────
// VedMoulya — AIDiscoverySource port
// EPIC-012C — AI World Discovery
//
// Pluggable discovery sources: provider announcements, official model
// catalogues, GitHub, model repositories, trusted technical sources,
// AI product sources, relevant news. The UI is never hardcoded to a
// particular website — sources are injected and can be added/removed.
//
// Sources return RAW facts only. Every derived field (free class,
// recommendation, relevance, security flags, GitHub intelligence) is
// computed by the domain engines with provenance — a source can never
// assert a recommendation or a capability on VedMoulya's behalf.
// ──────────────────────────────────────────────────────────────────

import type { DiscoveryBudget, RawDiscoveryItem } from '../types/discovery-types.js';

export interface DiscoverySourceContext {
  /** Bounded budget for this run (sources must respect it). */
  budget: DiscoveryBudget;
  /** Clock injection for deterministic tests. */
  now: () => Date;
}

export interface AIDiscoverySource {
  /** Stable source id (also used as the item `source`). */
  readonly id: string;
  /** Human-readable source name. */
  readonly name: string;
  /**
   * Fetch raw items. MUST be bounded (respect source/API rate limits,
   * truncate to budget.maxItemsPerSource) and MUST fail softly: a source
   * throwing here is caught by the orchestrator and never fails the run.
   */
  discover(context: DiscoverySourceContext): Promise<{ items: RawDiscoveryItem[] }>;
}
