// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section: AI Recommendations Panel
// Cross-domain AI recommendations with confidence scores
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card } from '@vedmoulya/ui';
import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Recommendation } from './types.js';

export interface RecommendationsPanelProps {
  recommendations: Recommendation[];
  emptyMessage?: string;
}

export function RecommendationsPanel({
  recommendations,
  emptyMessage = 'No recommendations yet.',
}: RecommendationsPanelProps): React.JSX.Element {
  const router = useRouter();
  return (
    <section>
      <h2 className="text-[20px] font-heading font-semibold text-[#111827] mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[#7C3AED]" />
        AI Recommendations
      </h2>
      <div className="space-y-3">
        {recommendations.length > 0 ? (
          recommendations.map((rec) => (
            <Card key={rec.id} variant="standard" padding="md">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#F5F3FF]">
                  <Sparkles className="h-4 w-4 text-[#7C3AED]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[14px] font-semibold text-[#111827]">{rec.title}</h4>
                    {rec.confidence >= 90 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#22C55E]">
                        HIGH
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-[#64748B] mt-0.5">{rec.description}</p>
                  {rec.reason && (
                    <p className="text-[12px] text-[#374151] mt-1.5 flex items-start gap-1.5">
                      <span
                        className="mt-1 h-1 w-1 rounded-full bg-[#0EA5A9] shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        <span className="font-semibold text-[#0EA5A9]">Why this matters — </span>
                        {rec.reason}
                      </span>
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] text-[#7C3AED] font-medium bg-[#F5F3FF] px-2 py-0.5 rounded-full">
                      {rec.confidence}% confidence
                    </span>
                    <span className="text-[11px] text-[#94A3B8]">{rec.sources.join(' + ')}</span>
                    {rec.actionLabel && (
                      <button
                        className="ml-auto text-[11px] font-medium text-[#2B5FD9] hover:text-[#1E4AA8] transition-colors"
                        onClick={() => {
                          if (rec.actionRoute.startsWith('/')) {
                            router.push(rec.actionRoute);
                          }
                        }}
                        type="button"
                      >
                        {rec.actionLabel} →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <p className="text-[14px] text-[#94A3B8] italic">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}
