// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section: Execution Center
// Active plans, completed today, blocked plans, recovery suggestions
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card } from '@vedmoulya/ui';
import { ListChecks, AlertTriangle, ArrowRight } from 'lucide-react';
import type { ExecutionSummary } from './types.js';

export interface ExecutionCenterProps {
  execution: ExecutionSummary;
}

export function ExecutionCenter({ execution }: ExecutionCenterProps): React.JSX.Element {
  return (
    <Card variant="standard" padding="md">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-[#EFF4FE]">
          <ListChecks className="h-4 w-4 text-[#2B5FD9]" />
        </div>
        <h3 className="text-[16px] font-semibold text-[#111827]">Execution Center</h3>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center py-1">
          <span className="text-[14px] text-[#64748B]">Active plans</span>
          <span className="text-[16px] font-bold text-[#111827]">{execution.activePlans}</span>
        </div>
        <div className="flex justify-between items-center py-1">
          <span className="text-[14px] text-[#64748B]">Completed today</span>
          <span className="text-[16px] font-bold text-[#22C55E]">{execution.completedToday}</span>
        </div>
        <div className="flex justify-between items-center py-1">
          <span className="text-[14px] text-[#64748B]">Estimated time</span>
          <span className="text-[16px] font-bold text-[#111827]">
            {String(execution.totalEstimatedMinutes)}m
          </span>
        </div>
        <div className="flex justify-between items-center py-1">
          <span className="flex items-center gap-1.5 text-[14px] text-[#64748B]">
            Blocked
            {execution.blockedPlans > 0 && <AlertTriangle className="h-3.5 w-3.5 text-[#EF4444]" />}
          </span>
          <span
            className={`text-[16px] font-bold ${
              execution.blockedPlans > 0 ? 'text-[#EF4444]' : 'text-[#111827]'
            }`}
          >
            {execution.blockedPlans}
          </span>
        </div>
        <div className="pt-1 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2B5FD9] rounded-full transition-all duration-500"
              style={{
                width: `${String(execution.activePlans > 0 ? Math.round((execution.completedToday / (execution.activePlans + execution.completedToday)) * 100) : 0)}%`,
              }}
            />
          </div>
          <span className="text-[12px] text-[#64748B] font-medium">
            {execution.activePlans > 0
              ? String(
                  Math.round(
                    (execution.completedToday /
                      (execution.activePlans + execution.completedToday)) *
                      100,
                  ),
                )
              : '0'}
            %
          </span>
        </div>
        {execution.recoverySuggestions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
            <p className="text-[12px] font-semibold text-[#64748B] mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-[#F59E0B]" />
              Recovery Suggestions
            </p>
            {execution.recoverySuggestions.map((suggestion, i) => (
              <p
                key={`recovery-${String(i)}`}
                className="text-[13px] text-[#64748B] flex items-start gap-1.5 py-0.5"
              >
                <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-[#2B5FD9]" />
                {suggestion}
              </p>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
