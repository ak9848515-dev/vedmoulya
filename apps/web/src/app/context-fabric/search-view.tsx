// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Search view
// APP-001 — Post-V1 Application Platform Layer
// Unified hybrid search across personal + business context. Every result
// carries a score, reasons and provenance. Search feels real — it runs
// against the live fabric with permission gating.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Loading, EmptyState, Badge } from '@vedmoulya/ui';
import { useContextFabricSearch } from '../../lib/api-client.js';
import { Search as SearchIcon, Loader2 } from 'lucide-react';
import { EntityCard, ScoreBadge } from './components.js';

export function SearchView({ userId }: { userId: string }): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [goalId, setGoalId] = useState('');
  const { data, isLoading, isError, refetch } = useContextFabricSearch(userId, submitted, {
    goalId: goalId || undefined,
    limit: 20,
  });

  const runSearch = (event: React.SyntheticEvent): void => {
    event.preventDefault();
    setSubmitted(query.trim());
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 dark:bg-[#1E293B]">
        <form
          onSubmit={(event) => {
            runSearch(event);
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search personal & enterprise context… e.g. enterprise blog platform"
              aria-label="Context search query"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2B5FD9] focus:outline-none focus:ring-2 focus:ring-[#2B5FD9]/20 dark:border-slate-700 dark:bg-[#0F172A] dark:text-white"
            />
          </div>
          <input
            value={goalId}
            onChange={(event) => {
              setGoalId(event.target.value);
            }}
            placeholder="Anchor goal id (optional)"
            aria-label="Anchor goal id"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#2B5FD9] focus:outline-none dark:border-slate-700 dark:bg-[#0F172A] dark:text-white sm:w-56"
          />
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2B5FD9] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SearchIcon className="h-4 w-4" />
            )}
            Search
          </button>
        </form>
        <p className="mt-2 text-[11px] text-slate-400">
          Hybrid retrieval: keyword + metadata + recency + confidence + graph proximity. Only
          context you are permitted to access is returned.
        </p>
      </Card>

      {submitted && isLoading && (
        <div className="flex items-center justify-center h-[30vh]">
          <Loading label="Retrieving context…" size="lg" />
        </div>
      )}

      {submitted && !isLoading && isError && (
        <EmptyState
          icon={<SearchIcon className="h-10 w-10" />}
          title="Search failed"
          description="The fabric could not complete the search. Try again."
          action={{ label: 'Retry', onClick: () => void refetch() }}
        />
      )}

      {submitted && !isLoading && !isError && data && (
        <>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#EEF2FF] text-[#2B5FD9] dark:bg-[#1E3A8A] dark:text-[#BFDBFE]">
              {data.total} eligible results
            </Badge>
            <span className="text-xs text-slate-400">{Math.round(data.latencyMs)} ms</span>
          </div>

          {data.entities.length === 0 ? (
            <EmptyState
              icon={<SearchIcon className="h-10 w-10" />}
              title="No context found"
              description="Nothing matched — or everything matching is outside your permission scope."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {data.entities.map((entity, index) => {
                const rank = data.ranking.find((r) => r.entityId === entity.entityId);
                return (
                  <Card key={entity.entityId} className="p-4 dark:bg-[#1E293B]">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        #{index + 1}
                      </span>
                      {rank && <ScoreBadge score={rank.score} />}
                    </div>
                    <EntityCard entity={entity} />
                    {rank && rank.reasons.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                        {rank.reasons.slice(0, 3).map((reason, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
                          >
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#2B5FD9]" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {!submitted && (
        <EmptyState
          icon={<SearchIcon className="h-10 w-10" />}
          title="Search the fabric"
          description="Type a query to retrieve permission-safe context across your personal and enterprise graphs with scores, reasons and provenance."
        />
      )}
    </div>
  );
}
