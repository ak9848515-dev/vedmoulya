// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Marketplace: Benchmark Datasets tab
// EPIC-004 / EI-002 — Enterprise Provider Registry & Intelligence Platform
// Extracted from the route page (CERT-002) and lazy-loaded via next/dynamic to
// keep the initial /providers page bundle within the 50 kB budget.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Loading, TextField, Select, EmptyState } from '@vedmoulya/ui';
import {
  ClipboardList,
  BarChart3,
  Target,
  BookOpen,
  Search,
  FlaskConical,
  Server,
  Gauge,
} from 'lucide-react';
import { useProviderBenchmarkDatasets } from '../../lib/api-client.js';
import type {
  ProviderBenchmarkDefinition,
  BenchmarkDifficulty,
  ProviderBenchmarkCategory,
} from '@vedmoulya/providers';

export const BENCHMARK_CATEGORY_LABELS: Record<string, string> = {
  general_knowledge: 'General Knowledge',
  reasoning: 'Reasoning',
  coding: 'Coding',
  mathematics: 'Mathematics',
  long_context: 'Long Context',
  instruction_following: 'Instruction Following',
  multimodal: 'Multimodal',
  translation: 'Translation',
  summarization: 'Summarization',
  creative_writing: 'Creative Writing',
  tool_use: 'Tool Use',
};

const BENCHMARK_CATEGORY_COLORS: Record<string, string> = {
  general_knowledge: 'bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A8A]/40',
  reasoning: 'bg-[#F5F3FF] text-[#7C3AED] dark:bg-[#4C1D95]/40',
  coding: 'bg-[#F0FDF4] text-[#22C55E] dark:bg-[#14532D]/40',
  mathematics: 'bg-[#FFFBEB] text-[#F59E0B] dark:bg-[#78350F]/40',
  long_context: 'bg-[#FEF2F2] text-[#EF4444] dark:bg-[#450A0A]/40',
  instruction_following: 'bg-[#F0F9FF] text-[#0EA5E9] dark:bg-[#0C4A6E]/40',
  multimodal: 'bg-[#FDF4FF] text-[#D946EF] dark:bg-[#701A75]/40',
  translation: 'bg-[#ECFEFF] text-[#06B6D4] dark:bg-[#164E63]/40',
  summarization: 'bg-[#F8FAFC] text-[#475569] dark:bg-[#1E293B]/40',
  creative_writing: 'bg-[#FFF7ED] text-[#EA580C] dark:bg-[#7C2D12]/40',
  tool_use: 'bg-[#FAF5FF] text-[#8B5CF6] dark:bg-[#3B0764]/40',
};

const DIFFICULTY_BADGE: Record<
  BenchmarkDifficulty,
  {
    variant:
      | 'default'
      | 'success'
      | 'warning'
      | 'danger'
      | 'info'
      | 'ai'
      | 'premium'
      | 'draft'
      | 'published'
      | 'archived'
      | 'beta'
      | 'new';
    label: string;
  }
