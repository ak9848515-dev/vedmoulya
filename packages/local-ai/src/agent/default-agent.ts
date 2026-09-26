// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local AI — default Local Agent composition
//
// The ONE place the default runtime wiring lives. Two runtimes are registered
// out of the box — Ollama and the OpenAI-compatible adapter (LM Studio) — which
// is the point of the Local Runtime interface: adding a runtime is a
// `registry.register(...)` call, never a change to the agent, the HTTP server or
// the web contract.
//
// A registered runtime that is NOT running is not an error: its `discover()`
// reports NOT_RUNNING, and the UI says so. Registration only makes it available.
// ─────────────────────────────────────────────────────────────────────────────

import { LocalAgent } from './agent.js';
import { LocalRuntimeRegistry } from '../registry.js';
import { DEFAULT_OLLAMA_ENDPOINT, OllamaRuntimeAdapter } from '../adapters/ollama-runtime.js';
import {
  DEFAULT_LM_STUDIO_ENDPOINT,
  OpenAICompatibleRuntimeAdapter,
} from '../adapters/openai-compatible-runtime.js';

/** The Ollama endpoint, honoring an explicit override before the environment. */
export function resolveOllamaEndpoint(
  endpoint?: string,
  env: Record<string, string | undefined> = process.env,
): string {
  if (endpoint !== undefined && endpoint.trim() !== '') return endpoint;
  return env['VEDMOULYA_OLLAMA_URL'] ?? env['OLLAMA_BASE_URL'] ?? DEFAULT_OLLAMA_ENDPOINT;
}

/** The LM Studio (OpenAI-compatible) endpoint, override before environment. */
export function resolveLmStudioEndpoint(
  endpoint?: string,
  env: Record<string, string | undefined> = process.env,
): string {
  if (endpoint !== undefined && endpoint.trim() !== '') return endpoint;
  return env['VEDMOULYA_LM_STUDIO_URL'] ?? env['LM_STUDIO_BASE_URL'] ?? DEFAULT_LM_STUDIO_ENDPOINT;
}

export interface DefaultLocalAgentOptions {
  /** Ollama endpoint override. */
  endpoint?: string;
  /** LM Studio (OpenAI-compatible) endpoint override. */
  lmStudioEndpoint?: string;
  /** Injected fetch for tests. */
  fetchFn?: typeof fetch;
}

export function createDefaultLocalAgent(options: DefaultLocalAgentOptions = {}): LocalAgent {
  const registry = new LocalRuntimeRegistry();
  registry.register(
    new OllamaRuntimeAdapter({
      endpoint: resolveOllamaEndpoint(options.endpoint),
      ...(options.fetchFn !== undefined ? { fetchFn: options.fetchFn } : {}),
    }),
  );
  registry.register(
    new OpenAICompatibleRuntimeAdapter({
      id: 'lm-studio',
      displayName: 'LM Studio',
      endpoint: resolveLmStudioEndpoint(options.lmStudioEndpoint),
      ...(options.fetchFn !== undefined ? { fetchFn: options.fetchFn } : {}),
    }),
  );
  return new LocalAgent({ registry });
}
