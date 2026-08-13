// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Center: shared presentational components
// EPIC-004 / EI-010 — Enterprise Memory Intelligence Platform
// MemoryCard, ImportanceBadge, ConfidenceBadge, RelationshipRow, TimelineRow,
// ConsumerRow, CompressionBadge, RetentionBadge, LifecycleBadge — the shared
// building blocks for every memory dashboard view.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   the only indexed accesses are typed Record lookups keyed by the closed
   MemoryType / MemoryLifecycleStatus / MemoryCompressionState /
   MemoryRetentionPolicy / MemoryRelationshipType / MemorySourceType unions
   (TYPE_COLORS[item.type], LIFECYCLE_COLORS[status], …) — no runtime
   attacker-controlled keys. */

import React from 'react';
import type {
  MemoryConsumer,
  MemoryItem,
  MemoryRelationship,
  MemoryTimelineEntry,
} from '@vedmoulya/memory-intelligence';
import {
  COMPRESSION_COLORS,
  FALLBACK_COLOR,
  LIFECYCLE_COLORS,
  LEVEL_COLORS,
  RELATIONSHIP_COLORS,
  RETENTION_COLORS,
  SOURCE_COLORS,
  TYPE_COLORS,
  TYPE_LABELS,
  formatDateTime,
  formatPct,
  truncate,
} from './memory-ui.js';

function badge(className: string | undefined, fallback: string): string {
  return className ?? fallback;
}

// ── Importance / Confidence ──────────────────────────────────────────────────

interface ScoreBadgeProps {
  score: number;
  level: 'low' | 'medium' | 'high';
  label: string;
}

export function ScoreBadge({ score, level, label }: ScoreBadgeProps): React.JSX.Element {
  return (
    <span
      title={`${label}: ${score.toFixed(2)}`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEVEL_COLORS[level]}`}
    >
      {label} {formatPct(score)}
    </span>
  );
}

// ── Lifecycle / Compression / Retention badges ───────────────────────────────

export function LifecycleBadge({
  status,
}: {
  status: MemoryItem['lifecycleStatus'];
}): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge(LIFECYCLE_COLORS[status], 'bg-[#64748B] text-white')}`}
    >
      {status}
    </span>
  );
}

export function CompressionBadge({
  state,
}: {
  state: MemoryItem['compressionState'];
}): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge(COMPRESSION_COLORS[state], 'bg-[#64748B] text-white')}`}
    >
      {state}
    </span>
  );
}

export function RetentionBadge({
  policy,
}: {
  policy: MemoryItem['retentionPolicy'];
}): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge(RETENTION_COLORS[policy], 'bg-[#64748B] text-white')}`}
    >
      {policy.replace('_', ' ')}
    </span>
  );
}

// ── MemoryCard (the core row) ────────────────────────────────────────────────

interface MemoryCardProps {
  item: MemoryItem;
  onOpen?: (memoryId: string) => void;
  actions?: React.ReactNode;
}

export function MemoryCard({ item, onOpen, actions }: MemoryCardProps): React.JSX.Element {
  const typeColor = TYPE_COLORS[item.type] ?? FALLBACK_COLOR;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(item.memoryId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen?.(item.memoryId);
      }}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-[#2B5FD9] hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-[#2B5FD9]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
              style={{ backgroundColor: typeColor }}
            >
              {TYPE_LABELS[item.type] ?? item.type}
            </span>
            <LifecycleBadge status={item.lifecycleStatus} />
            <CompressionBadge state={item.compressionState} />
            <RetentionBadge policy={item.retentionPolicy} />
          </div>
          <h3 className="mt-2 truncate text-sm font-semibold text-slate-900 dark:text-white">
            {item.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
            {item.summary ?? item.content}
          </p>
        </div>
        {actions}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <ScoreBadge
          score={item.importance.score}
          level={item.importance.level}
          label="Importance"
        />
        <ScoreBadge
          score={item.confidence.score}
          level={item.confidence.level}
          label="Confidence"
        />
        <span className="inline-flex items-center gap-1">
          <span
            className={`rounded-full px-2 py-0.5 font-semibold text-white ${badge(SOURCE_COLORS[item.sourceType], 'bg-[#64748B] text-white')}`}
          >
            {item.sourceType}
          </span>
        </span>
        <span className="ml-auto">{formatDateTime(item.updatedAt)}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span>↻ {item.usage.totalRetrievals} retrievals</span>
        <span>◎ {item.usage.frequency}× frequency</span>
        <span>recency {formatPct(item.usage.recency)}</span>
        {item.relatedGoal && <span>goal: {truncate(item.relatedGoal, 24)}</span>}
        {item.relatedProject && <span>project: {truncate(item.relatedProject, 24)}</span>}
        {item.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-700">
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── RelationshipRow ──────────────────────────────────────────────────────────

interface RelationshipRowProps {
  relationship: MemoryRelationship;
}

export function RelationshipRow({ relationship }: RelationshipRowProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${badge(RELATIONSHIP_COLORS[relationship.type], 'bg-[#64748B] text-white')}`}
      >
        {relationship.type.replace('_', ' ')}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
          {truncate(relationship.sourceTitle ?? relationship.sourceId, 40)}
          <span className="mx-1 text-slate-400">→</span>
          {truncate(relationship.targetTitle ?? relationship.targetId, 40)}
        </p>
        <p className="text-[11px] text-slate-400">
          weight {relationship.weight.toFixed(2)} · {relationship.actor} ·{' '}
          {formatDateTime(relationship.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ── TimelineRow ──────────────────────────────────────────────────────────────

interface TimelineRowProps {
  entry: MemoryTimelineEntry;
}

export function TimelineRow({ entry }: TimelineRowProps): React.JSX.Element {
  const actionColor =
    entry.action === 'expired'
      ? 'bg-[#EF4444] text-white'
      : entry.action === 'archived'
        ? 'bg-[#64748B] text-white'
        : entry.action === 'captured'
          ? 'bg-[#22C55E] text-white'
          : entry.action === 'retrieved' || entry.action === 'consumed'
            ? 'bg-[#06B6D4] text-white'
            : 'bg-[#2B5FD9] text-white';
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
      <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${actionColor}`}>
        {entry.action}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
          {entry.title}
        </p>
        <p className="text-[11px] text-slate-400">
          {entry.actor}
          {entry.note ? ` · ${truncate(entry.note, 60)}` : ''}
        </p>
      </div>
      <span className="shrink-0 text-[11px] text-slate-400">{formatDateTime(entry.timestamp)}</span>
    </div>
  );
}

// ── ConsumerRow ──────────────────────────────────────────────────────────────

interface ConsumerRowProps {
  consumer: MemoryConsumer;
}

export function ConsumerRow({ consumer }: ConsumerRowProps): React.JSX.Element {
  const typeColor =
    consumer.consumerType === 'engine'
      ? 'bg-[#8B5CF6] text-white'
      : consumer.consumerType === 'module'
        ? 'bg-[#2B5FD9] text-white'
        : consumer.consumerType === 'user'
          ? 'bg-[#EC4899] text-white'
          : 'bg-[#64748B] text-white';
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeColor}`}>
          {consumer.consumerType}
        </span>
        <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
          {consumer.consumerLabel}
        </span>
      </div>
      <div className="shrink-0 text-right text-[11px] text-slate-400">
        <span className="font-semibold text-slate-600 dark:text-slate-300">
          {consumer.usageCount}
        </span>{' '}
        uses · last {formatDateTime(consumer.lastUsedAt)}
      </div>
    </div>
  );
}
