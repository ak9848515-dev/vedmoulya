// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Center: Relationships & Memory Graph
// EPIC-004 / EI-010 — Enterprise Memory Intelligence Platform
// The Memory Graph — every memory edge (recalls, follows, supports,
// contradicts, supersedes, depends_on, similar_to, refines, produced_by)
// with BFS traversal from any seed memory.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Loading, EmptyState, Button, Select } from '@vedmoulya/ui';
import { useMemoryRelationships, useMemoryGraph, useMemoryItems } from '../../lib/api-client.js';
import { Share2, GitBranch } from 'lucide-react';
import type { MemoryRelationshipType } from '@vedmoulya/memory-intelligence';
import { RelationshipRow, MemoryCard } from './components.js';

const TYPE_OPTIONS = [
  'recalls',
  'follows',
  'precedes',
  'supports',
  'contradicts',
  'supersedes',
  'depends_on',
  'similar_to',
  'refines',
  'produced_by',
].map((value) => ({ value, label: value.replace('_', ' ') }));

export function RelationshipsView({ userId }: { userId: string }): React.JSX.Element {
  const [type, setType] = useState<MemoryRelationshipType | ''>('');
  const [seedId, setSeedId] = useState('');
  const [appliedSeed, setAppliedSeed] = useState('');

  const { data, isLoading, isError, refetch } = useMemoryRelationships(userId, type || undefined);
  const items = useMemoryItems(userId, { limit: 100 });
  const graph = useMemoryGraph(userId, appliedSeed || 'none', 3);
  const graphActive = appliedSeed !== '';

  const seedOptions = (items.data?.items ?? []).map((item) => ({
    value: item.memoryId,
    label: item.title.slice(0, 42),
  }));

  const runGraph = (): void => {
    setAppliedSeed(seedId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading memory graph…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<Share2 className="h-10 w-10" />}
        title="Memory graph unavailable"
        description="The memory relationships could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-[#7C3AED]" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Relationship Explorer
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Every edge between memories — filtered by relationship type.
          </p>
          <div className="mt-4">
            <Select
              value={type}
              onChange={(e) => {
                setType(e.target.value as MemoryRelationshipType | '');
              }}
              placeholder="All relationship types"
              options={[{ value: '', label: 'All relationship types' }, ...TYPE_OPTIONS]}
            />
          </div>
          <div className="mt-4 max-h-[46vh] space-y-2 overflow-y-auto pr-1">
            {data.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                No relationships yet — memories link as they consolidate and enrich.
              </p>
            ) : (
              data.map((r) => <RelationshipRow key={r.relationshipId} relationship={r} />)
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-[#06B6D4]" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Memory Graph Traversal
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            BFS traversal from a seed memory (max depth 3) — how the Brain walks related experience.
          </p>
          <div className="mt-4 flex gap-2">
            <Select
              value={seedId}
              onChange={(e) => {
                setSeedId(e.target.value);
              }}
              placeholder="Seed memory…"
              options={seedOptions}
              className="flex-1"
            />
            <Button onClick={runGraph} disabled={!seedId}>
              Traverse
            </Button>
          </div>

          {!graphActive && (
            <p className="py-10 text-center text-xs text-slate-400">
              Pick a seed memory to walk the graph.
            </p>
          )}
          {graphActive && graph.isLoading && (
            <div className="py-10 text-center">
              <Loading label="Traversing…" size="md" />
            </div>
          )}
          {graphActive && !graph.isLoading && graph.data && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-slate-400">
                Depth reached: {graph.data.depth} · {graph.data.visited.length} memories visited
              </p>
              {graph.data.visited.map((node) => (
                <div
                  key={node.memoryId}
                  className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
                  style={{ marginLeft: `${node.depth * 14}px` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#06B6D4] px-2 py-0.5 text-[10px] font-semibold text-white">
                      depth {node.depth}
                    </span>
                    <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                      {node.title}
                    </span>
                  </div>
                  {node.relationships.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {node.relationships.map((r) => (
                        <span
                          key={r.relationshipId}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                        >
                          {r.type.replace('_', ' ')} → {r.targetId.slice(0, 10)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {graph.data.visited.length === 1 && (
                <p className="text-xs text-slate-400">No connected memories from this seed.</p>
              )}
            </div>
          )}
        </Card>
      </div>

      {seedOptions.length > 0 && appliedSeed === '' && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Seed candidates
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(items.data?.items ?? []).slice(0, 6).map((item) => (
              <MemoryCard
                key={item.memoryId}
                item={item}
                onOpen={() => {
                  setSeedId(item.memoryId);
                  setAppliedSeed(item.memoryId);
                }}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
