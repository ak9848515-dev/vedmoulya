'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, Badge, Button } from '@vedmoulya/ui';
import {
  Play,
  Pause,
  RotateCcw,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Receipt,
  Target,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  useMissionCreateAndRun,
  useMissionStatus,
  useMissionHistory,
  useMissionPause,
  useMissionResume,
  useMissionCancel,
  type MissionStatusView,
  type MissionHistoryEntry,
} from '../lib/api-client.js';

export interface AutonomousBusinessPanelProps {
  userId: string;
  onMissionStarted?: (missionId: string) => void;
  className?: string;
}

const PRESET_WORKFLOWS = [
  {
    id: 'opportunity-engine',
    title: 'Opportunity & Lead Engine',
    description:
      'Mine market & AI-world opportunities, qualify prospects, and prepare draft client proposals.',
    objective:
      'Discover and qualify active market opportunities, score their strategic fit, and draft custom commercial proposals.',
    icon: TrendingUp,
    color:
      'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
  },
  {
    id: 'revenue-sentinel',
    title: 'Revenue & Cash Flow Sentinel',
    description:
      'Audit outstanding and overdue receivables, reconcile payments, and draft client follow-ups.',
    objective:
      'Reconcile recorded invoices, identify overdue payments, calculate cash flow exposure, and draft recovery advisories.',
    icon: Receipt,
    color:
      'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
  },
  {
    id: 'goal-autopilot',
    title: 'Goal & Project Autopilot',
    description:
      'Break down business goals into verified milestones, assign budget parameters, and track execution.',
    objective:
      'Decompose active strategic business goals into verified operational milestones and generate project delivery roadmaps.',
    icon: Target,
    color:
      'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
  },
];

