// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Control Panel (SPRINT-031)
// The Autonomy Control surface inside the AICompanion:
//   • Autonomy level (0–5) — explicit user confirmation required to save
//     (fail-closed: nothing is granted without confirmation).
//   • Emergency stop — audited ENGAGE/RELEASE; when engaged every
//     recommendation is blocked and the panel says so clearly.
//   • TODAY briefing — composed no-spam summary (pending approvals,
//     opportunities, provider health, cost).
// Same design tokens as the rest of the companion; nothing here executes or
// authorizes anything — it only reads the control plane and records the
// user's explicit choices.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, SlidersHorizontal, Sun } from 'lucide-react';
import { api } from '../lib/trpc.js';
import { useAuthStore } from '../stores/auth-store.js';

interface SettingsData {
  autonomyLevel: number;
  userConfirmed: boolean;
  maxDailyCostUsd?: number;
  maxTaskCostUsd?: number;
  privateOnly: boolean;
  notificationPreference: string;
}

interface BriefingData {
  hasContent: boolean;
  emergencyStopEngaged: boolean;
  settingsConfirmed: boolean;
  autonomyLevel: number;
  pendingApprovals: Array<{ taskId: string; title: string; approvalRequired: string[] }>;
  opportunities: Array<{ title: string; status: string; category: string }>;
  recommendedNextAction: string;
}

const LEVEL_LABELS: Record<number, string> = {
  0: 'Observe only',
  1: 'Recommend',
  2: 'Prepare / draft',
  3: 'Ask approval',
  4: 'Execute low-risk pre-authorized',
  5: 'Continuous within explicit policy',
};

