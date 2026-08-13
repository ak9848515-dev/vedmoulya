// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI World: Discovery Item Card
// EPIC-012C — AI World Discovery, Provider Catalog & Market Intelligence
//
// One shared card for every surface (bell drawer + the /ai-world page).
// Renders the answers to: WHAT happened? WHY does it matter? SHOULD I do
// something? — in a few seconds. Evidence-first, never fabricated, and the
// source link is only ever rendered for safe http(s) schemes (discovered
// content is untrusted input — never auto-opened).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import {
  Star,
  GitFork,
  ShieldAlert,
  ExternalLink,
  Settings2,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import type {
  DiscoveryItem,
  DiscoveryItemAction,
  FreeResourceClass,
  RecommendationState,
} from '@vedmoulya/ai-world';

// ── Recommendation state styling (text + colour, never colour alone) ─────────

const RECOMMENDATION_STYLES: Record<RecommendationState, string> = {
  IGNORE: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  WATCH: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  REVIEW: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  TRY: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  CONFIGURE: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  INTEGRATE: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
};

const FREE_LABELS: Record<FreeResourceClass, string> = {
  FREE_API: 'Free API',
  FREE_WITH_QUOTA: 'Free with quota',
  OPEN_WEIGHTS: 'Open weights',
  OPEN_SOURCE: 'Open source',
  LOCAL: 'Runs locally',
  SELF_HOSTABLE: 'Self-hostable',
  PAID: 'Paid',
  UNKNOWN: 'Pricing unknown',
};

