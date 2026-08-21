// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Fabric Panel (SPRINT-030)
// A compact Provider Network surface inside the AICompanion: OBSERVED runtime
// provider health (UNKNOWN until real calls are observed — never fabricated),
// plus the fail-closed autonomy posture. Same design tokens as the rest of the
// companion; nothing here executes or authorizes anything.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../lib/trpc.js';
import { useAuthStore } from '../stores/auth-store.js';

interface ProviderHealth {
  providerId: string;
  state: string;
  observedCalls: number;
  recentSuccessRate: number;
  avgLatencyMs?: number;
  evidence: string[];
}

const STATE_STYLES: Record<string, string> = {
  HEALTHY: 'bg-[#DCFCE7] text-[#15803D]',
  DEGRADED: 'bg-[#FEF3C7] text-[#92400E]',
  UNAVAILABLE: 'bg-[#FEE2E2] text-[#B91C1C]',
  MISCONFIGURED: 'bg-[#FEE2E2] text-[#B91C1C]',
  UNKNOWN: 'bg-[#E2E8F0] text-[#64748B]',
};

export function FabricPanel(): React.JSX.Element {
  const userId = useAuthStore((s) => s.user?.userId ?? '');
  const healthQuery = api.fabric.allProviderHealth.useQuery(
    { userId },
    { enabled: userId.length > 0, refetchOnWindowFocus: false },
  );
  const [health, setHealth] = useState<ProviderHealth[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async (): Promise<void> => {
    if (!userId) return;
    setError('');
    try {
      const result = await healthQuery.refetch();
      if (result.data?.success && result.data.data) {
        setHealth(result.data.data as unknown as ProviderHealth[]);
      } else {
        setError('Could not reach the intelligence fabric.');
      }
    } catch {
      setError('Could not reach the intelligence fabric.');
    }
  }, [userId, healthQuery]);

  useEffect(() => {
    void load();
  }, [userId]);

  const observed = health.filter((h) => h.state !== 'UNKNOWN');
  const unknown = health.filter((h) => h.state === 'UNKNOWN');

  return (
    <div className="w-full" data-testid="fabric-panel">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151]">
          <Activity className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
          Provider network
        </span>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[#64748B] hover:bg-[#F1F5F9] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
          aria-label="Refresh provider health"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
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

      {!error && observed.length === 0 && (
        <p className="px-1 pb-2 text-[12px] text-[#94A3B8]">
          No runtime observations yet — provider health is UNKNOWN until real calls are observed.
        </p>
      )}

      <ul className="space-y-1.5">
        {[...observed, ...unknown].slice(0, 6).map((h) => (
          <li
            key={h.providerId}
            className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="truncate text-[12px] font-medium text-[#1F2937]">
                {h.providerId}
              </span>
              {h.avgLatencyMs !== undefined && (
                <span className="shrink-0 text-[10px] text-[#94A3B8]">
                  {Math.round(h.avgLatencyMs)}ms avg
                </span>
              )}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATE_STYLES[h.state] ?? STATE_STYLES.UNKNOWN}`}
              title={h.evidence.join(' ')}
            >
              {h.state}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 flex items-center gap-1 px-1 text-[10px] text-[#94A3B8]">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        Autonomy is gated — nothing executes without the existing approval authority.
      </p>
    </div>
  );
}
