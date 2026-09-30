// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local AI — Local Runtime abstraction (types)
// PHASE 1 — Local AI Foundation
//
// WHAT THIS IS
//   A local RUNTIME is a program on the user's machine that can serve models
//   (Ollama, LM Studio, llama.cpp, vLLM, Jan, …). Ollama is the FIRST runtime
//   implemented — it is NOT synonymous with "Local AI". Everything above this
//   file (the Local Agent, the web app) depends only on `LocalRuntime`, so a new
//   runtime is an adapter, never a redesign of the orchestration layer.
//
// HONESTY RULES
//   • Every call that can fail returns a typed error kind. A network failure
//     NEVER becomes "not installed": NOT_RUNNING (nothing listens) and
//     UNREACHABLE (no answer in time) are distinct.
//   • Capabilities carry provenance. A runtime that DECLARES capabilities
//     (Ollama's `/api/tags` does) yields MEASURED; anything inferred from a
//     model name is INFERRED, never claimed as verified.
//   • `generate` uses the real upstream API. There is no fake endpoint.
// ─────────────────────────────────────────────────────────────────────────────

/** Known local runtimes. Only `ollama` has an adapter in Phase 1. */
export type LocalRuntimeId =
  'ollama' | 'lm-studio' | 'llama.cpp' | 'vllm' | 'jan' | 'openai-compatible';

/** The runtime implemented by this phase. Kept explicit so ids are never guessed. */
export const OLLAMA_RUNTIME_ID: LocalRuntimeId = 'ollama';

/** How a capability list was obtained. */
export type CapabilityProvenance = 'MEASURED' | 'INFERRED';

export interface LocalRuntimeCapabilities {
  /** The runtime can list its installed models. */
  modelDiscovery: boolean;
  /** The runtime can run a real generation. */
  generation: boolean;
  /** The runtime can stream a generation token by token. */
  streaming: boolean;
  /** The runtime can describe a single model. */
  getModel: boolean;
}

/** One model the runtime really reported (never invented). */
export interface LocalModelDescriptor {
  /** Stable runtime id (e.g. an Ollama tag). */
  id: string;
  name: string;
  runtime: LocalRuntimeId;
  sizeBytes?: number;
  roundedSizeGb?: number;
  quantization?: string;
  family?: string;
  parameterSize?: string;
  contextLength?: number;
  capabilities: string[];
  capabilitiesProvenance: CapabilityProvenance;
}

/**
 * The typed failure vocabulary of a local runtime probe.
 *
 *   NOT_RUNNING         — nothing is listening (connection refused). The
 *                         runtime is very likely not started.
 *   UNREACHABLE         — the probe produced no answer (timeout / DNS / abort).
 *                         Absence is NOT proven, so this is a separate state.
 *   INVALID_RESPONSE    — something answered, but not with a valid runtime
 *                         payload (wrong service on the port / unparseable body).
 *   NO_MODELS           — reachable, but zero models are installed.
 *   MODEL_UNAVAILABLE   — reachable, but the requested model is not served.
 *   GENERATION_FAILED   — reachable, model present, but the generation failed.
 */
export type LocalRuntimeErrorKind =
  | 'NOT_RUNNING'
  | 'UNREACHABLE'
  | 'INVALID_RESPONSE'
  | 'NO_MODELS'
  | 'MODEL_UNAVAILABLE'
  | 'GENERATION_FAILED';

export interface RuntimeDiscoveryResult {
  runtime: LocalRuntimeId;
  endpoint: string;
  /** True only when the runtime answered AS ITSELF (valid identity payload). */
  present: boolean;
  version?: string;
  error?: LocalRuntimeErrorKind;
  message: string;
}

export interface RuntimeHealth {
  runtime: LocalRuntimeId;
  endpoint: string;
  /** True when the runtime answered a request at all. */
  reachable: boolean;
  /** True when the answer was a valid, healthy runtime response. */
  healthy: boolean;
  version?: string;
  latencyMs: number;
  error?: LocalRuntimeErrorKind;
  message: string;
}

export interface LocalModelListResult {
  runtime: LocalRuntimeId;
  endpoint: string;
  /** True when the catalog was READ (an empty, honest catalog still reads OK). */
  ok: boolean;
  models: LocalModelDescriptor[];
  error?: LocalRuntimeErrorKind;
  message: string;
}

export interface LocalChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LocalGenerateRequest {
  /** When omitted the adapter chooses the first installed model it really has. */
  modelId?: string;
  messages: LocalChatMessage[];
  maxTokens?: number;
  timeoutMs?: number;
}

export interface LocalGenerateResult {
  runtime: LocalRuntimeId;
  ok: boolean;
  /** The model that ACTUALLY ran (never a stale preference). */
  modelId: string;
  content: string;
  latencyMs: number;
  error?: LocalRuntimeErrorKind;
  message: string;
  /**
   * REAL usage the local runtime reported (Ollama `prompt_eval_count` /
   * `eval_count`, OpenAI-compatible `prompt_tokens` / `completion_tokens`).
   * Absent when the runtime reported none — usage is never fabricated.
   */
  usage?: LocalTokenUsage;
}

/** Local inference token usage. Local cost is genuinely zero — there is no price. */
export interface LocalTokenUsage {
  input: number;
  output: number;
  total: number;
}

/**
 * One streamed chunk. A stream that could not START (runtime down, model not
 * installed, transport refused) is reported as a TERMINAL chunk carrying `error`
 * instead of silently ending with zero content — otherwise a broken runtime and a
 * slow model are indistinguishable to the caller.
 */
export interface LocalGenerateChunk {
  content: string;
  done: boolean;
  /** Present on a terminal failure chunk: why the stream could not run. */
  error?: LocalRuntimeErrorKind;
  /** Human-readable explanation accompanying `error`. */
  message?: string;
  /** The model the stream was asked for (echoed on failure for diagnosis). */
  modelId?: string;
  /** REAL usage the runtime reported on the terminal chunk (never fabricated). */
  usage?: LocalTokenUsage;
}

/**
 * The Local Runtime interface. A local runtime is a bridge target, not a cloud
 * provider: there is no credential, no per-token cost and no vendor assumption.
 * Every method is total — failures are typed results, never thrown surprises.
 */
export interface LocalRuntime {
  readonly id: LocalRuntimeId;
  readonly displayName: string;
  capabilities(): LocalRuntimeCapabilities;
  discover(): Promise<RuntimeDiscoveryResult>;
  health(): Promise<RuntimeHealth>;
  listModels(): Promise<LocalModelListResult>;
  getModel(modelId: string): Promise<LocalModelDescriptor | null>;
  generate(request: LocalGenerateRequest): Promise<LocalGenerateResult>;
  stream(request: LocalGenerateRequest): AsyncIterable<LocalGenerateChunk>;
}
