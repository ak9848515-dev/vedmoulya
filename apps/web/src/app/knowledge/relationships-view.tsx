// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Center: Relationship Explorer
// EPIC-004 / EI-009 — Enterprise Knowledge Intelligence Platform
// The Knowledge Graph — 10 edge types (parent, child, depends_on, related_to,
// implements, consumes, produces, supersedes, uses, owned_by). Filter edges
// by type, inspect one item's neighborhood (traversal), and trace the shortest
// path between two knowledge items.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Loading, EmptyState, Select, TextField, Button } from '@vedmoulya/ui';
import {
  useKnowledgeRelationships,
  useKnowledgeGraph,
  useKnowledgeShortestPath,
} from '../../lib/api-client.js';
import { Share2, GitBranch, MapPin } from 'lucide-react';
import type { KnowledgeRelationshipType } from '@vedmoulya/knowledge-intelligence';
import { RELATIONSHIP_COLORS } from './knowledge-ui.js';
import { RelationshipRow } from './components.js';

const RELATIONSHIP_OPTIONS = [
  { value: '', label: 'All relationship types' },
  ...[
    'parent',
    'child',
    'depends_on',
    'related_to',
    'implements',
    'consumes',
    'produces',
    'supersedes',
    'uses',
    'owned_by',
  ].map((value) => ({ value, label: value.replace('_', ' ') })),
];

export function RelationshipsView({ userId }: { userId: string }): React.JSX.Element {
  const [type, setType] = useState<KnowledgeRelationshipType | ''>('');
  const [rootId, setRootId] = useState('');
  const [rootSubmitted, setRootSubmitted] = useState('');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [pathPair, setPathPair] = useState<{ from: string; to: string } | null>(null);

  const { data, isLoading, isError, refetch } = useKnowledgeRelationships(
    userId,
    type || undefined,
  );
  const graph = useKnowledgeGraph(userId, rootSubmitted || 'none', 3);
  const path = useKnowledgeShortestPath(userId, pathPair?.from ?? 'none', pathPair?.to ?? 'none');

  const byType = new Map<string, number>();
  data?.forEach((rel) => {
    byType.set(rel.type, (byType.get(rel.type) ?? 0) + 1);
  });

  return (
    <div className="space-y-6">
      {/* ── Edge-type distribution ─────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Filter by relationship"
            options={RELATIONSHIP_OPTIONS}
            value={type}
            onChange={(e) => {
              setType(e.target.value as KnowledgeRelationshipType | '');
            }}
            className="w-56"
          />
          <Badge variant="info" className="text-[10px]">
            {data?.length ?? 0} edges
          </Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from(byType.entries()).map(([relType, count]) => (
            <button
              key={relType}
              onClick={() => {
                setType(relType as KnowledgeRelationshipType);
              }}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all ${
                type === relType ? 'ring-2 ring-[#2B5FD9]/60' : ''
              } ${RELATIONSHIP_COLORS[relType as keyof typeof RELATIONSHIP_COLORS] ?? 'bg-slate-200 text-slate-600'}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
              {relType.replace('_', ' ')} · {count}
            </button>
          ))}
          {data && data.length === 0 && (
            <p className="text-xs text-slate-400">No relationships match this filter.</p>
          )}
        </div>
      </Card>

      {/* ── Edge list ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-[30vh]">
          <Loading label="Traversing the knowledge graph…" size="lg" />
        </div>
      ) : isError || !data ? (
        <EmptyState
          icon={<Share2 className="h-10 w-10" />}
          title="Graph unavailable"
          description="The knowledge graph could not be reached."
          action={{ label: 'Retry', onClick: () => void refetch() }}
        />
      ) : (
        <Card className="divide-y divide-slate-100 p-2 dark:divide-slate-800">
          {data.map((rel) => (
            <RelationshipRow key={rel.relationshipId} relationship={rel} />
          ))}
        </Card>
      )}

      {/* ── Neighborhood traversal ─────────────────────────────────────── */}
      <Card className="p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <GitBranch className="h-4 w-4 text-[#7C3AED]" /> Neighborhood traversal
        </h3>
        <p className="text-xs text-slate-400">
          Explore the graph up to 3 hops from one knowledge item.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <TextField
            label="Root knowledge ID"
            value={rootId}
            onChange={(e) => {
              setRootId(e.target.value);
            }}
            placeholder="e.g. kno_0000000001"
            className="w-64"
          />
          <Button
            variant="secondary"
            onClick={() => {
              setRootSubmitted(rootId.trim());
            }}
          >
            Traverse
          </Button>
        </div>

        {rootSubmitted && graph.data && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <MapPin className="h-3.5 w-3.5" />
              {graph.data.visited.length} item{graph.data.visited.length === 1 ? '' : 's'} reachable
              in {graph.data.depth} hop{graph.data.depth === 1 ? '' : 's'}
            </div>
            {graph.data.visited.map((node) => (
              <div
                key={node.knowledgeId}
                className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
              >
                <span className="rounded-full bg-[#7C3AED] px-2 py-0.5 text-[10px] font-bold text-white">
                  depth {node.depth}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                  {node.title}
                </span>
                <span className="font-mono text-[10px] text-slate-400">{node.knowledgeId}</span>
              </div>
            ))}
          </div>
        )}
        {rootSubmitted && graph.isLoading && <Loading label="Traversing…" />}
      </Card>

      {/* ── Shortest path ──────────────────────────────────────────────── */}
      <Card className="p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <MapPin className="h-4 w-4 text-[#22C55E]" /> Shortest path
        </h3>
        <p className="text-xs text-slate-400">
          How does one piece of knowledge connect to another?
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <TextField
            label="From knowledge ID"
            value={fromId}
            onChange={(e) => {
              setFromId(e.target.value);
            }}
            placeholder="kno_…"
            className="w-56"
          />
          <TextField
            label="To knowledge ID"
            value={toId}
            onChange={(e) => {
              setToId(e.target.value);
            }}
            placeholder="kno_…"
            className="w-56"
          />
          <Button
            variant="secondary"
            disabled={!fromId.trim() || !toId.trim()}
            onClick={() => {
              setPathPair({ from: fromId.trim(), to: toId.trim() });
            }}
          >
            Trace path
          </Button>
        </div>

        {pathPair && path.data && path.data.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {path.data.map((id, index) => (
              <React.Fragment key={id}>
                {index > 0 && <span className="text-slate-300">→</span>}
                <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {id}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
        {pathPair && path.data && path.data.length === 0 && (
          <p className="mt-3 text-xs text-slate-400">No path connects these two items.</p>
        )}
        {pathPair && path.isLoading && <Loading label="Tracing path…" />}
      </Card>
    </div>
  );
}
