// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Goal Explorer: Task Graph View
// EPIC-004 / EI-006 — Enterprise Goal & Task Intelligence Engine
// Renders a goal's decomposed task plan: task DAG with critical path,
// parallel groups, milestones, and the prioritized task table.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Select, Loading } from '@vedmoulya/ui';
import {
  Network,
  Map as MapIcon,
  Layers,
  ListChecks,
  ArrowRight,
  Timer,
  Wallet,
  Coins,
  Zap,
  GitMerge,
  Flag,
} from 'lucide-react';
import { useGoalTaskGraph, useGoalsList } from '../../lib/api-client.js';
import { useAuthStore } from '../../stores/auth-store.js';
import {
  CAPABILITY_LABELS,
  TASK_FLOW_LABELS,
  formatDuration,
  percentColor,
  shortId,
} from './explorer-data.js';
import type { TaskDTO } from '@vedmoulya/goals';

export function TaskGraphView({ userId }: { userId: string }): React.JSX.Element {
  const { user } = useAuthStore();
  const { data: goals, isLoading: goalsLoading } = useGoalsList(userId);
  const [goalId, setGoalId] = useState('');
  const { data: graph, isLoading, isError } = useGoalTaskGraph(userId, goalId);

  if (!user) return <></>;

  if (goalsLoading || !goals) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loading label="Loading goals..." size="lg" />
      </div>
    );
  }

  const selected = goals.find((g) => g.goalId === goalId);

  return (
    <div className="space-y-4 animate-slide-up">
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="flex flex-col lg:flex-row gap-3 items-center">
          <div className="flex-1 min-w-0">
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Goal
            </label>
            <Select
              value={goalId}
              onChange={(e) => {
                setGoalId(e.target.value);
              }}
              aria-label="Select goal"
              options={goals.map((g) => ({ value: g.goalId, label: `${g.title} (${g.category})` }))}
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Badge variant="ai" size="sm" className="flex items-center gap-1.5">
              <Zap className="h-3 w-3" /> Task plan only — no AI execution
            </Badge>
          </div>
        </div>
        {selected && (
          <p className="mt-3 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
            <strong className="text-[#111827] dark:text-[#F8FAFC]">{selected.title}</strong> ·{' '}
            {selected.status} · {selected.category} · effort {String(selected.estimatedEffort)}h
          </p>
        )}
      </Card>

      {!goalId && (
        <Card variant="standard" padding="lg" className="max-w-lg text-center dark:bg-[#1E293B]">
          <Network className="h-8 w-8 text-[#2B5FD9] mx-auto mb-2" />
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Select a goal to explore its task plan
          </h2>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] mt-1">
            Generate tasks for the goal first (Goals tab), then inspect the DAG here.
          </p>
        </Card>
      )}

      {goalId && isLoading && (
        <div className="flex items-center justify-center h-[40vh]">
          <Loading label="Loading task graph..." size="lg" />
        </div>
      )}

      {goalId && isError && (
        <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Task graph unavailable
          </h2>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] mt-1">
            Generate the task plan from the Goals tab first.
          </p>
        </Card>
      )}

      {goalId && graph && (
        <div className="space-y-4">
          {graph.tasks.length === 0 ? (
            <Card
              variant="standard"
              padding="lg"
              className="max-w-lg text-center dark:bg-[#1E293B]"
            >
              <ListChecks className="h-8 w-8 text-[#7C3AED] mx-auto mb-2" />
              <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
                No tasks generated yet
              </h2>
              <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                Open the Goals tab, select this goal, and run <strong>Generate Tasks</strong>.
              </p>
            </Card>
          ) : (
            <TaskGraphDetail graph={graph} />
          )}
        </div>
      )}
    </div>
  );
}

