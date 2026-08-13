// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Marketplace: Model Registry tab
// EPIC-004 / EI-002 — Enterprise Provider Registry & Intelligence Platform
// Extracted from the route page (CERT-002) and lazy-loaded via next/dynamic to
// keep the initial /providers page bundle within the 50 kB budget.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Loading, TextField, Select, EmptyState } from '@vedmoulya/ui';
import { Database, Cpu, Activity, Eye, Search, Table2, Grid3X3, CheckCircle2 } from 'lucide-react';
import { useProviderModelRegistry } from '../../lib/api-client.js';
import type { ProviderModelRegistryEntryDTO } from '@vedmoulya/providers';

const FAMILY_COLORS: Record<string, string> = {
  openai: 'bg-[#10A37F]/15 text-[#10A37F]',
  anthropic: 'bg-[#D97757]/15 text-[#D97757]',
  google: 'bg-[#4285F4]/15 text-[#4285F4]',
  deepseek: 'bg-[#4D6BFE]/15 text-[#4D6BFE]',
  openrouter: 'bg-[#7C3AED]/15 text-[#7C3AED]',
  ollama: 'bg-[#64748B]/15 text-[#64748B]',
  mock: 'bg-[#94A3B8]/15 text-[#64748B]',
};

const CAPABILITY_LABELS: Record<string, string> = {
  reasoning: 'Reasoning',
  coding: 'Coding',
  vision: 'Vision',
  embeddings: 'Embeddings',
  summarization: 'Summarization',
  classification: 'Classification',
  translation: 'Translation',
  speech: 'Speech',
  image_understanding: 'Image Understanding',
  general_conversation: 'General Chat',
  content_generation: 'Content Generation',
};

function FeatureChip({ label }: { label: string }): React.JSX.Element {
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[#2B5FD9] dark:text-[#93C5FD]">
      {label}
    </span>
  );
}

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${String(Math.round(tokens / 1_000))}k`;
  return String(tokens);
}

export default function ModelRegistryView({ userId }: { userId: string }): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [providerFilter, setProviderFilter] = useState<string>('all');

  const { data, isLoading, isError } = useProviderModelRegistry(userId);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loading label="Loading Model Registry..." size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Unable to load the model registry
          </h2>
          <p className="mt-2 text-[14px] text-[#64748B] dark:text-[#94A3B8]">
            Please try again in a moment.
          </p>
        </Card>
      </div>
    );
  }

  const { models, total } = data;

  // Get unique provider names
  const providerNames = [...new Set(models.map((m) => m.providerName))].sort();

  // Client-side filtering
  const q = query.trim().toLowerCase();
  const filtered = models.filter((entry) => {
    if (providerFilter !== 'all' && entry.providerName !== providerFilter) return false;
    if (q) {
      const haystack =
        `${entry.providerName} ${entry.model.name} ${entry.model.id} ${entry.model.capabilities.join(' ')}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 animate-slide-up">
      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Models',
            value: String(total),
            icon: <Database className="h-5 w-5 text-[#2B5FD9]" />,
            bg: 'bg-[#EFF4FE] dark:bg-[#1E3A8A]/40',
          },
          {
            label: 'Providers',
            value: String(providerNames.length),
            icon: <Cpu className="h-5 w-5 text-[#7C3AED]" />,
            bg: 'bg-[#F5F3FF] dark:bg-[#4C1D95]/40',
          },
          {
            label: 'Streaming',
            value: String(models.filter((m) => m.model.streaming).length),
            icon: <Activity className="h-5 w-5 text-[#22C55E]" />,
            bg: 'bg-[#F0FDF4] dark:bg-[#14532D]/40',
          },
          {
            label: 'Vision',
            value: String(models.filter((m) => m.model.vision).length),
            icon: <Eye className="h-5 w-5 text-[#F59E0B]" />,
            bg: 'bg-[#FFFBEB] dark:bg-[#78350F]/40',
          },
        ].map((stat) => (
          <Card
            key={stat.label}
            variant="standard"
            padding="md"
            className="dark:bg-[#1E293B] dark:border-[#334155]"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>{stat.icon}</div>
              <div className="min-w-0">
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium truncate">
                  {stat.label}
                </p>
                <p className="text-[20px] font-bold text-[#111827] dark:text-[#F8FAFC]">
                  {stat.value}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Search + Filters ───────────────────────────────────────────── */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 min-w-0">
            <TextField
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="Search models by name, ID, provider, or capability…"
              aria-label="Search models"
              leftIcon={<Search className="h-4 w-4 text-[#94A3B8]" />}
            />
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
              }}
              aria-label="Filter by provider"
              options={[
                { value: 'all', label: 'All Providers' },
                ...providerNames.map((name) => ({ value: name, label: name })),
              ]}
            />
            <div className="flex rounded-lg border border-[#E2E8F0] dark:border-[#334155] overflow-hidden">
              <button
                onClick={() => {
                  setViewMode('table');
                }}
                className={`p-2 transition-colors ${viewMode === 'table' ? 'bg-[#2B5FD9] text-white' : 'bg-white dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'}`}
                aria-label="Table view"
              >
                <Table2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setViewMode('grid');
                }}
                className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-[#2B5FD9] text-white' : 'bg-white dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'}`}
                aria-label="Grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Results count ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
          Showing{' '}
          <span className="font-semibold text-[#111827] dark:text-[#F8FAFC]">
            {filtered.length}
          </span>{' '}
          of {total} models across {providerNames.length} providers
        </p>
        <Badge variant="ai" size="sm" className="flex items-center gap-1.5">
          <Database className="h-3 w-3" /> Full fleet model inventory
        </Badge>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Database className="h-8 w-8" />}
          title="No models found"
          description="Try adjusting your search or clearing the filters."
        />
      ) : viewMode === 'table' ? (
        <ModelRegistryTable entries={filtered} />
      ) : (
        <ModelRegistryGrid entries={filtered} />
      )}
    </div>
  );
}

