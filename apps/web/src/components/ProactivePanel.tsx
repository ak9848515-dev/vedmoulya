// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Proactive Intelligence Panel (SPRINT-029)
// A unified surface for proactive recommendations inside the AICompanion —
// same design tokens, same one-product feel. Every card communicates
// WHAT / WHY / VALUE / RISK / COST / ACTION. Nothing here authorizes
// anything: dismiss/accept just record the user's explicit choice; any
// authorization-required recommendation is refused server-side.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Sparkles,
  ShieldAlert,
  Zap,
  Clock,
  CircleDollarSign,
  TrendingUp,
  X,
  RefreshCw,
  Check,
} from 'lucide-react';
import { api } from '../lib/trpc.js';
import { useAuthStore } from '../stores/auth-store.js';

interface Recommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  evidence: string[];
  confidence: number;
  expectedValue?: { label: string; status: string };
  urgency: string;
  estimatedCost?: { label: string; status: string };
  requiredCapabilities?: string[];
  recommendedWorkflow?: string[];
  authorizationRequired: boolean;
  riskLevel: string;
  status: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  OPPORTUNITY: 'Opportunity',
  RISK: 'Risk',
  TASK: 'Task',
  AUTOMATION: 'Automation',
  REVENUE_OPPORTUNITY: 'Revenue',
  COST_SAVING: 'Cost saving',
  TIME_SAVING: 'Time saving',
  LEARNING_OPPORTUNITY: 'Learning',
  BUSINESS_OPPORTUNITY: 'Business',
  SYSTEM_IMPROVEMENT: 'System',
};

const URGENCY_STYLES: Record<string, string> = {
  HIGH: 'bg-[#FEE2E2] text-[#B91C1C]',
  MEDIUM: 'bg-[#FEF3C7] text-[#92400E]',
  LOW: 'bg-[#E2E8F0] text-[#475569]',
};

export function ProactivePanel(): React.JSX.Element {
  const userId = useAuthStore((s) => s.user?.userId ?? '');
  const refresh = api.proactive.refresh.useMutation();
  const dismiss = api.proactive.dismiss.useMutation();
  const accept = api.proactive.accept.useMutation();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const result = await refresh.mutateAsync({ userId });
      if (result.success && result.data) {
        setRecs(result.data as unknown as Recommendation[]);
      } else {
        setError(result.error?.message ?? 'Could not refresh recommendations.');
      }
    } catch {
      setError('Could not reach the proactive service. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId, refresh]);

  useEffect(() => {
    void load();
  }, [userId]);

  const onDismiss = useCallback(
    async (id: string): Promise<void> => {
      await dismiss.mutateAsync({ userId, recommendationId: id });
      setRecs((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'DISMISSED' } : r)));
    },
    [userId, dismiss],
  );

  const onAccept = useCallback(
    async (id: string): Promise<void> => {
      const result = await accept.mutateAsync({ userId, recommendationId: id });
      if (result.success && result.data) {
        setRecs((prev) => prev.map((r) => (r.id === id ? (result.data as Recommendation) : r)));
      } else {
        setError(
          result.error?.message ?? 'That action requires approval through the normal channel.',
        );
      }
    },
    [userId, accept],
  );

  return (
    <div className="w-full" data-testid="proactive-panel">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151]">
          <Sparkles className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
          Proactive intelligence
        </span>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[#64748B] hover:bg-[#F1F5F9] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] disabled:opacity-40"
          aria-label="Refresh recommendations"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {error && (
        <div
          className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 mb-2 text-[12px] text-[#B91C1C]"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && recs.length === 0 && (
        <p className="px-1 pb-2 text-[12px] text-[#94A3B8]">Thinking about what could help…</p>
      )}

      {!loading && recs.length === 0 && !error && (
        <p className="px-1 pb-2 text-[12px] text-[#94A3B8]">
          No recommendations yet — nothing is proposed without evidence.
        </p>
      )}

      <ul className="space-y-2">
        {recs
          .filter((r) => r.status !== 'DISMISSED')
          .slice(0, 8)
          .map((r) => (
            <li key={r.id} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="shrink-0 rounded-full bg-[#EDE9FE] px-2 py-0.5 text-[10px] font-medium text-[#6D28D9]">
                    {CATEGORY_LABELS[r.category] ?? r.category}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${URGENCY_STYLES[r.urgency] ?? ''}`}
                  >
                    {r.urgency}
                  </span>
                  {r.authorizationRequired && (
                    <span
                      className="flex shrink-0 items-center gap-0.5 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-medium text-[#92400E]"
                      title="Approval required through the existing mechanism"
                    >
                      <ShieldAlert className="h-3 w-3" aria-hidden="true" /> Approval
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      void onAccept(r.id);
                    }}
                    disabled={r.authorizationRequired}
                    className="p-1 rounded-md text-[#16A34A] hover:bg-[#DCFCE7] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={
                      r.authorizationRequired
                        ? 'Approval required — cannot accept here'
                        : 'Accept recommendation'
                    }
                    title={
                      r.authorizationRequired ? 'Approval required — cannot accept here' : 'Accept'
                    }
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => void onDismiss(r.id)}
                    className="p-1 rounded-md text-[#94A3B8] hover:bg-[#F1F5F9] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#94A3B8]"
                    aria-label="Dismiss recommendation"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setExpanded(expanded === r.id ? null : r.id);
                }}
                className="mt-1 text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded-md"
                aria-expanded={expanded === r.id}
              >
                <p className="text-[13px] font-medium text-[#1F2937]">{r.title}</p>
                <p className="text-[12px] text-[#64748B] line-clamp-2">{r.description}</p>
              </button>

              {expanded === r.id && (
                <div className="mt-2 space-y-1.5 border-t border-[#E2E8F0] pt-2">
                  {r.expectedValue && (
                    <p className="flex items-center gap-1 text-[11px] text-[#374151]">
                      <TrendingUp className="h-3 w-3 text-[#16A34A]" aria-hidden="true" /> Value:{' '}
                      {r.expectedValue.label}
                    </p>
                  )}
                  {r.estimatedCost && (
                    <p className="flex items-center gap-1 text-[11px] text-[#374151]">
                      <CircleDollarSign className="h-3 w-3 text-[#92400E]" aria-hidden="true" />{' '}
                      Cost: {r.estimatedCost.label}
                    </p>
                  )}
                  {r.requiredCapabilities && r.requiredCapabilities.length > 0 && (
                    <p className="flex items-center gap-1 text-[11px] text-[#374151]">
                      <Zap className="h-3 w-3 text-[#7C3AED]" aria-hidden="true" /> Needs:{' '}
                      {r.requiredCapabilities.join(', ')}
                    </p>
                  )}
                  <p className="flex items-center gap-1 text-[11px] text-[#475569]">
                    <Clock className="h-3 w-3 text-[#64748B]" aria-hidden="true" /> Why:{' '}
                    {r.evidence.join(' · ')}
                  </p>
                  {r.recommendedWorkflow && r.recommendedWorkflow.length > 0 && (
                    <ol className="list-decimal list-inside text-[11px] text-[#475569] space-y-0.5">
                      {r.recommendedWorkflow.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </li>
          ))}
      </ul>
    </div>
  );
}
