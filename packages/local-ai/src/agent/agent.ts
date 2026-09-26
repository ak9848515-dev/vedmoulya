// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local AI — Local Agent
//
// THE BOUNDARY
//   VedMoulya  →  Local Agent  →  Local Runtime interface  →  runtime adapter
//                                                          →  (Ollama)
//
// The agent is the trusted local bridge. It runs on the USER'S machine next to
// the runtime, which is the only side that can reach `127.0.0.1:11434`. It is,
// for this phase, ONLY an AI-runtime bridge:
//   • NO filesystem API (not even read-only)
//   • NO arbitrary command execution
//   • NO hidden remote-control mechanism
// It imports no `node:fs`, no `node:child_process` and no network client beyond
// the runtime adapter's `fetch`. That is the security boundary in code.
//
// CONNECTED IS STRICT (see `verify`): agent up + runtime reachable + version
// healthy + models read + ≥1 model available + selected model installed + a
// REAL generation succeeded. Anything less returns a narrower, truthful state.
// ─────────────────────────────────────────────────────────────────────────────

import { LocalRuntimeRegistry } from '../registry.js';
import {
  deriveLocalAiState,
  LOCAL_AI_STATE_META,
  localAiStateLabel,
  type LocalAiState,
} from '../states.js';
import type {
  LocalGenerateChunk,
  LocalGenerateRequest,
  LocalGenerateResult,
  LocalModelDescriptor,
  LocalRuntime,
  LocalRuntimeCapabilities,
  LocalRuntimeId,
} from '../types.js';

/** Bumped by hand when the Local Agent wire contract changes. */
export const LOCAL_AGENT_VERSION = '1.0.0';

/**
 * The deterministic smoke prompt used by `verify`. Deliberately tiny and
 * repeatable so a real completion can be checked without depending on a model's
 * verbosity.
 */
export const LOCAL_AGENT_SMOKE_PROMPT = 'Reply with the single word: ok';

/** Thrown when a caller names a runtime the registry does not hold. */
export class UnknownLocalRuntimeError extends Error {
  readonly runtimeId: string;
  constructor(runtimeId: string) {
    super(`Unknown local runtime: ${runtimeId}`);
    this.name = 'UnknownLocalRuntimeError';
    this.runtimeId = runtimeId;
  }
}

export interface LocalAgentHealth {
  status: 'RUNNING';
  version: string;
  startedAt: string;
  runtimes: LocalRuntimeId[];
}

export interface LocalRuntimeReport {
  id: LocalRuntimeId;
  displayName: string;
  capabilities: LocalRuntimeCapabilities;
}

export interface RuntimeStatusReport {
  runtime: LocalRuntimeId;
  displayName: string;
  endpoint: string;
  state: LocalAiState;
  label: string;
  tone: 'neutral' | 'ok' | 'warn' | 'error';
  message: string;
  version?: string;
  modelCount: number;
  models: LocalModelDescriptor[];
  selectedModelId?: string;
  capabilities: LocalRuntimeCapabilities;
}

export interface RuntimeCheck {
  key: string;
  label: string;
  ok: boolean;
}

export interface RuntimeVerifyReport extends RuntimeStatusReport {
  connected: boolean;
  checks: RuntimeCheck[];
  generation?: {
    ok: boolean;
    modelId: string;
    latencyMs: number;
    message: string;
  };
}

export interface LocalAgentOptions {
  registry?: LocalRuntimeRegistry;
  version?: string;
  /** Clock injection for deterministic tests. */
  now?: () => Date;
}

export class LocalAgent {
  private readonly registry: LocalRuntimeRegistry;
  private readonly version: string;
  private readonly startedAt: string;

  constructor(options: LocalAgentOptions = {}) {
    this.registry = options.registry ?? new LocalRuntimeRegistry();
    this.version = options.version ?? LOCAL_AGENT_VERSION;
    this.startedAt = (options.now ?? ((): Date => new Date()))().toISOString();
  }

  /** The registry, so a host can register additional runtime adapters. */
  get runtimes(): LocalRuntimeRegistry {
    return this.registry;
  }

  private requireRuntime(runtimeId: string): LocalRuntime {
    const runtime = this.registry.get(runtimeId as LocalRuntimeId);
    if (runtime === undefined) throw new UnknownLocalRuntimeError(runtimeId);
    return runtime;
  }

