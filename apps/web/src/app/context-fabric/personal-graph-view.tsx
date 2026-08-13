// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Personal Graph view
// APP-001 — Post-V1 Application Platform Layer
// The first-class personal relationship model: user — goals, projects,
// tasks, skills, knowledge, memories, documents, applications, preferences,
// work history, learning history and AI interaction history.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- false-positive on the
   closed-set entity lookups in this view (same pattern as memory/os views). */

'use client';

import React, { useMemo, useState } from 'react';
import { Loading, EmptyState, Badge } from '@vedmoulya/ui';
import { useContextFabricPersonalGraph } from '../../lib/api-client.js';
import { User, Boxes } from 'lucide-react';
import { EntityCard, RelationshipRow } from './components.js';
import { ENTITY_LABELS, pct } from './fabric-ui.js';

export function PersonalGraphView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useContextFabricPersonalGraph(userId);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const entities = useMemo(() => {
    if (!data) return [];
    return typeFilter === 'all'
      ? data.entities
      : data.entities.filter((entity) => entity.type === typeFilter);
  }, [data, typeFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Building your personal graph…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<User className="h-10 w-10" />}
        title="Personal graph unavailable"
        description="The personal intelligence graph could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const types = Object.keys(data.stats.countByType).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-[#EEF2FF] text-[#2B5FD9] dark:bg-[#1E3A8A] dark:text-[#BFDBFE]">
          {data.entities.length} entities
        </Badge>
        <Badge className="bg-[#F5F3FF] text-[#7C3AED] dark:bg-[#4C1D95] dark:text-[#DDD6FE]">
          {data.relationships.length} relationships
        </Badge>
        <Badge className="bg-[#F0FDF4] text-[#166534] dark:bg-[#14532D] dark:text-[#BBF7D0]">
          avg confidence {pct(data.stats.avgConfidence)}
        </Badge>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button
            onClick={() => {
              setTypeFilter('all');
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              typeFilter === 'all'
                ? 'bg-[#2B5FD9] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            All
          </button>
          {types.map((type) => (
            <button
              key={type}
              onClick={() => {
                setTypeFilter(type);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === type
                  ? 'bg-[#2B5FD9] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {ENTITY_LABELS[type] ?? type}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Boxes className="h-4 w-4 text-[#2B5FD9]" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Entities ({entities.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {entities.map((entity) => (
              <EntityCard key={entity.entityId} entity={entity} />
            ))}
            {entities.length === 0 && (
              <p className="col-span-full text-sm text-slate-400">No entities in this category.</p>
            )}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-[#7C3AED]" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Relationships</h2>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {data.relationships.map((rel) => (
              <RelationshipRow key={rel.relationshipId} rel={rel} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
