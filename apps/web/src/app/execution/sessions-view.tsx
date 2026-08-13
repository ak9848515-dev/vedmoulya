// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Execution Explorer: Sessions View
// EPIC-004 / EI-005 — Enterprise Execution Orchestrator
// Execution sessions: create, list, inspect (monitor snapshot, event timeline,
// queue, recovery plans, per-node results) and drive the state machine
// (pause / resume / cancel). Orchestration only — never executes AI.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Loading, Select, EmptyState } from '@vedmoulya/ui';
import {
  PlayCircle,
  PauseCircle,
  XCircle,
  RotateCcw,
  Activity,
  Clock,
  CalendarClock,
  ListChecks,
  Package,
  Sparkles,
  Map,
  AlertTriangle,
} from 'lucide-react';
import {
  useExecutionSessions,
  useExecutionSession,
  useExecutionMonitorSnapshot,
  useExecutionQueue,
  useExecutionRecoveryPlans,
  useCreateExecutionSession,
  usePauseExecutionSession,
  useResumeExecutionSession,
  useCancelExecutionSession,
} from '../../lib/api-client.js';
import { BLOG_SEED, NEWSLETTER_SEED, STATE_BADGE, formatDate } from './explorer-data.js';
import type {
  ExecutionSessionDTO,
  ExecutionMonitorSnapshotDTO,
  ExecutionQueueEntryDTO,
  ExecutionRecoveryPlanDTO,
} from '@vedmoulya/execution-orchestrator';

// ── View ────────────────────────────────────────────────────────────────────

export function SessionsView({ userId }: { userId: string }): React.JSX.Element {
  const [selectedId, setSelectedId] = useState('');
  const [seed, setSeed] = useState('blog');
  const createSession = useCreateExecutionSession();
  const { data: sessions, isLoading, isError, refetch } = useExecutionSessions(userId);
  const [createError, setCreateError] = useState<string | null>(null);

  const runCreate = (): void => {
    const payload = seed === 'newsletter' ? NEWSLETTER_SEED : BLOG_SEED;
    setCreateError(null);
    void createSession
      .mutateAsync({ userId, ...payload })
      .then((res) => {
        const data = (res as { data?: ExecutionSessionDTO }).data;
        if (data) setSelectedId(data.sessionId);
      })
      .catch((err: unknown) => {
        setCreateError(
          err instanceof Error ? err.message : 'Could not create the execution session.',
        );
      });
  };

  if (isLoading || !sessions) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loading label="Loading execution sessions..." size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Unable to load sessions
          </h2>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Create session */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="flex flex-col lg:flex-row gap-3 items-center">
          <div className="flex-1 min-w-0">
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Strategy Seed
            </label>
            <Select
              value={seed}
              onChange={(e) => {
                setSeed(e.target.value);
              }}
              aria-label="Strategy seed"
              options={[
                { value: 'blog', label: 'Blog Generation (hybrid · 5 nodes)' },
                { value: 'newsletter', label: 'Newsletter Generation (sequential · 4 nodes)' },
              ]}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8] mb-2">
              Creating a session builds the graph, validates it, and schedules its execution queue —
              without executing any AI.
            </p>
            <Badge variant="ai" size="sm" className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Session only — no AI execution
            </Badge>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <button
              onClick={runCreate}
              disabled={createSession.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-[#2B5FD9] text-white hover:bg-[#2450C4] transition-colors disabled:opacity-50"
            >
              <PlayCircle className="h-4 w-4" /> Create Session
            </button>
            <button
              onClick={() => {
                void refetch();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium border border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>
        {createError && <p className="mt-3 text-[13px] text-[#EF4444]">{createError}</p>}
        {createSession.isSuccess && (
          <p className="mt-3 text-[13px] text-[#22C55E]">
            Session created — inspect it in the detail panel below.
          </p>
        )}
      </Card>

      {/* Session list */}
      {sessions.length === 0 ? (
        <EmptyState
          icon={<PlayCircle className="h-8 w-8" />}
          title="No execution sessions yet"
          description="Create a session above to convert a strategy into a scheduled, monitored workflow."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.sessionId}
              session={session}
              selected={session.sessionId === selectedId}
              onSelect={setSelectedId}
            />
          ))}
        </div>
      )}

      {/* Session detail */}
      {selectedId && <SessionDetail userId={userId} sessionId={selectedId} />}
    </div>
  );
}

