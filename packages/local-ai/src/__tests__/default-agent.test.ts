import { describe, it, expect } from 'vitest';
import {
  createDefaultLocalAgent,
  resolveLmStudioEndpoint,
  resolveOllamaEndpoint,
} from '../agent/default-agent.js';
import { DEFAULT_LM_STUDIO_ENDPOINT } from '../adapters/openai-compatible-runtime.js';
import { DEFAULT_OLLAMA_ENDPOINT } from '../adapters/ollama-runtime.js';

describe('resolveOllamaEndpoint / resolveLmStudioEndpoint', () => {
  it('prefers an explicit override, then the environment, then the default', () => {
    expect(resolveOllamaEndpoint('http://127.0.0.1:9999', {})).toBe('http://127.0.0.1:9999');
    expect(resolveOllamaEndpoint(undefined, { VEDMOULYA_OLLAMA_URL: 'http://x:1' })).toBe(
      'http://x:1',
    );
    expect(resolveOllamaEndpoint(undefined, { OLLAMA_BASE_URL: 'http://x:2' })).toBe('http://x:2');
    expect(resolveOllamaEndpoint(undefined, {})).toBe(DEFAULT_OLLAMA_ENDPOINT);

    expect(resolveLmStudioEndpoint('http://127.0.0.1:8888', {})).toBe('http://127.0.0.1:8888');
    expect(resolveLmStudioEndpoint(undefined, { VEDMOULYA_LM_STUDIO_URL: 'http://y:1' })).toBe(
      'http://y:1',
    );
    expect(resolveLmStudioEndpoint(undefined, { LM_STUDIO_BASE_URL: 'http://y:2' })).toBe(
      'http://y:2',
    );
    expect(resolveLmStudioEndpoint(undefined, {})).toBe(DEFAULT_LM_STUDIO_ENDPOINT);
  });
});

describe('createDefaultLocalAgent', () => {
  it('registers Ollama AND the OpenAI-compatible runtime behind the interface', () => {
    const agent = createDefaultLocalAgent();
    expect(agent.health().runtimes).toEqual(['ollama', 'lm-studio']);
    expect(agent.listRuntimes().map((runtime) => runtime.displayName)).toEqual([
      'Ollama',
      'LM Studio',
    ]);
  });

  it('reports a not-running runtime honestly instead of failing to start', async () => {
    const refusing = (() =>
      Promise.reject(
        Object.assign(new Error('refused'), { cause: { code: 'ECONNREFUSED' } }),
      )) as unknown as typeof fetch;
    const agent = createDefaultLocalAgent({ fetchFn: refusing });
    const status = await agent.status('lm-studio');
    expect(status.state).toBe('OLLAMA_NOT_RUNNING');
    expect(status.label).toBe('LM Studio not running');
  });
});
