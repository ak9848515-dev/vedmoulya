// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Center: Retention Manager
// EPIC-004 / EI-010 — Enterprise Memory Intelligence Platform
// Every memory carries a retention policy with an absolute expiry timestamp.
// This manager surfaces the retention exposure, the memories closest to
// expiry, and the exact expiration clock for each policy.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   the only indexed accesses are typed Record lookups keyed by the closed
   MemoryRetentionPolicy union (RETENTION_COLORS[p], POLICY_TTL[p]) — no
   runtime attacker-controlled keys. */

'use client';

import React, { useState } from 'react';
import { Card, Loading, EmptyState, Button, Select } from '@vedmoulya/ui';
import {
  useMemoryItems,
  useExpireMemories,
  useTransitionMemoryLifecycle,
} from '../../lib/api-client.js';
import { useAuthStore } from '../../stores/auth-store.js';
import { Hourglass, Clock, ShieldCheck } from 'lucide-react';
import type { MemoryRetentionPolicy } from '@vedmoulya/memory-intelligence';
import { RETENTION_COLORS, formatDateTime } from './memory-ui.js';

const POLICY_OPTIONS = [
  { value: '', label: 'All policies' },
  { value: 'ephemeral', label: 'Ephemeral (24h)' },
  { value: 'short_term', label: 'Short term (7d)' },
  { value: 'medium_term', label: 'Medium term (30d)' },
  { value: 'long_term', label: 'Long term (365d)' },
  { value: 'permanent', label: 'Permanent' },
];

const POLICY_TTL: Record<MemoryRetentionPolicy, string> = {
  ephemeral: '1 day',
  short_term: '7 days',
  medium_term: '30 days',
  long_term: '365 days',
  permanent: 'never',
};

export function RetentionView({ userId }: { userId: string }): React.JSX.Element {
  const { user } = useAuthStore();
  const actor = user?.email ?? user?.userId ?? 'human-owner';
  const [policy, setPolicy] = useState<MemoryRetentionPolicy | ''>('');
  const [feedback, setFeedback] = useState<{ message: string; ok: boolean } | null>(null);

  const { data, isLoading, isError, refetch } = useMemoryItems(userId, {
    retentionPolicy: policy || undefined,
    limit: 80,
  });
  const expire = useExpireMemories();
  const lifecycleMutation = useTransitionMemoryLifecycle();

  const expireDue = async (): Promise<void> => {
    setFeedback(null);
    try {
      const res = await expire.mutateAsync({ userId, actor });
      const payload = res.data as { expired?: number; purged?: number } | undefined;
      setFeedback({
        message: `Expired ${payload?.expired ?? 0} memories${payload?.purged ? `, purged ${payload.purged}` : ''}.`,
        ok: true,
      });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : 'Expiry failed.',
        ok: false,
      });
    }
    void refetch();
  };

  const archiveNow = async (memoryId: string, title: string): Promise<void> => {
    setFeedback(null);
    try {
      await lifecycleMutation.mutateAsync({ userId, memoryId, to: 'archived', actor });
      setFeedback({ message: `Archived "${title}".`, ok: true });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : 'Archive failed.',
        ok: false,
      });
    }
    void refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading retention policies…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<Hourglass className="h-10 w-10" />}
        title="Retention data unavailable"
        description="The memory retention manager could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const items = data.items;
  const now = Date.now();
  const expiring = items
    .filter((i) => i.expiresAt && i.lifecycleStatus !== 'expired')
    .map((i) => ({ item: i, remainingMs: new Date(i.expiresAt as string).getTime() - now }))
    .filter((i) => i.remainingMs > 0)
    .sort((a, b) => a.remainingMs - b.remainingMs);
  const dueCount = items.filter(
    (i) => i.expiresAt && i.lifecycleStatus !== 'expired' && new Date(i.expiresAt).getTime() <= now,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Retention Manager
          </h3>
          <p className="text-xs text-slate-400">
            TTL by policy · {dueCount} memories due for expiry now
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={policy}
            onChange={(e) => {
              setPolicy(e.target.value as MemoryRetentionPolicy | '');
            }}
            placeholder="All policies"
            options={POLICY_OPTIONS}
            className="w-44"
          />
          <Button onClick={() => void expireDue()} variant="secondary" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Expire due now
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-2 text-sm ${
            feedback.ok
              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* ── Policy legend ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(
          [
            'ephemeral',
            'short_term',
            'medium_term',
            'long_term',
            'permanent',
          ] as MemoryRetentionPolicy[]
        ).map((p) => {
          const count = items.filter((i) => i.retentionPolicy === p).length;
          return (
            <Card
              key={p}
              className="p-4"
              style={{ borderTop: `3px solid ${RETENTION_COLORS[p] ?? '#64748B'}` }}
            >
              <div className="text-xs font-semibold capitalize text-slate-700 dark:text-slate-200">
                {p.replace('_', ' ')}
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{count}</div>
              <div className="text-[11px] text-slate-400">TTL: {POLICY_TTL[p]}</div>
            </Card>
          );
        })}
      </div>

      {/* ── Expiring soon ───────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Hourglass className="h-4 w-4 text-[#F59E0B]" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Expiring Soon
          </h3>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Memories closest to their retention deadline — reinforce to keep, archive or let expire.
        </p>
        <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {expiring.length === 0 && (
            <p className="py-8 text-center text-xs text-slate-400">
              Nothing expiring soon — all memories within their retention windows.
            </p>
          )}
          {expiring.slice(0, 30).map(({ item, remainingMs }) => {
            const days = Math.floor(remainingMs / 86_400_000);
            const hours = Math.floor((remainingMs % 86_400_000) / 3_600_000);
            const urgent = remainingMs < 2 * 86_400_000;
            return (
              <div
                key={item.memoryId}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 dark:border-slate-700 ${
                  urgent
                    ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10'
                    : 'border-slate-200'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {item.type.replace('_', ' ')} · {item.retentionPolicy.replace('_', ' ')} ·
                    expires {formatDateTime(item.expiresAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${urgent ? 'bg-[#EF4444] text-white' : 'bg-[#F59E0B] text-white'}`}
                  >
                    {days > 0 ? `${days}d ${hours}h` : `${hours}h`} left
                  </span>
                  <button
                    onClick={() => void archiveNow(item.memoryId, item.title)}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                  >
                    Archive
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <p className="flex items-center gap-1.5 text-center text-xs text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5" />
        Permanent memories never expire; archived memories are excluded from retrieval.
      </p>
    </div>
  );
}
