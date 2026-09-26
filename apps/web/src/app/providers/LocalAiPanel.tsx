// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Local AI panel (minimal integration)
//
// Deliberately SMALL: it represents Local AI as three clearly separate things —
//   LOCAL AGENT (the bridge on this computer)
//   RUNTIME     (Ollama, the first local runtime)
//   MODEL       (a model the runtime really has)
// and one Connection state. It never invents a status: everything rendered comes
// from the Local Agent's resolved report.
//
// If the Local Agent is not running the panel says so and nothing else changes —
// cloud AI is untouched and the page keeps working.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Cpu,
  HardDriveDownload,
  RefreshCw,
  PlugZap,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  checkLocalAgent,
  DEFAULT_LOCAL_RUNTIME_ID,
  fetchLocalRuntimeStatus,
  verifyLocalRuntime,
  type LocalAgentCheck,
  type LocalRuntimeStatusDTO,
  type LocalRuntimeVerifyDTO,
} from './local-ai-agent.js';

const TONE_CLASS: Record<string, string> = {
  ok: 'text-emerald-700 dark:text-emerald-300',
  warn: 'text-amber-700 dark:text-amber-300',
  error: 'text-rose-700 dark:text-rose-300',
  neutral: 'text-[#64748B] dark:text-[#94A3B8]',
};

interface LocalAiState {
  check: LocalAgentCheck | null;
  report: LocalRuntimeStatusDTO | LocalRuntimeVerifyDTO | null;
  selectedModelId: string;
  checking: boolean;
  connecting: boolean;
}

export function LocalAiPanel(): React.ReactElement {
  const [state, setState] = useState<LocalAiState>({
    check: null,
    report: null,
    selectedModelId: '',
    checking: false,
    connecting: false,
  });

  const refresh = useCallback(async (): Promise<void> => {
    setState((previous) => ({ ...previous, checking: true }));
    const check = await checkLocalAgent();
    if (!check.reachable) {
      setState({ check, report: null, selectedModelId: '', checking: false, connecting: false });
      return;
    }
    const report = await fetchLocalRuntimeStatus(check.url, DEFAULT_LOCAL_RUNTIME_ID);
    setState((previous) => ({
      check,
      report,
      selectedModelId:
        previous.selectedModelId !== ''
          ? previous.selectedModelId
          : (report?.selectedModelId ?? ''),
      checking: false,
      connecting: false,
    }));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async (): Promise<void> => {
    const check = state.check;
    if (check === null || !check.reachable) return;
    setState((previous) => ({ ...previous, connecting: true }));
    const report = await verifyLocalRuntime(
      check.url,
      DEFAULT_LOCAL_RUNTIME_ID,
      state.selectedModelId !== '' ? state.selectedModelId : undefined,
    );
    setState((previous) => ({
      ...previous,
      report: report ?? previous.report,
      selectedModelId: report?.selectedModelId ?? previous.selectedModelId,
      connecting: false,
    }));
  }, [state.check, state.selectedModelId]);

  const agentReachable = state.check?.reachable === true;
  const report = state.report;
  const verify = isVerifyReport(report) ? report : null;
  const tone = report?.tone ?? 'neutral';

  return (
    <section
      data-testid="local-ai-panel"
      className="rounded-2xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] p-4"
    >
      <div className="flex items-start gap-3">
        <Cpu
          className="mt-0.5 h-5 w-5 shrink-0 text-[#2B5FD9] dark:text-[#60A5FA]"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Local AI
          </h2>
          <p className="mt-0.5 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
            Run AI on this computer through the VedMoulya Local Agent. Local AI is separate from
            cloud providers and is never required.
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        <Row
          label="Local Agent"
          value={agentReachable ? 'Connected' : 'Not connected'}
          tone={agentReachable ? 'ok' : 'neutral'}
          testId="local-ai-agent-status"
        />
        <Row
          label="Runtime"
          value={agentReachable ? (report?.displayName ?? 'Ollama') : '—'}
          tone="neutral"
          testId="local-ai-runtime"
        />
        <Row
          label="Model"
          value={report?.selectedModelId ?? report?.models[0]?.id ?? '—'}
          tone="neutral"
          testId="local-ai-model"
        />
        <Row
          label="Connection"
          value={report?.label ?? (agentReachable ? 'Checking…' : 'Not connected')}
          tone={tone}
          testId="local-ai-connection"
        />
      </dl>

      {report !== null && report.models.length > 0 ? (
        <div className="mt-3">
          <label
            htmlFor="local-ai-model-select"
            className="text-[12px] font-medium text-[#374151] dark:text-[#E2E8F0]"
          >
            Local model
          </label>
          <select
            id="local-ai-model-select"
            data-testid="local-ai-model-select"
            value={state.selectedModelId}
            onChange={(event) => {
              setState((previous) => ({ ...previous, selectedModelId: event.target.value }));
            }}
            className="mt-1 w-full rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] px-3 py-2 text-[13px] text-[#111827] dark:text-[#F8FAFC]"
          >
            {report.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <p
        data-testid="local-ai-message"
        className={`mt-3 flex items-start gap-2 text-[12px] ${TONE_CLASS[tone] ?? TONE_CLASS['neutral']}`}
      >
        {tone === 'ok' ? (
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span>{report?.message ?? state.check?.message ?? 'Checking for the Local Agent…'}</span>
      </p>

      {verify !== null && verify.checks.length > 0 ? (
        <ul data-testid="local-ai-checks" className="mt-2 space-y-1">
          {verify.checks.map((check) => (
            <li key={check.key} className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
              <span
                className={
                  check.ok
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }
              >
                {check.ok ? '✓' : '•'}
              </span>{' '}
              {check.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="local-ai-refresh"
          onClick={() => {
            void refresh();
          }}
          disabled={state.checking}
          className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] dark:border-[#334155] px-3 py-2 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {state.checking ? 'Checking…' : 'Check again'}
        </button>
        <button
          type="button"
          data-testid="local-ai-connect"
          onClick={() => {
            void connect();
          }}
          disabled={!agentReachable || state.connecting}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2B5FD9] px-3 py-2 text-[13px] font-medium text-white hover:bg-[#1E4AA8] disabled:opacity-50"
        >
          {state.connecting ? (
            <HardDriveDownload className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <PlugZap className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {state.connecting ? 'Connecting…' : 'Connect local AI'}
        </button>
      </div>

      {!agentReachable ? (
        <p className="mt-2 text-[11px] text-[#94A3B8] dark:text-[#64748B]">
          Start it on this computer with <code>npm run local-agent</code>.
        </p>
      ) : null}
    </section>
  );
}

function isVerifyReport(report: LocalRuntimeStatusDTO | null): report is LocalRuntimeVerifyDTO {
  return report !== null && Array.isArray((report as LocalRuntimeVerifyDTO).checks);
}

function Row({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: string;
  tone: string;
  testId: string;
}): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">{label}</dt>
      <dd
        data-testid={testId}
        className={`text-[13px] font-medium ${TONE_CLASS[tone] ?? TONE_CLASS['neutral']}`}
      >
        {value}
      </dd>
    </div>
  );
}

export default LocalAiPanel;
