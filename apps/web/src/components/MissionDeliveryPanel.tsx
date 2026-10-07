// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — REVENUE-001 · Mission delivery + commercial outcome panel
//
// COMPOSITION ONLY. This is the last UI inch of the first-revenue path: it turns
// a REAL, already-VERIFIED mission objective into a ClientOps DRAFT deliverable
// and then records that a HUMAN commercial action is pending.
//
// It creates NO artifact system, NO invoice engine and NO payment path. It
// reuses the EXISTING hooks:
//   • deriveDeliverableContent   — deterministic draft from the verified
//                                  objective (the same fields the frozen S4
//                                  handoff persists as provenance)
//   • useMissionDeliver          — mission.deliver (draft only,
//                                  pendingApproval stays true)
//   • useRecordCommercialOutcome — mission.recordCommercialOutcome (mints only
//                                  COMMERCIAL_PENDING)
//
// TRUTH RULES:
//   • Nothing is delivered unless a human clicks, edits and confirms.
//   • Nothing is sent, published, emailed or charged — ever.
//   • With no VERIFIED objective the panel states that honestly and offers no
//     action; it never fabricates a deliverable.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import {
  deriveDeliverableContent,
  useMissionDeliver,
  useRecordCommercialOutcome,
  type MissionStatusView,
} from '../lib/api-client.js';

export interface MissionDeliveryPanelProps {
  mission: MissionStatusView;
  /** The ClientOps client the deliverable belongs to (human-selected). */
  clientId: string;
  /** Only when the mission was launched from an opportunity; never invented. */
  opportunityId?: string;
}

export function MissionDeliveryPanel({
  mission,
  clientId,
  opportunityId,
}: MissionDeliveryPanelProps): React.JSX.Element {
  const draft = deriveDeliverableContent(mission);
  const deliver = useMissionDeliver();
  const recordOutcome = useRecordCommercialOutcome();

  const [name, setName] = useState(draft?.name ?? '');
  const [content, setContent] = useState(draft?.content ?? '');
  const [documentId, setDocumentId] = useState('');
  const [outcomeId, setOutcomeId] = useState('');
  const [error, setError] = useState('');

  // No verified objective → no deliverable. This is stated honestly.
  if (draft === undefined) {
    return (
      <div className="mt-1.5 rounded-lg border border-[#E2E8F0] bg-[#F1F5F9] p-2" role="status">
        <p className="text-[10px] text-[#64748B]">
          No VERIFIED objective yet — a deliverable is prepared only from real verified work.
        </p>
      </div>
    );
  }

  const prepare = async (): Promise<void> => {
    setError('');
    try {
      const result = await deliver.mutateAsync({
        missionId: mission.missionId,
        objectiveId: draft.objectiveId,
        clientId,
        deliverableName: name.trim().length > 0 ? name.trim() : draft.name,
        deliverableContent: content,
        ...(opportunityId !== undefined ? { opportunityId } : {}),
      });
      if ((result as { success?: boolean }).success === false) {
        setError(
          (result as { error?: { message?: string } }).error?.message ??
            'The deliverable draft could not be prepared.',
        );
        return;
      }
      setDocumentId((result as { data?: { documentId?: string } }).data?.documentId ?? '');
    } catch {
      setError('Could not prepare the deliverable draft.');
    }
  };

  const record = async (): Promise<void> => {
    setError('');
    try {
      const result = await recordOutcome.mutateAsync({
        missionId: mission.missionId,
        objectiveId: draft.objectiveId,
      });
      if ((result as { success?: boolean }).success === false) {
        setError(
          (result as { error?: { message?: string } }).error?.message ??
            'The commercial outcome could not be recorded.',
        );
        return;
      }
      setOutcomeId((result as { data?: { outcomeId?: string } }).data?.outcomeId ?? '');
    } catch {
      setError('Could not record the commercial outcome.');
    }
  };

  return (
    <div
      className="mt-1.5 rounded-lg border border-[#E2E8F0] bg-[#F1F5F9] p-2 space-y-1.5"
      data-testid="mission-delivery"
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#374151]">
        <FileText className="h-3 w-3 text-[#7C3AED]" aria-hidden="true" />
        Deliverable draft
      </span>

      {documentId === '' ? (
        <>
          <label className="block text-[10px] text-[#64748B]">
            Deliverable name
            <input
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              aria-label="deliverable-name"
              className="mt-0.5 w-full rounded-md border border-[#E2E8F0] px-1.5 py-0.5 text-[10px] text-[#1F2937]"
            />
          </label>
          <label className="block text-[10px] text-[#64748B]">
            Draft content (derived from the verified objective — edit before delivering)
            <textarea
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
              }}
              rows={6}
              aria-label="deliverable-content"
              className="mt-0.5 w-full rounded-md border border-[#E2E8F0] px-1.5 py-0.5 text-[10px] text-[#1F2937] font-mono"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              void prepare();
            }}
            disabled={
              deliver.isPending || content.trim().length === 0 || clientId.trim().length === 0
            }
            className="w-full rounded-lg bg-[#2B5FD9] text-white text-[10px] font-medium py-1 hover:bg-[#1E4AA8] transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
            aria-label="prepare-deliverable"
          >
            {deliver.isPending ? 'Preparing…' : 'Prepare draft deliverable'}
          </button>
          <p className="text-[9px] text-[#94A3B8]">
            Prepares a DRAFT only. Nothing is sent, published or charged — a human submits it.
          </p>
        </>
      ) : (
        <p
          className="flex items-center gap-1 text-[10px] text-[#15803D]"
          role="status"
          data-testid="deliverable-draft"
        >
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Draft deliverable prepared ({documentId}) — awaiting human submission.
        </p>
      )}

      {documentId !== '' && (
        <div className="pt-1 border-t border-[#E2E8F0] space-y-1">
          {outcomeId !== '' ? (
            <p
              className="flex items-center gap-1 text-[10px] text-[#7C3AED]"
              role="status"
              data-testid="commercial-pending"
            >
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Commercial outcome recorded — COMMERCIAL_PENDING. Payment stays human-controlled.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  void record();
                }}
                disabled={recordOutcome.isPending}
                className="w-full rounded-lg bg-[#7C3AED] text-white text-[10px] font-medium py-1 hover:bg-[#6D28D9] transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9]"
                aria-label="record-commercial-outcome"
              >
                {recordOutcome.isPending ? 'Recording…' : 'Record commercial outcome'}
              </button>
              <p className="text-[9px] text-[#94A3B8]">
                Records only that a commercial action is PENDING. No invoice, no payment, no
                contact.
              </p>
            </>
          )}
        </div>
      )}

      {error !== '' && (
        <p className="text-[10px] text-[#B91C1C]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
