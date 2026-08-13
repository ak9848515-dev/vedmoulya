// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Domain Service: Provider Candidates
// Ranks eligible providers for a goal — it NEVER selects one. Each
// candidate carries capability match, quality, latency, cost, context
// window, availability, confidence, historical success, and health.
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, ProviderFamily, ProviderStatus } from '@vedmoulya/ai';
import type { ProviderCandidate } from '../../types/strategy-types.js';

// ── Provider capability profiles (registry estimates, EI-002 aligned) ───────
// These mirror the provider registry's capability matrix. In production the
// registry (EI-002) supplies these; here we seed representative estimates.

export interface ProviderCapabilityProfile {
  family: ProviderFamily;
  name: string;
  modelId: string;
  capabilities: CapabilityType[];
  quality: number;
  latencyMs: number;
  costPer1MInput: number;
  costPer1MOutput: number;
  contextWindow: number;
  availability: ProviderStatus;
  confidence: number;
  historicalSuccess: number;
  healthScore: number;
}

const PROFILES: ProviderCapabilityProfile[] = [
  {
    family: 'anthropic',
    name: 'Anthropic Claude',
    modelId: 'claude-3-opus',
    capabilities: [
      'content_generation',
      'reasoning',
      'summarization',
      'translation',
      'classification',
    ],
    quality: 0.97,
    latencyMs: 1200,
    costPer1MInput: 15,
    costPer1MOutput: 75,
    contextWindow: 200000,
    availability: 'healthy',
    confidence: 0.95,
    historicalSuccess: 0.96,
    healthScore: 0.98,
  },
  {
    family: 'openai',
    name: 'OpenAI GPT-4o',
    modelId: 'gpt-4o',
    capabilities: [
      'content_generation',
      'reasoning',
      'summarization',
      'classification',
      'translation',
      'coding',
    ],
    quality: 0.92,
    latencyMs: 900,
    costPer1MInput: 5,
    costPer1MOutput: 15,
    contextWindow: 128000,
    availability: 'healthy',
    confidence: 0.97,
    historicalSuccess: 0.94,
    healthScore: 0.97,
  },
  {
    family: 'google',
    name: 'Google Gemini',
    modelId: 'gemini-1.5-pro',
    capabilities: [
      'content_generation',
      'reasoning',
      'summarization',
      'translation',
      'classification',
    ],
    quality: 0.88,
    latencyMs: 1100,
    costPer1MInput: 3.5,
    costPer1MOutput: 10.5,
    contextWindow: 2000000,
    availability: 'healthy',
    confidence: 0.9,
    historicalSuccess: 0.9,
    healthScore: 0.95,
  },
  {
    family: 'deepseek',
    name: 'DeepSeek',
    modelId: 'deepseek-chat',
    capabilities: ['reasoning', 'coding', 'classification'],
    quality: 0.89,
    latencyMs: 800,
    costPer1MInput: 0.27,
    costPer1MOutput: 1.1,
    contextWindow: 64000,
    availability: 'healthy',
    confidence: 0.85,
    historicalSuccess: 0.88,
    healthScore: 0.92,
  },
  {
    family: 'openrouter',
    name: 'OpenRouter',
    modelId: 'openrouter-auto',
    capabilities: [
      'content_generation',
      'reasoning',
      'summarization',
      'classification',
      'translation',
      'coding',
    ],
    quality: 0.85,
    latencyMs: 1000,
    costPer1MInput: 2,
    costPer1MOutput: 6,
    contextWindow: 128000,
    availability: 'degraded',
    confidence: 0.8,
    historicalSuccess: 0.85,
    healthScore: 0.88,
  },
  {
    family: 'ollama',
    name: 'Ollama (local)',
    modelId: 'llama3',
    capabilities: ['content_generation', 'reasoning', 'summarization', 'classification'],
    quality: 0.75,
    latencyMs: 500,
    costPer1MInput: 0,
    costPer1MOutput: 0,
    contextWindow: 32000,
    availability: 'healthy',
    confidence: 0.7,
    historicalSuccess: 0.8,
    healthScore: 0.9,
  },
  {
    family: 'mock',
    name: 'Mock Provider',
    modelId: 'mock-model',
    capabilities: [
      'content_generation',
      'reasoning',
      'summarization',
      'classification',
      'translation',
      'coding',
    ],
    quality: 0.5,
    latencyMs: 50,
    costPer1MInput: 0,
    costPer1MOutput: 0,
    contextWindow: 16000,
    availability: 'healthy',
    confidence: 0.6,
    historicalSuccess: 0.7,
    healthScore: 0.85,
  },
];

// ── Service ─────────────────────────────────────────────────────────────────

export class ProviderCandidateService {
  /**
   * Rank eligible providers for a set of required capabilities.
   * Returns candidates sorted by composite rank score (highest first).
   * Does NOT select a provider — ranking only.
   */
  rankCandidates(
    requiredCapabilities: CapabilityType[],
    allowList?: string[],
    maxResults = 5,
  ): ProviderCandidate[] {
    const allowed = allowList && allowList.length > 0 ? new Set(allowList) : null;

    const candidates = PROFILES.filter((p) => (allowed ? allowed.has(p.family) : true))
      .filter((p) => requiredCapabilities.every((c) => p.capabilities.includes(c)))
      .map((p) => this.toCandidate(p, requiredCapabilities))
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, maxResults);

    return candidates;
  }

  private toCandidate(p: ProviderCapabilityProfile, required: CapabilityType[]): ProviderCandidate {
    const capabilityMatch =
      required.length === 0
        ? 0.5
        : required.reduce((sum, c) => sum + (p.capabilities.includes(c) ? 1 : 0), 0) /
          required.length;

    // Composite rank score: quality + capability match + health + history,
    // lightly penalized by cost and latency (ranking only, no selection).
    const rankScore = Math.max(
      0,
      Math.min(
        1,
        0.35 * p.quality +
          0.2 * capabilityMatch +
          0.15 * p.healthScore +
          0.15 * p.historicalSuccess +
          0.05 * p.confidence +
          0.05 * (p.availability === 'healthy' ? 1 : 0.5) +
          0.05 * (1 - Math.min(1, p.costPer1MInput / 20)) +
          0.0 * (1 - Math.min(1, p.latencyMs / 2000)),
      ),
    );

    return {
      providerId: `${p.family}_${p.modelId}`,
      family: p.family,
      name: p.name,
      modelId: p.modelId,
      capabilityMatch,
      qualityEstimate: p.quality,
      latencyEstimateMs: p.latencyMs,
      costEstimateUsd: 0, // filled by the budget engine
      contextWindow: p.contextWindow,
      availability: p.availability,
      confidence: p.confidence,
      historicalSuccess: p.historicalSuccess,
      healthScore: p.healthScore,
      rankScore,
    };
  }
}
