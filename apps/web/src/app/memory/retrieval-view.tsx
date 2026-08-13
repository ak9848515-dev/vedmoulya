// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Center: Retrieval Console
// EPIC-004 / EI-010 — Enterprise Memory Intelligence Platform
// Query the memory layer by keyword, goal, project, user, capability,
// provider, context, importance band or time window. Every result shows its
// match type, composite relevance score and matched fields — exactly how the
// Enterprise Brain and Execution Orchestrator would retrieve it.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Loading, EmptyState, Button, TextField, Select } from '@vedmoulya/ui';
import { useMemoryRetrieve } from '../../lib/api-client.js';
import { Search, SlidersHorizontal } from 'lucide-react';
import { MemoryCard } from './components.js';

const IMPORTANCE_OPTIONS = [
  { value: '', label: 'Any importance' },
  { value: '0.8', label: '≥ 0.80 (critical)' },
  { value: '0.6', label: '≥ 0.60 (high)' },
  { value: '0.4', label: '≥ 0.40 (medium)' },
  { value: '0.2', label: '≥ 0.20 (low)' },
];

export function RetrievalView({ userId }: { userId: string }): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [relatedGoal, setRelatedGoal] = useState('');
  const [relatedProject, setRelatedProject] = useState('');
  const [relatedCapability, setRelatedCapability] = useState('');
  const [relatedProvider, setRelatedProvider] = useState('');
  const [relatedContext, setRelatedContext] = useState('');
  const [minImportance, setMinImportance] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [applied, setApplied] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading, isError, refetch } = useMemoryRetrieve(userId, applied ?? {});

  const runQuery = (): void => {
    setApplied({
      query: query.trim() || undefined,
      relatedGoal: relatedGoal.trim() || undefined,
      relatedProject: relatedProject.trim() || undefined,
      relatedCapability: relatedCapability.trim() || undefined,
      relatedProvider: relatedProvider.trim() || undefined,
      relatedContext: relatedContext.trim() || undefined,
      minImportance: minImportance ? Number(minImportance) : undefined,
      includeInactive: includeInactive || undefined,
      limit: 25,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-[#2B5FD9]" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Retrieval Console
          </h3>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Retrieve by goal, project, user, capability, provider, context, time, importance,
          similarity, business module or keyword — ranked by composite relevance.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextField
            label="Query"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder="Free-text keyword retrieval…"
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Related goal"
              value={relatedGoal}
              onChange={(e) => {
                setRelatedGoal(e.target.value);
              }}
              placeholder="goal ID"
            />
            <TextField
              label="Related project"
              value={relatedProject}
              onChange={(e) => {
                setRelatedProject(e.target.value);
              }}
              placeholder="project ID"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <TextField
              label="Capability"
              value={relatedCapability}
              onChange={(e) => {
                setRelatedCapability(e.target.value);
              }}
              placeholder="capability ID"
            />
            <TextField
              label="Provider"
              value={relatedProvider}
              onChange={(e) => {
                setRelatedProvider(e.target.value);
              }}
              placeholder="provider ID"
            />
            <TextField
              label="Context"
              value={relatedContext}
              onChange={(e) => {
                setRelatedContext(e.target.value);
              }}
              placeholder="context ID"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={minImportance}
              onChange={(e) => {
                setMinImportance(e.target.value);
              }}
              placeholder="Any importance"
              options={IMPORTANCE_OPTIONS}
            />
            <label className="flex items-center gap-2 pt-5 text-xs text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => {
                  setIncludeInactive(e.target.checked);
                }}
                className="h-4 w-4 rounded border-slate-300"
              />
              Include archived/expired
            </label>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={runQuery} className="gap-1.5">
            <SlidersHorizontal className="h-4 w-4" />
            Retrieve
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {!applied && (
          <EmptyState
            icon={<Search className="h-10 w-10" />}
            title="Run a retrieval"
            description="Set filters above and press Retrieve. Results show their match type and composite relevance score."
          />
        )}

        {applied && isLoading && (
          <div className="flex items-center justify-center h-[30vh]">
            <Loading label="Retrieving memories…" size="lg" />
          </div>
        )}

        {applied && isError && (
          <EmptyState
            icon={<Search className="h-10 w-10" />}
            title="Retrieval failed"
            description="The memory layer could not answer this query."
            action={{ label: 'Retry', onClick: () => void refetch() }}
          />
        )}

        {applied && !isLoading && !isError && (data ?? []).length === 0 && (
          <EmptyState
            icon={<Search className="h-10 w-10" />}
            title="No memories matched"
            description="Widen the query or remove some filters and try again."
          />
        )}

        {applied &&
          !isLoading &&
          !isError &&
          (data ?? []).map((result) => (
            <div key={result.memory.memoryId}>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px]">
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold text-white ${
                    result.matchType === 'goal' ||
                    result.matchType === 'project' ||
                    result.matchType === 'user'
                      ? 'bg-[#2B5FD9]'
                      : result.matchType === 'similarity'
                        ? 'bg-[#8B5CF6]'
                        : result.matchType === 'time'
                          ? 'bg-[#0D9488]'
                          : result.matchType === 'importance'
                            ? 'bg-[#F59E0B]'
                            : 'bg-[#06B6D4]'
                  }`}
                >
                  {result.matchType.replace('_', ' ')}
                </span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {(result.score * 100).toFixed(0)}% relevant
                </span>
                <span className="text-slate-400">
                  matched: {result.matchedFields.join(', ') || 'content'}
                </span>
              </div>
              <MemoryCard item={result.memory} />
              {result.snippet && (
                <p className="mt-1 rounded-b-lg border border-t-0 border-slate-200 px-3 py-2 text-[11px] italic text-slate-400 dark:border-slate-700">
                  {result.snippet}
                </p>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
