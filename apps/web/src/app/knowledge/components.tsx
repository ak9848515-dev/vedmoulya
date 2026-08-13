// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Center: presentational components
// EPIC-004 / EI-009 — Enterprise Knowledge Intelligence Platform
// Pure presentational components extracted from the knowledge dashboard views
// so they can be rendered in Storybook with fixture DTOs (same convention as
// the Enterprise Brain components.js and Learning Intelligence components.js).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   the only indexed accesses are typed Record lookups keyed by the closed
   KnowledgeCategory / KnowledgeLevel unions (CATEGORY_COLORS[item.category],
   TRUST_LEVEL_COLORS[level], …) — no runtime attacker-controlled keys. */

import React, { useState } from 'react';
import { Badge, Card } from '@vedmoulya/ui';
import type {
  KnowledgeConsumer,
  KnowledgeItemDTO,
  KnowledgeRelationshipDTO,
  KnowledgeTimelineEntryDTO,
  KnowledgeVersionDTO,
} from '@vedmoulya/knowledge-intelligence';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  LIFECYCLE_COLORS,
  SOURCE_COLORS,
  VALIDATION_COLORS,
  FALLBACK_COLOR,
  formatDateTime,
  formatPct,
  truncate,
  trustLevel,
  TRUST_LEVEL_COLORS,
} from './knowledge-ui.js';
import {
  FileText,
  Link2,
  ScrollText,
  History,
  Users,
  ShieldCheck,
  BadgeCheck,
  Clock,
} from 'lucide-react';

// ── TrustBadge ───────────────────────────────────────────────────────────────

export interface TrustBadgeProps {
  score: number;
}

