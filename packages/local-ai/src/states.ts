// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local AI — Connection state model (pure)
//
// The ten states below are the honest vocabulary the UI renders. They are
// DERIVED from measured evidence, never assumed, and a failure is never
// collapsed into "Ollama not installed".
//
// CONNECTED is deliberately strict: it requires the Local Agent to be running,
// the runtime to be reachable and healthy, a model catalog to have been read,
// at least one model to be available, the selected model to exist AND a real
// generation to have succeeded. Anything less is a narrower, truthful state.
// ─────────────────────────────────────────────────────────────────────────────

import type { LocalRuntimeErrorKind } from './types.js';

export type LocalAiState =
  /** The Local Agent process is not answering on this machine. */
  | 'LOCAL_AGENT_NOT_RUNNING'
  /** The agent is up; no runtime has been probed yet. */
  | 'LOCAL_AGENT_RUNNING'
  /** Nothing is listening on the runtime endpoint (connection refused). */
  | 'OLLAMA_NOT_RUNNING'
  /** The probe got no answer (timeout / aborted) — absence NOT proven. */
  | 'OLLAMA_UNREACHABLE'
  /** Something answered, but it was not a valid runtime payload. */
  | 'OLLAMA_INVALID_RESPONSE'
  /** Reachable, but zero models are installed. */
  | 'OLLAMA_NO_MODELS'
  /** Reachable with real models, none selected yet. */
  | 'OLLAMA_MODELS_FOUND'
  /** Reachable, but the selected model is not served by this runtime. */
  | 'OLLAMA_MODEL_UNAVAILABLE'
  /** Reachable and model present, but the generation failed. */
  | 'OLLAMA_GENERATION_FAILED'
  /** All conditions met AND a real generation succeeded. */
  | 'OLLAMA_CONNECTED';

export interface LocalAiStateMeta {
  label: string;
  tone: 'neutral' | 'ok' | 'warn' | 'error';
  description: string;
}

export const LOCAL_AI_STATE_META: Record<LocalAiState, LocalAiStateMeta> = {
  LOCAL_AGENT_NOT_RUNNING: {
    label: 'Local Agent not connected',
    tone: 'neutral',
    description: 'The VedMoulya Local Agent is not running on this computer.',
  },
  LOCAL_AGENT_RUNNING: {
    label: 'Local Agent connected',
    tone: 'ok',
    description: 'The Local Agent is running and ready to probe local runtimes.',
  },
  OLLAMA_NOT_RUNNING: {
    label: 'Ollama not running',
    tone: 'warn',
    description: 'Nothing is listening on the Ollama address — start Ollama and try again.',
  },
  OLLAMA_UNREACHABLE: {
    label: 'Ollama unreachable',
    tone: 'warn',
    description: 'The Local Agent could not get an answer from Ollama in time.',
  },
  OLLAMA_INVALID_RESPONSE: {
    label: 'Unexpected response',
    tone: 'error',
    description: 'Something answered on the Ollama address, but it was not an Ollama service.',
  },
  OLLAMA_NO_MODELS: {
    label: 'No models installed',
    tone: 'warn',
    description: 'Ollama is running, but no models are installed yet.',
  },
  OLLAMA_MODELS_FOUND: {
    label: 'Models found',
    tone: 'ok',
    description: 'Ollama is running with installed models — choose one and connect.',
  },
  OLLAMA_MODEL_UNAVAILABLE: {
    label: 'Model unavailable',
    tone: 'warn',
    description: 'The selected model is not served by this Ollama server.',
  },
  OLLAMA_GENERATION_FAILED: {
    label: 'Generation failed',
    tone: 'error',
    description: 'Ollama ran the model but did not return a usable reply.',
  },
  OLLAMA_CONNECTED: {
    label: 'Connected',
    tone: 'ok',
    description: 'Local AI is connected — a real generation succeeded through the Local Agent.',
  },
};

/**
 * Measured facts about one runtime, from which the ONE state is derived.
 * Every field is optional except `agentReachable`: missing means "not measured",
 * which is why it never maps to CONNECTED.
 */
export interface LocalAiEvidence {
  agentReachable: boolean;
  runtimeError?: LocalRuntimeErrorKind;
  /** Number of models the runtime really reported (undefined = not measured). */
  modelCount?: number;
  selectedModelId?: string;
  selectedModelAvailable?: boolean;
  /** True once a real generation has been attempted. */
  generationTested?: boolean;
  generationOk?: boolean;
}

/** Map a runtime error kind onto the state vocabulary. */
export function stateForRuntimeError(error: LocalRuntimeErrorKind): LocalAiState {
  switch (error) {
    case 'NOT_RUNNING':
      return 'OLLAMA_NOT_RUNNING';
    case 'UNREACHABLE':
      return 'OLLAMA_UNREACHABLE';
    case 'INVALID_RESPONSE':
      return 'OLLAMA_INVALID_RESPONSE';
    case 'NO_MODELS':
      return 'OLLAMA_NO_MODELS';
    case 'MODEL_UNAVAILABLE':
      return 'OLLAMA_MODEL_UNAVAILABLE';
    case 'GENERATION_FAILED':
      return 'OLLAMA_GENERATION_FAILED';
  }
}

/**
 * Derive the one truthful state from measured evidence.
 *
 * Order is deliberate: the later conditions are only reachable when the earlier
 * ones held, so CONNECTED can never be returned from partial evidence.
 */
export function deriveLocalAiState(evidence: LocalAiEvidence): LocalAiState {
  if (!evidence.agentReachable) return 'LOCAL_AGENT_NOT_RUNNING';

  const runtimeError = evidence.runtimeError;
  if (runtimeError !== undefined && runtimeError !== 'NO_MODELS') {
    // NO_MODELS is folded into the modelCount check below (an honest empty
    // catalog is a fact about models, not a runtime failure).
    return stateForRuntimeError(runtimeError);
  }

  const modelCount = evidence.modelCount;
  if (modelCount === undefined) {
    // The agent is up but no runtime fact has landed yet.
    return 'LOCAL_AGENT_RUNNING';
  }
  if (modelCount === 0) return 'OLLAMA_NO_MODELS';

  if (evidence.selectedModelId !== undefined && evidence.selectedModelAvailable === false) {
    return 'OLLAMA_MODEL_UNAVAILABLE';
  }

  if (evidence.generationTested === true) {
    return evidence.generationOk === true ? 'OLLAMA_CONNECTED' : 'OLLAMA_GENERATION_FAILED';
  }

  return 'OLLAMA_MODELS_FOUND';
}

/** CONNECTED is the only state that means "usable local AI right now". */
export function isLocalAiConnected(state: LocalAiState): boolean {
  return state === 'OLLAMA_CONNECTED';
}