> = {
  basic: { variant: 'info', label: 'Basic' },
  intermediate: { variant: 'premium', label: 'Intermediate' },
  advanced: { variant: 'warning', label: 'Advanced' },
  expert: { variant: 'danger', label: 'Expert' },
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

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${String(Math.round(tokens / 1_000))}k`;
  return String(tokens);
}

export default function BenchmarkDatasetsView({ userId }: { userId: string }): React.JSX.Element {
  const [category, setCategory] = useState<ProviderBenchmarkCategory | 'all'>('all');
  const [difficulty, setDifficulty] = useState<BenchmarkDifficulty | 'all'>('all');
  const [query, setQuery] = useState('');

  const { data, isLoading, isError } = useProviderBenchmarkDatasets(userId, {
    ...(category !== 'all' ? { category } : {}),
    ...(difficulty !== 'all' ? { difficulty } : {}),
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loading label="Loading Benchmark Datasets..." size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Unable to load benchmark datasets
          </h2>
          <p className="mt-2 text-[14px] text-[#64748B] dark:text-[#94A3B8]">
            Please try again in a moment.
          </p>
        </Card>
      </div>
    );
  }

  const { items, total, summary } = data;

  // Client-side text filter
  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((d) =>
        `${d.benchmarkId} ${d.capability} ${d.scenario} ${d.description} ${d.category}`
          .toLowerCase()
          .includes(q),
      )
    : items;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Datasets',
            value: String(total),
            icon: <ClipboardList className="h-5 w-5 text-[#2B5FD9]" />,
            bg: 'bg-[#EFF4FE] dark:bg-[#1E3A8A]/40',
          },
          {
            label: 'Categories',
            value: String(
              Object.keys(summary.byCategory).filter(
                (c) => ((summary.byCategory as Record<string, number>)[c] ?? 0) > 0,
              ).length,
            ),
            icon: <BarChart3 className="h-5 w-5 text-[#7C3AED]" />,
            bg: 'bg-[#F5F3FF] dark:bg-[#4C1D95]/40',
          },
          {
            label: 'Difficulty Levels',
            value: String(
              Object.keys(summary.byDifficulty).filter(
                (d) => ((summary.byDifficulty as Record<string, number>)[d] ?? 0) > 0,
              ).length,
            ),
            icon: <Target className="h-5 w-5 text-[#F59E0B]" />,
            bg: 'bg-[#FFFBEB] dark:bg-[#78350F]/40',
          },
          {
            label: 'Definitions Only',
            value: 'No scores',
            icon: <BookOpen className="h-5 w-5 text-[#22C55E]" />,
            bg: 'bg-[#F0FDF4] dark:bg-[#14532D]/40',
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
              placeholder="Search benchmark datasets by ID, capability, scenario…"
              aria-label="Search benchmark datasets"
              leftIcon={<Search className="h-4 w-4 text-[#94A3B8]" />}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:w-auto">
            <Select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as ProviderBenchmarkCategory | 'all');
              }}
              aria-label="Filter by category"
              options={[
                { value: 'all', label: 'All Categories' },
                ...Object.keys(summary.byCategory)
                  .filter((c) => ((summary.byCategory as Record<string, number>)[c] ?? 0) > 0)
                  .sort()
                  .map((c) => ({ value: c, label: BENCHMARK_CATEGORY_LABELS[c] ?? c })),
              ]}
            />
            <Select
              value={difficulty}
              onChange={(e) => {
                setDifficulty(e.target.value as BenchmarkDifficulty | 'all');
              }}
              aria-label="Filter by difficulty"
              options={[
                { value: 'all', label: 'All Difficulties' },
                ...Object.keys(summary.byDifficulty)
                  .filter((d) => ((summary.byDifficulty as Record<string, number>)[d] ?? 0) > 0)
                  .map((d) => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) })),
              ]}
            />
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
          of {total} benchmark datasets
        </p>
        <Badge variant="ai" size="sm" className="flex items-center gap-1.5">
          <FlaskConical className="h-3 w-3" /> Definitions only — no benchmarks executed
        </Badge>
      </div>

      {/* ── Dataset Cards ──────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="No benchmark datasets found"
          description="Try adjusting your search or clearing the filters."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((dataset) => (
            <BenchmarkDatasetCard key={dataset.benchmarkId} dataset={dataset} />
          ))}
        </div>
      )}

      {/* ── Summary table ──────────────────────────────────────────────── */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#2B5FD9]" /> Coverage Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide mb-2">
              By Category
            </p>
            <div className="space-y-1.5">
              {Object.entries(summary.byCategory)
                .filter(([, count]) => count > 0)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([cat, count]) => (
                  <div key={cat} className="flex items-center gap-2 text-[12px]">
                    <span className="w-36 truncate text-[#64748B] dark:text-[#94A3B8]">
                      {BENCHMARK_CATEGORY_LABELS[cat] ?? cat}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9] dark:bg-[#334155] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#2B5FD9] dark:bg-[#6B8FEF]"
                        style={{
                          width: `${String((count / Math.max(...Object.values(summary.byCategory))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right font-semibold text-[#111827] dark:text-[#F8FAFC]">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide mb-2">
              By Difficulty
            </p>
            <div className="space-y-1.5">
              {Object.entries(summary.byDifficulty)
                .filter(([, count]) => count > 0)
                .map(([diff, count]) => (
                  <div key={diff} className="flex items-center gap-2 text-[12px]">
                    <span className="w-36 truncate text-[#64748B] dark:text-[#94A3B8]">
                      {diff.charAt(0).toUpperCase() + diff.slice(1)}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9] dark:bg-[#334155] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#7C3AED] dark:bg-[#A78BFA]"
                        style={{
                          width: `${String((count / Math.max(...Object.values(summary.byDifficulty))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right font-semibold text-[#111827] dark:text-[#F8FAFC]">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function BenchmarkDatasetCard({
  dataset,
}: {
  dataset: ProviderBenchmarkDefinition;
}): React.JSX.Element {
  const diffInfo = DIFFICULTY_BADGE[dataset.difficulty];
  const categoryColor =
    BENCHMARK_CATEGORY_COLORS[dataset.category] ?? 'bg-[#F1F5F9] text-[#64748B]';

  return (
    <Card
      variant="standard"
      padding="md"
      className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 dark:bg-[#1E293B] dark:border-[#334155] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-2 rounded-lg shrink-0 ${categoryColor}`}>
            <FlaskConical className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
              {dataset.benchmarkId}
            </h3>
            <p className="text-[11px] text-[#94A3B8]">
              {BENCHMARK_CATEGORY_LABELS[dataset.category] ?? dataset.category}
            </p>
          </div>
        </div>
        <Badge variant={diffInfo.variant} size="sm" className="shrink-0">
          {diffInfo.label}
        </Badge>
      </div>

      {/* Capability + Scenario */}
      <div className="mb-2">
        <div className="flex items-center gap-1.5 text-[12px] text-[#2B5FD9] dark:text-[#93C5FD] font-medium">
          <Target className="h-3.5 w-3.5" />
          <span>{CAPABILITY_LABELS[dataset.capability] ?? dataset.capability}</span>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-[#64748B] dark:text-[#94A3B8] flex-1">
        {dataset.scenario}
      </p>
      <p className="mt-2 text-[12px] text-[#94A3B8] line-clamp-2">{dataset.description}</p>

      {/* Expected envelope */}
      <div className="mt-4 space-y-1.5 text-[12px]">
        <div className="flex items-center gap-1.5 text-[#64748B] dark:text-[#94A3B8]">
          <BarChart3 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Expected quality:{' '}
            <strong className="text-[#111827] dark:text-[#F8FAFC]">
              {Math.round(dataset.expectedQuality * 100)}%
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[#64748B] dark:text-[#94A3B8]">
          <Server className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            ~{formatContext(dataset.expectedTokens)} tokens · ~${dataset.expectedCostUsd.toFixed(4)}{' '}
            cost
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[#64748B] dark:text-[#94A3B8]">
          <Gauge className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">~{dataset.expectedLatencyMs}ms expected latency</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-[#F1F5F9] dark:border-[#334155] flex items-center justify-between">
        <span className="text-[11px] text-[#94A3B8]">
          Updated {new Date(dataset.updatedAt).toLocaleDateString()}
        </span>
        <Badge variant="ai" size="sm" className="flex items-center gap-1">
          <BookOpen className="h-3 w-3" /> Definition
        </Badge>
      </div>
    </Card>
  );
}
