// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Center: Importance Dashboard
// EPIC-004 / EI-010 — Enterprise Memory Intelligence Platform
// What matters most to future decisions — importance × confidence × recency.
// Every memory is scored on capture; this dashboard surfaces the high-value
// memory that should drive the next goal, provider or execution decision.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Loading, EmptyState, Select } from '@vedmoulya/ui';
import { useMemoryItems } from '../../lib/api-client.js';
import { Flame, Gauge, ShieldCheck, Timer } from 'lucide-react';
import type { MemoryType } from '@vedmoulya/memory-intelligence';
import { MemoryCard } from './components.js';

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  ...[
    'working',
    'session',
    'project',
    'business',
    'capability',
    'provider',
    'execution',
    'decision',
    'learning',
    'context',
    'user_preference',
    'failure',
    'success',
    'long_term',
  ].map((value) => ({ value, label: value.replace('_', ' ') })),
];

export function ImportanceView({ userId }: { userId: string }): React.JSX.Element {
  const [type, setType] = useState<MemoryType | ''>('');
  const { data, isLoading, isError, refetch } = useMemoryItems(userId, {
    type: type || undefined,
    minImportance: 0.6,
    limit: 40,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading importance scores…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<Flame className="h-10 w-10" />}
        title="Importance data unavailable"
        description="The memory importance scoring could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const items = [...data.items].sort(
    (a, b) => b.importance.score * b.confidence.score - a.importance.score * a.confidence.score,
  );
  const high = items.filter((i) => i.importance.score >= 0.8).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Importance Dashboard
          </h3>
          <p className="text-xs text-slate-400">
            High-importance memories (≥ 0.60) ranked by importance × confidence.
          </p>
        </div>
        <Select
          value={type}
          onChange={(e) => {
            setType(e.target.value as MemoryType | '');
          }}
          placeholder="All types"
          options={TYPE_OPTIONS}
          className="w-40"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={<Flame className="h-5 w-5" />}
          label="High importance (≥0.80)"
          value={String(high)}
          color="#EF4444"
        />
        <StatCard
          icon={<Gauge className="h-5 w-5" />}
          label="Shown (≥0.60)"
          value={String(items.length)}
          color="#F59E0B"
        />
        <StatCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Avg confidence"
          value={
            items.length
              ? `${Math.round((items.reduce((s, i) => s + i.confidence.score, 0) / items.length) * 100)}%`
              : '—'
          }
          color="#22C55E"
        />
        <StatCard
          icon={<Timer className="h-5 w-5" />}
          label="Avg recency"
          value={
            items.length
              ? `${Math.round((items.reduce((s, i) => s + i.usage.recency, 0) / items.length) * 100)}%`
              : '—'
          }
          color="#06B6D4"
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Flame className="h-10 w-10" />}
          title="No high-importance memory yet"
          description="Memories score above 0.60 importance as they are captured and reinforced."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <div key={item.memoryId}>
              <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-400">
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(item.importance.score * 100)}%`,
                      backgroundColor:
                        item.importance.score >= 0.8
                          ? '#22C55E'
                          : item.importance.score >= 0.6
                            ? '#F59E0B'
                            : '#EF4444',
                    }}
                  />
                </div>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {(item.importance.score * 100).toFixed(0)}% importance
                </span>
                <span className="ml-auto">
                  factors: {item.importance.factors.slice(0, 2).join(', ') || 'capture'}
                </span>
              </div>
              <MemoryCard item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}): React.JSX.Element {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{value}</div>
    </Card>
  );
}
