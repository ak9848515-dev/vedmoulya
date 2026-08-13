// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Context Package view
// APP-001 — Post-V1 Application Platform Layer
// Minimum Useful Context assembly: goal + task + user + permissions + query
// → a permission-safe, token-budgeted context package with provenance,
// explanations and estimated token cost — consumable by Agent Builder,
// Execution Strategy, Execution Orchestrator, Quality Engine and the future
// Application Factory.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Loading, EmptyState, Badge } from '@vedmoulya/ui';
import { useContextFabricPackage } from '../../lib/api-client.js';
import { Package, Loader2, Zap, ShieldCheck, ShieldX } from 'lucide-react';
import { ExplanationList, Kpi } from './components.js';
import { formatDate } from './fabric-ui.js';

const SUGGESTED_QUERIES = [
  {
    label: 'Publish enterprise insights',
    goalId: 'goal_blog_seed',
    query: 'publish enterprise AI insights to the blog',
  },
  {
    label: 'Master context engineering',
    goalId: 'goal_learning_seed',
    query: 'learn permission-aware context fabrics',
  },
];

export function PackageView({ userId }: { userId: string }): React.JSX.Element {
  const [goalId, setGoalId] = useState('goal_blog_seed');
  const [query, setQuery] = useState('publish enterprise AI insights to the blog');
  const [submitted, setSubmitted] = useState('');
  const { data, isLoading, isError, refetch } = useContextFabricPackage(userId, goalId, submitted);

  const build = (event: React.SyntheticEvent, overrideQuery?: string): void => {
    event.preventDefault();
    setSubmitted((overrideQuery ?? query).trim());
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 dark:bg-[#1E293B]">
        <form
          onSubmit={(event) => {
            build(event);
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={goalId}
            onChange={(event) => {
              setGoalId(event.target.value);
            }}
            placeholder="Goal id"
            aria-label="Goal id"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#2B5FD9] focus:outline-none dark:border-slate-700 dark:bg-[#0F172A] dark:text-white sm:w-48"
          />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="What is the next agent/workflow trying to do?"
            aria-label="Context query"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#2B5FD9] focus:outline-none dark:border-slate-700 dark:bg-[#0F172A] dark:text-white"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#7C3AED] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6D28D9] disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Package className="h-4 w-4" />
            )}
            Assemble package
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_QUERIES.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              onClick={() => {
                setGoalId(suggestion.goalId);
                setQuery(suggestion.query);
                setSubmitted(suggestion.query);
              }}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition-colors hover:border-[#2B5FD9] hover:text-[#2B5FD9] dark:border-slate-700 dark:text-slate-300"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      </Card>

      {submitted && isLoading && (
        <div className="flex items-center justify-center h-[30vh]">
          <Loading label="Assembling minimum useful context…" size="lg" />
        </div>
      )}

      {submitted && !isLoading && isError && (
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title="Assembly failed"
          description="The fabric could not assemble the package."
          action={{ label: 'Retry', onClick: () => void refetch() }}
        />
      )}

      {submitted && !isLoading && !isError && data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Items"
              value={String(data.items.length)}
              color="#2B5FD9"
              sub="minimum useful set"
            />
            <Kpi
              label="Est. tokens"
              value={data.estimatedTokens.toLocaleString()}
              color="#7C3AED"
              sub="token-efficient"
            />
            <Kpi
              label="Version"
              value={data.contextVersion}
              color="#F59E0B"
              sub={`assembled ${formatDate(data.assembledAt)}`}
            />
            <Kpi
              label="Capabilities"
              value={String(data.relevantCapabilities.length)}
              color="#22C55E"
              sub="advertised to consumers"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#2B5FD9]" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Package items
                </h2>
              </div>
              <div className="space-y-3">
                {data.items.map((item) => (
                  <Card key={item.entityId} className="p-4 dark:bg-[#1E293B]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#EEF2FF] text-[#2B5FD9] dark:bg-[#1E3A8A] dark:text-[#BFDBFE]">
                          {item.type}
                        </Badge>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.entityLabel}
                        </span>
                        {item.permission.allowed ? (
                          <ShieldCheck
                            className="h-3.5 w-3.5 text-[#22C55E]"
                            aria-label="access granted"
                          />
                        ) : (
                          <ShieldX
                            className="h-3.5 w-3.5 text-[#EF4444]"
                            aria-label="access denied"
                          />
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {item.estimatedTokens} tok
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {item.contentPreview}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      {item.provenance.source} · {item.provenance.producedBy}
                    </p>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-[#7C3AED]" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Why these were selected
                </h2>
              </div>
              <ExplanationList explanations={data.summary} />
              {data.relevantCapabilities.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Relevant capabilities
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.relevantCapabilities.map((capability) => (
                      <Badge
                        key={capability}
                        className="bg-[#F0FDF4] text-[#166534] dark:bg-[#14532D] dark:text-[#BBF7D0]"
                      >
                        {capability}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!submitted && (
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title="Build a context package"
          description="Give the fabric a goal and a task, and it assembles the minimum useful, permission-safe context package — with provenance, explanations and a token estimate — ready for the next agent or workflow."
        />
      )}
    </div>
  );
}
