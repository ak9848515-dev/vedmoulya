// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Center: Compression Dashboard
// EPIC-004 / EI-010 — Enterprise Memory Intelligence Platform
// Memory is compressed (raw → compressed → summarized → collapsed) to keep the
// layer fast. This dashboard shows the compression state of the registry and
// lets an operator compress or consolidate in bulk.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Loading, EmptyState, Button } from '@vedmoulya/ui';
import {
  useMemoryItems,
  useCompressMemories,
  useConsolidateMemories,
  useExpireMemories,
} from '../../lib/api-client.js';
import { useAuthStore } from '../../stores/auth-store.js';
import { FileArchive, Layers, Scissors, GitMerge, Trash2 } from 'lucide-react';
import { MemoryCard } from './components.js';

export function CompressionView({ userId }: { userId: string }): React.JSX.Element {
  const { user } = useAuthStore();
  const actor = user?.email ?? user?.userId ?? 'human-owner';
  const [feedback, setFeedback] = useState<{ message: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useMemoryItems(userId, { limit: 60 });
  const compress = useCompressMemories();
  const consolidate = useConsolidateMemories();
  const expire = useExpireMemories();

  const run = async (
    kind: 'compress' | 'consolidate' | 'expire',
    params: Record<string, unknown>,
  ): Promise<void> => {
    setBusy(kind);
    setFeedback(null);
    try {
      const res =
        kind === 'compress'
          ? await compress.mutateAsync({ userId, ...params })
          : kind === 'consolidate'
            ? await consolidate.mutateAsync({ userId, ...params })
            : await expire.mutateAsync({ userId, ...params });
      const payload = res.data as
        | {
            compressed?: number;
            merged?: number;
            candidates?: number;
            expired?: number;
            purged?: number;
          }
        | undefined;
      setFeedback({
        message:
          kind === 'compress'
            ? `Compressed ${payload?.compressed ?? 0} memories.`
            : kind === 'consolidate'
              ? `Consolidated ${payload?.merged ?? 0} memories (${payload?.candidates ?? 0} candidates).`
              : `Expired ${payload?.expired ?? 0} memories${payload?.purged ? `, purged ${payload.purged}` : ''}.`,
        ok: true,
      });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : 'Operation failed.',
        ok: false,
      });
    }
    setBusy(null);
    void refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading compression states…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<FileArchive className="h-10 w-10" />}
        title="Compression data unavailable"
        description="The memory compression dashboard could not be loaded."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  const items = data.items;
  const byState = {
    raw: items.filter((i) => i.compressionState === 'raw').length,
    compressed: items.filter((i) => i.compressionState === 'compressed').length,
    summarized: items.filter((i) => i.compressionState === 'summarized').length,
    collapsed: items.filter((i) => i.compressionState === 'collapsed').length,
  };
  const totalLen = items.reduce((s, i) => s + i.content.length, 0);
  const summarizedLen = items
    .filter((i) => i.summary)
    .reduce((s, i) => s + (i.summary?.length ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Raw" value={String(byState.raw)} color="#94A3B8" />
        <StatCard label="Compressed" value={String(byState.compressed)} color="#06B6D4" />
        <StatCard label="Summarized" value={String(byState.summarized)} color="#8B5CF6" />
        <StatCard label="Collapsed" value={String(byState.collapsed)} color="#64748B" />
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

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#8B5CF6]" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Bulk Operations
          </h3>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Compress reduces verbosity, consolidation merges near-duplicate memories, expiry clears
          expired records (per retention policy).
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            onClick={() => void run('compress', { target: 'summarized' })}
            disabled={busy !== null}
            className="gap-1.5"
          >
            <Scissors className="h-4 w-4" />
            {busy === 'compress' ? 'Compressing…' : 'Compress all (→ summarized)'}
          </Button>
          <Button
            onClick={() => void run('consolidate', { actor })}
            disabled={busy !== null}
            variant="secondary"
            className="gap-1.5"
          >
            <GitMerge className="h-4 w-4" />
            {busy === 'consolidate' ? 'Consolidating…' : 'Consolidate duplicates'}
          </Button>
          <Button
            onClick={() => void run('expire', { actor })}
            disabled={busy !== null}
            variant="secondary"
            className="gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            {busy === 'expire' ? 'Expiring…' : 'Expire due memories'}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Compression Savings
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          {items.length} memories · {totalLen.toLocaleString()} raw characters
          {summarizedLen > 0 ? ` · ${summarizedLen.toLocaleString()} summarized characters` : ''}
        </p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4]"
            style={{ width: `${(byState.raw / Math.max(1, items.length)) * 100}%` }}
          />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.slice(0, 8).map((item) => (
            <MemoryCard key={item.memoryId} item={item} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}): React.JSX.Element {
  return (
    <Card className="p-4">
      <div className="h-1.5 w-10 rounded-full" style={{ backgroundColor: color }} />
      <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-[11px] font-medium text-slate-400">{label}</div>
    </Card>
  );
}