function TaskGraphDetail({
  graph,
}: {
  graph: NonNullable<ReturnType<typeof useGoalTaskGraph>['data']>;
}): React.JSX.Element {
  const byId = new Map(graph.tasks.map((t) => [t.taskId, t]));
  const criticalSet = new Set(graph.criticalPath);

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat
          label="Tasks"
          value={String(graph.tasks.length)}
          icon={<ListChecks className="h-4 w-4 text-[#2B5FD9]" />}
          bg="bg-[#EFF4FE] dark:bg-[#1E3A8A]/40"
        />
        <MiniStat
          label="Critical path"
          value={String(graph.criticalPathLength)}
          icon={<MapIcon className="h-4 w-4 text-[#F59E0B]" />}
          bg="bg-[#FFFBEB] dark:bg-[#78350F]/40"
        />
        <MiniStat
          label="Est. duration"
          value={formatDuration(graph.totalEstimatedTimeMs)}
          icon={<Timer className="h-4 w-4 text-[#7C3AED]" />}
          bg="bg-[#F5F3FF] dark:bg-[#4C1D95]/40"
        />
        <MiniStat
          label="Est. cost"
          value={`$${graph.totalEstimatedCostUsd.toFixed(2)}`}
          icon={<Wallet className="h-4 w-4 text-[#0D9488]" />}
          bg="bg-[#F0FDFA] dark:bg-[#134E4A]/40"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Critical path */}
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <MapIcon className="h-4 w-4 text-[#F59E0B]" /> Critical Path
          </h3>
          <div className="space-y-1.5">
            {graph.criticalPath.map((taskId, idx) => (
              <div key={taskId} className="flex items-center gap-2">
                {idx > 0 && <ArrowRight className="h-3 w-3 text-[#F59E0B] shrink-0" />}
                <span className="px-2 py-1 rounded-md border border-[#F59E0B]/40 bg-[#FFFBEB] dark:bg-[#78350F]/40 text-[11px] font-medium text-[#D97706] truncate">
                  {byId.get(taskId)?.title ?? taskId}
                </span>
              </div>
            ))}
            {graph.criticalPath.length === 0 && (
              <p className="text-[13px] text-[#94A3B8]">No critical path computed.</p>
            )}
          </div>
        </Card>

        {/* Parallel groups */}
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <GitMerge className="h-4 w-4 text-[#0D9488]" /> Parallel Groups
          </h3>
          <div className="space-y-3">
            {graph.parallelGroups.map((group, idx) => (
              <div key={String(idx)}>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mb-1">
                  Group {idx + 1}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.map((taskId) => (
                    <span
                      key={taskId}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F0FDFA] dark:bg-[#134E4A]/40 text-[#0D9488] border border-[#0D9488]/30"
                    >
                      {byId.get(taskId)?.title ?? taskId}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {graph.parallelGroups.length === 0 && (
              <p className="text-[13px] text-[#94A3B8]">
                No parallel groups — fully sequential plan.
              </p>
            )}
          </div>
        </Card>

        {/* Milestones */}
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <Flag className="h-4 w-4 text-[#7C3AED]" /> Milestones
          </h3>
          <div className="space-y-2">
            {graph.milestones.map((m) => (
              <div
                key={m.milestoneId}
                className="p-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC] truncate">
                    {m.order}. {m.title}
                  </span>
                  <Badge variant={m.achieved ? 'success' : 'default'} size="sm">
                    {m.achieved ? 'Achieved' : 'Pending'}
                  </Badge>
                </div>
                <p className="text-[10px] text-[#94A3B8] truncate">{m.description}</p>
                <p className="text-[10px] text-[#94A3B8] mt-0.5">
                  {String(m.taskIds.length)} task(s)
                </p>
              </div>
            ))}
            {graph.milestones.length === 0 && (
              <p className="text-[13px] text-[#94A3B8]">No milestones defined.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Task table */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#2B5FD9]" /> Prioritized Task Plan
          </h3>
          <Badge variant={graph.validated ? 'success' : 'warning'} size="sm">
            {graph.validated ? 'DAG valid' : 'DAG invalid'}
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[...graph.tasks]
            .sort((a, b) => b.priority - a.priority)
            .map((task) => (
              <TaskRow
                key={task.taskId}
                task={task}
                byId={byId}
                onCritical={criticalSet.has(task.taskId)}
              />
            ))}
        </div>
      </Card>
    </div>
  );
}

export function TaskRow({
  task,
  byId,
  onCritical,
}: {
  task: TaskDTO;
  byId: Map<string, TaskDTO>;
  onCritical: boolean;
}): React.JSX.Element {
  return (
    <div
      className={`p-2.5 rounded-lg border bg-[#F8FAFC] dark:bg-[#0F172A] ${
        onCritical
          ? 'border-[#F59E0B]/50 ring-1 ring-[#F59E0B]/30'
          : 'border-[#E2E8F0] dark:border-[#334155]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC] truncate">
          {task.title}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-bold text-[#2B5FD9]">{String(task.priority)}</span>
          {onCritical && <span className="text-[10px] font-bold text-[#F59E0B]">★</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[#64748B] dark:text-[#94A3B8]">
        <span className="px-1.5 py-0.5 rounded bg-[#F5F3FF] dark:bg-[#4C1D95]/40 text-[#7C3AED]">
          {CAPABILITY_LABELS[task.capability] ?? task.capability}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[#2B5FD9]">
          {TASK_FLOW_LABELS[task.flowType] ?? task.flowType}
        </span>
        <span className="inline-flex items-center gap-1">
          <Timer className="h-3 w-3" /> {formatDuration(task.estimatedTimeMs)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Wallet className="h-3 w-3" /> ${task.estimatedCostUsd.toFixed(2)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Coins className="h-3 w-3" /> {task.estimatedTokens.toLocaleString()} tok
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-[#E2E8F0] dark:bg-[#334155] overflow-hidden">
          <div
            className={`h-full rounded-full ${percentColor(task.confidence)}`}
            style={{ width: `${String(Math.round(task.confidence * 100))}%` }}
          />
        </div>
        <span className="text-[9px] text-[#94A3B8]">
          conf {String(Math.round(task.confidence * 100))}%
        </span>
      </div>
      {task.dependencies.length > 0 && (
        <p className="mt-1 text-[10px] text-[#94A3B8] truncate">
          ← {task.dependencies.map((d) => byId.get(d)?.title ?? shortId(d)).join(', ')}
        </p>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
  bg,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  bg: string;
}): React.JSX.Element {
  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium truncate">
            {label}
          </p>
          <p className="text-[18px] font-bold text-[#111827] dark:text-[#F8FAFC]">{value}</p>
        </div>
      </div>
    </Card>
  );
}
