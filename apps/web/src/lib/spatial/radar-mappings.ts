// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Spatial Intelligence: Radar mapping (SPRINT-043D)
// PURE PRESENTATION MAPPING ONLY. Consumes authoritative read-model fields and
// maps them to spatial visual props. NO business logic, NO invented state, NO
// fabricated relationships or evidence. Values are derived ONLY from fields the
// backend already records (stopReason / nextAction / hasVerifiedPayment /
// evidenceCount / opportunityScore). Keep these functions deterministic so the
// 2D/SVG + (future) 3D layers, tests, reduced-motion and a11y fallbacks agree.
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal normalized radar entry consumed by the spatial layer. Subset of the
 *  authoritative `OpportunityRadarRow` fields. Do not add fields the backend
 *  does not provide. */
export interface RadarSpatialEntry {
  problemId: string;
  problemStatement: string;
  /** Authoritative advisory opportunity score (0..1), if present. */
  opportunityScore?: number;
  /** Number of evidence records actually recorded. */
  evidenceCount: number;
  /** True ONLY when the backend recorded a verified payment. */
  hasVerifiedPayment: boolean;
  /** Authoritative revenue validation state label. */
  revenueState: string;
  /** Authoritative next-best-action label (may be 'STOP'). */
  nextAction: string;
  /** Authoritative stop reason, when the system recommends STOP. */
  stopReason?: string;
}

/** Honest visual state categories derived straight from authoritative fields.
 *  Never conflates hypothesis with verified reality. */
export type RadarCategory =
  | 'STOP' // system recommends STOP (authoritative) — danger
  | 'VERIFIED' // verified payment recorded (authoritative) — gold/teal signal
  | 'OBSERVED' // at least one real evidence record exists (not verified)
  | 'UNKNOWN'; // no evidence recorded yet (authoritative absence)

export function categorizeRadarEntry(e: RadarSpatialEntry): RadarCategory {
  if (e.nextAction === 'STOP' || e.stopReason) return 'STOP';
  if (e.hasVerifiedPayment) return 'VERIFIED';
  if (e.evidenceCount > 0) return 'OBSERVED';
  return 'UNKNOWN';
}

/** Deterministic stable angle (degrees) from the problemId — presentation
 *  layout only, never a data relationship. */
export function radarAngleDeg(problemId: string): number {
  let h = 0;
  for (let i = 0; i < problemId.length; i += 1) {
    h = (h * 31 + problemId.charCodeAt(i)) >>> 0;
  }
  return (h % 3600) / 10; // 0..360
}

/** Radial band (0..1 position toward the rim) by category — keeps STOP and
 *  verified near the center as "closer to decision", unknowns toward the rim. */
export function radarRadius(e: RadarSpatialEntry): number {
  switch (categorizeRadarEntry(e)) {
    case 'VERIFIED':
      return 0.25;
    case 'STOP':
      return 0.3;
    case 'OBSERVED':
      return 0.55;
    case 'UNKNOWN':
      return 0.8;
  }
}

/** Node diameter (px) from the authoritative score (linear 0..1 → 10..26px,
 *  clamped; honest, not an invented scale). */
export function radarSizePx(e: RadarSpatialEntry): number {
  const s = Math.min(1, Math.max(0, e.opportunityScore ?? 0));
  return 10 + s * 16;
}

/** Opacity encodes evidence PRESENCE only: no evidence → faint (0.5);
 *  evidence exists → full (1). */
export function radarOpacity(e: RadarSpatialEntry): number {
  return e.evidenceCount > 0 ? 1 : 0.5;
}

/** Evidence label — always honest, never overstated. */
export function radarEvidenceLabel(e: RadarSpatialEntry): string {
  if (e.hasVerifiedPayment) return 'verified payment';
  if (e.evidenceCount > 0)
    return `${e.evidenceCount} evidence record${e.evidenceCount === 1 ? '' : 's'}`;
  return 'no evidence yet';
}

/** Deterministic sort: STOP first (attention), then verified, then observed,
 *  then unknown — advisory presentation ordering, not a business decision. */
export function radarSortEntries(entries: RadarSpatialEntry[]): RadarSpatialEntry[] {
  const rank: Record<RadarCategory, number> = {
    STOP: 0,
    VERIFIED: 1,
    OBSERVED: 2,
    UNKNOWN: 3,
  };
  return [...entries].sort((a, b) => rank[categorizeRadarEntry(a)] - rank[categorizeRadarEntry(b)]);
}

/** Color mapping (aligned to 043B Constitutional tokens; used as SVG fill/
 *  stroke alongside a textual label — never color alone). */
export function radarColor(e: RadarSpatialEntry): { fill: string; stroke: string; label: string } {
  const c = categorizeRadarEntry(e);
  switch (c) {
    case 'STOP':
      return { fill: '#FEE2E2', stroke: '#EF4444', label: 'STOP recommended' };
    case 'VERIFIED':
      return { fill: '#F0FDF4', stroke: '#C89B3C', label: 'verified payment' };
    case 'OBSERVED':
      return { fill: '#F0FDFA', stroke: '#0EA5A9', label: 'evidence observed' };
    case 'UNKNOWN':
      return { fill: '#F8FAFC', stroke: '#94A3B8', label: 'no evidence yet' };
  }
}

// ── Digital Twin (SPRINT-043D) ──────────────────────────────────────────────
// The Digital Twin represents "how VedMoulya currently understands the
// operating state". It must NEVER fabricate a state: any dimension that is not
// actually recorded is UNKNOWN (never 0-as-a-score).

export interface TwinDimension {
  key: string;
  label: string;
  /** Null when the backend has no recorded value for this dimension. */
  value: number | null;
  /** Short honest label for the current value. */
  note?: string;
}

export type TwinStatus = 'FORMING' | 'KNOWN' | 'PARTIAL';

export function twinStatus(dimensions: TwinDimension[]): TwinStatus {
  const known = dimensions.filter((d) => d.value !== null && d.value > 0).length;
  if (known === 0) return 'FORMING';
  if (known === dimensions.length) return 'KNOWN';
  return 'PARTIAL';
}

/** UNKNOWN is a first-class state: missing data is never rendered as a 0 score. */
export function twinValueLabel(d: TwinDimension): string {
  if (d.value === null) return 'not yet known';
  if (d.value === 0) return d.note ?? 'no items yet';
  return `${d.value}${d.note ? ` · ${d.note}` : ''}`;
}
