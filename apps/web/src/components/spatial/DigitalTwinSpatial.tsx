// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Spatial Intelligence: Digital Twin (SPRINT-043D)
// PURE PRESENTATION component. A 2D/SVG orbital model of the founder's current
// operating state. It is NOT a human avatar — the center is the operating
// identity; concentric rings represent state dimensions. ALL honesty rules are
// delegated to `lib/spatial/radar-mappings.ts` (twinStatus / twinValueLabel).
// Never fabricates a state: a dimension with no recorded value is UNKNOWN
// (rendered as a neutral, dashed ring — never a "0" score).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useMemo, useState } from 'react';
import { MousePointer } from 'lucide-react';
import type { TwinDimension } from '../../lib/spatial/radar-mappings.js';
import { twinStatus, twinValueLabel } from '../../lib/spatial/radar-mappings.js';

export interface DigitalTwinSpatialProps {
  /** Real dimensions only — each `value` is null when unrecorded (§13/14). */
  dimensions: TwinDimension[];
  selectedKey?: string | null;
  onSelect?: (dimension: TwinDimension) => void;
}

const WIDTH = 480;
const HEIGHT = 520;
const CTX = 240;
const CTY = 230;
const RIM = 180;

/** Ring layout, outer→inner: a single source of truth so the SVG never indexes
 *  parallel arrays (presentation layout only — not a data relationship). */
const RINGS = [
  { key: 'goals', label: 'GOALS', radius: 62 },
  { key: 'progress', label: 'PROGRESS', radius: 102 },
  { key: 'evidence', label: 'EVIDENCE', radius: 142 },
  { key: 'opportunities', label: 'OPPORTUNITIES', radius: 180 },
] as const;

/** Radius per dimension key (bounded; unknown keys fall back to the rim). */
const RING_RADIUS: Record<string, number> = {
  goals: 62,
  progress: 102,
  evidence: 142,
  opportunities: 180,
};

function polarT(angleDeg: number, radius: number): { x: number; y: number } {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CTX + radius * Math.cos(a), y: CTY + radius * Math.sin(a) };
}

/** Deterministic angle from a key (layout only — not a relationship). */
function angleOf(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return (h % 3600) / 10;
}

function ringColor(d: TwinDimension): string {
  if (d.value === null) return '#94A3B8'; // UNKNOWN — neutral, never a score (§10/14)
  if (d.value === 0) return '#64748B'; // known-zero
  return '#0EA5A9'; // known (intelligence teal)
}