/** One knowledge trust score with its level. */
export function TrustBadge({ score }: TrustBadgeProps): React.JSX.Element {
  const level = trustLevel(score);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TRUST_LEVEL_COLORS[level]}`}
    >
      <ShieldCheck className="h-3 w-3" />
      {level.toUpperCase()} · {formatPct(score)}
    </span>
  );
}

// ── TrustBar ─────────────────────────────────────────────────────────────────

export function TrustBar({ score }: { score: number }): React.JSX.Element {
  const level = trustLevel(score);
  const color = level === 'high' ? '#22C55E' : level === 'medium' ? '#F59E0B' : '#EF4444';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.round(score * 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-[10px] font-medium text-slate-400">
        {formatPct(score)}
      </span>
    </div>
  );
}

// ── KnowledgeCard ────────────────────────────────────────────────────────────

export interface KnowledgeCardProps {
  item: KnowledgeItemDTO;
  onOpen?: (knowledgeId: string) => void;
  /** Optional extra actions rendered below the metadata. */
  actions?: React.ReactNode;
}

/** One authoritative knowledge item: category, trust, lifecycle, validation,
 *  citations, consumers, and relationships — everything the platform stores. */
export function KnowledgeCard({ item, onOpen, actions }: KnowledgeCardProps): React.JSX.Element {
  const color = CATEGORY_COLORS[item.category] ?? FALLBACK_COLOR;
  const [open, setOpen] = useState(false);
  return (
    <Card className="flex flex-col p-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="truncate text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {CATEGORY_LABELS[item.category] ?? item.category}
          </span>
        </div>
        <TrustBadge score={item.trust.score} />
      </div>

      <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-white">{item.title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {truncate(item.description)}
      </p>

      {/* ── Badge row ──────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge className={`text-[10px] ${SOURCE_COLORS[item.sourceType] ?? ''}`}>
          {item.sourceType}
        </Badge>
        <Badge className={`text-[10px] ${LIFECYCLE_COLORS[item.lifecycleStatus] ?? ''}`}>
          {item.lifecycleStatus}
        </Badge>
        <Badge className={`text-[10px] ${VALIDATION_COLORS[item.validationStatus] ?? ''}`}>
          {item.validationStatus}
        </Badge>
        <Badge className="bg-slate-100 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          v{item.version}
        </Badge>
      </div>

      {/* ── Provenance + usage ─────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" /> {truncate(item.source, 40)}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {item.consumers.length} consumer
          {item.consumers.length === 1 ? '' : 's'}
        </span>
        <span className="flex items-center gap-1">
          <Link2 className="h-3.5 w-3.5" /> {item.relationships.length} relation
          {item.relationships.length === 1 ? '' : 's'}
        </span>
        <span className="flex items-center gap-1">
          <BadgeCheck className="h-3.5 w-3.5" /> {item.citations.length} citation
          {item.citations.length === 1 ? '' : 's'}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> {item.usage.totalReads} reads
        </span>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>Trust score</span>
          <span className="font-medium text-slate-500 dark:text-slate-400">
            {formatPct(item.confidence.score)} confidence
          </span>
        </div>
        <div className="mt-1">
          <TrustBar score={item.trust.score} />
        </div>
      </div>

      {/* ── Expandable metadata ────────────────────────────────────────── */}
      <button
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#2B5FD9] transition-colors hover:text-[#1E4BB8]"
      >
        {open ? 'Hide' : 'Show'} metadata · citations · tags
      </button>

      {open && (
        <div className="mt-2 space-y-3 border-t border-slate-100 pt-3 text-[11px] dark:border-slate-800">
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              >
                #{tag}
              </span>
            ))}
          </div>
          {item.citations.length > 0 && (
            <section>
              <h4 className="font-semibold text-slate-500 dark:text-slate-400">Citations</h4>
              <ul className="mt-1 space-y-1 text-slate-400">
                {item.citations.slice(0, 4).map((citation) => (
                  <li key={citation.citationId}>
                    · {citation.sourceTitle}
                    {citation.verified ? ' ✓' : ''}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="text-[10px] text-slate-300 dark:text-slate-500">
            Owner {item.owner} · created {formatDateTime(item.createdAt)} · updated{' '}
            {formatDateTime(item.updatedAt)}
          </div>
        </div>
      )}

      {onOpen && (
        <button
          onClick={() => {
            onOpen(item.knowledgeId);
          }}
          className="mt-3 text-left text-[11px] font-semibold text-[#2B5FD9] transition-colors hover:text-[#1E4BB8]"
        >
          Open knowledge item →
        </button>
      )}
      {actions && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">{actions}</div>
      )}
    </Card>
  );
}

// ── RelationshipRow ──────────────────────────────────────────────────────────

export interface RelationshipRowProps {
  relationship: KnowledgeRelationshipDTO;
}

/** One edge of the Knowledge Graph: source → type → target. */
export function RelationshipRow({ relationship }: RelationshipRowProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="truncate font-medium text-slate-700 dark:text-slate-200">
        {relationship.sourceTitle ?? relationship.sourceId}
      </span>
      <Badge className="bg-slate-100 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {relationship.type.replace('_', ' ')}
      </Badge>
      <span className="text-slate-300">→</span>
      <span className="truncate font-medium text-slate-700 dark:text-slate-200">
        {relationship.targetTitle ?? relationship.targetId}
      </span>
      <span className="ml-auto shrink-0 text-[10px] text-slate-400">
        w{relationship.weight.toFixed(2)} · {formatDateTime(relationship.createdAt)}
      </span>
    </div>
  );
}

// ── VersionRow ───────────────────────────────────────────────────────────────

export interface VersionRowProps {
  version: KnowledgeVersionDTO;
}

/** One snapshot in the version history. */
export function VersionRow({ version }: VersionRowProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <History className="h-4 w-4 text-slate-400" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            v{version.versionNumber}
          </span>
          <span className="truncate text-xs text-slate-500 dark:text-slate-400">
            {version.changeSummary}
          </span>
        </div>
        <div className="mt-0.5 text-[10px] text-slate-400">
          {version.actor} · {formatDateTime(version.createdAt)}
        </div>
      </div>
    </div>
  );
}

// ── TimelineRow ──────────────────────────────────────────────────────────────

export interface TimelineRowProps {
  entry: KnowledgeTimelineEntryDTO;
}

/** One audit event in the knowledge timeline. */
export function TimelineRow({ entry }: TimelineRowProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <ScrollText className="h-4 w-4 text-slate-400" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {entry.title}
          </span>
          <Badge className="bg-slate-100 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {entry.action}
          </Badge>
        </div>
        <div className="mt-0.5 text-[10px] text-slate-400">
          {entry.actor}
          {entry.note ? ` · ${entry.note}` : ''} · {formatDateTime(entry.timestamp)}
        </div>
      </div>
    </div>
  );
}

// ── ConsumerRow ──────────────────────────────────────────────────────────────

export interface ConsumerRowProps {
  consumer: KnowledgeConsumer;
}

/** One consumer of a knowledge item (engine / module / user / system). */
export function ConsumerRow({ consumer }: ConsumerRowProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <Users className="h-4 w-4 text-slate-400" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
            {consumer.consumerLabel}
          </span>
          <Badge className="bg-slate-100 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {consumer.consumerType}
          </Badge>
        </div>
        <div className="mt-0.5 text-[10px] text-slate-400">
          used {consumer.usageCount}× · first {formatDateTime(consumer.firstUsedAt)} · last{' '}
          {formatDateTime(consumer.lastUsedAt)}
        </div>
      </div>
    </div>
  );
}
