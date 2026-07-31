// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section: Memory Timeline
// Recent memories, AI observations, and reflection prompts
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge } from '@vedmoulya/ui';
import { Sparkles, MessageCircle, Brain } from 'lucide-react';
import type { MemorySummary } from './types.js';

export interface MemoryTimelineProps {
  memory: MemorySummary;
}

export function MemoryTimeline({ memory }: MemoryTimelineProps): React.JSX.Element {
  return (
    <section>
      <h2 className="text-[20px] font-heading font-semibold text-[#111827] mb-4 flex items-center gap-2">
        <Brain className="h-5 w-5 text-[#7C3AED]" />
        Memory Timeline
        <Badge variant="ai" size="sm">
          {memory.totalMemories} total
        </Badge>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stats Card */}
        <Card variant="standard" padding="md">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-[#64748B]">Recent memories</span>
              <span className="text-[15px] font-bold text-[#111827]">{memory.recentCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-[#64748B]">Important events</span>
              <span className="text-[15px] font-bold text-[#F59E0B]">{memory.importantEvents}</span>
            </div>
            {memory.lastMemoryDate && (
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-[#64748B]">Last memory</span>
                <span className="text-[13px] text-[#94A3B8]">
                  {new Date(memory.lastMemoryDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* AI Observations */}
        <Card variant="standard" padding="md">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-[#7C3AED]" />
            <h3 className="text-[14px] font-semibold text-[#111827]">AI Observations</h3>
          </div>
          {memory.aiObservations.length > 0 ? (
            <ul className="space-y-2">
              {memory.aiObservations.map((obs, i) => (
                <li
                  key={`obs-${String(i)}`}
                  className="text-[13px] text-[#64748B] flex items-start gap-2"
                >
                  <span className="w-1 h-1 rounded-full bg-[#7C3AED] mt-1.5 shrink-0" />
                  {obs}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[#94A3B8] italic">No observations yet.</p>
          )}
        </Card>

        {/* Reflection Prompts */}
        <Card variant="standard" padding="md">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="h-4 w-4 text-[#2B5FD9]" />
            <h3 className="text-[14px] font-semibold text-[#111827]">Reflection</h3>
          </div>
          {memory.reflectionPrompts.length > 0 ? (
            <ul className="space-y-2">
              {memory.reflectionPrompts.map((prompt, i) => (
                <li
                  key={`prompt-${String(i)}`}
                  className="text-[13px] text-[#64748B] flex items-start gap-2"
                >
                  <span className="w-1 h-1 rounded-full bg-[#2B5FD9] mt-1.5 shrink-0" />
                  {prompt}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[#94A3B8] italic">No reflection prompts yet.</p>
          )}
        </Card>
      </div>
    </section>
  );
}
