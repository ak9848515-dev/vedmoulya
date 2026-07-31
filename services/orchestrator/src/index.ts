// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Orchestrator Service
// Main entry point for the AI Orchestrator
// BLD-005 — AI Orchestrator
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import { AIOrchestrationService } from '@vedmoulya/services';
import { MockProvider } from './providers/MockProvider.js';

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

export function createOrchestrator(_config?: Partial<OrchestratorConfig>): AIOrchestrationService {
  const orchestrator = new AIOrchestrationService();

  // Always register mock provider for development/testing
  orchestrator.registerProvider(new MockProvider());

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
export { AIMetrics } from './observability/AIMetrics.js';

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
