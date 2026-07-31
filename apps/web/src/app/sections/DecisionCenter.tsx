// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section: Decision Center
// Pending decisions, confidence score, high risk items, top pending list
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Progress } from '@vedmoulya/ui';
import { Brain, AlertTriangle } from 'lucide-react';
import type { DecisionSummary } from './types.js';

export interface DecisionCenterProps {
  decisions: DecisionSummary;
}

export function DecisionCenter({ decisions }: DecisionCenterProps): React.JSX.Element {
  return (
    <Card variant="standard" padding="md">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-[#F5F3FF]">
          <Brain className="h-4 w-4 text-[#7C3AED]" />
        </div>
        <h3 className="text-[16px] font-semibold text-[#111827]">Decision Center</h3>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center py-1">
          <span className="text-[14px] text-[#64748B]">Pending</span>
          <span className="text-[16px] font-bold text-[#F59E0B]">{decisions.pendingDecisions}</span>
        </div>
        <div className="flex justify-between items-center py-1">
          <span className="text-[14px] text-[#64748B]">Made today</span>
          <span className="text-[16px] font-bold text-[#22C55E]">{decisions.decisionsToday}</span>
        </div>
        <div className="py-1">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[14px] text-[#64748B]">Avg confidence</span>
            <span className="text-[14px] font-bold text-[#7C3AED]">
              {String(decisions.averageConfidence)}%
            </span>
          </div>
          <Progress value={decisions.averageConfidence} variant="ai" size="sm" />
        </div>
        <div className="flex justify-between items-center py-1">
          <span className="flex items-center gap-1.5 text-[14px] text-[#64748B]">
            High risk
            {decisions.highRiskCount > 0 && (
              <AlertTriangle className="h-3.5 w-3.5 text-[#EF4444]" />
            )}
          </span>
          <span
            className={`text-[16px] font-bold ${
              decisions.highRiskCount > 0 ? 'text-[#EF4444]' : 'text-[#111827]'
            }`}
          >
            {decisions.highRiskCount}
          </span>
        </div>
        {decisions.topPending.length > 0 && (
          <div className="mt-2 pt-3 border-t border-[#E2E8F0]">
            <p className="text-[12px] font-semibold text-[#64748B] mb-2">Top Pending Decisions</p>
            {decisions.topPending.map((item, i) => (
              <p
                key={`pending-${String(i)}`}
                className="text-[13px] text-[#64748B] flex items-start gap-2 py-0.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] mt-1.5 shrink-0" />
                {item}
              </p>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
