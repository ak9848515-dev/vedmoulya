import { describe, it, expect } from 'vitest';
import {
  deriveLocalAiState,
  isLocalAiConnected,
  localAiStateLabel,
  stateForRuntimeError,
  LOCAL_AI_STATE_META,
  type LocalAiState,
} from '../states.js';
import type { LocalRuntimeErrorKind } from '../types.js';

describe('deriveLocalAiState', () => {
  it('reports LOCAL_AGENT_NOT_RUNNING when the agent is unreachable', () => {
    expect(deriveLocalAiState({ agentReachable: false })).toBe('LOCAL_AGENT_NOT_RUNNING');
  });

  it('reports LOCAL_AGENT_RUNNING when the agent is up but nothing is measured', () => {
    expect(deriveLocalAiState({ agentReachable: true })).toBe('LOCAL_AGENT_RUNNING');
  });

  it.each<[LocalRuntimeErrorKind, LocalAiState]>([
    ['NOT_RUNNING', 'OLLAMA_NOT_RUNNING'],
    ['UNREACHABLE', 'OLLAMA_UNREACHABLE'],
    ['INVALID_RESPONSE', 'OLLAMA_INVALID_RESPONSE'],
    ['MODEL_UNAVAILABLE', 'OLLAMA_MODEL_UNAVAILABLE'],
    ['GENERATION_FAILED', 'OLLAMA_GENERATION_FAILED'],
  ])('maps runtime error %s to %s', (error, state) => {
    expect(stateForRuntimeError(error)).toBe(state);
    expect(deriveLocalAiState({ agentReachable: true, runtimeError: error })).toBe(state);
  });

  it('reports OLLAMA_NO_MODELS for an empty catalog', () => {
    expect(
      deriveLocalAiState({ agentReachable: true, runtimeError: 'NO_MODELS', modelCount: 0 }),
    ).toBe('OLLAMA_NO_MODELS');
    expect(deriveLocalAiState({ agentReachable: true, modelCount: 0 })).toBe('OLLAMA_NO_MODELS');
  });

  it('reports OLLAMA_MODELS_FOUND before any generation is tested', () => {
    expect(deriveLocalAiState({ agentReachable: true, modelCount: 2 })).toBe('OLLAMA_MODELS_FOUND');
  });

  it('reports OLLAMA_MODEL_UNAVAILABLE for a missing selected model', () => {
    expect(
      deriveLocalAiState({
        agentReachable: true,
        modelCount: 2,
        selectedModelId: 'ghost',
        selectedModelAvailable: false,
      }),
    ).toBe('OLLAMA_MODEL_UNAVAILABLE');
  });

  it('reports OLLAMA_GENERATION_FAILED when a real generation did not succeed', () => {
    expect(
      deriveLocalAiState({
        agentReachable: true,
        modelCount: 2,
        selectedModelId: 'a',
        selectedModelAvailable: true,
        generationTested: true,
        generationOk: false,
      }),
    ).toBe('OLLAMA_GENERATION_FAILED');
  });

  it('reports OLLAMA_CONNECTED only when every condition held', () => {
    const state = deriveLocalAiState({
      agentReachable: true,
      modelCount: 1,
      selectedModelId: 'qwen2.5-coder:7b-instruct',
      selectedModelAvailable: true,
      generationTested: true,
      generationOk: true,
    });
    expect(state).toBe('OLLAMA_CONNECTED');
    expect(isLocalAiConnected(state)).toBe(true);
  });

  it('never reports CONNECTED from partial evidence', () => {
    // Generation tested but no model count measured.
    expect(
      deriveLocalAiState({ agentReachable: true, generationTested: true, generationOk: true }),
    ).toBe('LOCAL_AGENT_RUNNING');
    expect(isLocalAiConnected('OLLAMA_MODELS_FOUND')).toBe(false);
  });

  it('has metadata for every state', () => {
    for (const state of Object.keys(LOCAL_AI_STATE_META)) {
      expect(LOCAL_AI_STATE_META[state as LocalAiState].label.length).toBeGreaterThan(0);
    }
  });
});

describe('localAiStateLabel', () => {
  it('matches the Ollama meta labels exactly (no behaviour change for Ollama)', () => {
    expect(localAiStateLabel('OLLAMA_NOT_RUNNING', 'Ollama')).toBe('Ollama not running');
    expect(localAiStateLabel('OLLAMA_UNREACHABLE', 'Ollama')).toBe('Ollama unreachable');
    expect(localAiStateLabel('OLLAMA_CONNECTED', 'Ollama')).toBe('Connected');
    expect(localAiStateLabel('LOCAL_AGENT_NOT_RUNNING', 'Ollama')).toBe(
      'Local Agent not connected',
    );
  });

  it('names the ACTUAL runtime instead of Ollama', () => {
    expect(localAiStateLabel('OLLAMA_NOT_RUNNING', 'LM Studio')).toBe('LM Studio not running');
    expect(localAiStateLabel('OLLAMA_UNREACHABLE', 'llama.cpp')).toBe('llama.cpp unreachable');
  });
});
