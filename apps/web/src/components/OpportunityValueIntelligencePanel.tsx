// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S6.4 Opportunity Value Intelligence panel
//
// The human workspace for ONE opportunity. It presents the EXISTING canonical
// qualification (S5.1) together with the EXISTING S6.3 value intelligence, so a
// human can answer:
//
//   WHY DOES THIS OPPORTUNITY LOOK VALUABLE?
//   WHAT EVIDENCE SUPPORTS THAT? WHAT IS MISSING?
//   WHAT IS THE CURRENT COMMERCIAL STATE?
//   WHAT IS MY AUTHORITATIVE NEXT ACTION?
//
// It creates NO intelligence engine, NO approval engine and NO commercial
// backend. It renders EXISTING backend semantic states VERBATIM and calls the
// EXISTING authority-backed mutations:
//   • read            → control.getValueIntelligence (owner-scoped QUERY)
//   • request decision→ control.requestOpportunityApproval (registers a request
//                       with the existing Brain authority; it never approves)
//
// TRUTH RULES enforced here:
//   • PAID is shown only when the canonical commercial evidence says paid.
//   • Delivery evidence and commercial evidence are NEVER collapsed.
//   • INSUFFICIENT is shown as INSUFFICIENT — never downgraded to LOW, never
//     upgraded, and never rendered as "0" or "FAILED".
//   • No revenue figure, no invented percentage, no decorative AI score.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, TrendingUp, XCircle } from 'lucide-react';
import {
  useOpportunityValueIntelligence,
  useRequestOpportunityApproval,
  useOpportunityApprove,
  useOpportunityReject,
  useStartMissionForOpportunity,
  useMissionStatus,
  type OpportunityValueIntelligenceView,
  type ValueAssessment,
  type ValueEvidenceLevel,
} from '../lib/api-client.js';
import { useAuthStore } from '../stores/auth-store.js';

// ── Presentation maps (labels only — never reinterpret a backend state) ─────

const ASSESSMENT_LABEL: Record<ValueAssessment, string> = {
  INSUFFICIENT_EVIDENCE: 'Insufficient evidence',
  PROMISING: 'Promising',
  STRONG_CANDIDATE: 'Strong candidate',
  HIGH_RISK: 'High risk',
};

const ASSESSMENT_STYLE: Record<ValueAssessment, string> = {
  INSUFFICIENT_EVIDENCE: 'bg-[#F1F5F9] text-[#64748B]',
  PROMISING: 'bg-[#F5F3FF] text-[#7C3AED]',
  STRONG_CANDIDATE: 'bg-[#DCFCE7] text-[#15803D]',
  HIGH_RISK: 'bg-[#FEF2F2] text-[#B91C1C]',
};

const LEVEL_STYLE: Record<ValueEvidenceLevel, string> = {
  INSUFFICIENT: 'bg-[#F1F5F9] text-[#64748B]',
  LOW: 'bg-[#FEF9C3] text-[#92400E]',
  MEDIUM: 'bg-[#F5F3FF] text-[#7C3AED]',
  HIGH: 'bg-[#DCFCE7] text-[#15803D]',
};

/** Evidence levels are shown with their EXACT backend token — never aliased. */
function levelStyle(level: ValueEvidenceLevel): string {
  switch (level) {
    case 'HIGH':
      return LEVEL_STYLE.HIGH;
    case 'MEDIUM':
      return LEVEL_STYLE.MEDIUM;
    case 'LOW':
      return LEVEL_STYLE.LOW;
    default:
      return LEVEL_STYLE.INSUFFICIENT;
  }
}

