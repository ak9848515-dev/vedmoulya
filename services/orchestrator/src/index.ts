// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Orchestrator Service
// Main entry point for the AI Orchestrator
// BLD-005 — AI Orchestrator
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import { AIOrchestrationService } from '@vedmoulya/services';
import { MockProvider } from './providers/MockProvider.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { VercelAIProvider } from './providers/VercelAIProvider.js';
import { DeepSeekProvider } from './providers/DeepSeekProvider.js';
import { OpenAIEmbeddingProvider } from './providers/OpenAIEmbeddingProvider.js';

// ── Service Configuration ──────────────────────────────────────────────────

export interface OrchestratorConfig {
  providers: {
    openai?: { apiKey: string };
    anthropic?: { apiKey: string };
    google?: { apiKey: string };
    deepseek?: { apiKey: string };
    enableMock: boolean;
  };
}

// ── Orchestrator Bootstrap ─────────────────────────────────────────────────

export function createOrchestrator(config?: Partial<OrchestratorConfig>): AIOrchestrationService {
  const orchestrator = new AIOrchestrationService();
  registerPlatformProviders(orchestrator, config);
  return orchestrator;
}

// ── Exports ────────────────────────────────────────────────────────────────

export { AIOrchestrationService } from '@vedmoulya/services';
export type { ProviderAdapter } from '@vedmoulya/services';
export type {
  OrchestrateRequestDTO,
  OrchestrateResponseDTO,
  ProviderHealthDTO,
  CapabilityProfileDTO,
  CostEstimateDTO,
  ProviderListDTO,
  CapabilityListDTO,
} from '@vedmoulya/services';

export { MockProvider } from './providers/MockProvider.js';
export { OpenAIProvider } from './providers/OpenAIProvider.js';
export { VercelAIProvider } from './providers/VercelAIProvider.js';
export { DeepSeekProvider } from './providers/DeepSeekProvider.js';
export { OpenAIEmbeddingProvider } from './providers/OpenAIEmbeddingProvider.js';
export { AIMetrics } from './observability/AIMetrics.js';

/**
 * Production embedding provider for the RAG pipeline. Returns undefined when
 * no OpenAI key is configured so callers can fall back to the deterministic
 * MockEmbeddingProvider (dev/CI) or leave RAG unconfigured (production).
 */
export function createOpenAIEmbeddingProvider(): OpenAIEmbeddingProvider | undefined {
  const apiKey = resolveOpenAIKey();
  if (!apiKey) return undefined;
  return new OpenAIEmbeddingProvider(apiKey);
}

/**
 * Register the platform AI providers on a shared AIOrchestrationService.
 * EPIC-003/AC-001 — the API gateway reuses this single registration point so
 * the Content Agency pipeline (and every future business module) routes through
 * the AI Provider Manager without duplicating provider wiring.
 *
 * Real providers activate when their API keys are present in the environment
 * (or in the config). The Mock provider is registered in non-production
 * environments (dev/test) so pipelines are exercisable without API keys; in
 * production it is only registered when explicitly enabled via
 * `AI_ENABLE_MOCK=true` or `config.providers.enableMock: true` — production
 * must never silently serve synthetic responses (AI-RUNTIME-001).
 */
/**
 * Resolve the OpenAI API key from the canonical production config variable
 * (`AI_OPENAI_API_KEY`, validated by @vedmoulya/core) with a backward-
 * compatible fallback to the legacy `OPENAI_API_KEY` used by the smoke
 * scripts and local dev. The canonical key is preferred so production
 * configuration (which validates `AI_OPENAI_API_KEY`) and the runtime
 * provider registration agree — fixing the P0 mismatch where production
 * config passed validation but no real provider was registered.
 */
export function resolveOpenAIKey(): string | undefined {
  return process.env.AI_OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || undefined;
}

/**
 * Resolve the DeepSeek API key from the canonical production config variable
 * (`AI_DEEPSEEK_API_KEY`, validated by @vedmoulya/core). There is no legacy
 * fallback variable — the canonical key is the single source of truth.
 */
export function resolveDeepSeekKey(): string | undefined {
  return process.env.AI_DEEPSEEK_API_KEY?.trim() || undefined;
}

export function registerPlatformProviders(
  orchestrator: AIOrchestrationService,
  config?: Partial<OrchestratorConfig>,
): void {
  const providers = config?.providers;
  const openaiKey = providers?.openai?.apiKey ?? resolveOpenAIKey();
  if (openaiKey) {
    // AI-RUNTIME-002: the Vercel AI SDK adapter is the PRIMARY production
    // execution path (generateText/streamText/generateObject + usage
    // accounting + timeouts). The raw-fetch OpenAIProvider remains available
    // for operators who explicitly opt in with AI_RUNTIME_LEGACY_RAW_FETCH=true
    // (e.g. environments pinned to the pre-SDK adapter).
    if (process.env.AI_RUNTIME_LEGACY_RAW_FETCH === 'true') {
      orchestrator.registerProvider(new OpenAIProvider(openaiKey));
    } else {
      orchestrator.registerProvider(new VercelAIProvider(openaiKey));
    }
  }
  const deepseekKey = providers?.deepseek?.apiKey ?? resolveDeepSeekKey();
  if (deepseekKey) {
    // DeepSeek is wired through the same Vercel AI SDK runtime as OpenAI
    // (OpenAI-compatible endpoint via createOpenAI) — always the SDK path,
    // never the raw-fetch legacy adapter.
    orchestrator.registerProvider(new DeepSeekProvider(deepseekKey));
  }
  const enableMock =
    providers?.enableMock ??
    (process.env.NODE_ENV !== 'production' || process.env.AI_ENABLE_MOCK === 'true');
  if (enableMock) {
    orchestrator.registerProvider(new MockProvider());
  }
}

// ── AI Domain Exports ──────────────────────────────────────────────────────

export type {
  AIRequest,
  AIResponse,
  CapabilityType,
  QualityTier,
  ProviderFamily,
  ProviderHealth,
  CapabilityProfile,
  TokenUsage,
  ValidationResult,
  RoutingDecision,
  FailureReason,
  OrchestratorResult,
} from '@vedmoulya/ai';
