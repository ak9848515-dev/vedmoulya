// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S7.1 Opportunity monitoring panel
//
// The human workspace for external opportunity DISCOVERY. It presents exactly
// the flow the platform actually supports, and stops at the human boundary:
//
//   CHECK FOR OPPORTUNITIES  → control.monitorOpportunities (bounded pass:
//                              normalize → dedup → DISCOVERED)
//   RECOMMENDED / WHY        → control.getRankedOpportunities (the EXISTING
//                              qualification's own score + evidence lines)
//   PREPARE A PROPOSAL DRAFT → control.generateProposalDraft (the EXISTING AI
//                              orchestration; a DRAFT a human may edit)
//   HUMAN ACTION             → this panel NEVER submits, bids, contacts the
//                              client or moves money — there is no such call
//
// TRUTH RULES enforced here:
//   • The monitor result is rendered verbatim: created / already-known /
//     filtered / rejected / truncated. No optimistic "1 new" and no invented
//     count.
//   • A source failure is shown as a FAILURE with the backend's own message and
//     an explicit "nothing was imported" — never as an empty success.
//   • A recommendation's Why lines are the backend's EXISTING evidence strings,
//     rendered verbatim. The UI adds no score, percentage or estimate.
//   • The proposal is labeled a DRAFT and the human boundary is stated
//     explicitly. Freelancer.com submission is NOT performed by VedMoulya.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Sparkles, Star, ShieldCheck } from 'lucide-react';
import {
  useMonitorOpportunities,
  useOpportunityProposalDraft,
  useRankedOpportunities,
  type OpportunityMonitoringView,
  type OpportunityRecommendationView,
} from '../lib/api-client.js';
import { useAuthStore } from '../stores/auth-store.js';

/** Presentation labels only — never a reinterpretation of a backend state. */
const RISK_STYLE: Record<string, string> = {
  LOW: 'bg-[#DCFCE7] text-[#15803D]',
  MEDIUM: 'bg-[#FEF9C3] text-[#92400E]',
  HIGH: 'bg-[#FEF2F2] text-[#B91C1C]',
  UNKNOWN: 'bg-[#F1F5F9] text-[#64748B]',
};

export interface OpportunityMonitoringPanelProps {
  /** Called after a pass created at least one new opportunity, so the parent
   *  can refresh its own opportunity list. */
  onOpportunitiesChanged?: () => void;
}

/**
 * The external opportunity monitoring workspace. Self-contained: it owns its
 * monitor pass state, the ranked read and the per-opportunity draft state.
 */
