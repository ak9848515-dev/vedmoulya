// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section: Priorities List
// All priorities with severity colors, blocked indicators, and source badges
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge } from '@vedmoulya/ui';
import { ListChecks } from 'lucide-react';
import type { Priority } from './types.js';
import { priorityLabel, priorityColor } from './types.js';

export interface PrioritiesListProps {
  priorities: Priority[];
}

export function PrioritiesList({ priorities }: PrioritiesListProps): React.JSX.Element {
  return (
    <section>
      <h2 className="text-[20px] font-heading font-semibold text-[#111827] mb-4 flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-[#2B5FD9]" />
        Priorities
      </h2>
      <div className="space-y-2">
        {priorities.length > 0 ? (
          priorities.map((p) => (
            <Card key={p.id} variant="standard" padding="md">
              <div className="flex items-center gap-3">
                <div
                  className={`w-1 h-10 rounded-full shrink-0 ${
                    p.isBlocked ? 'bg-[#EF4444]' : 'bg-[#2B5FD9]'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className={`text-[14px] font-semibold ${
                        p.isBlocked ? 'text-[#EF4444]' : 'text-[#111827]'
                      }`}
                    >
                      {p.title}
                    </p>
                    <span className={`text-[11px] font-medium ${priorityColor[p.priority] ?? ''}`}>
                      {priorityLabel[p.priority] ?? ''}
                    </span>
                    {p.isBlocked && (
                      <Badge variant="danger" size="sm">
                        BLOCKED
                      </Badge>
                    )}
                  </div>
                  <p className="text-[13px] text-[#64748B] mt-0.5 truncate">{p.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-[#94A3B8] capitalize">{p.source}</span>
                  {p.deadline && (
                    <span className="text-[11px] text-[#94A3B8] hidden md:inline">
                      {new Date(p.deadline).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))
        ) : (
          <p className="text-[14px] text-[#94A3B8] italic">No priorities set.</p>
        )}
      </div>
    </section>
  );
}
