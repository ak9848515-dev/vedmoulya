// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Spatial Intelligence: Opportunity Radar (SPRINT-043D)
// PURE PRESENTATION component. Renders existing radar entries as a 2D/SVG
// "constellation". ALL state→visual mapping is delegated to
// `lib/spatial/radar-mappings.ts` (never duplicated here). No data fetching,
// no business logic, no engines, no WebGL. Honest: empty renders an intentional
// empty state; UNKNOWN is never shown as 0-score; STOP is never styled as a
// success. The List view (toggle in Command Center) is the a11y/dense fallback.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useMemo, useState } from 'react';
import { MousePointer } from 'lucide-react';
import type { RadarSpatialEntry, RadarCategory } from '../../lib/spatial/radar-mappings.js';
import {
  categorizeRadarEntry,
  radarAngleDeg,
  radarColor,
  radarEvidenceLabel,
  radarOpacity,
  radarRadius,
  radarSizePx,
  radarSortEntries,
} from '../../lib/spatial/radar-mappings.js';

export interface OpportunityRadarSpatialProps {
  entries: RadarSpatialEntry[];
  selectedProblemId?: string | null;
  onSelect?: (problemId: string) => void;
}

const WIDTH = 480;
const HEIGHT = 520;
const CENTER_X = 240;
const CENTER_Y = 210;
const RIM_RADIUS = 150;
const LEGEND_ORDER: RadarCategory[] = ['STOP', 'VERIFIED', 'OBSERVED', 'UNKNOWN'];

function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const a = ((angleDeg - 90) * Math.PI) / 180; // 0° = top
  return { x: CENTER_X + radius * Math.cos(a), y: CENTER_Y + radius * Math.sin(a) };
}

function scoreLabel(score: number | undefined): string {
  return score === undefined ? 'UNKNOWN' : `${Math.round(score * 100)}/100`;
}

