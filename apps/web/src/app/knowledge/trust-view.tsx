// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Center: Trust view
// EPIC-004 / EI-009 — Enterprise Knowledge Intelligence Platform
// Whether knowledge is trusted — the trust distribution, the top trusted
// items, and the factors behind each score (source reliability, validation,
// lifecycle freshness, citation verification, and consumer feedback).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Loading, EmptyState } from '@vedmoulya/ui';
import { useKnowledgeDashboard } from '../../lib/api-client.js';
import { ShieldCheck, Gauge, BadgeCheck, FileCheck2 } from 'lucide-react';
import { TRUST_BAND_COLORS, FALLBACK_COLOR, formatPct } from './knowledge-ui.js';
import { KnowledgeCard } from './components.js';

export function TrustView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useKnowledgeDashboard(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Scoring trust…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-10 w-10" />}
        title="Trust dashboard unavailable"
        description="The trust scoring service could not be reached."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const maxBand = Math.max(1, ...data.trustDistribution.map((b) => b.count));

  return (
    <div className="space-y-6">
      {/* ── Score cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#22C55E]/10 text-[#22C55E]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xs text-slate-400">Average trust</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {formatPct(data.totals.avgTrust)}
            </div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2B5FD9]/10 text-[#2B5FD9]">
            <Gauge className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xs text-slate-400">Average confidence</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {formatPct(data.totals.avgConfidence)}
            </div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
            <BadgeCheck className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xs text-slate-400">Validated</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {data.totals.validated}
            </div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F59E0B]/10 text-[#F59E0B]">
            <FileCheck2 className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xs text-slate-400">Active items</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {data.totals.active}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Trust distribution ───────────────────────────────────────── */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Trust distribution
          </h3>
          <p className="text-xs text-slate-400">How much VedMoulya can rely on each band</p>
          <div className="mt-4 flex h-40 items-end gap-3">
            {data.trustDistribution.map((band) => {
              const color = TRUST_BAND_COLORS[band.band] ?? FALLBACK_COLOR;
              return (
                <div
                  key={band.band}
                  className="flex flex-1 flex-col items-center justify-end"
                  title={`${band.band}: ${band.count} items`}
                >
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max(4, (band.count / maxBand) * 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                  <span className="mt-1 text-[10px] text-slate-400">{band.band}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-[10px] text-slate-400 dark:border-slate-800">
            <p>
              · Trust = f(source reliability, validation, lifecycle freshness, citations, consumer
              feedback).
            </p>
            <p>· Low-trust items are surfaced for review, never silently relied upon.</p>
          </div>
        </Card>

        {/* ── Top trusted ──────────────────────────────────────────────── */}
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Top trusted knowledge
          </h3>
          <div className="space-y-3">
            {data.topTrusted.slice(0, 5).map((item) => (
              <div key={item.knowledgeId}>
                <KnowledgeCard item={item} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
