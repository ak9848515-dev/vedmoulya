// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: shared components
// APP-001 — Post-V1 Application Platform Layer
// Presentational building blocks shared by the fabric views: EntityCard,
// RelationshipRow, ScoreBadge, PermissionBadge, ProvenanceLine,
// ExplanationList, Kpi and a graph-edge visualization.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   TYPE_ICONS / ENTITY_COLORS lookups use a closed set of typed keys (the same
   pattern the memory/OS components files use). */

'use client';

import React from 'react';
import { Badge, Card } from '@vedmoulya/ui';
import {
  User,
  Target,
  FolderKanban,
  ListTodo,
  Lightbulb,
  Database,
  FileText,
  AppWindow,
  Flag,
  Briefcase,
  GraduationCap,
  Cpu,
  Building2,
  Users,
  Contact,
  Boxes,
  Shield,
  Workflow,
} from 'lucide-react';
import type {
  ContextEntity,
  ContextRelationship,
  ContextExplanation,
  PermissionEvaluation,
} from '@vedmoulya/context-fabric';
import {
  ENTITY_COLORS,
  ENTITY_LABELS,
  SCOPE_BADGES,
  SOURCE_BADGES,
  formatDate,
  pct,
  scoreColor,
} from './fabric-ui.js';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  user: <User className="h-4 w-4" />,
  goal: <Target className="h-4 w-4" />,
  project: <FolderKanban className="h-4 w-4" />,
  task: <ListTodo className="h-4 w-4" />,
  skill: <Lightbulb className="h-4 w-4" />,
  knowledge: <Database className="h-4 w-4" />,
  memory: <Database className="h-4 w-4" />,
  document: <FileText className="h-4 w-4" />,
  application: <AppWindow className="h-4 w-4" />,
  preference: <Flag className="h-4 w-4" />,
  work_history: <Briefcase className="h-4 w-4" />,
  learning_history: <GraduationCap className="h-4 w-4" />,
  ai_interaction: <Cpu className="h-4 w-4" />,
  organization: <Building2 className="h-4 w-4" />,
  person: <Users className="h-4 w-4" />,
  team: <Users className="h-4 w-4" />,
  client: <Contact className="h-4 w-4" />,
  process: <Workflow className="h-4 w-4" />,
  policy: <Shield className="h-4 w-4" />,
  business_capability: <Boxes className="h-4 w-4" />,
};

export function EntityIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}): React.JSX.Element {
  const color = ENTITY_COLORS[type as ContextEntity['type']] ?? '#64748B';
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${className ?? ''}`}
      style={{ backgroundColor: color }}
    >
      {TYPE_ICONS[type] ?? <Boxes className="h-4 w-4" />}
    </span>
  );
}

export function EntityCard({
  entity,
  score,
  onExplain,
}: {
  entity: ContextEntity;
  score?: number;
  onExplain?: (entityId: string) => void;
}): React.JSX.Element {
  return (
    <Card className="p-4 transition-shadow hover:shadow-md dark:bg-[#1E293B]">
      <div className="flex items-start gap-3">
        <EntityIcon type={entity.type} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {entity.label}
            </h3>
            {score !== undefined && (
              <span className={`text-xs font-bold ${scoreColor(score)}`}>{pct(score)}</span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <Badge className="bg-[#EEF2FF] text-[#2B5FD9] dark:bg-[#1E3A8A] dark:text-[#BFDBFE]">
              {ENTITY_LABELS[entity.type] ?? entity.type}
            </Badge>
            <Badge
              className={`${SOURCE_BADGES[entity.source] ?? 'bg-[#64748B] text-white'} text-[10px]`}
            >
              {entity.source}
            </Badge>
            {entity.graph === 'business' && (
              <Badge className="bg-[#F0FDF4] text-[#166534] dark:bg-[#14532D] dark:text-[#BBF7D0]">
                business
              </Badge>
            )}
          </div>
          {entity.description && (
            <p className="mt-1.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
              {entity.description}
            </p>
          )}
        </div>
      </div>
      {onExplain && (
        <button
          onClick={() => {
            onExplain(entity.entityId);
          }}
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#2B5FD9] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Explain selection
        </button>
      )}
    </Card>
  );
}

export function RelationshipRow({ rel }: { rel: ContextRelationship }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
      <span className="font-mono text-slate-400">{rel.fromId.split(':').pop()}</span>
      <span className="rounded bg-[#EEF2FF] px-1.5 py-0.5 font-medium text-[#2B5FD9] dark:bg-[#1E3A8A] dark:text-[#BFDBFE]">
        {rel.type.replace(/_/g, ' ')}
      </span>
      <span className="font-mono text-slate-400">{rel.toId.split(':').pop()}</span>
      <span className="ml-auto font-semibold text-slate-500 dark:text-slate-400">
        {pct(rel.weight)}
      </span>
    </div>
  );
}

export function ScoreBadge({ score }: { score: number }): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${scoreColor(score)} bg-[#F8FAFC] dark:bg-[#0F172A]`}
    >
      {pct(score)}
    </span>
  );
}

export function PermissionBadge({
  permission,
}: {
  permission: ContextEntity['permissions'];
}): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${SCOPE_BADGES[permission.scope] ?? 'bg-[#64748B] text-white'}`}
    >
      {permission.scope}
    </span>
  );
}

export function ProvenanceLine({ entity }: { entity: ContextEntity }): React.JSX.Element {
  return (
    <div className="space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
      <p>
        <span className="font-medium text-slate-600 dark:text-slate-300">Source:</span>{' '}
        {entity.provenance.source} · {entity.provenance.sourceId}
      </p>
      <p>
        <span className="font-medium text-slate-600 dark:text-slate-300">Produced by:</span>{' '}
        {entity.provenance.producedBy}
      </p>
      <p>
        <span className="font-medium text-slate-600 dark:text-slate-300">Created:</span>{' '}
        {formatDate(entity.provenance.createdAt)} ·{' '}
        <span className="font-medium text-slate-600 dark:text-slate-300">Updated:</span>{' '}
        {formatDate(entity.provenance.updatedAt)}
      </p>
    </div>
  );
}

export function ExplanationList({
  explanations,
}: {
  explanations: ContextExplanation[];
}): React.JSX.Element {
  if (explanations.length === 0) {
    return <p className="text-sm text-slate-400">No explanations available.</p>;
  }
  return (
    <ul className="space-y-2">
      {explanations.map((explanation) => (
        <li
          key={explanation.entityId}
          className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              {explanation.entityLabel}
            </span>
            <ScoreBadge score={explanation.score} />
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Selected because: {explanation.reasons.join('; ')}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function Kpi({
  label,
  value,
  sub,
  color = '#2B5FD9',
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#1E293B]">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white" style={{ color }}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  );
}

/** Compact permission evaluation banner (allowed/denied + reasons). */
export function PermissionEvaluationBanner({
  permission,
}: {
  permission: PermissionEvaluation;
}): React.JSX.Element {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs ${
        permission.allowed
          ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534] dark:border-[#14532D] dark:bg-[#052E16] dark:text-[#BBF7D0]'
          : 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] dark:border-[#7F1D1D] dark:bg-[#450A0A] dark:text-[#FECACA]'
      }`}
    >
      <p className="font-semibold">{permission.allowed ? 'Access granted' : 'Access denied'}</p>
      <p className="mt-0.5">{permission.reasons.join('; ')}</p>
    </div>
  );
}