  health(): LocalAgentHealth {
    return {
      status: 'RUNNING',
      version: this.version,
      startedAt: this.startedAt,
      runtimes: this.registry.ids(),
    };
  }

  listRuntimes(): LocalRuntimeReport[] {
    return this.registry.list().map((runtime) => ({
      id: runtime.id,
      displayName: runtime.displayName,
      capabilities: runtime.capabilities(),
    }));
  }

  /**
   * The single resolved status for one runtime. Reads discovery, health and the
   * model catalog and DERIVES the honest state — it never performs a generation
   * (that is `verify`, which is deliberately explicit because it costs compute).
   */
  async status(
    runtimeId: string,
    options: { modelId?: string } = {},
  ): Promise<RuntimeStatusReport> {
    const runtime = this.requireRuntime(runtimeId);
    const capabilities = runtime.capabilities();
    const discovery = await runtime.discover();

    if (!discovery.present) {
      const state = deriveLocalAiState({
        agentReachable: true,
        ...(discovery.error !== undefined ? { runtimeError: discovery.error } : {}),
      });
      return this.report(
        runtime.id,
        runtime.displayName,
        discovery.endpoint,
        state,
        discovery.message,
        {
          capabilities,
          models: [],
          ...(discovery.version !== undefined ? { version: discovery.version } : {}),
        },
      );
    }

    const listing = await runtime.listModels();
    const models = listing.models;
    const requested = options.modelId?.trim() ?? '';
    const selectedModelId =
      requested !== '' ? requested : models.length > 0 ? models[0]?.id : undefined;
    const selectedModelAvailable =
      selectedModelId !== undefined
        ? models.some((model) => model.id === selectedModelId || model.name === selectedModelId)
        : undefined;

    const state = deriveLocalAiState({
      agentReachable: true,
      ...(listing.error !== undefined ? { runtimeError: listing.error } : {}),
      modelCount: models.length,
      ...(selectedModelId !== undefined
        ? { selectedModelId, selectedModelAvailable: selectedModelAvailable ?? false }
        : {}),
    });

    return this.report(
      runtime.id,
      runtime.displayName,
      discovery.endpoint,
      state,
      listing.message,
      {
        capabilities,
        models,
        modelCount: models.length,
        ...(discovery.version !== undefined ? { version: discovery.version } : {}),
        ...(selectedModelId !== undefined ? { selectedModelId } : {}),
      },
    );
  }

  async listModels(runtimeId: string): Promise<LocalModelDescriptor[]> {
    const runtime = this.requireRuntime(runtimeId);
    const listing = await runtime.listModels();
    return listing.models;
  }

  async getModel(runtimeId: string, modelId: string): Promise<LocalModelDescriptor | null> {
    const runtime = this.requireRuntime(runtimeId);
    return runtime.getModel(modelId);
  }

  async generate(runtimeId: string, request: LocalGenerateRequest): Promise<LocalGenerateResult> {
    const runtime = this.requireRuntime(runtimeId);
    return runtime.generate(request);
  }

  /** Stream a real generation, forwarding the runtime adapter's chunks. */
  async *stream(
    runtimeId: string,
    request: LocalGenerateRequest,
  ): AsyncGenerator<LocalGenerateChunk> {
    const runtime = this.requireRuntime(runtimeId);
    yield* runtime.stream(request);
  }