function levelBadge(level: ValueEvidenceLevel): React.JSX.Element {
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${levelStyle(level)}`}>
      {level}
    </span>
  );
}

export interface OpportunityValueIntelligencePanelProps {
  opportunityId: string;
  /** The current lifecycle status the parent already knows (avoids a second read). */
  lifecycleStatus?: string;
  /** Called after an approval request is successfully registered. */
  onApprovalRequested?: () => void;
}

/**
 * One opportunity's value intelligence workspace. Mounted per EXPANDED
 * opportunity only, so the read fires once per human expansion — never per row
 * and never in a loop (no N+1).
 */
export function OpportunityValueIntelligencePanel({
  opportunityId,
  lifecycleStatus,
  onApprovalRequested,
}: OpportunityValueIntelligencePanelProps): React.JSX.Element {
  const [requested, setRequested] = useState(false);
  const [taskId, setTaskId] = useState('');
  const [approvedStatus, setApprovedStatus] = useState('');
  const [missionId, setMissionId] = useState('');
  const [error, setError] = useState('');
  const [missionError, setMissionError] = useState('');
  const userId = useAuthStore((s) => s.user?.userId ?? '');
  const query = useOpportunityValueIntelligence(userId, opportunityId);
  const requestApproval = useRequestOpportunityApproval();
  const approve = useOpportunityApprove();
  const reject = useOpportunityReject();
  const startMission = useStartMissionForOpportunity();

  const data = query.data;
  const value: OpportunityValueIntelligenceView | undefined = data?.valueIntelligence;
  // Once the human approves, the local state is authoritative until the parent
  // refreshes — the panel never re-derives an approval from the score.
  const status = approvedStatus !== '' ? approvedStatus : (data?.status ?? lifecycleStatus);

  // S7.2 — reflect the EXISTING Mission state (no second state machine). The
  // status is only polled once a Mission id is known for this opportunity.
  const missionStatus = useMissionStatus(userId, missionId !== '' ? missionId : null);
  const missionState = missionStatus.data?.state ?? '';
  const missionSucceeded =
    missionState === 'COMPLETED' ||
    (missionStatus.data?.objectives ?? []).some((o) => o.state === 'VERIFIED');
  const missionFailed = missionState === 'FAILED' || missionState === 'CANCELLED';

  /**
   * Honest two-source handling: the world pipeline surfaces control-plane
   * lifecycle records AND discovery-sourced (Brain) opportunities. Only the
   * former has a control-plane qualification, so a NOT_FOUND read is reported
   * as "not a lifecycle record" — never as a fabricated verdict and never as a
   * generic failure.
   */
  const readError =
    (query as { error?: { message?: string } }).error?.message !== undefined
      ? ((query as { error?: { message?: string } }).error?.message ?? '')
      : '';
  const isNonControlRecord = /not found|NOT_FOUND/i.test(readError);

  const requestDecision = async (): Promise<void> => {
    setError('');
    try {
      // `userId` mirrors the session identity the gateway requires; the server
      // overwrites it with the authenticated user, so it can never be used to
      // request approval against another account.
      const result = await requestApproval.mutateAsync({ userId, opportunityId });
      if ((result as { success?: boolean }).success === false) {
        setError(
          (result as { error?: { message?: string } }).error?.message ??
            'The approval authority refused the request.',
        );
        return;
      }
      // The returned task id is the human decision reference. It is DISPLAYED,
      // never auto-decided.
      const returnedTaskId = (result as { data?: { taskId?: string } }).data?.taskId ?? '';
      setTaskId(returnedTaskId);
      setRequested(true);
      onApprovalRequested?.();
    } catch {
      setError('Could not reach the approval authority.');
    }
  };

  /**
   * HUMAN approval. `to: 'APPROVED'` is fixed in the hook and the record is
   * minted by the EXISTING Brain authority from the requested task id. Nothing
   * in this component calls it automatically — it is an explicit click.
   */
  const approveDecision = async (): Promise<void> => {
    setError('');
    try {
      const result = await approve.mutateAsync({
        userId,
        id: opportunityId,
        approvalTaskId: taskId,
      });
      if ((result as { success?: boolean }).success === false) {
        setError(
          (result as { error?: { message?: string } }).error?.message ??
            'The approval authority refused the approval.',
        );
        return;
      }
      setApprovedStatus('APPROVED');
      onApprovalRequested?.();
    } catch {
      setError('Could not approve the opportunity through the authority.');
    }
  };

  /**
   * HUMAN launch. Uses the EXISTING guarded `startMissionForOpportunity`
   * procedure — it launches exactly one Mission for an APPROVED opportunity and
   * never auto-runs on approval.
   */
  const startMissionForOpportunity = async (): Promise<void> => {
    setMissionError('');
    try {
      const result = await startMission.mutateAsync({ id: opportunityId });
      if ((result as { success?: boolean }).success === false) {
        setMissionError(
          (result as { error?: { message?: string } }).error?.message ??
            'The mission could not be started.',
        );
        return;
      }
      const returnedMissionId = (result as { data?: { missionId?: string } }).data?.missionId ?? '';
      setMissionId(returnedMissionId);
      onApprovalRequested?.();
    } catch {
      setMissionError('Could not start the mission.');
    }
  };

  /**
   * HUMAN rejection. `to: 'REJECTED'` is fixed in the hook; this never launches
   * work and never auto-runs.
   */
  const rejectDecision = async (): Promise<void> => {
    setError('');
    try {
      const result = await reject.mutateAsync({ userId, id: opportunityId });
      if ((result as { success?: boolean }).success === false) {
        setError(
          (result as { error?: { message?: string } }).error?.message ??
            'The opportunity could not be rejected.',
        );
        return;
      }
      setApprovedStatus('REJECTED');
      onApprovalRequested?.();
    } catch {
      setError('Could not reject the opportunity.');
    }
  };

  // ── Honest loading state ────────────────────────────────────────────────
  if (query.isLoading) {
    return (
      <div className="mt-1.5 rounded-lg border border-[#E2E8F0] bg-[#F1F5F9] p-2" role="status">
        <p className="text-[10px] text-[#64748B]">Loading value intelligence…</p>
      </div>
    );
  }

  // ── Honest two-source state: a discovery-sourced (Brain) opportunity has no
  //    control-plane qualification. It is stated plainly, never rendered as a
  //    verdict and never as a generic failure. ──────────────────────────────
  if (isNonControlRecord) {
    return (
      <div
        className="mt-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2"
        role="status"
        data-testid="value-intelligence-non-control"
      >
        <p className="text-[10px] text-[#64748B]">
          This opportunity is not a control-plane lifecycle record (for example, a discovery-sourced
          opportunity). Qualification and value intelligence are available only for a real lifecycle
          record — no verdict is fabricated.
        </p>
      </div>
    );
  }

  // ── Honest failure state (never a fabricated empty verdict) ──────────────
  if (query.isError || (query.data !== undefined && data === undefined)) {
    return (
      <div
        className="mt-1.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-2"
        role="alert"
        data-testid="value-intelligence-error"
      >
        <p className="text-[10px] text-[#B91C1C]">
          Value intelligence is unavailable right now. No verdict is shown because none was
          received.
        </p>
      </div>
    );
  }

  return (
    <div
      className="mt-1.5 rounded-lg border border-[#E2E8F0] bg-[#F1F5F9] p-2 space-y-1.5"
      data-testid="value-intelligence"
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#374151]">
        <TrendingUp className="h-3 w-3 text-[#7C3AED]" aria-hidden="true" />
        Value intelligence
      </span>

      {/* S7.2 — the opportunity facts a human needs for an informed DECISION,
          read VERBATIM from the canonical record (nothing invented). */}
      {data !== undefined &&
        (data.title !== undefined ||
          data.description !== undefined ||
          data.sourceRef !== undefined ||
          (data.requiredCapabilities ?? []).length > 0) && (
          <div className="space-y-0.5" data-testid="opportunity-decision-facts">
            {data.title !== undefined && (
              <p className="text-[10px] font-medium text-[#1F2937]">{data.title}</p>
            )}
            {data.sourceRef !== undefined && (
              <p className="text-[9px] text-[#94A3B8]">
                source: {data.sourceRef.source} · {data.sourceRef.sourceReference}
              </p>
            )}
            {data.description !== undefined && data.description !== '' && (
              <p className="text-[10px] text-[#64748B]" data-testid="opportunity-description">
                {data.description}
              </p>
            )}
            {(data.requiredCapabilities ?? []).length > 0 && (
              <p className="text-[10px] text-[#64748B]" data-testid="opportunity-capabilities">
                Required skills/capabilities: {data.requiredCapabilities?.join(', ')}
              </p>
            )}
          </div>
        )}

      {/* Qualification (the EXISTING assessor's evidence-based verdict) */}
      {data !== undefined && (
        <div className="space-y-0.5">
          <p className="text-[10px] text-[#64748B]">
            Qualification score: {data.assessment.score.toFixed(2)} · risk:{' '}
            {data.assessment.riskLevel}
          </p>
          <p className="text-[10px] text-[#64748B]">
            Evidence used: {data.inputsUsed.requiredCapabilities} required ·{' '}
            {data.inputsUsed.marketSignals} market signal
            {data.inputsUsed.marketSignals === 1 ? '' : 's'}
          </p>
        </div>
      )}

      {/* Value intelligence — only when the backend actually produced it. */}
      {value === undefined ? (
        <p className="text-[10px] text-[#94A3B8]">
          No value intelligence is available for this opportunity — the evidence source is not
          configured.
        </p>
      ) : (
        <div className="space-y-1" data-testid="value-intelligence-body">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${ASSESSMENT_STYLE[value.overallAssessment]}`}
            >
              {ASSESSMENT_LABEL[value.overallAssessment]}
            </span>
            <span className="text-[10px] text-[#64748B]">confidence:</span>
            {levelBadge(value.confidence)}
          </div>

          {/* DELIVERY evidence — distinct from commercial, never collapsed. */}
          <div className="rounded-md bg-white border border-[#E2E8F0] px-2 py-1">
            <p className="text-[10px] font-medium text-[#374151]">
              Delivery evidence {levelBadge(value.deliveryEvidence.level)}
            </p>
            {value.deliveryEvidence.sampleCount === 0 ? (
              <p className="text-[10px] text-[#94A3B8]">
                No verified delivery history — INSUFFICIENT, not a failure.
              </p>
            ) : (
              <p className="text-[10px] text-[#64748B]">
                {value.deliveryEvidence.successCount} successful ·{' '}
                {value.deliveryEvidence.failureCount} failed · {value.deliveryEvidence.sampleCount}{' '}
                sample
                {value.deliveryEvidence.sampleCount === 1 ? '' : 's'}
              </p>
            )}
          </div>

          {/* COMMERCIAL evidence — PAID is only ever the canonical paid count. */}
          <div className="rounded-md bg-white border border-[#E2E8F0] px-2 py-1">
            <p className="text-[10px] font-medium text-[#374151]">
              Commercial evidence {levelBadge(value.commercialEvidence.level)}
            </p>
            {value.commercialEvidence.sampleCount === 0 ? (
              <p className="text-[10px] text-[#94A3B8]">
                No commercial history — INSUFFICIENT, not a success and not a failure.
              </p>
            ) : (
              <p className="text-[10px] text-[#64748B]">
                {value.commercialEvidence.paidCount} paid · {value.commercialEvidence.pendingCount}{' '}
                pending · {value.commercialEvidence.cancelledCount} cancelled
              </p>
            )}
          </div>

          <p className="text-[10px] text-[#64748B]">
            Evidence: {value.evidenceCount} linked outcome{value.evidenceCount === 1 ? '' : 's'}
          </p>

          {/* Reasons — deterministic backend explanations, rendered verbatim. */}
          {value.reasons.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-[#374151]">Why</p>
              <ul className="space-y-0.5" data-testid="value-reasons">
                {value.reasons.map((reason, i) => (
                  <li key={`reason-${i}`} className="text-[10px] text-[#64748B]">
                    • {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Missing evidence — only when there is genuinely none to show. */}
          {value.deliveryEvidence.sampleCount === 0 && (
            <p className="text-[10px] text-[#92400E]" data-testid="missing-delivery">
              Missing: no verified delivery history yet.
            </p>
          )}
          {value.commercialEvidence.sampleCount === 0 && (
            <p className="text-[10px] text-[#92400E]" data-testid="missing-commercial">
              Missing: no linked commercial history yet.
            </p>
          )}
        </div>
      )}

      {/* ── HUMAN DECISION — the EXISTING authority-backed request, the
          explicit human approval/rejection, and the guarded mission launch. ── */}
      <div className="pt-1 border-t border-[#E2E8F0]">
        {status === 'APPROVED' ? (
          <div className="space-y-1">
            <p className="flex items-center gap-1 text-[10px] text-[#15803D]">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              This opportunity is approved. {value?.reasons[0] ?? ''}
            </p>
            {missionId !== '' ? (
              <div className="space-y-0.5" data-testid="mission-status">
                <p
                  className="text-[10px] text-[#7C3AED]"
                  role="status"
                  data-testid="mission-started"
                >
                  Mission created: {missionId}
                  {missionState !== '' ? ` · ${missionState}` : ''}
                </p>
                {missionSucceeded && (
                  <p
                    className="flex items-center gap-1 text-[10px] text-[#15803D]"
                    data-testid="mission-verified"
                  >
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    Mission VERIFIED. Delivery and external submission remain your explicit action.
                  </p>
                )}
                {missionFailed && (
                  <p
                    className="flex items-center gap-1 text-[10px] text-[#B91C1C]"
                    role="alert"
                    data-testid="mission-failed"
                  >
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    Mission {missionState}. No success is claimed — see the Mission for details.
                  </p>
                )}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void startMissionForOpportunity();
                  }}
                  disabled={startMission.isPending}
                  className="w-full rounded-lg bg-[#2B5FD9] text-white text-[10px] font-medium py-1 hover:bg-[#1E4AA8] transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
                  aria-label={`Start mission for ${opportunityId}`}
                >
                  {startMission.isPending ? 'Starting…' : 'Start mission'}
                </button>
                {missionError !== '' && (
                  <p className="flex items-center gap-1 text-[10px] text-[#B91C1C]" role="alert">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    {missionError}
                  </p>
                )}
                <p className="text-[9px] text-[#94A3B8]">
                  Starting runs the EXISTING autonomous mission loop. A human still verifies and
                  submits the result externally.
                </p>
              </>
            )}
          </div>
        ) : status === 'REJECTED' ? (
          <p className="flex items-center gap-1 text-[10px] text-[#64748B]" role="status">
            <XCircle className="h-3 w-3" aria-hidden="true" />
            This opportunity was rejected. No work will run for it.
          </p>
        ) : requested ? (
          <div className="space-y-1">
            <p className="flex items-center gap-1 text-[10px] text-[#7C3AED]" role="status">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Approval requested
              {taskId !== '' ? ` — task ${taskId}` : ''} — a human decision is pending with the
              approval authority.
            </p>
            <button
              type="button"
              onClick={() => {
                void approveDecision();
              }}
              disabled={approve.isPending || taskId === ''}
              className="w-full rounded-lg bg-[#15803D] text-white text-[10px] font-medium py-1 hover:bg-[#166534] transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
              aria-label={`Approve opportunity ${opportunityId}`}
            >
              {approve.isPending ? 'Approving…' : 'Approve opportunity'}
            </button>
            <button
              type="button"
              onClick={() => {
                void rejectDecision();
              }}
              disabled={reject.isPending}
              className="w-full rounded-lg bg-[#F1F5F9] text-[#B91C1C] text-[10px] font-medium py-1 hover:bg-[#E2E8F0] transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
              aria-label={`Reject opportunity ${opportunityId}`}
            >
              {reject.isPending ? 'Rejecting…' : 'Reject opportunity'}
            </button>
            {error !== '' && (
              <p className="flex items-center gap-1 text-[10px] text-[#B91C1C]" role="alert">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {error}
              </p>
            )}
            <p className="text-[9px] text-[#94A3B8]">
              Approval is an explicit human action. It is never granted automatically.
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                void requestDecision();
              }}
              disabled={requestApproval.isPending}
              className="w-full rounded-lg bg-[#2B5FD9] text-white text-[10px] font-medium py-1 hover:bg-[#1E4AA8] transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
              aria-label={`Request approval for ${opportunityId}`}
            >
              {requestApproval.isPending ? 'Requesting…' : 'Request approval'}
            </button>
            {error !== '' && (
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#B91C1C]" role="alert">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {error}
              </p>
            )}
            <p className="mt-0.5 text-[9px] text-[#94A3B8]">
              This registers a request with the existing approval authority. It never approves — the
              human remains the decision-maker.
            </p>
          </>
        )}
      </div>

      {value !== undefined && value.overallAssessment === 'HIGH_RISK' && (
        <p className="flex items-center gap-1 text-[9px] text-[#B91C1C]">
          <XCircle className="h-3 w-3" aria-hidden="true" />
          Negative canonical evidence outweighs any success for this opportunity.
        </p>
      )}
    </div>
  );
}
