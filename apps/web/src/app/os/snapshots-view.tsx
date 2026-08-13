// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Snapshots view
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// The persisted health snapshot history — every health pass is recorded in the
// os_health_registry store (Postgres in production) so the operating system's
// health can be tracked over time.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import { useOSSnapshots } from '../../lib/api-client.js';
import { History, RefreshCw } from 'lucide-react';
import { SnapshotRow } from './components.js';

export function SnapshotsView({ userId }: { userId: string }): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useOSSnapshots(userId, 30);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading health history…" size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={<History className="h-10 w-10" />}
        title="Snapshot history unavailable"
        description="The OS health history could not be reached. Check your connection and retry."
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <History className="h-4 w-4 text-[#2B5FD9]" />
              Health Snapshot History
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Every health pass is persisted to the os_health_registry store — engine counts,
              pipeline status, dependency acyclicity and diagnostics tracked over time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="info" className="text-[11px]">
              {data.length} snapshot{data.length === 1 ? '' : 's'}
            </Badge>
            <button
              onClick={() => void refetch()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {data.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-400">
              No snapshots yet — run a health pass from the Dashboard tab to record one.
            </p>
          )}
          {data.map((snapshot) => (
            <SnapshotRow key={snapshot.snapshotId} snapshot={snapshot} />
          ))}
        </div>
      </Card>
    </div>
  );
}
