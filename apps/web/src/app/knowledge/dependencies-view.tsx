// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Center: Dependencies view
// EPIC-004 / EI-009 — Enterprise Knowledge Intelligence Platform
// What depends on what. For a given knowledge item, this view lists its
// dependencies (depends_on / consumes / uses edges with criticality) and its
// consumers (engines, modules, users, systems). VedMoulya always knows what
// depends on its knowledge before anything changes.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Loading, EmptyState, TextField } from '@vedmoulya/ui';
import {
  useKnowledgeDependencies,
  useKnowledgeConsumers,
  useKnowledgeItems,
} from '../../lib/api-client.js';
import { GitBranch, Users, ShieldAlert, Search } from 'lucide-react';
import { ConsumerRow } from './components.js';

const CRITICALITY_COLORS: Record<string, string> = {
  high: 'bg-[#EF4444] text-white',
  medium: 'bg-[#F59E0B] text-white',
  low: 'bg-[#94A3B8] text-white',
};

export function DependenciesView({ userId }: { userId: string }): React.JSX.Element {
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');

  const items = useKnowledgeItems(userId, { limit: 100 });
  const deps = useKnowledgeDependencies(userId, selectedId || 'none');
  const consumers = useKnowledgeConsumers(userId, selectedId || 'none');

  const candidates = (items.data?.items ?? []).filter(
    (item) =>
      !search.trim() ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.knowledgeId.includes(search.trim()),
  );

  return (
    <div className="space-y-6">
      {/* ── Item picker ────────────────────────────────────────────────── */}
      <Card className="p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Search className="h-4 w-4 text-[#2B5FD9]" /> Pick a knowledge item
        </h3>
        <p className="text-xs text-slate-400">
          Everything below is derived from the item's graph edges and consumer registry.
        </p>
        <div className="mt-3">
          <TextField
            label="Filter items"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder="Search by title or ID…"
          />
        </div>
        {items.isLoading ? (
          <Loading label="Loading items…" />
        ) : (
          <div className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1">
            {candidates.slice(0, 30).map((item) => (
              <button
                key={item.knowledgeId}
                onClick={() => {
                  setSelectedId(item.knowledgeId);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                  selectedId === item.knowledgeId
                    ? 'bg-[#2B5FD9]/10 text-[#2B5FD9]'
                    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="truncate font-medium">{item.title}</span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-400">
                  {item.knowledgeId} · v{item.version}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* ── Dependency + consumer panels ───────────────────────────────── */}
      {selectedId && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-[#EF4444]" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Dependencies
              </h3>
              <Badge variant="danger" className="text-[10px]">
                {deps.data?.length ?? 0}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              What this knowledge depends on (derived from depends_on / consumes / uses edges).
            </p>
            {deps.isLoading ? (
              <Loading label="Resolving dependencies…" />
            ) : deps.data && deps.data.length > 0 ? (
              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {deps.data.map((dep) => (
                  <div key={dep.dependencyId} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CRITICALITY_COLORS[dep.criticality] ?? ''}`}
                    >
                      {dep.criticality}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                        {dep.targetTitle ?? dep.targetId}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {dep.type.replace('_', ' ')}
                        {dep.note ? ` · ${dep.note}` : ''}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">
                      {dep.targetId}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">No dependencies recorded.</p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#8B5CF6]" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Consumers
              </h3>
              <Badge variant="ai" className="text-[10px]">
                {consumers.data?.length ?? 0}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Who uses this knowledge — engines, modules, users, and systems.
            </p>
            {consumers.isLoading ? (
              <Loading label="Loading consumers…" />
            ) : consumers.data && consumers.data.length > 0 ? (
              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {consumers.data.map((consumer) => (
                  <ConsumerRow key={consumer.consumerId} consumer={consumer} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                No consumers yet — engines register usage as they retrieve this knowledge.
              </p>
            )}
          </Card>
        </div>
      )}

      {!selectedId && (
        <EmptyState
          icon={<ShieldAlert className="h-10 w-10" />}
          title="Select a knowledge item"
          description="VedMoulya must know what depends on its knowledge before anything changes."
        />
      )}
    </div>
  );
}
