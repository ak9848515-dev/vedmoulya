// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider-usage ingest status (in-product)
//
// The per-provider quota rows say "Unavailable from provider" whenever the
// provider itself reported nothing. That is honest but unexplained: is VedMoulya
// not checking at all, is there no usage endpoint for that provider, or did the
// probe fail? This panel answers exactly that from the gateway's ingest status
// (schedule state + the last pass's real per-family outcomes).
//
// Nothing here is inferred: an empty entry list means the ingest never ran in
// this process, and an unscheduled ingest says so rather than implying checks
// are happening.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import {
  useProviderUsageIngestStatus,
  type ProviderUsageIngestStatusDTO,
} from '../../lib/api-client.js';

const CARD =
  'rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] p-4 shadow-sm';

/** Human label for one outcome — the gateway's vocabulary, never re-interpreted. */
export function ingestOutcomeLabel(
  outcome: ProviderUsageIngestStatusDTO['entries'][number]['outcome'],
): string {
  switch (outcome) {
    case 'QUOTA_WRITTEN':
      return 'Provider-reported quota written';
    case 'CHECKED_WRITTEN':
      return 'Checked — provider reported no bounded quota';
    case 'NO_PROBE':
      return 'No usage/billing endpoint for this provider';
    case 'NOT_CONFIGURED':
      return 'No credential configured';
    case 'PROBE_FAILED':
      return 'Probe failed';
    default:
      return outcome;
  }
}

/**
 * The schedule sentence. An unscheduled ingest is stated plainly — the operator
 * CLI script and the opt-in cadence flag are the only two ways quota is ever
 * refreshed, and saying so is better than a silent "Unavailable".
 */
export function ingestScheduleLabel(status: ProviderUsageIngestStatusDTO): string {
  if (!status.scheduleEnabled) {
    return 'Not scheduled — provider account usage is refreshed only by a manual operator run.';
  }
  const minutes =
    status.scheduleIntervalMs !== undefined
      ? Math.max(1, Math.round(status.scheduleIntervalMs / 60_000))
      : undefined;
  return minutes !== undefined
    ? `Scheduled every ${minutes} minute${minutes === 1 ? '' : 's'} by the gateway heartbeat.`
    : 'Scheduled by the gateway heartbeat.';
}

/**
 * `userId` is the SESSION user: the procedure is authenticated like every other
 * read, while the payload itself is deployment-scoped (no owner data).
 */
export function ProviderUsageIngestNote({ userId }: { userId: string }): React.JSX.Element {
  const query = useProviderUsageIngestStatus(userId);
  const status = query.data;
  if (!status) return <></>;

  const reported = status.entries.filter((entry) => entry.outcome === 'QUOTA_WRITTEN').length;
  const failures = status.entries.filter((entry) => entry.outcome === 'PROBE_FAILED').length;

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-[#2B5FD9]" aria-hidden="true" />
        <h2 className="text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Provider usage checks
        </h2>
      </div>
      <p className="mt-1.5 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
        {ingestScheduleLabel(status)}
      </p>
      {status.lastRunAt !== undefined ? (
        <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
          Last pass in this server process: {new Date(status.lastRunAt).toLocaleString()} —{' '}
          {reported} provider-reported quota{reported === 1 ? '' : 's'} written,{' '}
          {status.checkedSamplesWritten} checked without a reported quota
          {failures > 0 ? `, ${failures} failed` : ''}.
        </p>
      ) : (
        <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
          No pass recorded in this server process, so no provider-reported quota has been ingested
          here yet.
        </p>
      )}
      {failures > 0 && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />A failed probe is reported here
          and never turned into a quota or a health downgrade.
        </p>
      )}
      {status.entries.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {status.entries.map((entry) => (
            <li
              key={`${entry.family}:${entry.outcome}`}
              className="text-[11px] text-[#64748B] dark:text-[#94A3B8]"
            >
              <span className="font-medium text-[#374151] dark:text-[#E2E8F0]">{entry.family}</span>{' '}
              — {ingestOutcomeLabel(entry.outcome)}
              {entry.detail ? <span className="text-[#94A3B8]"> · {entry.detail}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
