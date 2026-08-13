// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Learning Intelligence: Recommendations view
// EPIC-004 / EI-007 — Enterprise Learning Intelligence Platform
// The seven best-* recommendations with the human-approval workflow:
// approve, reject, and rollback (versioned + audited). Learning NEVER
// bypasses human approval for architectural or critical behavioral changes.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import {
  useLearningIntelligenceRecommendations,
  useApproveLearningRecommendation,
  useRejectLearningRecommendation,
  useRollbackLearningRecommendation,
} from '../../lib/api-client.js';
import { useAuthStore } from '../../stores/auth-store.js';
import { Sparkles, ShieldCheck, ThumbsUp, ThumbsDown, RotateCcw, Check } from 'lucide-react';
import {
  CATEGORY_COLORS,
  RECOMMENDATION_STATUS_COLORS,
  formatPct,
  formatDate,
} from './learning-ui.js';

const TYPE_LABELS: Record<string, string> = {
  best_provider: 'Best Provider',
  best_context: 'Best Context',
  best_strategy: 'Best Strategy',
  best_capability: 'Best Capability',
  best_budget: 'Best Budget',
  best_prompt: 'Best Prompt',
  best_execution_pattern: 'Best Execution Pattern',
};

export function RecommendationsView({ userId }: { userId: string }): React.JSX.Element {
  const { user } = useAuthStore();
  const { data, isLoading, isError, refetch } = useLearningIntelligenceRecommendations(userId);
  const approve = useApproveLearningRecommendation();
  const reject = useRejectLearningRecommendation();
  const rollback = useRollbackLearningRecommendation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; message: string; ok: boolean } | null>(
    null,
  );

  const actor = user?.email ?? user?.userId ?? 'human-owner';

  const act = async (
    recommendationId: string,
    action: 'approve' | 'reject' | 'rollback',
  ): Promise<void> => {
    setBusyId(recommendationId);
    setFeedback(null);
    const fn =
      action === 'approve'
        ? approve.mutateAsync
        : action === 'reject'
          ? reject.mutateAsync
          : rollback.mutateAsync;
    try {
      const result = await fn({ userId, recommendationId, actor });
      const decision = result.data as { version?: number } | undefined;
      setFeedback({
        id: recommendationId,
        message: `Recommendation ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'rolled back'} (v${decision?.version ?? '—'}).`,
        ok: true,
      });
    } catch (error) {
      setFeedback({
        id: recommendationId,
        message: error instanceof Error ? error.message : 'Recommendation action failed.',
        ok: false,
      });
    }
    setBusyId(null);
    void refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Generating recommendations…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<Sparkles className="h-10 w-10" />}
        title="Recommendations unavailable"
        description="Learning recommendations could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-10 w-10" />}
        title="No recommendations yet"
        description="Record learning signals (Explorer tab) and the engine will derive best provider, context, strategy, capability, budget, prompt, and execution-pattern recommendations."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 p-3">
        <ShieldCheck className="h-5 w-5 text-[#22C55E]" />
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Every recommendation requires <strong>human approval</strong> before it becomes
          actionable. Approvals are versioned and audited, and can always be rolled back.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.map((recommendation) => {
          const color = CATEGORY_COLORS[recommendation.category] ?? '#64748B';
          const statusColor =
            RECOMMENDATION_STATUS_COLORS[recommendation.status] ?? 'bg-slate-400 text-white';
          const isBusy = busyId === recommendation.recommendationId;
          const isFinal = recommendation.status !== 'pending';
          return (
            <Card key={recommendation.recommendationId} className="flex flex-col p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {TYPE_LABELS[recommendation.type] ?? recommendation.type}
                  </span>
                </div>
                <Badge className={`text-[10px] ${statusColor}`}>{recommendation.status}</Badge>
              </div>

              <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-white">
                {recommendation.targetEntity.entityLabel}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {recommendation.description}
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Metric label="Value" value={formatPct(recommendation.value)} color={color} />
                <Metric label="Confidence" value={formatPct(recommendation.confidence)} />
                <Metric label="Samples" value={String(recommendation.sampleCount)} />
              </div>

              <ul className="mt-3 space-y-1">
                {recommendation.rationale.slice(0, 3).map((line) => (
                  <li key={line} className="text-[11px] text-slate-400">
                    · {line}
                  </li>
                ))}
              </ul>

              <div className="mt-2 text-[10px] text-slate-300 dark:text-slate-500">
                v{recommendation.version} · {formatDate(recommendation.updatedAt)}
              </div>

              {feedback?.id === recommendation.recommendationId && (
                <p
                  className={`mt-2 rounded-md px-2 py-1 text-xs ${
                    feedback.ok ? 'bg-[#22C55E]/10 text-[#15803D]' : 'bg-[#EF4444]/10 text-red-600'
                  }`}
                >
                  {feedback.message}
                </p>
              )}

              <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                {!isFinal && (
                  <>
                    <button
                      disabled={isBusy || approve.isPending}
                      onClick={() => void act(recommendation.recommendationId, 'approve')}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#22C55E] px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-[#16A34A] disabled:opacity-50"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button
                      disabled={isBusy || reject.isPending}
                      onClick={() => void act(recommendation.recommendationId, 'reject')}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" /> Reject
                    </button>
                  </>
                )}
                {recommendation.status === 'approved' && (
                  <button
                    disabled={isBusy || rollback.isPending}
                    onClick={() => void act(recommendation.recommendationId, 'rollback')}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#EF4444] px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-[#DC2626] disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Roll back
                  </button>
                )}
                {isFinal && (
                  <span className="flex flex-1 items-center justify-center gap-1.5 text-xs font-medium text-slate-400">
                    <Check className="h-3.5 w-3.5" /> Decision recorded (audited)
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}): React.JSX.Element {
  return (
    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div
        className="text-sm font-bold text-slate-800 dark:text-slate-100"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
