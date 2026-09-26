// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Local AI panel + overview card
//
// Two presentation surfaces over ONE shared live state (`useLocalAiStatus`):
//   • LocalAiPanelView — the full panel on /providers (agent, runtime, model,
//     connection, strict connect check and a streamed generation).
//   • LocalAiOverviewCard — a compact card for the AI Providers overview, so
//     the SAME live connection state is visible on the provider cards.
//
// Neither surface invents a status: everything rendered comes from the agent's
// resolved report. If the Local Agent is not running both say so and cloud AI is
// untouched.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useCallback, useState } from 'react';
import {
  Cpu,
  HardDriveDownload,
  RefreshCw,
  PlugZap,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  DEFAULT_LOCAL_RUNTIME_ID,
  streamLocalGeneration,
  type LocalRuntimeStatusDTO,
  type LocalRuntimeVerifyDTO,
} from './local-ai-agent.js';
import { useLocalAiStatus, type LocalAiStatus, type LocalAiTone } from './use-local-ai-status.js';

const TONE_CLASS: Record<string, string> = {
  ok: 'text-emerald-700 dark:text-emerald-300',
  warn: 'text-amber-700 dark:text-amber-300',
  error: 'text-rose-700 dark:text-rose-300',
  neutral: 'text-[#64748B] dark:text-[#94A3B8]',
};

const TONE_DOT: Record<LocalAiTone, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  error: 'bg-rose-500',
  neutral: 'bg-[#94A3B8]',
};

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

// ── The full panel ────────────────────────────────────────────────────────

