// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Preferences Store (Port)
// EPIC-012A — AI Provider Intelligence (Phases 5 / 13 / 14)
//
// Owner-scoped persistence for per-user provider preferences. Every
// record is keyed by the owning userId — the store is a flat key →
// record map with NO cross-user read surface (owner isolation is
// structural, not enforced by callers).
// ──────────────────────────────────────────────────────────────────

import type { ProviderPreferences } from '../../types/preferences-types.js';

export interface ProviderPreferencesStore {
  /** Load one user's preferences; null when the user never customized. */
  get(userId: string): Promise<ProviderPreferences | null>;
  /** Persist the user's preferences (create or replace). */
  save(preferences: ProviderPreferences): Promise<void>;
}
