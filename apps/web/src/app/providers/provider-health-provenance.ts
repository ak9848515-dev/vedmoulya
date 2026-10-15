// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider health provenance (pure UI logic)
//
// The registry health record (`status` / `healthScore` / `latencyMs`) is CATALOG
// data by default: it is derived from public provider documentation, it is never
// refreshed by a runtime request, and the catalog even stamps `lastCheckedAt`
// with its own build time. Rendering that record as a live check — a green
// "healthy" dot, "97% health", or "Last checked <build time>" — presents a
// provider that was never verified as if it had just been verified.
//
// This module is the single place that decides what a health record may be
// called, based on its provenance (`ProviderHealthSource`, absent ⇒ 'SEED'):
//
//   SEED     → "Catalog estimate" — labelled as an estimate, with NO check time
//              and no status word that could read as a live check.
//   MEASURED → the record was written by a runtime health sample, so the status,
//              the score and the check time may be shown as measured.
//
// Pure + exported so the rule is testable without mounting a screen.
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderHealthSource = 'SEED' | 'MEASURED';

export interface ProviderHealthRecord {
  /** Canonical `@vedmoulya/ai` status vocabulary (e.g. 'healthy'). */
  status: string;
  /** Composite health score (0..1) as stored by the registry. */
  healthScore: number;
  /** Measured/estimated latency in ms. */
  latencyMs: number;
  /** Provenance of the record (absent ⇒ 'SEED'). */
  healthSource?: ProviderHealthSource;
  /** Registry timestamp — the catalog's build time for a SEED record. */
  lastCheckedAt?: string | null;
}

export interface ProviderHealthDisplay {
  /** True only when a runtime sample wrote this record. */
  measured: boolean;
  /** The status word to render (a SEED record is never rendered bare). */
  statusLabel: string;
  /** Sentence explaining where the record came from — always rendered. */
  provenanceLabel: string;
  /**
   * The labelled catalog estimate line, or null for a measured record. It is
   * shown SEPARATELY so the estimate can never be read as a measured value.
   */
  estimateLabel: string | null;
  /**
   * The check time, or null. A SEED record has NO check time: the catalog
   * timestamp is a build time, not evidence that anything was checked.
   */
  lastCheckedLabel: string | null;
}

/** Human latency label used for the estimate line. */
function latencyLabel(latencyMs: number): string {
  return `${Math.round(latencyMs)} ms`;
}

/**
 * Decide how a health record may be presented. The result is exhaustive: every
 * reader renders `provenanceLabel`, and a SEED record can never reach the
 * measured branch (absent provenance is SEED — unproven, not "probably fine").
 */
export function providerHealthDisplay(health: ProviderHealthRecord): ProviderHealthDisplay {
  const score = `${Math.round(health.healthScore * 100)}% health`;
  if (health.healthSource === 'MEASURED') {
    return {
      measured: true,
      statusLabel: health.status,
      // Precise wording: a runtime sample WAS recorded (that is the promotion
      // rule) — never a claim that a health probe of the model itself ran.
      provenanceLabel:
        typeof health.lastCheckedAt === 'string' && health.lastCheckedAt.length > 0
          ? `Measured at runtime — a runtime sample was recorded ${health.lastCheckedAt}.`
          : 'Measured at runtime from a recorded sample.',
      estimateLabel: null,
      lastCheckedLabel:
        typeof health.lastCheckedAt === 'string' && health.lastCheckedAt.length > 0
          ? health.lastCheckedAt
          : null,
    };
  }
  return {
    measured: false,
    statusLabel: `Catalog estimate — ${health.status}`,
    provenanceLabel:
      'Catalog record — not a live check. This deployment has never run a health check for this provider.',
    estimateLabel: `Registry estimate: ${health.status} · ${score} · ${latencyLabel(health.latencyMs)}`,
    lastCheckedLabel: null,
  };
}
