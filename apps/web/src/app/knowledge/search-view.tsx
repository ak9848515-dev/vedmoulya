// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Center: Search view
// EPIC-004 / EI-009 — Enterprise Knowledge Intelligence Platform
// The eight search modes of the Knowledge Layer — semantic, keyword,
// category, relationship, dependency, consumer, trust, and version — with
// per-result match-type badges and relevance scores.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Loading, EmptyState, TextField, Select, Button } from '@vedmoulya/ui';
import { useKnowledgeSearch } from '../../lib/api-client.js';
import { Search as SearchIcon, SlidersHorizontal } from 'lucide-react';
import type {
  KnowledgeCategory,
  KnowledgeRelationshipType,
} from '@vedmoulya/knowledge-intelligence';
import { CATEGORY_COLORS, FALLBACK_COLOR, formatPct } from './knowledge-ui.js';
import { KnowledgeCard } from './components.js';

const MATCH_TYPE_COLORS: Record<string, string> = {
  semantic: 'bg-[#7C3AED] text-white',
  keyword: 'bg-[#2B5FD9] text-white',
  category: 'bg-[#F97316] text-white',
  relationship: 'bg-[#06B6D4] text-white',
  dependency: 'bg-[#EF4444] text-white',
  consumer: 'bg-[#8B5CF6] text-white',
  trust: 'bg-[#22C55E] text-white',
  version: 'bg-[#0D9488] text-white',
};

const CATEGORY_OPTIONS = [
  'business',
  'technical',
  'user',
  'project',
  'ai',
  'sap',
  'client',
  'domain',
  'policy',
  'document',
  'api',
  'architecture',
  'learning',
  'execution',
].map((value) => ({ value, label: value }));
const RELATIONSHIP_OPTIONS = [
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
].map((value) => ({ value, label: value.replace('_', ' ') }));

export function SearchView({ userId }: { userId: string }): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<KnowledgeCategory | ''>('');
  const [relationshipType, setRelationshipType] = useState<KnowledgeRelationshipType | ''>('');
  const [minTrust, setMinTrust] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data, isLoading, isError, refetch } = useKnowledgeSearch(userId, {
    query: submitted || undefined,
    category: category || undefined,
    relationshipType: relationshipType || undefined,
    minTrust: minTrust ? Math.min(1, Math.max(0, Number(minTrust))) : undefined,
    limit: 50,
  });

  const runSearch = (): void => {
    setSubmitted(query.trim());
  };

  return (
    <div className="space-y-5">
      {/* ── Search bar ─────────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <TextField
              label="Search knowledge"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="e.g. SAP onboarding, provider fallback, security policy…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch();
              }}
            />
          </div>
          <Select
            label="Category"
            options={[{ value: '', label: 'All categories' }, ...CATEGORY_OPTIONS]}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as KnowledgeCategory | '');
            }}
            className="w-40"
          />
          <Select
            label="Relationship"
            options={[{ value: '', label: 'Any relationship' }, ...RELATIONSHIP_OPTIONS]}
            value={relationshipType}
            onChange={(e) => {
              setRelationshipType(e.target.value as KnowledgeRelationshipType | '');
            }}
            className="w-40"
          />
          <TextField
            label="Min trust"
            value={minTrust}
            onChange={(e) => {
              setMinTrust(e.target.value);
            }}
            placeholder="0.6"
            className="w-24"
          />
          <Button variant="primary" onClick={runSearch}>
            <SearchIcon className="mr-1 h-4 w-4" /> Search
          </Button>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Semantic, keyword, category, relationship, dependency, consumer, trust, and version modes.
        </p>
      </Card>

      {/* ── Results ────────────────────────────────────────────────────── */}
      {isLoading && submitted && (
        <div className="flex items-center justify-center h-[30vh]">
          <Loading label="Searching the knowledge layer…" size="lg" />
        </div>
      )}

      {isError && (
        <EmptyState
          icon={<SearchIcon className="h-10 w-10" />}
          title="Search failed"
          description="The knowledge search service could not be reached."
          action={{ label: 'Retry', onClick: () => void refetch() }}
        />
      )}

      {!isLoading && !isError && data && submitted && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {data.length} result{data.length === 1 ? '' : 's'} for “{submitted}”
            </h3>
            <Badge variant="info" className="text-[10px]">
              8 search modes
            </Badge>
          </div>

          {data.length === 0 ? (
            <EmptyState
              icon={<SearchIcon className="h-10 w-10" />}
              title="Nothing found"
              description="No knowledge matched. Broaden the query, drop filters, or capture the item in the Explorer tab."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.map((result) => {
                const color = CATEGORY_COLORS[result.item.category] ?? FALLBACK_COLOR;
                return (
                  <div key={result.item.knowledgeId} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge className={`text-[10px] ${MATCH_TYPE_COLORS[result.matchType] ?? ''}`}>
                        {result.matchType}
                      </Badge>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                        {formatPct(result.score)} relevance
                      </span>
                    </div>
                    <KnowledgeCard item={result.item} />
                    <p className="rounded-lg bg-slate-50 p-2 text-[11px] italic text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                      “{result.snippet}”
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {!isLoading && !data && !submitted && (
        <EmptyState
          icon={<SearchIcon className="h-10 w-10" />}
          title="Search the knowledge layer"
          description="Type a query and press Search. Results are ranked by composite relevance and show the match mode used to find them."
        />
      )}
    </div>
  );
}
