// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local AI — default Local Agent composition
//
// The ONE place the default runtime wiring lives. A host that wants an
// additional runtime (LM Studio, llama.cpp, vLLM, Jan) registers its adapter on
// `agent.runtimes` — no change to the agent, the server or the web contract.
// ─────────────────────────────────────────────────────────────────────────────

import { LocalAgent } from './agent.js';
import { LocalRuntimeRegistry } from '../registry.js';
import { DEFAULT_OLLAMA_ENDPOINT, OllamaRuntimeAdapter } from '../adapters/ollama-runtime.js';

/** The Ollama endpoint, honoring an explicit override before the environment. */
export function resolveOllamaEndpoint(
  endpoint?: string,
  env: Record<string, string | undefined> = process.env,
): string {
  if (endpoint !== undefined && endpoint.trim() !== '') return endpoint;
  return env['VEDMOULYA_OLLAMA_URL'] ?? env['OLLAMA_BASE_URL'] ?? DEFAULT_OLLAMA_ENDPOINT;
}

export interface DefaultLocalAgentOptions {
  endpoint?: string;
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
  return new LocalAgent({ registry });
}
