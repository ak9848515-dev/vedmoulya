// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Goal Explorer: Lifecycle View
// EPIC-004 / EI-006 — Enterprise Goal & Task Intelligence Engine
// Drives a goal through the typed lifecycle state machine
// (proposed → scored → accepted → active ⇄ blocked → completed → archived)
// and shows its immutable event timeline.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Card, Badge, Select, Loading } from '@vedmoulya/ui';
import {
  ArrowRight,
  History,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  XCircle,
  Archive,
  Unlock,
  Lock,
} from 'lucide-react';
import { useGoalsList, useGoal, useTransitionGoal, useGoalExplain } from '../../lib/api-client.js';
import { useAuthStore } from '../../stores/auth-store.js';
import { STATUS_BADGE, STATUS_LABELS, LIFECYCLE_FLOW } from './explorer-data.js';

export function LifecycleView({ userId }: { userId: string }): React.JSX.Element {
  const { user } = useAuthStore();
  const { data: goals, isLoading: goalsLoading } = useGoalsList(userId);
  const [goalId, setGoalId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const { data: goal, refetch } = useGoal(userId, goalId);
  const { data: explanation } = useGoalExplain(userId, goalId);
  const transition = useTransitionGoal();

  if (!user) return <></>;

  if (goalsLoading || !goals) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loading label="Loading goals..." size="lg" />
      </div>
    );
  }

  type CommandType = Parameters<typeof transition.mutateAsync>[0]['command']['type'];
  const run = (type: CommandType): void => {
    if (!goalId) return;
    setBusy(type);
    const command: Parameters<typeof transition.mutateAsync>[0]['command'] =
      type === 'block'
        ? { type: 'block', reason: 'Manually blocked' }
        : type === 'cancel'
          ? { type: 'cancel', reason: 'Manually cancelled' }
          : { type };
    void transition
      .mutateAsync({ userId, goalId, command })
      .then(() => refetch())
      .catch(() => undefined)
      .finally(() => {
        setBusy(null);
      });
  };

  const actions: Array<{
    type: CommandType;
    label: string;
    icon: React.ReactNode;
    className: string;
    disabled?: boolean;
  }> = [
    {
      type: 'score',
      label: 'Score',
      icon: <PlayCircle className="h-4 w-4" />,
      className: 'bg-[#2B5FD9] hover:bg-[#2450C4]',
      disabled: goal?.status !== 'proposed',
    },
    {
      type: 'accept',
      label: 'Accept',
      icon: <CheckCircle2 className="h-4 w-4" />,
      className: 'bg-[#22C55E] hover:bg-[#16A34A]',
      disabled: goal?.status !== 'scored',
    },
    {
      type: 'activate',
      label: 'Activate',
      icon: <PlayCircle className="h-4 w-4" />,
      className: 'bg-[#7C3AED] hover:bg-[#6D28D9]',
      disabled: goal?.status !== 'accepted' && goal?.status !== 'blocked',
    },
    {
      type: 'block',
      label: 'Block',
      icon: <Lock className="h-4 w-4" />,
      className: 'bg-[#F59E0B] hover:bg-[#D97706]',
      disabled: goal?.status !== 'active',
    },
    {
      type: 'unblock',
      label: 'Unblock',
      icon: <Unlock className="h-4 w-4" />,
      className: 'bg-[#0D9488] hover:bg-[#0F766E]',
      disabled: goal?.status !== 'blocked',
    },
    {
      type: 'complete',
      label: 'Complete',
      icon: <CheckCircle2 className="h-4 w-4" />,
      className: 'bg-[#22C55E] hover:bg-[#16A34A]',
      disabled: goal?.status !== 'active',
    },
    {
      type: 'cancel',
      label: 'Cancel',
      icon: <XCircle className="h-4 w-4" />,
      className: 'bg-[#EF4444] hover:bg-[#DC2626]',
      disabled: !['proposed', 'scored', 'accepted', 'active'].includes(goal?.status ?? ''),
    },
    {
      type: 'archive',
      label: 'Archive',
      icon: <Archive className="h-4 w-4" />,
      className: 'bg-[#64748B] hover:bg-[#475569]',
      disabled: goal?.status !== 'completed' && goal?.status !== 'cancelled',
    },
  ];

  return (
    <div className="space-y-4 animate-slide-up">
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
          Goal
        </label>
        <Select
          value={goalId}
          onChange={(e) => {
            setGoalId(e.target.value);
          }}
          aria-label="Select goal"
          options={goals.map((g) => ({
            value: g.goalId,
            label: `${g.title} (${STATUS_LABELS[g.status]})`,
          }))}
        />
      </Card>

      {!goalId && (
        <Card variant="standard" padding="lg" className="max-w-lg text-center dark:bg-[#1E293B]">
          <History className="h-8 w-8 text-[#2B5FD9] mx-auto mb-2" />
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Select a goal to drive its lifecycle
          </h2>
        </Card>
      )}

      {goalId && !goal && (
        <div className="flex items-center justify-center h-[30vh]">
          <Loading label="Loading goal..." size="lg" />
        </div>
      )}

      {goal && (
        <div className="space-y-4">
          {/* State machine visual */}
          <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                Lifecycle State Machine
              </h3>
              <Badge variant={STATUS_BADGE[goal.status].variant} size="sm">
                {STATUS_LABELS[goal.status]}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              {LIFECYCLE_FLOW.map((state, idx, arr) => {
                const active = goal.status === state;
                const passed =
                  goal.events.some((e) => e.type === state) ||
                  (goal.status === 'completed' && state === 'active');
                return (
                  <React.Fragment key={state}>
                    <span
                      className={`px-2 py-1 rounded-md border font-medium ${
                        active
                          ? 'border-[#2B5FD9]/60 bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[#2B5FD9]'
                          : passed
                            ? 'border-[#22C55E]/40 bg-[#F0FDF4] dark:bg-[#14532D]/40 text-[#16A34A]'
                            : 'border-[#E2E8F0] dark:border-[#334155]'
                      }`}
                    >
                      {/* STATUS_LABELS is keyed by every lifecycle state — no
                          untrusted keys reach this lookup. */}
                      {/* eslint-disable-next-line security/detect-object-injection */}
                      {STATUS_LABELS[state]}
                    </span>
                    {idx < arr.length - 1 && (
                      <ArrowRight className="h-3 w-3 shrink-0 text-[#CBD5E1] dark:text-[#475569]" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </Card>

          {/* Transition actions */}
          <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
            <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
              <PauseCircle className="h-4 w-4 text-[#2B5FD9]" /> Transitions
            </h3>
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <button
                  key={a.type}
                  onClick={() => {
                    run(a.type);
                  }}
                  disabled={a.disabled || busy !== null}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-medium text-white transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${a.className}`}
                >
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              Disabled actions are illegal for the current state ({STATUS_LABELS[goal.status]}).
            </p>
          </Card>

          {/* Event timeline */}
          <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
            <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-[#7C3AED]" /> Event Timeline
            </h3>
            <div className="space-y-2">
              {[...goal.events].reverse().map((event) => (
                <div key={event.eventId} className="flex items-start gap-3">
                  <span
                    className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      event.type === 'completed'
                        ? 'bg-[#22C55E]'
                        : event.type === 'cancelled' || event.type === 'blocked'
                          ? 'bg-[#EF4444]'
                          : 'bg-[#2B5FD9]'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC] capitalize">
                        {event.type}
                      </p>
                      <span className="text-[10px] text-[#94A3B8] shrink-0">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      {event.message}
                    </p>
                  </div>
                </div>
              ))}
              {goal.events.length === 0 && (
                <p className="text-[13px] text-[#94A3B8]">No events recorded yet.</p>
              )}
            </div>
          </Card>

          {/* Explanation */}
          {explanation && (
            <Card
              variant="standard"
              padding="md"
              className="dark:bg-[#1E293B] dark:border-[#334155]"
            >
              <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-2">
                Goal Explanation
              </h3>
              <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
                {explanation.summary}
              </p>
              <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                {explanation.lifecycleSummary}
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
