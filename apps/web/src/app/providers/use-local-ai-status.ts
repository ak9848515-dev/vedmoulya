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
  fetchLocalRuntimeStatus,
  verifyLocalRuntime,
  type LocalAgentCheck,
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
  label: string;
  tone: LocalAiTone;
  message: string;
  runtimeName: string | null;
  modelId: string | null;
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
  connect: () => Promise<void>;
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

export function useLocalAiStatus(): LocalAiStatus {
  const [state, setState] = useState<LocalAiInternalState>(INITIAL);

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
      selectedModelId: report?.selectedModelId ?? previous.selectedModelId,
      connecting: false,
    }));
  }, [state.check, state.selectedModelId]);

  const setSelectedModelId = useCallback((modelId: string): void => {
    setState((previous) => ({ ...previous, selectedModelId: modelId }));
  }, []);

  const agentReachable = state.check?.reachable === true;

  const snapshot = useMemo<LocalAiSnapshot>(() => {
    const report = state.report;
    return {
      agentReachable,
      checking: state.checking,
      connecting: state.connecting,
      state: report?.state ?? null,
      label: report?.label ?? (agentReachable ? 'Checking…' : 'Not connected'),
      tone: report?.tone ?? 'neutral',
      message: report?.message ?? state.check?.message ?? 'Checking for the Local Agent…',
      runtimeName: report?.displayName ?? null,
      modelId: report?.selectedModelId ?? report?.models[0]?.id ?? null,
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
    snapshot,
    refresh,
    connect,
  };
}