export function AutonomousBusinessPanel({
  userId,
  onMissionStarted,
  className = '',
}: AutonomousBusinessPanelProps): React.JSX.Element {
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customObjective, setCustomObjective] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createAndRun = useMissionCreateAndRun();
  const pauseMission = useMissionPause();
  const resumeMission = useMissionResume();
  const cancelMission = useMissionCancel();

  const historyQuery = useMissionHistory(userId);
  const histories: MissionHistoryEntry[] = historyQuery.data ?? [];

  // If no active mission is manually selected, automatically target the most recent running or created mission
  const activeHistoryMission = histories.find((h) =>
    ['RUNNING', 'CREATED', 'PAUSED'].includes(h.state),
  );
  const effectiveMissionId = selectedMissionId ?? activeHistoryMission?.missionId ?? null;

  const statusQuery = useMissionStatus(userId, effectiveMissionId);
  const mission: MissionStatusView | null = statusQuery.data ?? null;

  const handleLaunchPreset = async (preset: (typeof PRESET_WORKFLOWS)[0]): Promise<void> => {
    if (createAndRun.isPending) return;
    setErrorMessage(null);
    try {
      const res = await createAndRun.mutateAsync({
        userId,
        title: preset.title,
        objective: preset.objective,
        initialObjectives: [preset.objective],
        maxObjectives: 5,
      });
      const envelope = res as unknown as { data?: { missionId?: string } } | undefined;
      const newId = envelope?.data?.missionId;
      if (newId) {
        setSelectedMissionId(newId);
        onMissionStarted?.(newId);
        void historyQuery.refetch();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to launch autonomous mission');
    }
  };

  const handleLaunchCustom = async (e: React.SyntheticEvent): Promise<void> => {
    e.preventDefault();
    if (!customTitle.trim() || !customObjective.trim() || createAndRun.isPending) return;
    setErrorMessage(null);
    try {
      const res = await createAndRun.mutateAsync({
        userId,
        title: customTitle.trim(),
        objective: customObjective.trim(),
        initialObjectives: [customObjective.trim()],
        maxObjectives: 5,
      });
      const envelope = res as unknown as { data?: { missionId?: string } } | undefined;
      const newId = envelope?.data?.missionId;
      if (newId) {
        setSelectedMissionId(newId);
        setCustomTitle('');
        setCustomObjective('');
        setShowCustomForm(false);
        onMissionStarted?.(newId);
        void historyQuery.refetch();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to launch custom mission');
    }
  };

  const handlePause = async (): Promise<void> => {
    if (!effectiveMissionId) return;
    try {
      await pauseMission.mutateAsync({ userId, missionId: effectiveMissionId });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to pause mission');
    }
  };

  const handleResume = async (): Promise<void> => {
    if (!effectiveMissionId) return;
    try {
      await resumeMission.mutateAsync({ userId, missionId: effectiveMissionId });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to resume mission');
    }
  };

  const handleCancel = async (): Promise<void> => {
    if (!effectiveMissionId) return;
    try {
      await cancelMission.mutateAsync({ userId, missionId: effectiveMissionId });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to cancel mission');
    }
  };

  const isRunning = mission?.state === 'RUNNING';
  const isPaused = mission?.state === 'PAUSED';

  return (
    <Card
      variant="standard"
      padding="lg"
      className={`border-slate-200 dark:border-slate-800 ${className}`}
      data-testid="autonomous-business-panel"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-[18px] font-semibold text-slate-900 dark:text-slate-100">
              Autonomous Business Engine
            </h2>
            {isRunning && (
              <Badge variant="success" size="sm" className="animate-pulse">
                Active Loop
              </Badge>
            )}
            {isPaused && (
              <Badge variant="warning" size="sm">
                Paused
              </Badge>
            )}
          </div>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Autonomous agent operations for your business. Select an autonomous workflow or define
            an objective — the engine plans, executes, verifies, and records durable milestones
            without manual intervention.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/autonomous-builder"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Open Mission Builder
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[13px] text-rose-700 dark:text-rose-300"
        >
          {errorMessage}
        </div>
      )}

      {/* Preset Autonomous Workflow Launchers */}
      <div className="mt-4">
        <p className="text-[12px] font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
          1-Click Autonomous Operations
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PRESET_WORKFLOWS.map((preset) => {
            const Icon = preset.icon;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => void handleLaunchPreset(preset)}
                disabled={createAndRun.isPending}
                className="text-left rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm transition-all bg-white dark:bg-slate-900/50 group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`p-1.5 rounded-lg border ${preset.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {preset.title}
                  </h3>
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  {preset.description}
                </p>
                <div className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                  <Play className="w-3 h-3 fill-current" />
                  Run Autonomously
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom Mission Form Toggle */}
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setShowCustomForm(!showCustomForm);
            }}
            className="text-[12px] font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 flex items-center gap-1"
          >
            {showCustomForm ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            {showCustomForm ? 'Hide custom mission prompt' : '+ Define custom autonomous mission'}
          </button>

          {histories.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowHistory(!showHistory);
              }}
              className="text-[12px] font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 flex items-center gap-1"
            >
              {showHistory ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              {showHistory ? 'Hide history' : `Recent missions (${histories.length})`}
            </button>
          )}
        </div>

        {showCustomForm && (
          <form
            onSubmit={(e) => void handleLaunchCustom(e)}
            className="mt-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-3"
          >
            <div>
              <label
                htmlFor="custom-mission-title"
                className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Mission Title
              </label>
              <input
                id="custom-mission-title"
                type="text"
                value={customTitle}
                onChange={(e) => {
                  setCustomTitle(e.target.value);
                }}
                placeholder="e.g., Audit Q4 Software Subscriptions & Reduce Costs"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label
                htmlFor="custom-mission-objective"
                className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Autonomous Objective Description
              </label>
              <textarea
                id="custom-mission-objective"
                value={customObjective}
                onChange={(e) => {
                  setCustomObjective(e.target.value);
                }}
                rows={2}
                placeholder="Describe what the agent should investigate, compile, or execute..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowCustomForm(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createAndRun.isPending}>
                {createAndRun.isPending ? 'Launching…' : 'Launch Autonomous Mission'}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Active Mission Live Display */}
      {mission && (
        <div
          className="mt-5 p-4 rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20"
          data-testid="active-mission-card"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Active Autonomous Mission
                </span>
                <Badge
                  variant={
                    mission.state === 'RUNNING'
                      ? 'success'
                      : mission.state === 'COMPLETED'
                        ? 'default'
                        : mission.state === 'PAUSED'
                          ? 'warning'
                          : 'danger'
                  }
                  size="sm"
                >
                  {mission.state}
                </Badge>
              </div>
              <h3 className="text-[16px] font-semibold text-slate-900 dark:text-slate-100 mt-1">
                {mission.title}
              </h3>
              <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-0.5">
                {mission.objective}
              </p>
            </div>

            {/* Mission Controls */}
            <div className="flex items-center gap-2">
              {isRunning && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handlePause()}
                  disabled={pauseMission.isPending}
                >
                  <Pause className="w-3.5 h-3.5 mr-1" />
                  Pause
                </Button>
              )}
              {isPaused && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleResume()}
                  disabled={resumeMission.isPending}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Resume
                </Button>
              )}
              {!['COMPLETED', 'CANCELLED', 'FAILED'].includes(mission.state) && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void handleCancel()}
                  disabled={cancelMission.isPending}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Stop
                </Button>
              )}
              <Link
                href={`/autonomous-builder?mission=${mission.missionId}`}
                className="text-[12px] font-medium text-blue-600 hover:underline px-2 py-1"
              >
                Full View →
              </Link>
            </div>
          </div>

          {/* Current Running Objective */}
          {mission.currentObjective && (
            <div className="mt-3 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                  Current Step: {mission.currentObjective.title}
                </span>
                <span className="text-slate-500">{mission.currentObjective.state}</span>
              </div>
            </div>
          )}

          {/* Objectives Progress Summary */}
          {mission.objectives.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>Objective Timeline</span>
                <span>
                  {mission.objectives.filter((o) => o.state === 'VERIFIED').length} /{' '}
                  {mission.objectives.length} verified
                </span>
              </div>
              <div className="space-y-1.5">
                {mission.objectives.map((obj) => (
                  <div
                    key={obj.objectiveId}
                    className="flex items-center justify-between text-[12px] px-2.5 py-1.5 rounded-md bg-white/70 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800"
                  >
                    <span className="truncate max-w-[80%] text-slate-700 dark:text-slate-300">
                      {obj.title}
                    </span>
                    <span
                      className={`text-[11px] font-medium ${
                        obj.state === 'VERIFIED'
                          ? 'text-emerald-600'
                          : obj.state === 'RUNNING'
                            ? 'text-blue-600'
                            : 'text-slate-400'
                      }`}
                    >
                      {obj.state}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History Drawer */}
      {showHistory && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[12px] font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Recent Autonomous Mission Runs
          </p>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
            {histories.map((entry) => (
              <div
                key={entry.missionId}
                onClick={() => {
                  setSelectedMissionId(entry.missionId);
                }}
                className={`py-2 px-2 rounded-lg cursor-pointer flex items-center justify-between text-[12px] hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors ${
                  effectiveMissionId === entry.missionId ? 'bg-blue-50/50 dark:bg-blue-950/30' : ''
                }`}
              >
                <div className="truncate max-w-[70%]">
                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                    {entry.title}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {entry.verifiedObjectives} of {entry.totalObjectives} objectives verified
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={entry.state === 'COMPLETED' ? 'success' : 'default'} size="sm">
                    {entry.state}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
