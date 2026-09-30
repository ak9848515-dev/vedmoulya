import { describe, it, expect } from 'vitest';
import {
  deriveLocalAiState,
  isLocalAiConnected,
  localAiStateLabel,
  LOCAL_AI_STATE_META,
  stateForRuntimeError,
  type LocalAiState,
} from '../states.js';
import type { LocalRuntimeErrorKind } from '../types.js';

describe('deriveLocalAiState — honest state derivation', () => {
  it('is LOCAL_AGENT_NOT_RUNNING when the agent is not reachable', () => {
    expect(deriveLocalAiState({ agentReachable: false })).toBe('LOCAL_AGENT_NOT_RUNNING');
  });

  it('is LOCAL_AGENT_RUNNING (only) when no runtime fact has landed', () => {
    expect(deriveLocalAiState({ agentReachable: true })).toBe('LOCAL_AGENT_RUNNING');
  });

  it('maps each runtime error kind onto its own state', () => {
    const cases: Array<[LocalRuntimeErrorKind, LocalAiState]> = [
      ['NOT_RUNNING', 'OLLAMA_NOT_RUNNING'],
      ['UNREACHABLE', 'OLLAMA_UNREACHABLE'],
      ['INVALID_RESPONSE', 'OLLAMA_INVALID_RESPONSE'],
      ['MODEL_UNAVAILABLE', 'OLLAMA_MODEL_UNAVAILABLE'],
      ['GENERATION_FAILED', 'OLLAMA_GENERATION_FAILED'],
    ];
    for (const [error, state] of cases) {
      expect(stateForRuntimeError(error)).toBe(state);
      expect(deriveLocalAiState({ agentReachable: true, runtimeError: error })).toBe(state);
    }
    // NO_MODELS is deliberately FOLDED into the modelCount path: an honest, empty
    // catalog is a fact about models, not a runtime failure. It must still land on
    // OLLAMA_NO_MODELS — never on a "connected" state.
    expect(stateForRuntimeError('NO_MODELS')).toBe('OLLAMA_NO_MODELS');
    expect(
      deriveLocalAiState({ agentReachable: true, runtimeError: 'NO_MODELS', modelCount: 0 }),
    ).toBe('OLLAMA_NO_MODELS');
  });

  it('never reports CONNECTED without a real, successful generation', () => {
    // Reachable + models, but NO generation attempted → MODELS_FOUND, not CONNECTED.
    expect(deriveLocalAiState({ agentReachable: true, modelCount: 2 })).toBe('OLLAMA_MODELS_FOUND');
    // Generation attempted → the verdict is the generation's.
    expect(
      deriveLocalAiState({
        agentReachable: true,
        modelCount: 2,
        generationTested: true,
        generationOk: true,
      }),
    ).toBe('OLLAMA_CONNECTED');
    expect(
      deriveLocalAiState({
        agentReachable: true,
        modelCount: 2,
        generationTested: true,
        generationOk: false,
      }),
    ).toBe('OLLAMA_GENERATION_FAILED');
  });

  it('reports OLLAMA_MODEL_UNAVAILABLE for a selected-but-missing model', () => {
    expect(
      deriveLocalAiState({
        agentReachable: true,
        modelCount: 1,
        selectedModelId: 'ghost:latest',
        selectedModelAvailable: false,
      }),
    ).toBe('OLLAMA_MODEL_UNAVAILABLE');
  });
});

describe('state metadata — no fake readiness', () => {
  // A /health 200 proves ONLY that the agent process is up. Reporting a green
  // "connected" state there would be exactly the fake readiness we must avoid.
  it('does NOT label a bare LOCAL_AGENT_RUNNING as connected or tone it ok', () => {
    const meta = LOCAL_AI_STATE_META['LOCAL_AGENT_RUNNING'];
    expect(meta.label).toBe('Local Agent running');
    expect(meta.label).not.toMatch(/connected/i);
    expect(meta.tone).not.toBe('ok');
    expect(localAiStateLabel('LOCAL_AGENT_RUNNING', 'Ollama')).toBe('Local Agent running');
  });

  it('reserves the "Connected" label and the ok tone for OLLAMA_CONNECTED alone', () => {
    expect(localAiStateLabel('OLLAMA_CONNECTED', 'Ollama')).toBe('Connected');
    expect(LOCAL_AI_STATE_META['OLLAMA_CONNECTED'].tone).toBe('ok');

    const states = Object.keys(LOCAL_AI_STATE_META) as LocalAiState[];
    const okStates = states.filter((state) => LOCAL_AI_STATE_META[state].tone === 'ok');
    // OLLAMA_CONNECTED plus OLLAMA_MODELS_FOUND ("we found models, you may pick one").
    expect(okStates).toEqual(['OLLAMA_MODELS_FOUND', 'OLLAMA_CONNECTED']);
    expect(isLocalAiConnected('OLLAMA_CONNECTED')).toBe(true);
    for (const state of states.filter((s) => s !== 'OLLAMA_CONNECTED')) {
      expect(isLocalAiConnected(state)).toBe(false);
      expect(localAiStateLabel(state, 'Ollama')).not.toBe('Connected');
    }
  });

  it('names the runtime actually being talked to, never "Ollama" unconditionally', () => {
    expect(localAiStateLabel('OLLAMA_NOT_RUNNING', 'LM Studio')).toBe('LM Studio not running');
    expect(localAiStateLabel('OLLAMA_UNREACHABLE', 'LM Studio')).toBe('LM Studio unreachable');
  });
});
