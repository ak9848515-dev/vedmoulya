// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local AI — public surface
//
//   VedMoulya → Local Agent → Local Runtime interface → runtime adapter → Ollama
//
// The Local Agent and the HTTP server are the only pieces a host process runs.
// The web app NEVER imports this module (it talks to the running agent over
// HTTP), so nothing here is bundled into the browser.
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────
export type {
  CapabilityProvenance,
  LocalChatMessage,
  LocalGenerateChunk,
  LocalGenerateRequest,
  LocalGenerateResult,
  LocalModelDescriptor,
  LocalModelListResult,
  LocalRuntime,
  LocalRuntimeCapabilities,
  LocalRuntimeErrorKind,
  LocalRuntimeId,
  RuntimeDiscoveryResult,
  RuntimeHealth,
} from './types.js';
export { OLLAMA_RUNTIME_ID } from './types.js';

// ── State model ───────────────────────────────────────────────────────────
export type { LocalAiEvidence, LocalAiState, LocalAiStateMeta } from './states.js';
export {
  deriveLocalAiState,
  isLocalAiConnected,
  LOCAL_AI_STATE_META,
  stateForRuntimeError,
} from './states.js';

// ── Registry ──────────────────────────────────────────────────────────────
export { LocalRuntimeRegistry } from './registry.js';

// ── Runtime adapters ──────────────────────────────────────────────────────
export type { OllamaRuntimeAdapterOptions } from './adapters/ollama-runtime.js';
export {
  classifyNetworkError,
  DEFAULT_OLLAMA_ENDPOINT,
  OllamaRuntimeAdapter,
  parseOllamaChatContent,
  parseOllamaModels,
  parseOllamaStreamLine,
  parseOllamaVersion,
} from './adapters/ollama-runtime.js';

// ── Local Agent ───────────────────────────────────────────────────────────
export type {
  LocalAgentHealth,
  LocalAgentOptions,
  RuntimeCheck,
  RuntimeStatusReport,
  RuntimeVerifyReport,
  LocalRuntimeReport,
} from './agent/agent.js';
export {
  LOCAL_AGENT_SMOKE_PROMPT,
  LOCAL_AGENT_VERSION,
  LocalAgent,
  UnknownLocalRuntimeError,
} from './agent/agent.js';
export type { DefaultLocalAgentOptions } from './agent/default-agent.js';
export { createDefaultLocalAgent, resolveOllamaEndpoint } from './agent/default-agent.js';

// ── HTTP server ───────────────────────────────────────────────────────────
export type { LocalAgentServerOptions, StartedLocalAgent } from './agent/server.js';
export {
  createLocalAgentServer,
  DEFAULT_ALLOWED_ORIGINS,
  DEFAULT_LOCAL_AGENT_HOST,
  DEFAULT_LOCAL_AGENT_PORT,
  startLocalAgentServer,
} from './agent/server.js';