export function ControlPanel(): React.JSX.Element {
  const userId = useAuthStore((s) => s.user?.userId ?? '');
  const settingsQuery = api.control.getSettings.useQuery(
    { userId },
    { enabled: userId.length > 0, refetchOnWindowFocus: false },
  );
  const briefingQuery = api.control.todayBriefing.useQuery(
    { userId },
    { enabled: userId.length > 0, refetchOnWindowFocus: false },
  );
  const stopStatusQuery = api.control.stopStatus.useQuery(
    { userId },
    { enabled: userId.length > 0, refetchOnWindowFocus: false },
  );
  const updateSettings = api.control.updateSettings.useMutation();
  const engageStop = api.control.engageStop.useMutation();
  const releaseStop = api.control.releaseStop.useMutation();

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [level, setLevel] = useState(0);
  const [dailyCap, setDailyCap] = useState('');
  const [taskCap, setTaskCap] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [engaged, setEngaged] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!userId) return;
    setError('');
    const [settingsResult, briefingResult, stopResult] = await Promise.all([
      settingsQuery.refetch(),
      briefingQuery.refetch(),
      stopStatusQuery.refetch(),
    ]);
    if (settingsResult.data?.success && settingsResult.data.data) {
      const s = settingsResult.data.data as SettingsData;
      setSettings(s);
      setLevel(s.autonomyLevel);
      setDailyCap(s.maxDailyCostUsd !== undefined ? String(s.maxDailyCostUsd) : '');
      setTaskCap(s.maxTaskCostUsd !== undefined ? String(s.maxTaskCostUsd) : '');
    }
    if (briefingResult.data?.success && briefingResult.data.data) {
      setBriefing(briefingResult.data.data as BriefingData);
    }
    if (stopResult.data?.success) {
      setEngaged((stopResult.data.data as { engaged?: boolean }).engaged ?? false);
    }
    if (!settingsResult.data?.success && !briefingResult.data?.success) {
      setError('Could not reach the control plane.');
    }
  }, [userId, settingsQuery, briefingQuery, stopStatusQuery]);

  useEffect(() => {
    void load();
  }, [userId]);

  const toggleStop = async (engage: boolean): Promise<void> => {
    if (!userId) return;
    if (engage) {
      await engageStop.mutateAsync({ userId, reason: 'User engaged the stop', source: 'user' });
    } else {
      await releaseStop.mutateAsync({ userId, reason: 'User released the stop', source: 'user' });
    }
    setEngaged(engage);
    await load();
  };

  const saveSettings = async (): Promise<void> => {
    if (!userId) return;
    setError('');
    setSaved(false);
    try {
      const result = await updateSettings.mutateAsync({
        userId,
        autonomyLevel: level,
        maxDailyCostUsd: dailyCap === '' ? undefined : Number(dailyCap),
        maxTaskCostUsd: taskCap === '' ? undefined : Number(taskCap),
        userConfirmed: true,
      });
      if (result.success) {
        setSaved(true);
        await load();
      } else {
        setError(
          (result as { error?: { message?: string } }).error?.message ?? 'Settings were refused.',
        );
      }
    } catch {
      setError('Settings were refused — explicit confirmation is required.');
    }
  };

  return (
    <div className="w-full" data-testid="control-panel">
      {error && (
        <div
          className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 mb-2 text-[12px] text-[#B91C1C]"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Emergency stop */}
      <div
        className={`rounded-xl border px-3 py-2 mb-2 ${
          engaged ? 'border-[#FECACA] bg-[#FEF2F2]' : 'border-[#E2E8F0] bg-[#F8FAFC]'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151]">
            {engaged ? (
              <ShieldAlert className="h-3.5 w-3.5 text-[#B91C1C]" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
            )}
            Emergency stop {engaged ? 'ENGAGED' : 'released'}
          </span>
          {engaged ? (
            <button
              onClick={() => {
                void toggleStop(false);
              }}
              className="px-2 py-1 rounded-lg text-[11px] font-medium text-[#B91C1C] bg-[#FEE2E2] hover:bg-[#FECACA] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91C1C]"
              aria-label="Release emergency stop"
            >
              Release
            </button>
          ) : (
            <button
              onClick={() => {
                void toggleStop(true);
              }}
              className="px-2 py-1 rounded-lg text-[11px] font-medium text-white bg-[#B91C1C] hover:bg-[#991B1B] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B91C1C]"
              aria-label="Engage emergency stop"
            >
              Engage
            </button>
          )}
        </div>
        {engaged && (
          <p className="mt-1 text-[11px] text-[#B91C1C]">
            Autonomous pathways are halted. Nothing executes until released.
          </p>
        )}
      </div>

      {/* TODAY briefing */}
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 mb-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151] mb-1">
          <Sun className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
          TODAY
        </span>
        {!briefing?.hasContent ? (
          <p className="text-[12px] text-[#94A3B8]">
            Nothing requires attention right now — no spam.
          </p>
        ) : (
          <>
            {briefing.pendingApprovals.length > 0 && (
              <p className="text-[12px] text-[#374151]">
                <span className="font-medium">{briefing.pendingApprovals.length}</span> pending
                approval
                {briefing.pendingApprovals.length === 1 ? '' : 's'} ·{' '}
                {briefing.pendingApprovals.map((p) => p.title).join(', ')}
              </p>
            )}
            {briefing.opportunities.length > 0 && (
              <p className="text-[12px] text-[#374151]">
                <span className="font-medium">{briefing.opportunities.length}</span> active
                opportunity
                {briefing.opportunities.length === 1 ? '' : 'ies'}
              </p>
            )}
            <p className="text-[12px] text-[#64748B] mt-1">{briefing.recommendedNextAction}</p>
          </>
        )}
      </div>

      {/* Autonomy settings */}
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 mb-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#374151] mb-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-[#7C3AED]" aria-hidden="true" />
          Autonomy
        </span>
        <label className="block text-[11px] text-[#64748B] mb-1" htmlFor="autonomy-level">
          Global autonomy level
        </label>
        <select
          id="autonomy-level"
          value={level}
          onChange={(e) => {
            setLevel(Number(e.target.value));
          }}
          className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-[12px] text-[#1F2937] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
          aria-label="Global autonomy level"
        >
          {Object.entries(LEVEL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {value} — {label}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div>
            <label className="block text-[11px] text-[#64748B] mb-1" htmlFor="daily-cap">
              Daily spend cap (USD)
            </label>
            <input
              id="daily-cap"
              type="number"
              min={0}
              step="0.01"
              value={dailyCap}
              onChange={(e) => {
                setDailyCap(e.target.value);
              }}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-[12px] text-[#1F2937] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
              aria-label="Daily spend cap in USD"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#64748B] mb-1" htmlFor="task-cap">
              Task spend cap (USD)
            </label>
            <input
              id="task-cap"
              type="number"
              min={0}
              step="0.01"
              value={taskCap}
              onChange={(e) => {
                setTaskCap(e.target.value);
              }}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-[12px] text-[#1F2937] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
              aria-label="Task spend cap in USD"
            />
          </div>
        </div>
        <button
          onClick={() => {
            void saveSettings();
          }}
          className="mt-2 w-full rounded-lg bg-[#2B5FD9] text-white text-[12px] font-medium py-1.5 hover:bg-[#1E4AA8] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
          aria-label="Save autonomy settings"
        >
          Save settings (explicit confirmation)
        </button>
        {saved && <p className="mt-1 text-[11px] text-[#15803D]">Settings saved.</p>}
        {settings && !settings.userConfirmed && (
          <p className="mt-1 text-[11px] text-[#92400E]">
            No autonomy is granted until you explicitly confirm settings.
          </p>
        )}
      </div>

      <p className="mt-1 px-1 text-[10px] text-[#94A3B8]">
        The control plane never executes or authorizes — approval stays with the existing authority.
      </p>
    </div>
  );
}
