// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Builder (BLD-024)
//
// The one-button product experience over the PROVEN MissionRuntime:
//   enter ONE mission → select the authorized workspace → RUN → walk away.
// The page is ONLY a control and observation layer: it never executes
// anything, never drives the runtime with timers, and never fabricates
// progress. Backend state is authoritative; the RUN mutation is guarded
// (double-click / retry safe — the backend serializes the loop per mission).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { Card, Button } from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import {
  useMissionStatus,
  useMissionHistory,
  useMissionCreateAndRun,
  useMissionPause,
  useMissionResume,
  useMissionCancel,
  useMissionApprove,
  useMissionReject,
  type MissionHistoryEntry,
} from '../../lib/api-client.js';
import { LiveMissionView } from './LiveMissionView.js';

function AutonomousBuilderInner(): React.JSX.Element {
  const { user } = useAuthStore();
  const hydrated = useAuthHydrated();
  const userId = user?.userId ?? '';

  // ── Form state ──────────────────────────────────────────────────────
  const [title, setTitle] = useState('Build VedMoulya into a powerful autonomous AI platform');
  const [objective, setObjective] = useState(
    'Improve the authorized workspace autonomously: inspect the repository, select high-value objectives, implement them, and verify the results.',
  );
  const [workspace, setWorkspace] = useState('');
  const [maxObjectives, setMaxObjectives] = useState('5');

  // ── Mission state (server-authoritative) ────────────────────────────
  const [missionId, setMissionId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false); // one in-flight RUN guard

  // ── Data + mutations ────────────────────────────────────────────────
  const status = useMissionStatus(userId, missionId);
  const history = useMissionHistory(userId);
  const createAndRun = useMissionCreateAndRun();
  const pause = useMissionPause();
  const resume = useMissionResume();
  const cancel = useMissionCancel();
  const approve = useMissionApprove();
  const reject = useMissionReject();

  // Browser-refresh recovery: restore the mission reference from the URL so
  // an in-flight mission is OBSERVED, never restarted, never duplicated.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('mission');
    if (fromUrl) setMissionId(fromUrl);
  }, []);

  useEffect(() => {
    if (missionId && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('mission', missionId);
      window.history.replaceState(null, '', url.toString());
    }
  }, [missionId]);

  const handleRun = async (): Promise<void> => {
    if (submitted || createAndRun.isPending) return; // double-click guard
    setRunError(null);
    setSubmitted(true);
    try {
      const result = await createAndRun.mutateAsync({
        userId,
        title: title.trim(),
        objective: objective.trim(),
        workspace: workspace.trim() || undefined,
        maxObjectives: Number.parseInt(maxObjectives, 10) || 5,
      });
      // The gateway returns a standard envelope { success, data: { missionId } };
      // capture the id so the live view can start observing (polling) the REAL
      // mission. A mission that immediately settles (e.g. WAITING_FOR_PROVIDER
      // with no providers) is still displayed honestly through the live view.
      const envelope = result as unknown as { data?: { missionId?: string } } | undefined;
      const newMissionId = envelope?.data?.missionId;
      if (newMissionId) {
        setMissionId(newMissionId);
      } else {
        setRunError('Mission did not return an identifier — check the server logs.');
      }
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Failed to start the mission');
    } finally {
      setSubmitted(false);
    }
  };

  const runCommand = async (mutation: {
    mutateAsync: (input: { userId: string; missionId: string }) => Promise<unknown>;
  }): Promise<void> => {
    if (!missionId) return;
    setRunError(null);
    try {
      await mutation.mutateAsync({ userId, missionId });
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Command failed');
    }
  };

  if (!hydrated) {
    return <p className="p-8 text-sm text-slate-500">Loading…</p>;
  }
  if (!userId) {
    return <SignInRedirect />;
  }

  const statusView = status.data ?? null;
  const histories: MissionHistoryEntry[] = history.data ?? [];

  return (
    <main id="main-content" className="mx-auto w-full max-w-5xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Autonomous Builder</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Enter one mission, press RUN, and the mission runtime plans, executes, verifies and
          checkpoints each objective — continuing autonomously without another prompt.
        </p>
      </header>

      {/* ── Mission form ──────────────────────────────────────────────── */}
      <Card data-testid="mission-form" padding="lg">
        <h2 className="text-base font-semibold">New mission</h2>
        <div className="mt-4 space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Mission title</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600"
              value={title}
              onChange={(e): void => {
                setTitle(e.target.value);
              }}
              maxLength={200}
              data-testid="mission-title-input"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Mission objective</span>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600"
              value={objective}
              onChange={(e): void => {
                setObjective(e.target.value);
              }}
              maxLength={2000}
              data-testid="mission-objective-input"
            />
          </label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium">Workspace</span>
              <input
                className="w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600"
                placeholder="Authorized workspace root"
                value={workspace}
                onChange={(e): void => {
                  setWorkspace(e.target.value);
                }}
                maxLength={500}
                data-testid="mission-workspace-input"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">AI provider</span>
              <input
                className="w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm opacity-70 dark:border-slate-600"
                value="Automatic"
                readOnly
                data-testid="mission-provider-input"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Budget (max objectives)</span>
              <input
                className="w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-600"
                type="number"
                min={1}
                max={100}
                value={maxObjectives}
                onChange={(e): void => {
                  setMaxObjectives(e.target.value);
                }}
                data-testid="mission-budget-input"
              />
            </label>
          </div>
          {runError ? (
            <p
              className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
              role="alert"
              data-testid="run-error"
            >
              {runError}
            </p>
          ) : null}
          <Button
            onClick={() => void handleRun()}
            disabled={submitted || createAndRun.isPending}
            data-testid="run-mission-btn"
          >
            {submitted || createAndRun.isPending ? 'Starting…' : 'RUN MISSION'}
          </Button>
        </div>
      </Card>

      {/* ── Live mission view ─────────────────────────────────────────── */}
      {missionId && statusView ? (
        <Card data-testid="live-mission-card" padding="lg">
          <h2 className="mb-4 text-base font-semibold">Mission status</h2>
          <ErrorBoundary>
            <LiveMissionView
              status={statusView}
              loopPending={createAndRun.isPending}
              onPause={() => runCommand(pause)}
              onResume={() => runCommand(resume)}
              onCancel={() => runCommand(cancel)}
              onApprove={() => runCommand(approve)}
              onReject={() => runCommand(reject)}
            />
          </ErrorBoundary>
        </Card>
      ) : null}
      {missionId && status.isLoading && !statusView ? (
        <p className="text-sm text-slate-500" data-testid="status-loading">
          Loading mission status…
        </p>
      ) : null}
      {missionId && status.isError ? (
        <p
          className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
          data-testid="status-error"
        >
          {status.error instanceof Error ? status.error.message : 'Mission status unavailable'}
        </p>
      ) : null}

      {/* ── Mission history ───────────────────────────────────────────── */}
      <Card data-testid="mission-history-card" padding="lg">
        <h2 className="mb-3 text-base font-semibold">Mission history</h2>
        <div>
          {histories.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="history-empty">
              No missions yet.
            </p>
          ) : (
            <ul
              className="divide-y divide-slate-200 dark:divide-slate-700"
              data-testid="mission-history"
            >
              {histories.map((entry) => (
                <li
                  key={entry.missionId}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2"
                >
                  <button
                    className="text-sm font-medium underline-offset-2 hover:underline"
                    onClick={(): void => {
                      setMissionId(entry.missionId);
                    }}
                    data-testid={`history-item-${entry.missionId}`}
                  >
                    {entry.title}
                  </button>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {entry.state}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {entry.verifiedObjectives}/{entry.totalObjectives} verified ·{' '}
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                  {entry.outcomeReason ? (
                    <span className="w-full text-xs text-rose-600 dark:text-rose-400">
                      {entry.outcomeReason}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </main>
  );
}

export default function AutonomousBuilderPage(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <AutonomousBuilderInner />
    </ErrorBoundary>
  );
}