export function DigitalTwinSpatial({
  dimensions,
  selectedKey,
  onSelect,
}: DigitalTwinSpatialProps): React.JSX.Element {
  // ALL hooks run unconditionally before any early return (rules-of-hooks):
  // the Command Center feeds dimensions that start empty (FORMING) and become
  // populated after data loads — the hook order must not change between renders.
  const status = useMemo(() => twinStatus(dimensions), [dimensions]);
  const nodes = useMemo(
    () =>
      dimensions.map((d) => {
        const radius = RING_RADIUS[d.key] ?? RIM;
        const ang = angleOf(`${d.key}:${radius}`);
        const p = polarT(ang, radius);
        return { d, x: p.x, y: p.y, color: ringColor(d) };
      }),
    [dimensions],
  );
  const [selected, setSelected] = useState<TwinDimension | null>(
    selectedKey ? (dimensions.find((d) => d.key === selectedKey) ?? null) : null,
  );

  // Honest forming state — never a fake populated twin (§14).
  if (dimensions.length === 0 || status === 'FORMING') {
    return (
      <div className="py-6 text-center" data-testid="twin-forming">
        <MousePointer className="mx-auto h-8 w-8 text-[#94A3B8]" aria-hidden="true" />
        <p className="mt-2 text-[14px] font-medium text-[#374151]">Your Digital Twin is forming.</p>
        <p className="mt-1 max-w-sm px-4 text-[12px] text-[#94A3B8]">
          VedMoulya builds your operating-state twin as real signals arrive. Each ring appears with
          honest, verifiable data — never an assumed score. Record goals, capture evidence and
          verify payments, and the twin reveals itself dimension by dimension.
        </p>
      </div>
    );
  }

  // After the FORMING early return, status is KNOWN or PARTIAL (the ternary
  // below cannot see FORMING).
  const statusClass =
    status === 'KNOWN' ? 'bg-[#F0FDF4] text-[#0EA5A9]' : 'bg-[#F5F3FF] text-[#7C3AED]';

  return (
    <div className="relative" data-testid="twin-spatial">
      <div className="mb-2 flex items-center justify-between text-[12px]">
        <span className="text-[#64748B]">Twin status</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[12px] font-medium ${statusClass}`}>
          {status}
        </span>
      </div>

      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Digital Twin — concentric operating-state rings around your identity"
      >
        <title>Digital Twin</title>
        <desc>
          Orbital model of your operating state. The center is your identity; each concentric ring
          is a state dimension. Teal dots are known dimensions, neutral dashed rings are unrecorded.
        </desc>

        {/* Concentric rings + labels (layout affordance, not data relationships). */}
        {RINGS.map((ring) => (
          <circle
            key={ring.key}
            cx={CTX}
            cy={CTY}
            r={ring.radius}
            fill="none"
            stroke="#E8EDF5"
            strokeWidth={1}
          />
        ))}
        {RINGS.map((ring) => {
          const p = polarT(0, ring.radius - 9);
          return (
            <text
              key={`${ring.key}-label`}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-[7px] fill-[#94A3B8]"
              aria-hidden="true"
            >
              {ring.label}
            </text>
          );
        })}

        {/* Center: IDENTITY (operating identity anchor, not an avatar). */}
        <circle cx={CTX} cy={CTY} r={18} fill="#F0FDF4" stroke="#0EA5A9" strokeWidth={2} />
        <text
          x={CTX}
          y={CTY + 3}
          textAnchor="middle"
          dominantBaseline="central"
          className="text-[8px] font-medium fill-[#0EA5A9]"
          aria-hidden="true"
        >
          IDENTITY
        </text>

        {/* Dimension nodes on their ring. */}
        {nodes.map((n) => {
          const ringLabel = RINGS.find((ring) => ring.key === n.d.key)?.label ?? 'IDENTITY';
          return (
            <g key={n.d.key}>
              <circle
                cx={n.x}
                cy={n.y}
                r={n.d.value === null ? 6 : 7}
                fill={n.color}
                stroke={n.color}
                strokeWidth={1.5}
                strokeDasharray={n.d.value === null ? '3 2' : undefined}
                opacity={n.d.value === null ? 0.6 : 1}
                role="button"
                tabIndex={0}
                aria-label={`${n.d.label} — ${twinValueLabel(n.d)} — ring ${ringLabel}`}
                aria-selected={selected === n.d}
                data-testid={`twin-node-${n.d.key}`}
                onClick={() => {
                  setSelected(n.d);
                  onSelect?.(n.d);
                }}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    setSelected(n.d);
                    onSelect?.(n.d);
                  }
                }}
                className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
              />
              <line
                x1={CTX}
                y1={CTY}
                x2={n.x}
                y2={n.y}
                stroke="#E2E8F0"
                strokeWidth={0.75}
                aria-hidden="true"
              />
            </g>
          );
        })}
      </svg>

      {/* Legend (semantic list; non-color state via label). */}
      <ul className="mt-3 flex flex-wrap gap-3 text-[12px]">
        <li className="flex items-center gap-1.5 text-[#4B5563]">
          <span className="block h-2.5 w-2.5 rounded-full bg-[#0EA5A9]" /> known
        </li>
        <li className="flex items-center gap-1.5 text-[#4B5563]">
          <span className="block h-2.5 w-2.5 rounded-full bg-[#94A3B8]" /> not yet known
        </li>
      </ul>

      {/* Selected dimension detail — honest value label (§15). */}
      {selected && (
        <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-[12px]">
          <div className="font-medium text-[#1F2937]">{selected.label}</div>
          <div className="mt-1 text-[12px] text-[#4B5563]">
            Value: <span className="text-[#1F2937]">{twinValueLabel(selected)}</span>
          </div>
          {selected.note && <div className="mt-1 text-[12px] text-[#64748B]">{selected.note}</div>}
        </div>
      )}
    </div>
  );
}