function SelectedOpportunity({ entry }: { entry: RadarSpatialEntry }): React.JSX.Element {
  const category = categorizeRadarEntry(entry);
  const color = radarColor(entry);
  const score = entry.opportunityScore;
  return (
    <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-[12px]">
      <div className="truncate font-medium text-[#1F2937]">{entry.problemStatement}</div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-[#4B5563]">
        <div>
          <span className="text-[#94A3B8]">state</span> {category}
        </div>
        <div>
          <span className="text-[#94A3B8]">revenue</span> {entry.revenueState}
        </div>
        <div>
          <span className="text-[#94A3B8]">evidence</span> {radarEvidenceLabel(entry)}
        </div>
        <div>
          <span className="text-[#94A3B8]">importance</span> {scoreLabel(score)}
        </div>
        <div className="col-span-2">
          <span className="text-[#94A3B8]">next action</span> {entry.nextAction}
        </div>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded bg-[#E2E8F0]">
        <div
          className="h-full"
          style={{
            width: score === undefined ? '5%' : `${score * 100}%`,
            background: color.stroke,
          }}
        />
      </div>
    </div>
  );
}

export function OpportunityRadarSpatial({
  entries,
  selectedProblemId,
  onSelect,
}: OpportunityRadarSpatialProps): React.JSX.Element {
  const [selected, setSelected] = useState<string | null>(selectedProblemId ?? null);
  const sorted = useMemo(() => radarSortEntries(entries), [entries]);
  const nodes = useMemo(
    () =>
      sorted.map((entry) => {
        const angle = radarAngleDeg(entry.problemId);
        const band = polar(angle, radarRadius(entry) * RIM_RADIUS);
        return {
          entry,
          angle,
          x: band.x,
          y: band.y,
          sizePx: radarSizePx(entry),
          color: radarColor(entry),
          opacity: radarOpacity(entry),
          category: categorizeRadarEntry(entry),
          selected: selected === entry.problemId,
        };
      }),
    [sorted, selected],
  );

  const ariaLabel = (e: RadarSpatialEntry): string =>
    `${categorizeRadarEntry(e)} opportunity — ${e.problemStatement}. ` +
    `${radarEvidenceLabel(e)}. Next action: ${e.nextAction}. ` +
    `Importance ${scoreLabel(e.opportunityScore)}.`;

  // Honest empty state — never fabricated nodes (§9).
  if (nodes.length === 0) {
    return (
      <div className="py-6 text-center" data-testid="radar-empty">
        <MousePointer className="mx-auto h-8 w-8 text-[#94A3B8]" aria-hidden="true" />
        <p className="mt-2 text-[14px] font-medium text-[#374151]">
          Your opportunity field is forming.
        </p>
        <p className="mt-1 max-w-sm px-4 text-[12px] text-[#94A3B8]">
          Opportunities appear here as VedMoulya learns from your evidence. Record observations,
          capture customer signals, and verify payments — each real signal raises confidence. Your
          decisions remain authoritative.
        </p>
      </div>
    );
  }

  // Legend chips (only categories actually present — never invented ones).
  const legendReps = LEGEND_ORDER.map((cat) => nodes.find((n) => n.category === cat)).filter(
    (n): n is (typeof nodes)[0] => n !== undefined,
  );

  // Selected detail only when the selection still exists in the dataset — never
  // a fabricated fallback to an unrelated node (§8).
  const selectedNode = selected ? nodes.find((n) => n.entry.problemId === selected) : undefined;

  return (
    <div className="relative" data-testid="radar-spatial">
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Opportunity radar — spatial view of verified, observed and proposed opportunities"
      >
        <title>Opportunity Radar</title>
        <desc>
          A constellation of your opportunities. Node size reflects the advisory opportunity score;
          color encodes the evidence state; position is a deterministic layout of each problem.
        </desc>

        {/* Subtle layout grid (presentation only — not data). */}
        {[0.25, 0.3, 0.55, 0.8].map((b) => (
          <circle
            key={b}
            cx={CENTER_X}
            cy={CENTER_Y}
            r={b * RIM_RADIUS}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={0.5}
            aria-hidden="true"
          />
        ))}

        {/* Center hub: total count. */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={32}
          fill="#FFFFFF"
          stroke="#CBD5E1"
          strokeWidth={1}
        />
        <text
          x={CENTER_X}
          y={CENTER_Y - 4}
          textAnchor="middle"
          dominantBaseline="central"
          className="text-[10px] font-medium fill-[#64748B]"
          aria-hidden="true"
        >
          {nodes.length} OPPORTUNITIES
        </text>
        <text
          x={CENTER_X}
          y={CENTER_Y + 11}
          textAnchor="middle"
          dominantBaseline="central"
          className="text-[8px] fill-[#94A3B8]"
          aria-hidden="true"
        >
          verified = gold · evidence = teal · STOP = red
        </text>

        {nodes.map((n) => {
          const r = n.sizePx / 2;
          const hitR = Math.max(14, r + 8); // compliant touch target (§18)
          return (
            <g key={n.entry.problemId}>
              {/* Verified-payment halo: gold ring (important achievement, §6). */}
              {n.category === 'VERIFIED' && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r + 10}
                  fill="#F0FDF4"
                  stroke={n.color.stroke}
                  strokeWidth={1.5}
                  opacity={0.6}
                />
              )}
              {/* Selected halo. */}
              {n.selected && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={hitR}
                  fill="#F5F3FF"
                  stroke="#7C3AED"
                  strokeWidth={2}
                />
              )}
              {/* STOP signal: red ring — never styled as success (§11). */}
              {n.category === 'STOP' && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={hitR}
                  fill="#FEF2F2"
                  stroke="#EF4444"
                  strokeWidth={2.5}
                  strokeDasharray="4 3"
                />
              )}
              {/* Visible node. */}
              <circle
                cx={n.x}
                cy={n.y}
                r={r}
                fill={n.color.fill}
                stroke={n.color.stroke}
                strokeWidth={n.category === 'VERIFIED' ? 2.5 : 1.5}
                opacity={n.opacity}
                strokeDasharray={n.category === 'UNKNOWN' ? '3 2' : undefined}
                className="transition-all duration-200"
              />
              {n.category === 'STOP' && (
                <text
                  x={n.x}
                  y={n.y + 2.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-[#EF4444] text-[7px] font-bold"
                  aria-hidden="true"
                >
                  ✕
                </text>
              )}
              {/* Transparent padded hit area: focus + touch + keyboard. MUST be
                  painted LAST so it sits on top for pointer events — a hit
                  circle painted before the visible dot lets the dot intercept
                  clicks and the node becomes unclickable (found by real-browser
                  verification, SPRINT-043E). Visually invisible; catches every
                  click in the compliant touch target (§18). */}
              <circle
                cx={n.x}
                cy={n.y}
                r={hitR}
                fill="transparent"
                stroke="none"
                tabIndex={0}
                role="button"
                aria-label={ariaLabel(n.entry)}
                aria-selected={n.selected}
                data-testid={`radar-node-${n.entry.problemId}`}
                onClick={() => {
                  setSelected(n.entry.problemId);
                  onSelect?.(n.entry.problemId);
                }}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    setSelected(n.entry.problemId);
                    onSelect?.(n.entry.problemId);
                  }
                }}
                className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
              />
            </g>
          );
        })}
      </svg>

      {/* Legend (semantic list; non-color state via chip + label). */}
      <ul className="mt-3 flex flex-wrap gap-2 text-[12px]">
        {legendReps.map((n) => {
          const c = n.color;
          return (
            <li key={n.category} className="flex items-center gap-1.5 text-[#4B5563]">
              <span
                className="block h-2.5 w-2.5 rounded-full"
                style={{ background: c.fill, borderColor: c.stroke }}
              />
              <span className="capitalize">{n.category.toLowerCase()}</span>
            </li>
          );
        })}
        <li className="flex items-center gap-1.5 text-[#4B5563]">
          <span className="block h-2.5 w-2.5 rounded-full border-2 border-[#7C3AED]" /> selected
        </li>
      </ul>

      {/* Selected detail — only authoritative fields (§8). */}
      {selectedNode && <SelectedOpportunity entry={selectedNode.entry} />}
    </div>
  );
}
