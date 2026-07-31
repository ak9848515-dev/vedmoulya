// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section: AI Insights
// Life Score, quick stats, cross-domain insights, AI context
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card } from '@vedmoulya/ui';
import { Brain, TrendingUp, Zap, Award, Lightbulb, Sparkles } from 'lucide-react';
import type { Metrics, AIContext, ExecutionSummary, MemorySummary } from './types.js';

export interface AIInsightsProps {
  metrics: Pick<Metrics, 'lifeScore'>;
  execution: Pick<ExecutionSummary, 'completedToday' | 'activePlans'>;
  memory: Pick<MemorySummary, 'totalMemories'>;
  aiContext: AIContext;
  recommendationCount: number;
}

export function AIInsights({
  metrics,
  execution,
  memory,
  aiContext,
  recommendationCount,
}: AIInsightsProps): React.JSX.Element {
  return (
    <section>
      <h2 className="text-[20px] font-heading font-semibold text-[#111827] mb-4 flex items-center gap-2">
        <Brain className="h-5 w-5 text-[#7C3AED]" />
        AI Insights
      </h2>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="standard" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#F0FDF4]">
              <TrendingUp className="h-5 w-5 text-[#22C55E]" />
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-medium">Life Score</p>
              <p className="text-[22px] font-bold text-[#111827]">{metrics.lifeScore}</p>
            </div>
          </div>
        </Card>
        <Card variant="standard" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#EFF4FE]">
              <Zap className="h-5 w-5 text-[#2B5FD9]" />
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-medium">Tasks Done</p>
              <p className="text-[22px] font-bold text-[#111827]">
                {execution.completedToday}/{execution.activePlans}
              </p>
            </div>
          </div>
        </Card>
        <Card variant="standard" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FFFBEB]">
              <Award className="h-5 w-5 text-[#F59E0B]" />
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-medium">Memory</p>
              <p className="text-[22px] font-bold text-[#111827]">{memory.totalMemories}</p>
            </div>
          </div>
        </Card>
        <Card variant="standard" padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#F5F3FF]">
              <Lightbulb className="h-5 w-5 text-[#7C3AED]" />
            </div>
            <div>
              <p className="text-[12px] text-[#64748B] font-medium">AI Insights</p>
              <p className="text-[22px] font-bold text-[#111827]">{recommendationCount} new</p>
            </div>
          </div>
        </Card>
      </div>

      {/* AI Context Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Cross-Domain Insights */}
        {aiContext.crossDomainInsights.length > 0 && (
          <Card variant="standard" padding="md">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-[#7C3AED] mt-0.5 shrink-0" />
              <div>
                <p className="text-[14px] font-semibold text-[#111827]">Cross-Domain Insights</p>
                <ul className="mt-2 space-y-1.5">
                  {aiContext.crossDomainInsights.map((insight, i) => (
                    <li
                      key={`cdi-${String(i)}`}
                      className="text-[13px] text-[#64748B] flex items-start gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] mt-1.5 shrink-0" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}

        {/* Suggested Questions */}
        {aiContext.suggestedQuestions.length > 0 && (
          <Card variant="standard" padding="md">
            <div className="flex items-start gap-3">
              <Brain className="h-5 w-5 text-[#2B5FD9] mt-0.5 shrink-0" />
              <div>
                <p className="text-[14px] font-semibold text-[#111827]">Ask AI</p>
                <ul className="mt-2 space-y-1.5">
                  {aiContext.suggestedQuestions.map((question, i) => (
                    <li key={`q-${String(i)}`}>
                      <button
                        className="text-[13px] text-[#2B5FD9] hover:text-[#1E4AA8] transition-colors text-left flex items-start gap-2"
                        onClick={() => {}}
                        type="button"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2B5FD9] mt-1.5 shrink-0" />
                        {question}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Current Focus */}
      <Card variant="elevated" padding="md" className="mt-4">
        <div className="flex items-start gap-3">
          <Zap className="h-5 w-5 text-[#F59E0B] mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] text-[#64748B] font-medium">Current Focus</p>
            <p className="text-[15px] font-semibold text-[#111827] mt-0.5">
              {aiContext.currentFocus}
            </p>
            {aiContext.recentActivity.length > 0 && (
              <div className="mt-2">
                <p className="text-[12px] text-[#94A3B8] mb-1">Recent activity</p>
                <div className="flex flex-wrap gap-1.5">
                  {aiContext.recentActivity.map((activity, i) => (
                    <span
                      key={`act-${String(i)}`}
                      className="text-[11px] text-[#64748B] bg-[#F1F5F9] px-2 py-1 rounded-full"
                    >
                      {activity}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}
