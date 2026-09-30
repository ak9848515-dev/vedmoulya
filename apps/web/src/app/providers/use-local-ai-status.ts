// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Local AI live status (shared source of truth)
//
// ONE hook owns the Local AI connection state so every surface that shows it
// (the full panel AND the AI Providers overview card) reads the SAME measured
// facts. A page calls this once and passes the returned controller down; no
// surface re-derives the state and no surface invents it.
//
// The agent is the authority: this hook only transports its resolved status.
// When the Local Agent is offline every surface shows "Not connected" and
// nothing else about the app changes.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  checkLocalAgent,
  DEFAULT_LOCAL_RUNTIME_ID,
  failureForNullReport,
  failureForReport,
  fetchLocalRuntimeStatus,
  verifyLocalRuntime,
  type LocalAgentCheck,
  type LocalAiFailure,
  type LocalAiState,
  type LocalRuntimeStatusDTO,
  type LocalRuntimeVerifyDTO,
} from './local-ai-agent.js';

export type LocalAiTone = 'neutral' | 'ok' | 'warn' | 'error';

/** The read-only summary other surfaces (the overview card) render. */
export interface LocalAiSnapshot {
  agentReachable: boolean;
  checking: boolean;
  connecting: boolean;
  /** The runtime's resolved state, when one has been measured. */
  state: LocalAiState | null;
  /**
   * TRUE only when the agent itself measured a complete, real connection
   * (runtime + models + selected model + a successful generation). A /health 200
   * alone is NEVER enough — that is the fake-readiness rule.
   */
  connected: boolean;
  label: string;
  tone: LocalAiTone;
  message: string;
  runtimeName: string | null;
  modelId: string | null;
  /** The typed failure to explain, or null when there is nothing wrong. */
  failure: LocalAiFailure | null;
}

export interface LocalAiStatus {
  check: LocalAgentCheck | null;
  report: LocalRuntimeStatusDTO | LocalRuntimeVerifyDTO | null;
  selectedModelId: string;
  setSelectedModelId: (modelId: string) => void;
  checking: boolean;
  connecting: boolean;
  agentReachable: boolean;
  snapshot: LocalAiSnapshot;
  refresh: () => Promise<void>;
  /** Run the strict connect check for the CURRENTLY selected model. */
  connect: () => Promise<void>;
  /** The typed failure the panel should explain, or null when nothing is wrong. */
  failure: LocalAiFailure | null;
  /** TRUE only when the agent measured a complete, real connection. */
  connected: boolean;
}

interface LocalAiInternalState {
  check: LocalAgentCheck | null;
  report: LocalRuntimeStatusDTO | LocalRuntimeVerifyDTO | null;
  selectedModelId: string;
  checking: boolean;
  connecting: boolean;
}

const INITIAL: LocalAiInternalState = {
  check: null,
  report: null,
  selectedModelId: '',
  checking: false,
  connecting: false,
};

const SELECTED_MODEL_STORAGE_KEY = 'vedmoulya.localAi.selectedModelId';

function readSavedModelId(): string {
  try {
    return typeof window === 'undefined'
      ? ''
      : (window.localStorage.getItem(SELECTED_MODEL_STORAGE_KEY) ?? '');
  } catch {
    return '';
  }
}

export function useLocalAiStatus(): LocalAiStatus {
  const [state, setState] = useState<LocalAiInternalState>(() => ({
    ...INITIAL,
    selectedModelId: readSavedModelId(),
  }));

  const refresh = useCallback(async (): Promise<void> => {
    setState((previous) => ({ ...previous, checking: true }));
    const check = await checkLocalAgent();
    if (!check.reachable) {
      setState({ ...INITIAL, check, checking: false });
      return;
    }
    const report = await fetchLocalRuntimeStatus(check.url, DEFAULT_LOCAL_RUNTIME_ID);
    setState((previous) => ({
      ...previous,
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
      // The SELECTED model is whatever the agent actually validated; an explicit
      // user choice survives (never silently overwritten by the agent's default).
      selectedModelId:
        previous.selectedModelId !== ''
          ? previous.selectedModelId
          : (report?.selectedModelId ?? ''),
      connecting: false,
    }));
  }, [state.check, state.selectedModelId]);

  const setSelectedModelId = useCallback(
    (modelId: string): void => {
      try {
        if (typeof window !== 'undefined') {
          if (modelId === '') window.localStorage.removeItem(SELECTED_MODEL_STORAGE_KEY);
          else window.localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, modelId);
        }
      } catch {
        // Selection remains usable for this page even when storage is unavailable.
      }
      setState((previous) => ({ ...previous, selectedModelId: modelId }));
      const check = state.check;
      if (check?.reachable === true) {
        // Carry the explicit choice across the browser/agent boundary immediately;
        // status also confirms whether that exact model is installed.
        void fetchLocalRuntimeStatus(check.url, DEFAULT_LOCAL_RUNTIME_ID, modelId).then(
          (report) => {
            if (report !== null) setState((previous) => ({ ...previous, report }));
          },
        );
      }
    },
    [state.check],
  );

  const agentReachable = state.check?.reachable === true;

  const snapshot = useMemo<LocalAiSnapshot>(() => {
    const report = state.report;
    // CONNECTED is taken from the agent's own verdict (`connected` on the verify
    // report). It is never inferred from a state string, a label or a /health 200.
    const connected = report !== null && 'connected' in report && report.connected;

    const failure: LocalAiFailure | null = !agentReachable
      ? (state.check?.failure ?? failureForNullReport(state.check?.url ?? 'the Local Agent'))
      : report === null
        ? failureForNullReport(state.check?.url ?? 'the Local Agent')
        : connected
          ? null
          : failureForReport(report);

    return {
      agentReachable,
      checking: state.checking,
      connecting: state.connecting,
      state: report?.state ?? null,
      connected,
      label: report?.label ?? (agentReachable ? 'Checking…' : 'Not connected'),
      // Only a real, measured connection can be 'ok'. Otherwise the agent's own
      // tone stands when it measured something, and an unmeasured agent is neutral.
      tone: connected ? 'ok' : (report?.tone ?? 'neutral'),
      message: report?.message ?? state.check?.message ?? 'Checking for the Local Agent…',
      runtimeName: report?.displayName ?? null,
      modelId: report?.selectedModelId ?? report?.models[0]?.id ?? null,
      failure,
    };
  }, [agentReachable, state.check, state.checking, state.connecting, state.report]);

  return {
    check: state.check,
    report: state.report,
    selectedModelId: state.selectedModelId,
    setSelectedModelId,
    checking: state.checking,
    connecting: state.connecting,
    agentReachable,
    connected: snapshot.connected,
    failure: snapshot.failure,
    snapshot,
    refresh,
    connect,
  };
}
