'use client';

import React from 'react';
import type { MissionStatusView } from '../../../lib/api-client.js';
import { CheckCircle2, AlertTriangle, Clock, Target } from 'lucide-react';

interface MissionResultProps {
  status: MissionStatusView;
}

export function MissionResult({ status }: MissionResultProps): React.JSX.Element {
  const isCompleted = status.state === 'COMPLETED';
  const isFailed = status.state === 'FAILED';
  const hasOutcome = isCompleted || isFailed || status.state === 'CANCELLED';
  const verifiedCount = status.objectives.filter((o) => o.state === 'VERIFIED').length;
  const totalCount = status.objectives.length;

  if (!hasOutcome) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-[#64748B]">
          <Target className="h-4 w-4" />
          <h2 className="text-[15px] font-semibold text-[#111827]">Result</h2>
        </div>
        <div className="rounded-lg border border-slate-200 p-6 text-center">
          <p className="text-[13px] text-[#64748B]">
            The mission is still in progress. Results will appear here when complete.
          </p>
          {status.state === 'RUNNING' && (
            <p className="text-[13px] text-[#2B5FD9] mt-2">VedMoulya is actively working.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[#64748B]">
        <Target className="h-4 w-4" />
        <h2 className="text-[15px] font-semibold text-[#111827]">Result</h2>
      </div>

      <div
        className={`rounded-lg border p-6 ${isCompleted ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}
      >
        <div className="flex items-start gap-4">
          {isCompleted ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0 mt-1" />
          ) : (
            <AlertTriangle className="h-8 w-8 text-rose-500 shrink-0 mt-1" />
          )}
          <div className="min-w-0">
            <h3
              className={`text-[18px] font-semibold ${isCompleted ? 'text-emerald-700' : 'text-rose-700'}`}
            >
              {isCompleted ? 'Mission Completed' : 'Mission Failed'}
            </h3>
            <p className="text-[14px] text-[#64748B] mt-1">
              {isCompleted
                ? 'VedMoulya successfully completed this mission.'
                : 'VedMoulya could not complete this mission.'}
            </p>
            {status.outcomeReason && <p className="text-[13px] mt-2">{status.outcomeReason}</p>}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[#64748B] mb-3">
          Verification Status
        </h3>
        <div className="flex items-center gap-4">
          {verifiedCount === totalCount && totalCount > 0 ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : (
            <Clock className="h-5 w-5 text-[#2B5FD9]" />
          )}
          <span className="text-[14px] font-medium text-[#111827]">
            {verifiedCount}/{totalCount} objectives verified
          </span>
        </div>
      </div>

      {status.finishedAt && (
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[#64748B] mb-3">
            Timeline
          </h3>
          <div className="space-y-2 text-[13px] text-[#64748B]">
            <div className="flex justify-between">
              <span>Started</span>
              <span>{new Date(status.startedAt ?? status.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Finished</span>
              <span>{new Date(status.finishedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {status.objectives.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-[#64748B] mb-3">
            Objectives
          </h3>
          <ul className="space-y-2">
            {status.objectives.map((o) => (
              <li
                key={o.objectiveId}
                className={`flex items-start gap-3 p-2 rounded ${o.state === 'VERIFIED' ? 'bg-emerald-50' : ''}`}
              >
                {o.state === 'VERIFIED' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#111827]">{o.title}</p>
                  <p className="text-[11px] text-[#94A3B8] uppercase tracking-wide">{o.state}</p>
                  {o.verifiedAt && (
                    <p className="text-[11px] text-[#94A3B8] mt-1">
                      Verified {new Date(o.verifiedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