  /**
   * The strict connection check. Runs the whole pipeline and returns CONNECTED
   * only when every real condition passed, together with the per-condition
   * evidence so the UI can explain exactly what is missing.
   */
  async verify(
    runtimeId: string,
    options: { modelId?: string; generationTimeoutMs?: number } = {},
  ): Promise<RuntimeVerifyReport> {
    const runtime = this.requireRuntime(runtimeId);
    const capabilities = runtime.capabilities();

    const discovery = await runtime.discover();
    const checks: RuntimeCheck[] = [{ key: 'agent', label: 'Local Agent running', ok: true }];
    if (!discovery.present) {
      checks.push({ key: 'runtime', label: 'Runtime reachable', ok: false });
      const state = deriveLocalAiState({
        agentReachable: true,
        ...(discovery.error !== undefined ? { runtimeError: discovery.error } : {}),
      });
      return {
        ...this.report(
          runtime.id,
          runtime.displayName,
          discovery.endpoint,
          state,
          discovery.message,
          {
            capabilities,
            models: [],
          },
        ),
        connected: false,
        checks,
      };
    }
    checks.push({ key: 'runtime', label: 'Runtime reachable', ok: true });
    // Health is the RUNTIME's own check (Ollama answers /api/version, an
    // OpenAI-compatible server answers /v1/models) — never a version, which not
    // every runtime exposes.
    const health = await runtime.health();
    checks.push({ key: 'health', label: 'Runtime health check passed', ok: health.healthy });

    const listing = await runtime.listModels();
    const models = listing.models;
    checks.push({ key: 'models', label: 'Model discovery succeeded', ok: listing.ok });
    checks.push({
      key: 'models_available',
      label: 'At least one model available',
      ok: models.length > 0,
    });

    const requested = options.modelId?.trim() ?? '';
    const selectedModelId =
      requested !== '' ? requested : models.length > 0 ? models[0]?.id : undefined;
    const selectedModelAvailable =
      selectedModelId !== undefined
        ? models.some((model) => model.id === selectedModelId || model.name === selectedModelId)
        : false;
    checks.push({
      key: 'model_selected',
      label: 'Selected model exists',
      ok: selectedModelId !== undefined && selectedModelAvailable,
    });

    const base = this.report(
      runtime.id,
      runtime.displayName,
      discovery.endpoint,
      'OLLAMA_MODELS_FOUND',
      listing.message,
      {
        capabilities,
        models,
        ...(discovery.version !== undefined ? { version: discovery.version } : {}),
        ...(selectedModelId !== undefined ? { selectedModelId } : {}),
      },
    );

    if (selectedModelId === undefined || !selectedModelAvailable) {
      const state = deriveLocalAiState({
        agentReachable: true,
        ...(listing.error !== undefined ? { runtimeError: listing.error } : {}),
        modelCount: models.length,
        ...(selectedModelId !== undefined ? { selectedModelId, selectedModelAvailable } : {}),
      });
      checks.push({ key: 'generation', label: 'Real generation succeeded', ok: false });
      return { ...base, state, label: LOCAL_AI_STATE_META[state].label, connected: false, checks };
    }

    const generation = await runtime.generate({
      modelId: selectedModelId,
      messages: [{ role: 'user', content: LOCAL_AGENT_SMOKE_PROMPT }],
      ...(options.generationTimeoutMs !== undefined
        ? { timeoutMs: options.generationTimeoutMs }
        : {}),
    });
    checks.push({ key: 'generation', label: 'Real generation succeeded', ok: generation.ok });

    const state = deriveLocalAiState({
      agentReachable: true,
      modelCount: models.length,
      selectedModelId,
      selectedModelAvailable: true,
      generationTested: true,
      generationOk: generation.ok,
    });

    return {
      ...base,
      state,
      label: localAiStateLabel(state, runtime.displayName),
      message: generation.message,
      connected: state === 'OLLAMA_CONNECTED',
      checks,
      generation: {
        ok: generation.ok,
        modelId: generation.modelId,
        latencyMs: generation.latencyMs,
        message: generation.message,
      },
    };
  }

  /** Assemble a report with the metadata for a state, keeping defaults single-sourced. */
  private report(
    runtime: LocalRuntimeId,
    displayName: string,
    endpoint: string,
    state: LocalAiState,
    message: string,
    extra: {
      capabilities: LocalRuntimeCapabilities;
      models: LocalModelDescriptor[];
      modelCount?: number;
      version?: string;
      selectedModelId?: string;
    },
  ): RuntimeStatusReport {
    const meta = LOCAL_AI_STATE_META[state];
    return {
      runtime,
      displayName,
      endpoint,
      state,
      label: localAiStateLabel(state, displayName),
      tone: meta.tone,
      message: message.trim() === '' ? meta.description : message,
      modelCount: extra.modelCount ?? extra.models.length,
      models: extra.models,
      capabilities: extra.capabilities,
      ...(extra.version !== undefined ? { version: extra.version } : {}),
      ...(extra.selectedModelId !== undefined ? { selectedModelId: extra.selectedModelId } : {}),
    };
  }
}