function ModelRegistryTable({
  entries,
}: {
  entries: ProviderModelRegistryEntryDTO[];
}): React.JSX.Element {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-[#F8FAFC] dark:bg-[#1E293B] border-b border-[#E2E8F0] dark:border-[#334155]">
            <th className="text-left px-4 py-3 font-semibold text-[#64748B] dark:text-[#94A3B8]">
              Provider
            </th>
            <th className="text-left px-4 py-3 font-semibold text-[#64748B] dark:text-[#94A3B8]">
              Model
            </th>
            <th className="text-left px-4 py-3 font-semibold text-[#64748B] dark:text-[#94A3B8]">
              Context
            </th>
            <th className="text-left px-4 py-3 font-semibold text-[#64748B] dark:text-[#94A3B8]">
              Max Output
            </th>
            <th className="text-center px-4 py-3 font-semibold text-[#64748B] dark:text-[#94A3B8]">
              Stream
            </th>
            <th className="text-center px-4 py-3 font-semibold text-[#64748B] dark:text-[#94A3B8]">
              Vision
            </th>
            <th className="text-center px-4 py-3 font-semibold text-[#64748B] dark:text-[#94A3B8]">
              Fn Call
            </th>
            <th className="text-center px-4 py-3 font-semibold text-[#64748B] dark:text-[#94A3B8]">
              Embed
            </th>
            <th className="text-left px-4 py-3 font-semibold text-[#64748B] dark:text-[#94A3B8]">
              Capabilities
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => (
            <tr
              key={`${entry.providerId}-${entry.model.id}`}
              className={`border-b border-[#F1F5F9] dark:border-[#334155] transition-colors hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] ${
                idx % 2 === 0 ? 'bg-white dark:bg-[#0F172A]' : 'bg-[#FAFBFC] dark:bg-[#0F172A]/80'
              }`}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${FAMILY_COLORS[entry.providerId]?.split(' ')[0] ?? 'bg-[#94A3B8]'}`}
                  />
                  <span className="font-medium text-[#111827] dark:text-[#F8FAFC]">
                    {entry.providerName}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-[#111827] dark:text-[#F8FAFC]">{entry.model.name}</span>
                <span className="ml-1.5 text-[11px] text-[#94A3B8]">{entry.model.id}</span>
              </td>
              <td className="px-4 py-3 text-[#64748B] dark:text-[#CBD5E1]">
                {formatContext(entry.model.contextLength)}
              </td>
              <td className="px-4 py-3 text-[#64748B] dark:text-[#CBD5E1]">
                {formatContext(entry.model.maxOutputTokens)}
              </td>
              <td className="px-4 py-3 text-center">
                {entry.model.streaming ? (
                  <CheckCircle2 className="h-4 w-4 text-[#22C55E] inline" />
                ) : (
                  <span className="text-[#CBD5E1]">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {entry.model.vision ? (
                  <CheckCircle2 className="h-4 w-4 text-[#22C55E] inline" />
                ) : (
                  <span className="text-[#CBD5E1]">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {entry.model.functionCalling ? (
                  <CheckCircle2 className="h-4 w-4 text-[#22C55E] inline" />
                ) : (
                  <span className="text-[#CBD5E1]">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {entry.model.embeddings ? (
                  <CheckCircle2 className="h-4 w-4 text-[#22C55E] inline" />
                ) : (
                  <span className="text-[#CBD5E1]">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {entry.model.capabilities.slice(0, 3).map((cap) => (
                    <span
                      key={cap}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F1F5F9] dark:bg-[#334155] text-[#64748B] dark:text-[#CBD5E1] whitespace-nowrap"
                    >
                      {CAPABILITY_LABELS[cap] ?? cap}
                    </span>
                  ))}
                  {entry.model.capabilities.length > 3 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-[#94A3B8]">
                      +{entry.model.capabilities.length - 3}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModelRegistryGrid({
  entries,
}: {
  entries: ProviderModelRegistryEntryDTO[];
}): React.JSX.Element {
  // Group by provider
  const grouped = entries.reduce<Record<string, ProviderModelRegistryEntryDTO[]>>((acc, entry) => {
    const list = acc[entry.providerName] ?? [];
    list.push(entry);
    acc[entry.providerName] = list;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([providerName, modelEntries]) => (
        <Card
          key={providerName}
          variant="standard"
          padding="md"
          className="dark:bg-[#1E293B] dark:border-[#334155]"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-[#EFF4FE] dark:bg-[#1E3A8A]/40">
              <Cpu className="h-4 w-4 text-[#2B5FD9]" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                {providerName}
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                {modelEntries.length} model{modelEntries.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {modelEntries.map((entry) => (
              <div
                key={entry.model.id}
                className="p-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                    {entry.model.name}
                  </span>
                  <span className="text-[11px] text-[#94A3B8]">{entry.model.id}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Context: {formatContext(entry.model.contextLength)}
                  </span>
                  <span className="text-[#CBD5E1]">·</span>
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Output: {formatContext(entry.model.maxOutputTokens)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {entry.model.streaming && <FeatureChip label="Stream" />}
                  {entry.model.vision && <FeatureChip label="Vision" />}
                  {entry.model.functionCalling && <FeatureChip label="Fn Call" />}
                  {entry.model.embeddings && <FeatureChip label="Embed" />}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {entry.model.capabilities.slice(0, 4).map((cap) => (
                    <span
                      key={cap}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[#2B5FD9] dark:text-[#93C5FD]"
                    >
                      {CAPABILITY_LABELS[cap] ?? cap}
                    </span>
                  ))}
                  {entry.model.capabilities.length > 4 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-[#94A3B8]">
                      +{entry.model.capabilities.length - 4}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