export function SessionCard({
  session,
  selected,
  onSelect,
}: {
  session: ExecutionSessionDTO;
  selected: boolean;
  onSelect: (sessionId: string) => void;
}): React.JSX.Element {
  const meta = STATE_BADGE[session.status] ?? {
    label: session.status,
    variant: 'default' as const,
  };
  const progressPct = Math.round(session.progress * 100);
  return (
    <Card
      variant="standard"
      padding="md"
      className={`group cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 dark:bg-[#1E293B] dark:border-[#334155] ${selected ? 'ring-2 ring-[#2B5FD9]/60' : ''}`}
    >
      <button
        type="button"
        onClick={() => {
          onSelect(session.sessionId);
        }}
        className="w-full text-left"
        aria-pressed={selected}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="p-2 rounded-lg bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 shrink-0">
            <PlayCircle className="h-4 w-4 text-[#2B5FD9]" />
          </div>
          <Badge variant={meta.variant} size="sm">
            {meta.label}
          </Badge>
        </div>
        <p className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC] line-clamp-2">
          {session.graphId}
        </p>
        <p className="text-[11px] text-[#94A3B8] mt-0.5 truncate">
          {session.strategyId} · stage {session.currentStage}
        </p>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-[#64748B] dark:text-[#94A3B8] mb-1">
            <span>Progress</span>
            <span className="font-semibold text-[#111827] dark:text-[#F8FAFC]">{progressPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#F1F5F9] dark:bg-[#334155] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#2B5FD9] dark:bg-[#6B8FEF] transition-all"
              style={{ width: `${String(progressPct)}%` }}
            />
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[#F1F5F9] dark:border-[#334155] flex items-center justify-between text-[10px] text-[#94A3B8]">
          <span className="inline-flex items-center gap-1 truncate">
            <Clock className="h-3 w-3 shrink-0" /> {formatDate(session.startedAt)}
          </span>
          <span className="inline-flex items-center gap-1 shrink-0">
            <Activity className="h-3 w-3" /> {String(Object.keys(session.results).length)} results
          </span>
        </div>
      </button>
    </Card>
  );
}

function SessionDetail({
  userId,
  sessionId,
}: {
  userId: string;
  sessionId: string;
}): React.JSX.Element {
  const { data: session, isLoading, isError, refetch } = useExecutionSession(userId, sessionId);
  const { data: monitor } = useExecutionMonitorSnapshot(userId, sessionId);
  const { data: queue } = useExecutionQueue(userId, sessionId);
  const { data: recovery } = useExecutionRecoveryPlans(userId, sessionId);
  const pauseSession = usePauseExecutionSession();
  const resumeSession = useResumeExecutionSession();
  const cancelSession = useCancelExecutionSession();
  const [commandError, setCommandError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[30vh]">
        <Loading label="Loading session detail..." size="lg" />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
        <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Session not found
        </h2>
      </Card>
    );
  }

  const meta = STATE_BADGE[session.status] ?? {
    label: session.status,
    variant: 'default' as const,
  };
  const progressPct = Math.round(session.progress * 100);
  const canPause =
    session.status === 'running' || session.status === 'waiting' || session.status === 'ready';
  const canResume = session.status === 'paused';
  const canCancel = !['completed', 'failed', 'cancelled'].includes(session.status);

  const runCommand = (action: () => Promise<unknown>): void => {
    setCommandError(null);
    void action()
      .then(() => {
        void refetch();
      })
      .catch((err: unknown) => {
        setCommandError(err instanceof Error ? err.message : 'Command rejected.');
      });
  };

  const runPause = (): void => {
    runCommand(() => pauseSession.mutateAsync({ userId, sessionId }));
  };
  const runResume = (): void => {
    runCommand(() => resumeSession.mutateAsync({ userId, sessionId }));
  };
  const runCancel = (): void => {
    runCommand(() => cancelSession.mutateAsync({ userId, sessionId }));
  };

  return (
    <div className="space-y-4">
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[17px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
                {session.sessionId}
              </h3>
              <Badge variant={meta.variant} size="sm">
                {meta.label}
              </Badge>
            </div>
            <p className="text-[12px] text-[#94A3B8]">
              {session.strategyId} · {session.graphId} · stage {session.currentStage}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canPause && (
              <button
                onClick={runPause}
                disabled={pauseSession.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#F59E0B] text-white hover:bg-[#D97706] transition-colors disabled:opacity-50"
              >
                <PauseCircle className="h-3.5 w-3.5" /> Pause
              </button>
            )}
            {canResume && (
              <button
                onClick={runResume}
                disabled={resumeSession.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#22C55E] text-white hover:bg-[#16A34A] transition-colors disabled:opacity-50"
              >
                <PlayCircle className="h-3.5 w-3.5" /> Resume
              </button>
            )}
            {canCancel && (
              <button
                onClick={runCancel}
                disabled={cancelSession.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#EF4444] text-white hover:bg-[#DC2626] transition-colors disabled:opacity-50"
              >
                <XCircle className="h-3.5 w-3.5" /> Cancel
              </button>
            )}
            <button
              onClick={() => {
                void refetch();
              }}
              className="p-2 rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors"
              aria-label="Reload session"
            >
              <RotateCcw className="h-4 w-4 text-[#64748B] dark:text-[#94A3B8]" />
            </button>
          </div>
        </div>
        {commandError && (
          <p className="mt-2 text-[13px] text-[#EF4444]" role="alert">
            {commandError}
          </p>
        )}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#94A3B8] mb-1">
            <span>Progress</span>
            <span className="font-semibold text-[#111827] dark:text-[#F8FAFC]">{progressPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#F1F5F9] dark:bg-[#334155] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2B5FD9] to-[#7C3AED] transition-all"
              style={{ width: `${String(progressPct)}%` }}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <MonitorCard monitor={monitor} />
        <ResultsCard session={session} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TimelineCard session={session} />
        <QueueCard queue={queue ?? []} />
      </div>

      <RecoveryCard plans={recovery ?? []} />
    </div>
  );
}

function MonitorCard({
  monitor,
}: {
  monitor: ExecutionMonitorSnapshotDTO | undefined;
}): React.JSX.Element {
  if (!monitor) {
    return (
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#2B5FD9]" /> Monitor
        </h3>
        <p className="text-[13px] text-[#94A3B8] mt-2">No snapshot available.</p>
      </Card>
    );
  }
  const groups: Array<{ label: string; nodes: string[]; color: string }> = [
    {
      label: 'Running',
      nodes: monitor.runningNodes,
      color: 'bg-[#F5F3FF] dark:bg-[#4C1D95]/40 text-[#7C3AED] border-[#7C3AED]/30',
    },
    {
      label: 'Completed',
      nodes: monitor.completedNodes,
      color: 'bg-[#F0FDF4] dark:bg-[#14532D]/40 text-[#16A34A] border-[#22C55E]/30',
    },
    {
      label: 'Failed',
      nodes: monitor.failedNodes,
      color: 'bg-[#FEF2F2] dark:bg-[#450A0A]/40 text-[#EF4444] border-[#EF4444]/30',
    },
    {
      label: 'Waiting',
      nodes: monitor.waitingNodes,
      color:
        'bg-[#F8FAFC] dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8] border-[#E2E8F0] dark:border-[#334155]',
    },
  ];
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#2B5FD9]" /> Monitor Snapshot
        </h3>
        <Badge variant={STATE_BADGE[monitor.status]?.variant ?? 'default'} size="sm">
          {STATE_BADGE[monitor.status]?.label ?? monitor.status}
        </Badge>
      </div>
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mb-1">
              {group.label} ({String(group.nodes.length)})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.nodes.map((nodeId) => (
                <span
                  key={nodeId}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${group.color}`}
                >
                  {nodeId}
                </span>
              ))}
              {group.nodes.length === 0 && (
                <span className="text-[11px] text-[#CBD5E1] dark:text-[#475569]">none</span>
              )}
            </div>
          </div>
        ))}
        {monitor.lastEvent && (
          <div className="pt-3 border-t border-[#F1F5F9] dark:border-[#334155] text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            Last event:{' '}
            <strong className="text-[#111827] dark:text-[#F8FAFC]">{monitor.lastEvent.type}</strong>{' '}
            — {monitor.lastEvent.message}
          </div>
        )}
      </div>
    </Card>
  );
}

function ResultsCard({ session }: { session: ExecutionSessionDTO }): React.JSX.Element {
  const results = Object.values(session.results);
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
      <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-[#22C55E]" /> Node Results ({String(results.length)})
      </h3>
      {results.length === 0 ? (
        <p className="text-[13px] text-[#94A3B8]">No node results recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {results.map((result) => (
            <div
              key={result.nodeId}
              className={`p-2.5 rounded-lg border bg-[#F8FAFC] dark:bg-[#0F172A] ${
                result.success ? 'border-[#E2E8F0] dark:border-[#334155]' : 'border-[#EF4444]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC] truncate">
                  {result.nodeId}
                </span>
                <Badge variant={result.success ? 'success' : 'danger'} size="sm">
                  {result.success ? 'Completed' : 'Failed'}
                </Badge>
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                {result.outcome}
              </p>
              <p className="text-[10px] text-[#94A3B8] mt-1">
                ${result.costUsd.toFixed(2)} · {result.tokensUsed.toLocaleString()} tok ·{' '}
                {result.latencyMs}ms · {result.attempts} attempt(s) ·{' '}
                {formatDate(result.completedAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function TimelineCard({ session }: { session: ExecutionSessionDTO }): React.JSX.Element {
  const events = session.events;
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
      <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-[#7C3AED]" /> Event Timeline
      </h3>
      {events.length === 0 ? (
        <p className="text-[13px] text-[#94A3B8]">No events recorded yet.</p>
      ) : (
        <ol className="space-y-0">
          {events.map((event, idx) => (
            <li key={event.eventId} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="w-6 h-6 shrink-0 rounded-full bg-[#F5F3FF] dark:bg-[#4C1D95]/40 text-[#7C3AED] flex items-center justify-center">
                  <CircleBadge type={event.type} />
                </span>
                {idx < events.length - 1 && (
                  <span className="w-px flex-1 bg-[#E2E8F0] dark:bg-[#334155]" />
                )}
              </div>
              <div className="pb-4 min-w-0">
                <p className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC] capitalize">
                  {event.type}
                  {event.nodeId && (
                    <span className="text-[#94A3B8] font-normal"> · {event.nodeId}</span>
                  )}
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{event.message}</p>
                <p className="text-[10px] text-[#CBD5E1] dark:text-[#475569]">
                  {formatDate(event.timestamp)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function CircleBadge({ type }: { type: string }): React.JSX.Element {
  const color =
    type === 'failed' || type === 'timeout'
      ? 'text-[#EF4444]'
      : type === 'completed'
        ? 'text-[#22C55E]'
        : type === 'retry' || type === 'paused'
          ? 'text-[#F59E0B]'
          : 'text-[#7C3AED]';
  const icon: Record<string, React.ReactNode> = {
    created: <Activity className="h-3 w-3" />,
    started: <PlayCircle className="h-3 w-3" />,
    completed: <Activity className="h-3 w-3" />,
    failed: <AlertTriangle className="h-3 w-3" />,
    retry: <RotateCcw className="h-3 w-3" />,
    timeout: <AlertTriangle className="h-3 w-3" />,
    cancelled: <XCircle className="h-3 w-3" />,
    checkpoint: <Map className="h-3 w-3" />,
    paused: <PauseCircle className="h-3 w-3" />,
    resumed: <PlayCircle className="h-3 w-3" />,
  };
  return <span className={color}>{icon[type] ?? <Activity className="h-3 w-3" />}</span>;
}

function QueueCard({ queue }: { queue: ExecutionQueueEntryDTO[] }): React.JSX.Element {
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
      <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
        <Package className="h-4 w-4 text-[#F59E0B]" /> Execution Queue ({String(queue.length)})
      </h3>
      {queue.length === 0 ? (
        <p className="text-[13px] text-[#94A3B8]">Queue is empty.</p>
      ) : (
        <div className="space-y-2">
          {queue.map((entry) => (
            <div
              key={entry.entryId}
              className="p-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC] truncate">
                  {entry.nodeId}
                </span>
                <Badge variant={entry.kind === 'priority' ? 'warning' : 'info'} size="sm">
                  {entry.kind}
                </Badge>
              </div>
              <p className="text-[10px] text-[#94A3B8] mt-1">
                priority {entry.priority} · attempts {String(entry.attempts)} · available{' '}
                {formatDate(entry.availableAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function RecoveryCard({ plans }: { plans: ExecutionRecoveryPlanDTO[] }): React.JSX.Element {
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
      <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
        <RotateCcw className="h-4 w-4 text-[#F59E0B]" /> Recovery Plans ({String(plans.length)})
      </h3>
      {plans.length === 0 ? (
        <p className="text-[13px] text-[#94A3B8]">
          No recovery plans — the graph has no failed nodes to recover.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {plans.map((plan, idx) => (
            <div
              key={String(idx)}
              className="p-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFFBEB] dark:bg-[#78350F]/40 text-[#D97706] border border-[#F59E0B]/30">
                  {plan.action.type}
                </span>
                <span className="text-[10px] text-[#94A3B8]">
                  {String(plan.affectedNodeIds.length)} node(s)
                </span>
              </div>
              <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">{plan.description}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
