import { describe, it, expect } from 'vitest';
import { LocalRuntimeRegistry } from '../registry.js';
import type { LocalRuntime, LocalRuntimeId } from '../types.js';

function stubRuntime(id: LocalRuntimeId, displayName = id): LocalRuntime {
  return {
    id,
    displayName,
    capabilities: () => ({
      modelDiscovery: true,
      generation: true,
      streaming: true,
      getModel: true,
    }),
    discover: () => Promise.resolve({ runtime: id, endpoint: 'x', present: false, message: 'n/a' }),
    health: () =>
      Promise.resolve({
        runtime: id,
        endpoint: 'x',
        reachable: false,
        healthy: false,
        latencyMs: 0,
        message: 'n/a',
      }),
    listModels: () =>
      Promise.resolve({ runtime: id, endpoint: 'x', ok: true, models: [], message: 'n/a' }),
    getModel: () => Promise.resolve(null),
    generate: () =>
      Promise.resolve({
        runtime: id,
        ok: false,
        modelId: '',
        content: '',
        latencyMs: 0,
        message: 'n/a',
      }),
    // eslint-disable-next-line @typescript-eslint/require-await
    stream: async function* () {
      yield { content: '', done: true };
    },
  };
}

describe('LocalRuntimeRegistry', () => {
  it('registers, resolves and lists runtimes', () => {
    const registry = new LocalRuntimeRegistry();
    registry.register(stubRuntime('ollama', 'Ollama'));
    registry.register(stubRuntime('lm-studio', 'LM Studio'));

    expect(registry.ids()).toEqual(['ollama', 'lm-studio']);
    expect(registry.get('ollama')?.displayName).toBe('Ollama');
    expect(registry.get('lm-studio')?.id).toBe('lm-studio');
    expect(registry.list()).toHaveLength(2);
    expect(registry.size).toBe(2);
    expect(registry.has('vllm')).toBe(false);
  });

  it('returns undefined for an unknown runtime and never throws', () => {
    const registry = new LocalRuntimeRegistry();
    expect(registry.get('vllm')).toBeUndefined();
  });

  it('replaces an adapter when the same id is registered twice', () => {
    const registry = new LocalRuntimeRegistry();
    registry.register(stubRuntime('ollama', 'First'));
    registry.register(stubRuntime('ollama', 'Second'));
    expect(registry.size).toBe(1);
    expect(registry.get('ollama')?.displayName).toBe('Second');
  });
});
