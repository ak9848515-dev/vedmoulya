// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Learning Intelligence: Insights view
// EPIC-004 / EI-007 — Enterprise Learning Intelligence Platform
// Derived insights across all learning categories.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Loading, EmptyState } from '@vedmoulya/ui';
import { useLearningIntelligenceInsights } from '../../lib/api-client.js';
import { Lightbulb, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { CATEGORY_COLORS, SEVERITY_COLORS, formatDate } from './learning-ui.js';

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'warning', label: 'Warnings' },
  { id: 'info', label: 'Info' },
];

export function InsightsView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useLearningIntelligenceInsights(userId);
  const [filter, setFilter] = useState('');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Deriving learning insights…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<Lightbulb className="h-10 w-10" />}
        title="Insights unavailable"
        description="Learning insights could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const filtered = filter ? data.filter((i) => i.severity === filter) : data;
  const critical = data.filter((i) => i.severity === 'critical').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setFilter(f.id);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.id
                ? 'bg-[#2B5FD9] text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
        {critical > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-red-500">
            <ShieldAlert className="h-4 w-4" />
            {critical} critical
          </span>
        )}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={<Info className="h-10 w-10" />}
          title="No insights here"
          description={
            filter
              ? 'No insights of this severity.'
              : 'Record more learning signals to surface insights.'
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((insight) => {
          const severityIcon =
            insight.severity === 'critical' ? (
              <ShieldAlert className="h-5 w-5" />
            ) : insight.severity === 'warning' ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Info className="h-5 w-5" />
            );
          return (
            <Card key={insight.insightId} className="p-4">
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${SEVERITY_COLORS[insight.severity] ?? 'bg-slate-400 text-white'}`}
                >
                  {severityIcon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {insight.title}
                    </h3>
                    <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[insight.category] ?? '#64748B' }}
                      />
                      {insight.category}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {insight.description}
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {insight.evidence.map((line) => (
                      <li key={line} className="text-[11px] text-slate-400">
                        · {line}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 text-[10px] text-slate-300 dark:text-slate-500">
                    {formatDate(insight.createdAt)}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