const FREE_STYLES: Record<FreeResourceClass, string> = {
  FREE_API: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  FREE_WITH_QUOTA: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  OPEN_WEIGHTS: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  OPEN_SOURCE: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  LOCAL: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  SELF_HOSTABLE: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  PAID: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  UNKNOWN: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const CATEGORY_LABELS: Record<DiscoveryItem['category'], string> = {
  provider: 'Provider',
  model: 'Model',
  github: 'GitHub',
  application: 'Application',
  news: 'AI Update',
};

// ── Safe link: discovered URLs are untrusted — only http(s) is clickable ────

function safeHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : undefined;
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface DiscoveryItemCardProps {
  item: DiscoveryItem;
  /** compact = bell drawer; full = /ai-world page. */
  variant?: 'compact' | 'full';
  read?: boolean;
  onMarkRead?: () => void;
  onSetAction?: (action: DiscoveryItemAction) => void;
  onConfigure?: () => void;
}

// ── Card ────────────────────────────────────────────────────────────────────

export function DiscoveryItemCard({
  item,
  variant = 'full',
  read = false,
  onMarkRead,
  onSetAction,
  onConfigure,
}: DiscoveryItemCardProps): React.JSX.Element {
  const compact = variant === 'compact';
  const href = safeHref(item.sourceUrl);
  const configurable = Boolean(item.modelFacts?.configurable);

  return (
    <div
      className={`
        rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B]
        p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
        ${!read ? 'border-l-4 border-l-[#2B5FD9] dark:border-l-[#6B8FEF]' : ''}
      `}
    >
      {/* ── Header: title + recommendation ─────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
              {CATEGORY_LABELS[item.category]}
            </span>
            {item.securityFlags.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-600 dark:text-rose-400">
                <ShieldAlert className="h-3 w-3" />
                Caution
              </span>
            )}
          </div>
          <h3 className="text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC] leading-snug">
            {item.title}
          </h3>
        </div>
        <span
          className={`
            shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
            ${RECOMMENDATION_STYLES[item.recommendation]}
          `}
        >
          {item.recommendation}
        </span>
      </div>

      {/* ── Summary: WHAT happened, WHY it matters ─────────────────────── */}
      <p className="mt-2 text-[12px] leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
        {item.summary}
      </p>

      {/* ── Facts chips: free / local / capabilities / confidence ──────── */}
      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${FREE_STYLES[item.freeClass]}`}
        >
          {FREE_LABELS[item.freeClass]}
        </span>
        {item.localAvailability === 'yes' && (
          <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 text-[10px] font-medium">
            Local
          </span>
        )}
        {item.capabilities.slice(0, compact ? 3 : 5).map((cap) => (
          <span
            key={cap}
            className="px-1.5 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#334155] text-[10px] text-[#64748B] dark:text-[#CBD5E1]"
          >
            {cap}
          </span>
        ))}
        {item.capabilities.length > (compact ? 3 : 5) && (
          <span className="text-[10px] text-[#94A3B8]">
            +{item.capabilities.length - (compact ? 3 : 5)}
          </span>
        )}
        <span className="text-[10px] text-[#94A3B8]" title="Evidence confidence">
          Confidence: {item.confidence.toLowerCase().replaceAll('_', ' ')}
        </span>
      </div>

      {/* ── GitHub repository intelligence (full) ──────────────────────── */}
      {!compact && item.github && (
        <div className="mt-3 rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] p-3">
          <div className="flex items-center gap-3 text-[11px] text-[#64748B] dark:text-[#94A3B8] flex-wrap">
            <span className="font-medium text-[#111827] dark:text-[#F8FAFC]">
              {item.github.name}
            </span>
            {typeof item.github.stars === 'number' && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-500" />
                {item.github.stars.toLocaleString()}
              </span>
            )}
            {typeof item.github.forks === 'number' && (
              <span className="inline-flex items-center gap-1">
                <GitFork className="h-3 w-3" />
                {item.github.forks.toLocaleString()}
              </span>
            )}
            {item.github.language && <span>{item.github.language}</span>}
            {item.github.license && <span>License: {item.github.license}</span>}
          </div>
          {item.github.flags.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {item.github.flags.map((flag) => (
                <span
                  key={flag}
                  className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-medium"
                >
                  {flag.replaceAll('_', ' ')}
                </span>
              ))}
            </div>
          )}
          {item.github.securityConsiderations.length > 0 && (
            <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400">
              {item.github.securityConsiderations[0]}
            </p>
          )}
        </div>
      )}

      {/* ── Evidence (full only — progressive disclosure) ──────────────── */}
      {!compact && item.evidence.length > 0 && (
        <details className="mt-2.5 group">
          <summary className="text-[11px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] cursor-pointer hover:underline select-none">
            Evidence ({item.evidence.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {item.evidence.slice(0, 5).map((evidence, i) => (
              <li
                key={`${evidence.claim}-${i}`}
                className="text-[11px] text-[#64748B] dark:text-[#94A3B8] flex gap-2"
              >
                <span className="shrink-0 mt-0.5">
                  {evidence.confidence === 'VERIFIED' ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#94A3B8]" />
                  )}
                </span>
                <span>
                  {evidence.claim}
                  <span className="text-[#94A3B8]">
                    {' '}
                    — {evidence.confidence.toLowerCase().replaceAll('_', ' ')}
                  </span>
                  {evidence.source && <span className="text-[#94A3B8]"> ({evidence.source})</span>}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {configurable && (
          <button
            onClick={onConfigure}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2B5FD9] text-white text-[11px] font-semibold hover:bg-[#1E4BB8] transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Configure Provider
          </button>
        )}
        {onMarkRead && !read && (
          <button
            onClick={onMarkRead}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F1F5F9] dark:bg-[#334155] text-[#64748B] dark:text-[#CBD5E1] text-[11px] font-medium hover:bg-[#E2E8F0] dark:hover:bg-[#475569] transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Mark read
          </button>
        )}
        {onSetAction && (
          <>
            <button
              onClick={() => {
                onSetAction('watching');
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F1F5F9] dark:bg-[#334155] text-[#64748B] dark:text-[#CBD5E1] text-[11px] font-medium hover:bg-[#E2E8F0] dark:hover:bg-[#475569] transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              Watch
            </button>
            <button
              onClick={() => {
                onSetAction('dismissed');
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F1F5F9] dark:bg-[#334155] text-[#64748B] dark:text-[#CBD5E1] text-[11px] font-medium hover:bg-[#FEE2E2] hover:text-[#EF4444] dark:hover:bg-[#7F1D1D] dark:hover:text-rose-300 transition-colors"
            >
              <EyeOff className="h-3.5 w-3.5" />
              Dismiss
            </button>
          </>
        )}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline ml-auto"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Source
          </a>
        )}
      </div>
    </div>
  );
}
