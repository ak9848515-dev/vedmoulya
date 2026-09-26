import { describe, it, expect } from 'vitest';
import { LocalAgent, UnknownLocalRuntimeError } from '../agent/agent.js';
import { LocalRuntimeRegistry } from '../registry.js';
import type {
  LocalGenerateChunk,
  LocalGenerateRequest,
  LocalModelDescriptor,
  LocalRuntime,
  LocalRuntimeErrorKind,
  LocalRuntimeId,
} from '../types.js';

interface StubOptions {
  id?: LocalRuntimeId;
  present?: boolean;
  discoverError?: LocalRuntimeErrorKind;
  version?: string;
  models?: Array<{ id: string; name: string }>;
  listError?: LocalRuntimeErrorKind;
  modelsOk?: boolean;
  generateOk?: boolean;
  generateContent?: string;
}

function makeRuntime(options: StubOptions = {}): LocalRuntime {
  const id: LocalRuntimeId = options.id ?? 'ollama';
  const declared: LocalModelDescriptor[] = (
    options.models ?? [{ id: 'qwen2.5-coder:7b-instruct', name: 'qwen2.5-coder:7b-instruct' }]
  ).map((model) => ({
    id: model.id,
    name: model.name,
    runtime: id,
    capabilities: ['completion'],
    capabilitiesProvenance: 'MEASURED' as const,
  }));
  const present = options.present ?? true;
  const modelsOk = options.modelsOk ?? true;
  return {
    id,
    displayName: id,
    capabilities: () => ({
      modelDiscovery: true,
      generation: true,
      streaming: true,
      getModel: true,
    }),
    discover: () =>
      Promise.resolve({
        runtime: id,
        endpoint: 'http://127.0.0.1:11434',
        present,
        ...(options.version !== undefined
          ? { version: options.version }
          : present
            ? { version: '0.34.4' }
            : {}),
        ...(options.discoverError !== undefined ? { error: options.discoverError } : {}),
        message: present ? 'ok' : 'not present',
      }),
    health: () =>
      Promise.resolve({
        runtime: id,
        endpoint: 'x',
        reachable: present,
        healthy: present,
        latencyMs: 1,
        message: 'ok',
      }),
    listModels: () =>
      Promise.resolve({
        runtime: id,
        endpoint: 'x',
        ok: modelsOk,
        models: modelsOk ? declared : [],
        ...(options.listError !== undefined ? { error: options.listError } : {}),
        message: 'listing',
      }),
    getModel: (modelId: string) =>
      Promise.resolve(declared.find((model) => model.id === modelId) ?? null),
    generate: (request: LocalGenerateRequest) =>
      Promise.resolve({
        runtime: id,
        ok: options.generateOk ?? true,
        modelId: request.modelId ?? declared[0]?.id ?? '',
        content: options.generateContent ?? 'ok',
        latencyMs: 5,
        message: options.generateOk === false ? 'no reply' : 'answered',
      }),
    // eslint-disable-next-line @typescript-eslint/require-await
    stream: async function* (request: LocalGenerateRequest): AsyncGenerator<LocalGenerateChunk> {
      yield { content: request.messages[0]?.content ?? '', done: true };
    },
  };
}

function agentWith(runtime: LocalRuntime): LocalAgent {
  return new LocalAgent({ registry: new LocalRuntimeRegistry().register(runtime) });
}

describe('LocalAgent — health and registration', () => {
  it('reports RUNNING with the registered runtime ids', () => {
    const agent = agentWith(makeRuntime());
    const health = agent.health();
    expect(health.status).toBe('RUNNING');
    expect(health.runtimes).toEqual(['ollama']);
    expect(typeof health.startedAt).toBe('string');
  });

  it('exposes a registry so adapters can be added', () => {
    const agent = new LocalAgent();
    expect(agent.listRuntimes()).toEqual([]);
    agent.runtimes.register(makeRuntime({ id: 'lm-studio' }));
    expect(agent.listRuntimes().map((report) => report.id)).toEqual(['lm-studio']);
  });

  it('throws a typed error for an unknown runtime', async () => {
    const agent = agentWith(makeRuntime());
    await expect(agent.status('vllm')).rejects.toBeInstanceOf(UnknownLocalRuntimeError);
  });
});

describe('LocalAgent — runtime discovery and status', () => {
  it('reports OLLAMA_NOT_RUNNING when nothing answers (never "not installed")', async () => {
    const agent = agentWith(makeRuntime({ present: false, discoverError: 'NOT_RUNNING' }));
    const status = await agent.status('ollama');
    expect(status.state).toBe('OLLAMA_NOT_RUNNING');
    expect(status.modelCount).toBe(0);
  });

  it('reports OLLAMA_MODELS_FOUND with the discovered models and a default selection', async () => {
    const agent = agentWith(makeRuntime());
    const status = await agent.status('ollama');
    expect(status.state).toBe('OLLAMA_MODELS_FOUND');
    expect(status.modelCount).toBe(1);
    expect(status.selectedModelId).toBe('qwen2.5-coder:7b-instruct');
    expect(status.version).toBe('0.34.4');
  });

  it('reports OLLAMA_NO_MODELS for an empty catalog', async () => {
    const agent = agentWith(makeRuntime({ models: [], listError: 'NO_MODELS' }));
    const status = await agent.status('ollama');
    expect(status.state).toBe('OLLAMA_NO_MODELS');
  });

  it('reports OLLAMA_MODEL_UNAVAILABLE when the requested model is not installed', async () => {
    const agent = agentWith(makeRuntime());
    const status = await agent.status('ollama', { modelId: 'ghost:latest' });
    expect(status.state).toBe('OLLAMA_MODEL_UNAVAILABLE');
  });
});

describe('LocalAgent — strict CONNECTED gating', () => {
  it('returns CONNECTED only when a real generation succeeds', async () => {
    const agent = agentWith(makeRuntime());
    const report = await agent.verify('ollama');
    expect(report.state).toBe('OLLAMA_CONNECTED');
    expect(report.connected).toBe(true);
    expect(report.checks.every((check) => check.ok)).toBe(true);
    expect(report.generation?.ok).toBe(true);
    expect(report.generation?.modelId).toBe('qwen2.5-coder:7b-instruct');
  });

  it('is not CONNECTED when generation fails, and says which check failed', async () => {
    const agent = agentWith(makeRuntime({ generateOk: false }));
    const report = await agent.verify('ollama');
    expect(report.connected).toBe(false);
    expect(report.state).toBe('OLLAMA_GENERATION_FAILED');
    expect(report.checks.find((check) => check.key === 'generation')?.ok).toBe(false);
  });

  it('is not CONNECTED when no model is available', async () => {
    const agent = agentWith(makeRuntime({ models: [], listError: 'NO_MODELS' }));
    const report = await agent.verify('ollama');
    expect(report.connected).toBe(false);
    expect(report.state).toBe('OLLAMA_NO_MODELS');
    expect(report.checks.find((check) => check.key === 'models_available')?.ok).toBe(false);
  });

  it('is not CONNECTED when the runtime is not running', async () => {
    const agent = agentWith(makeRuntime({ present: false, discoverError: 'NOT_RUNNING' }));
    const report = await agent.verify('ollama');
    expect(report.connected).toBe(false);
    expect(report.state).toBe('OLLAMA_NOT_RUNNING');
    expect(report.checks.find((check) => check.key === 'runtime')?.ok).toBe(false);
  });
});
