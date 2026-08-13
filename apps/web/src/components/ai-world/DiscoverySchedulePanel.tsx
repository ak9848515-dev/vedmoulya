// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI World · Discovery Activity / Schedule panel (EPIC-018)
// A premium, minimal section on the EXISTING /ai-world page — no separate
// scheduler dashboard. Shows next discovery, per-category schedules
// (Enable/Disable · Frequency · Last/Next run · Run now · Status) and the
// last scan summary. Advanced settings (source policies) use progressive
// disclosure. Manual "Run now" takes the exact same bounded safety path as
// scheduled runs — there is no privileged shortcut.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card } from '@vedmoulya/ui';
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  DiscoveryJobCategory,
  DiscoverySourcePolicy,
  SchedulerStatusView,
  ScheduleFrequency,
} from '@vedmoulya/ai-world-scheduler';
import {
  DISCOVERY_JOB_LABELS,
  FREQUENCY_OPTIONS,
  changeLabel,
  frequencyLabel,
  nextDiscoveryLabel,
  relativeTime,
  runtimeColor,
  runtimeDetailLabel,
  runtimeStateLabel,
  statusColor,
  statusLabel,
} from '../../app/ai-world/scheduler-ui.js';
import type { SchedulerRuntimeStatusViewDTO } from '../../lib/api-client.js';

export interface DiscoverySchedulePanelProps {
  status?: SchedulerStatusView;
  policies?: DiscoverySourcePolicy[];
  /** EPIC-018 closure — runtime cadence driver state (honest indicator). */
  runtime?: SchedulerRuntimeStatusViewDTO;
  busy: boolean;
  onToggle: (jobCategory: DiscoveryJobCategory, enabled: boolean) => void;
  onFrequency: (jobCategory: DiscoveryJobCategory, frequency: ScheduleFrequency) => void;
  onRunNow: (jobCategory: DiscoveryJobCategory) => void;
}

export function DiscoverySchedulePanel({
  status,
  policies,
  runtime,
  busy,
  onToggle,
  onFrequency,
  onRunNow,
}: DiscoverySchedulePanelProps): React.JSX.Element {
  const [advanced, setAdvanced] = useState(false);
  const jobs = status?.jobs ?? [];

  return (
    <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[#F5F3FF] dark:bg-[#4C1D95]/30">
            <CalendarClock className="h-4 w-4 text-[#7C3AED]" />
          </div>
          <div>
            <h2 className="text-[14px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
              Discovery Activity
            </h2>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              Scheduled, bounded discovery — keeps the AI World fresh
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${runtimeColor(runtime)}`}
            title={
              runtime?.active
                ? 'Discovery runs automatically on the configured schedule'
                : 'Runs happen only when you press Run'
            }
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${runtime?.active ? 'bg-emerald-500' : 'bg-amber-500'}`}
            />
            {runtimeStateLabel(runtime)}
            {runtime?.active ? ` · ${runtimeDetailLabel(runtime)}` : ''}
          </span>
        </div>
      </div>

      {/* ── Next discovery + last scan ────────────────────────────── */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
            Next discovery
          </p>
          <p className="mt-1 text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
            {nextDiscoveryLabel(status?.nextDiscoveryAt)}
          </p>
        </div>
        <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
            Last scan
          </p>
          <p className="mt-1 text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
            {status?.lastScanAt ? (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Completed {relativeTime(status.lastScanAt)}
              </span>
            ) : (
              'Never — first scan due now'
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            {status && status.meaningfulUpdates > 0
              ? `${String(status.meaningfulUpdates)} meaningful update${status.meaningfulUpdates === 1 ? '' : 's'}`
              : 'No meaningful changes since the last scan'}
          </p>
        </div>
      </div>

      {/* ── Schedule rows ─────────────────────────────────────────── */}
      <ul className="mt-4 divide-y divide-[#E2E8F0] dark:divide-[#334155]">
        {jobs.map((job) => (
          <li key={job.jobCategory} className="py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC]">
                  {DISCOVERY_JOB_LABELS[job.jobCategory]}
                </span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusColor(job.status)}`}
                >
                  {statusLabel(job.status)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {frequencyLabel(job.frequency)}
                {job.lastRunAt ? ` · last run ${relativeTime(job.lastRunAt)}` : ' · never run'}
                {job.lastChangeKind ? ` · ${changeLabel(job.lastChangeKind)}` : ''}
              </p>
            </div>

            {/* Frequency */}
            <select
              aria-label={`${DISCOVERY_JOB_LABELS[job.jobCategory]} frequency`}
              value={job.frequency}
              disabled={!job.enabled || busy}
              onChange={(e) => {
                onFrequency(job.jobCategory, e.target.value as ScheduleFrequency);
              }}
              className="px-2 py-1.5 rounded-lg bg-[#F1F5F9] dark:bg-[#334155] text-[12px] font-medium text-[#374151] dark:text-[#E2E8F0] border border-transparent focus:border-[#2B5FD9] outline-none disabled:opacity-40"
            >
              {FREQUENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {/* Enable / disable */}
            <button
              role="switch"
              aria-checked={job.enabled}
              aria-label={`${job.enabled ? 'Disable' : 'Enable'} ${DISCOVERY_JOB_LABELS[job.jobCategory]} discovery`}
              disabled={busy}
              onClick={() => {
                onToggle(job.jobCategory, !job.enabled);
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
                job.enabled ? 'bg-[#2B5FD9]' : 'bg-[#CBD5E1] dark:bg-[#475569]'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  job.enabled ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>

            {/* Run now — the exact same bounded path as scheduled runs */}
            <button
              onClick={() => {
                onRunNow(job.jobCategory);
              }}
              disabled={busy || !job.enabled || job.status === 'running'}
              aria-label={`Run ${DISCOVERY_JOB_LABELS[job.jobCategory]} discovery now`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F1F5F9] dark:bg-[#334155] text-[12px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:bg-[#2B5FD9] hover:text-white dark:hover:bg-[#2B5FD9] dark:hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="h-3 w-3" />
              Run
            </button>
          </li>
        ))}
      </ul>

      {/* ── Progressive disclosure: advanced (source policies) ────── */}
      <button
        onClick={() => {
          setAdvanced((v) => !v);
        }}
        aria-expanded={advanced}
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#2B5FD9] dark:hover:text-[#6B8FEF] transition-colors"
      >
        {advanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        <SlidersHorizontal className="h-3 w-3" />
        {advanced ? 'Hide advanced' : 'Advanced'}
      </button>
      {advanced && (
        <div className="mt-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] px-4 py-3 space-y-1.5">
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            Every discovery source is bounded: cooldowns, windowed rate limits, budgets and backoff
            are enforced automatically — one failing source never stops the others.
          </p>
          {(policies ?? []).map((p) => (
            <div
              key={p.sourceId}
              className="flex items-center justify-between text-[11px] text-[#374151] dark:text-[#E2E8F0]"
            >
              <span className="font-medium">{p.sourceId}</span>
              <span className="text-[#64748B] dark:text-[#94A3B8]">
                {p.enabled ? 'enabled' : 'disabled'} · {String(p.consecutiveFailures)} consecutive
                failure
                {p.consecutiveFailures === 1 ? '' : 's'} · {String(p.callsConsumed)}/
                {String(p.maxCallsPerWindow)} calls
              </span>
            </div>
          ))}
          {(policies ?? []).length === 0 && (
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              No source activity yet.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