export function OpportunityMonitoringPanel({
  onOpportunitiesChanged,
}: OpportunityMonitoringPanelProps): React.JSX.Element {
  const userId = useAuthStore((s) => s.user?.userId ?? '');
  const monitor = useMonitorOpportunities();
  const ranked = useRankedOpportunities(userId);
  const draftMutation = useOpportunityProposalDraft();

  const [result, setResult] = useState<OpportunityMonitoringView | null>(null);
  const [monitorError, setMonitorError] = useState('');
  const [draftFor, setDraftFor] = useState('');
  const [draftText, setDraftText] = useState('');
  const [draftMeta, setDraftMeta] = useState('');
  const [draftError, setDraftError] = useState('');
  const [copied, setCopied] = useState(false);

  const recommendations: OpportunityRecommendationView[] = ranked.data?.recommendations ?? [];

  /** ONE bounded pass. A failure is shown as a failure — nothing is faked. */
  const checkForOpportunities = async (): Promise<void> => {
    setMonitorError('');
    setResult(null);
    try {
      const response = await monitor.mutateAsync({});
      const data = (response as { data?: OpportunityMonitoringView }).data ?? null;
      setResult(data);
      if (data !== null && data.created > 0) onOpportunitiesChanged?.();
    } catch (error) {
      // The gateway's honest source message (auth / rate-limit / timeout /
      // malformed / unavailable / not configured). Nothing was imported.
      setMonitorError(error instanceof Error ? error.message : 'The monitoring pass failed.');
    }
  };

  /** Prepare a DRAFT. This never submits anything to anyone. */
  const prepareDraft = async (opportunityId: string): Promise<void> => {
    setDraftFor(opportunityId);
    setDraftText('');
    setDraftMeta('');
    setDraftError('');
    setCopied(false);
    try {
      const response = await draftMutation.mutateAsync({ id: opportunityId });
      const data = (response as { data?: { document: string; provider?: string; model?: string } })
        .data;
      setDraftText(data?.document ?? '');
      setDraftMeta(
        data?.model !== undefined
          ? `${data.provider ?? 'provider'} · ${data.model}`
          : (data?.provider ?? ''),
      );
      if ((data?.document ?? '') === '') {
        setDraftError('No draft was returned. Nothing is shown because none was received.');
      }
    } catch (error) {
      setDraftError(
        error instanceof Error ? error.message : 'The proposal draft could not be generated.',
      );
    }
  };

  const copyDraft = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 mb-2"
      data-testid="opportunity-monitoring"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151]">
          <Sparkles className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
          External opportunity monitoring
        </span>
        <button
          type="button"
          onClick={() => {
            void checkForOpportunities();
          }}
          disabled={monitor.isPending || userId === ''}
          className="flex items-center gap-1 rounded-lg bg-[#2B5FD9] px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-[#1E4AA8] disabled:opacity-60"
          aria-label="Check external sources for new opportunities"
        >
          <RefreshCw
            className={`h-3 w-3 ${monitor.isPending ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {monitor.isPending ? 'Checking…' : 'Check for opportunities'}
        </button>
      </div>

      <p className="mt-1 text-[9px] text-[#94A3B8]">
        One bounded pass over the configured external source. Opportunities enter as DISCOVERED and
        are deduplicated by source identity — re-checking never creates duplicates.
      </p>

      {/* ── Honest failure: the source failed and NOTHING was imported. ─────── */}
      {monitorError !== '' && (
        <div
          className="mt-1.5 flex items-start gap-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-2 py-1"
          role="alert"
          data-testid="monitoring-failure"
        >
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[#B91C1C]" aria-hidden="true" />
          <div>
            <p className="text-[10px] text-[#B91C1C]">{monitorError}</p>
            <p className="text-[9px] text-[#B91C1C]">
              No opportunity was imported. The source failure is reported honestly — nothing was
              fabricated.
            </p>
          </div>
        </div>
      )}

      {/* ── The pass outcome, rendered verbatim. ────────────────────────────── */}
      {result !== null && (
        <div
          className="mt-1.5 rounded-lg border border-[#E2E8F0] bg-white px-2 py-1"
          data-testid="monitoring-result"
        >
          <p className="text-[10px] text-[#64748B]">
            source: {result.source} · {result.sourceConfigured ? 'configured' : 'not configured'} ·{' '}
            {result.candidatesFetched} examined
          </p>
          <p className="text-[10px] text-[#64748B]" data-testid="monitoring-counts">
            {result.created} new · {result.existing} already known · {result.filtered} filtered by
            your settings · {result.rejected} refused by the security/normalization gate
          </p>
          {result.truncated && (
            <p className="text-[10px] text-[#92400E]">
              This pass stopped at its bound — more candidates exist in the source.
            </p>
          )}
          {result.usedCachedCandidates && (
            <p className="text-[9px] text-[#94A3B8]">
              Reused a source response from the current monitoring window (traffic bound).
            </p>
          )}
          {result.created === 0 && result.existing > 0 && (
            <p className="text-[9px] text-[#94A3B8]">
              Nothing new: the already-known opportunities were resolved idempotently, so no
              duplicate was created.
            </p>
          )}
          {result.rejected > 0 && result.rejectedSample.length > 0 && (
            <p className="text-[9px] text-[#92400E]">
              Refused: {result.rejectedSample.map((r) => r.code).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* ── Ranked / recommended (the EXISTING qualification, verbatim). ────── */}
      <div className="mt-2">
        <p className="flex items-center gap-1 text-[11px] font-medium text-[#374151]">
          <Star className="h-3 w-3 text-[#7C3AED]" aria-hidden="true" />
          Recommended for you
        </p>

        {ranked.isLoading && (
          <p className="mt-0.5 text-[10px] text-[#64748B]" role="status">
            Loading recommendations…
          </p>
        )}

        {!ranked.isLoading && ranked.isError && (
          <p className="mt-0.5 text-[10px] text-[#B91C1C]" role="alert">
            Recommendations are unavailable right now. No verdict is shown because none was
            received.
          </p>
        )}

        {!ranked.isLoading && !ranked.isError && recommendations.length === 0 && (
          <p className="mt-0.5 text-[10px] text-[#94A3B8]">
            No opportunities to rank yet. Run a monitoring check to discover some.
          </p>
        )}

        <ul className="mt-1 space-y-1.5">
          {recommendations.slice(0, 6).map((recommendation) => (
            <li
              key={recommendation.opportunityId}
              className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5"
              data-testid={`recommendation-${recommendation.opportunityId}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[11px] font-medium text-[#1F2937]">
                  {recommendation.title}
                </span>
                <span
                  className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                    recommendation.recommended
                      ? 'bg-[#DCFCE7] text-[#15803D]'
                      : 'bg-[#F1F5F9] text-[#64748B]'
                  }`}
                  data-testid={`recommended-${recommendation.opportunityId}`}
                >
                  {recommendation.recommended ? 'RECOMMENDED' : 'NOT RECOMMENDED'}
                </span>
              </div>
              <p className="text-[10px] text-[#64748B]">
                score {recommendation.score.toFixed(2)} · risk{' '}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                    RISK_STYLE[recommendation.riskLevel] ?? RISK_STYLE.UNKNOWN
                  }`}
                >
                  {recommendation.riskLevel}
                </span>{' '}
                · status {recommendation.status}
                {recommendation.source !== undefined ? ` · via ${recommendation.source}` : ''}
              </p>
              {recommendation.sourceReference !== undefined && (
                <p className="text-[9px] text-[#94A3B8]">
                  source reference: {recommendation.sourceReference}
                </p>
              )}
              {recommendation.reasons.length > 0 && (
                <>
                  <p className="mt-0.5 text-[10px] font-medium text-[#374151]">Why</p>
                  <ul
                    className="space-y-0.5"
                    data-testid={`reasons-${recommendation.opportunityId}`}
                  >
                    {recommendation.reasons.slice(0, 4).map((reason, i) => (
                      <li key={`r-${i}`} className="text-[10px] text-[#64748B]">
                        • {reason}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="mt-1 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    void prepareDraft(recommendation.opportunityId);
                  }}
                  disabled={draftMutation.isPending}
                  className="rounded-lg bg-[#7C3AED] px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-[#6D28D9] disabled:opacity-60"
                  aria-label={`Prepare a proposal draft for ${recommendation.opportunityId}`}
                >
                  {draftMutation.isPending && draftFor === recommendation.opportunityId
                    ? 'Preparing…'
                    : 'Prepare proposal draft'}
                </button>
                <span className="text-[9px] text-[#94A3B8]">
                  Draft only — you review, edit and submit.
                </span>
              </div>

              {/* The DRAFT the human reviews and may edit. Never sent. */}
              {draftFor === recommendation.opportunityId && draftText !== '' && (
                <div
                  className="mt-1 space-y-1"
                  data-testid={`draft-${recommendation.opportunityId}`}
                >
                  <textarea
                    value={draftText}
                    onChange={(e) => {
                      setDraftText(e.target.value);
                    }}
                    rows={8}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white p-1.5 font-mono text-[10px] text-[#1F2937] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
                    aria-label={`Proposal draft for ${recommendation.opportunityId}`}
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        void copyDraft();
                      }}
                      className="rounded-lg bg-[#F1F5F9] px-2 py-1 text-[10px] font-medium text-[#374151] transition-colors hover:bg-[#E2E8F0]"
                      aria-label="Copy the proposal draft"
                    >
                      {copied ? 'Copied' : 'Copy draft'}
                    </button>
                    {draftMeta !== '' && (
                      <span className="text-[9px] text-[#94A3B8]">generated by {draftMeta}</span>
                    )}
                  </div>
                  <p
                    className="flex items-start gap-1 text-[9px] text-[#92400E]"
                    data-testid={`boundary-${recommendation.opportunityId}`}
                  >
                    <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                    This is a DRAFT. VedMoulya does not submit bids, contact the client or accept
                    work. Posting or sending the proposal is your explicit action on the
                    marketplace.
                  </p>
                </div>
              )}

              {draftFor === recommendation.opportunityId && draftError !== '' && (
                <p className="mt-1 flex items-center gap-1 text-[10px] text-[#B91C1C]" role="alert">
                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {draftError}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>

      {monitorError === '' && result !== null && (
        <p className="mt-1.5 flex items-center gap-1 text-[9px] text-[#15803D]">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Pass complete. New opportunities are DISCOVERED and await your review — nothing was
          approved, bid on or submitted.
        </p>
      )}
    </div>
  );
}
