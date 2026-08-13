// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Intelligence Store (Port)
// EPIC-012B — AI Provider Intelligence & Model Discovery
//
// Cached intelligence: the UI must never re-derive provider profiles or
// re-query provider metadata on every render. The store persists the
// latest refresh result per providerId with its verification timestamp so
// callers can serve cached intelligence and refresh only when stale.
//
// The registry is a platform catalog (not user-scoped) — intelligence is
// keyed by providerId, NOT by userId, so there is no cross-user read
// surface to leak (owner isolation is structural). Credentials never
// travel through intelligence records by design.
// ──────────────────────────────────────────────────────────────────

import type { ProviderIntelligenceRefreshResult } from '../../types/intelligence-types.js';

/** A cached refresh result, keyed by providerId. */
export interface ProviderIntelligenceRecord extends ProviderIntelligenceRefreshResult {
  /** When the record was written to the store. */
  cachedAt: string;
}

export interface ProviderIntelligenceStore {
  /** Load the cached intelligence for one provider; null when never cached. */
  get(providerId: string): Promise<ProviderIntelligenceRecord | null>;
  /** Persist a refresh result (create or replace). */
  save(record: ProviderIntelligenceRecord): Promise<void>;
  /** Remove one provider's cached intelligence (e.g. provider deleted). */
  delete(providerId: string): Promise<void>;
  /** List all cached records (for fleet staleness sweeps). */
  list(): Promise<ProviderIntelligenceRecord[]>;
}