export function LocalAiPanelView({ localAi }: { localAi: LocalAiStatus }): React.ReactElement {
  const [prompt, setPrompt] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [output, setOutput] = useState('');
  const [streamMessage, setStreamMessage] = useState<string | null>(null);

  const generate = useCallback(async (): Promise<void> => {
    const check = localAi.check;
    if (check === null || !check.reachable) return;
    const text = prompt.trim();
    if (text === '' || streaming) return;
    setStreaming(true);
    setOutput('');
    setStreamMessage('Generating through the Local Agent…');
    const result = await streamLocalGeneration(check.url, [{ role: 'user', content: text }], {
      runtimeId: DEFAULT_LOCAL_RUNTIME_ID,
      ...(localAi.selectedModelId !== '' ? { modelId: localAi.selectedModelId } : {}),
      onChunk: (chunk) => {
        if (chunk.content === '') return;
        setOutput((previous) => previous + chunk.content);
      },
    });
    setStreaming(false);
    setOutput((previous) => (result.text !== '' ? result.text : previous));
    setStreamMessage(result.message);
  }, [localAi.check, localAi.selectedModelId, prompt, streaming]);

  const { check, report, agentReachable, checking, connecting, selectedModelId } = localAi;
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
            value={selectedModelId}
            onChange={(event) => {
              localAi.setSelectedModelId(event.target.value);
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
        <span>{report?.message ?? check?.message ?? 'Checking for the Local Agent…'}</span>
      </p>

      {verify !== null && verify.checks.length > 0 ? (
        <ul data-testid="local-ai-checks" className="mt-2 space-y-1">
          {verify.checks.map((entry) => (
            <li key={entry.key} className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
              <span
                className={
                  entry.ok
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }
              >
                {entry.ok ? '✓' : '•'}
              </span>{' '}
              {entry.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="local-ai-refresh"
          onClick={() => {
            void localAi.refresh();
          }}
          disabled={checking}
          className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] dark:border-[#334155] px-3 py-2 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {checking ? 'Checking…' : 'Check again'}
        </button>
        <button
          type="button"
          data-testid="local-ai-connect"
          onClick={() => {
            void localAi.connect();
          }}
          disabled={!agentReachable || connecting}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2B5FD9] px-3 py-2 text-[13px] font-medium text-white hover:bg-[#1E4AA8] disabled:opacity-50"
        >
          {connecting ? (
            <HardDriveDownload className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <PlugZap className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {connecting ? 'Connecting…' : 'Connect local AI'}
        </button>
      </div>

      {agentReachable ? (
        <div className="mt-4 border-t border-[#E2E8F0] dark:border-[#334155] pt-4">
          <label
            htmlFor="local-ai-prompt"
            className="text-[12px] font-medium text-[#374151] dark:text-[#E2E8F0]"
          >
            Try a local generation
          </label>
          <textarea
            id="local-ai-prompt"
            data-testid="local-ai-prompt"
            rows={2}
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
            }}
            placeholder="Ask the local model — the reply streams from the Local Agent."
            className="mt-1 w-full rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] px-3 py-2 text-[13px] text-[#111827] dark:text-[#F8FAFC]"
          />
          <button
            type="button"
            data-testid="local-ai-generate"
            onClick={() => {
              void generate();
            }}
            disabled={streaming || prompt.trim() === ''}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#111827] dark:bg-[#F8FAFC] px-3 py-2 text-[13px] font-medium text-white dark:text-[#0F172A] hover:opacity-90 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {streaming ? 'Generating…' : 'Generate'}
          </button>
          <pre
            data-testid="local-ai-output"
            aria-live="polite"
            className="mt-2 min-h-[2.5rem] whitespace-pre-wrap rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1E293B] px-3 py-2 text-[13px] text-[#111827] dark:text-[#F8FAFC]"
          >
            {output}
          </pre>
          {streamMessage !== null ? (
            <p
              data-testid="local-ai-stream-status"
              className="mt-1 text-[12px] text-[#64748B] dark:text-[#94A3B8]"
            >
              {streamMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {!agentReachable ? (
        <p className="mt-2 text-[11px] text-[#94A3B8] dark:text-[#64748B]">
          Start it on this computer with <code>npm run local-agent</code>.
        </p>
      ) : null}
    </section>
  );
}

/** Self-contained panel: owns its own live state when nothing is passed in. */
export function LocalAiPanel(): React.ReactElement {
  const localAi = useLocalAiStatus();
  return <LocalAiPanelView localAi={localAi} />;
}

// ── The compact overview card ─────────────────────────────────────────────
// Rendered among the AI Providers cards; it shows the SAME live connection
// state as the panel (one shared controller), never a second derivation.

export function LocalAiOverviewCard({ localAi }: { localAi: LocalAiStatus }): React.ReactElement {
  const { snapshot } = localAi;
  const connectionLabel = snapshot.state !== null ? snapshot.label : snapshot.label;
  return (
    <section
      data-testid="local-ai-overview-card"
      className="rounded-2xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] p-3.5"
    >
      <div className="flex items-center gap-3">
        <span
          data-testid="local-ai-overview-dot"
          aria-hidden="true"
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[snapshot.tone]}`}
        />
        <Cpu className="h-4 w-4 shrink-0 text-[#2B5FD9] dark:text-[#60A5FA]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC]">Local AI</p>
          <p
            data-testid="local-ai-overview-connection"
            className={`text-[12px] ${TONE_CLASS[snapshot.tone] ?? TONE_CLASS['neutral']}`}
          >
            {connectionLabel}
          </p>
        </div>
        <button
          type="button"
          data-testid="local-ai-overview-refresh"
          aria-label="Check Local AI again"
          onClick={() => {
            void localAi.refresh();
          }}
          disabled={snapshot.checking}
          className="rounded-lg border border-[#E2E8F0] dark:border-[#334155] p-1.5 text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <dl className="mt-2.5 space-y-1">
        <Row
          label="Local Agent"
          value={snapshot.agentReachable ? 'Connected' : 'Not connected'}
          tone={snapshot.agentReachable ? 'ok' : 'neutral'}
          testId="local-ai-overview-agent"
        />
        <Row
          label="Runtime"
          value={snapshot.runtimeName ?? (snapshot.agentReachable ? 'Ollama' : '—')}
          tone="neutral"
          testId="local-ai-overview-runtime"
        />
        <Row
          label="Model"
          value={snapshot.modelId ?? '—'}
          tone="neutral"
          testId="local-ai-overview-model"
        />
      </dl>
    </section>
  );
}

export default LocalAiPanel;
