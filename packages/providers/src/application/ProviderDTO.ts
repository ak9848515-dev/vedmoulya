// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Application DTOs
// Data Transfer Objects for the Enterprise Provider Registry
// EI-002 — Enterprise Provider Registry & Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type {
  CapabilityType,
  ModalityType,
  ProviderFamily,
  ProviderStatus as ProviderHealthStatus,
  QualityTier,
} from '@vedmoulya/ai';
import type {
  BenchmarkDifficulty,
  ProviderBenchmarkCategory,
  ProviderBenchmarkDefinition,
  ProviderLifecycleStatus,
} from '../types/provider-types.js';

// ── Command DTOs ─────────────────────────────────────────────────────────

export interface ProviderModelInput {
  id: string;
  name: string;
  contextLength: number;
  maxOutputTokens: number;
  streaming: boolean;
  vision: boolean;
  functionCalling: boolean;
  embeddings: boolean;
  reasoning: boolean;
  coding: boolean;
  creativeWriting: boolean;
  translation: boolean;
  image: boolean;
  audio: boolean;
  video: boolean;
  modalities: ModalityType[];
  capabilities: CapabilityType[];
}

export interface ProviderMatrixInput {
  capability: CapabilityType;
  quality: number;
  expectedCostUsd: number;
  expectedLatencyMs: number;
  expectedInputTokens: number;
  expectedOutputTokens: number;
  confidence: number;
  historicalSuccess: number;
  qualityTier: QualityTier;
}

export interface CreateProviderDTO {
  id: string;
  family: ProviderFamily;
  name: string;
  description: string;
  owner: string;
  models?: ProviderModelInput[];
  capabilities?: CapabilityType[];
  supportedModalities?: ModalityType[];
  inputPerMillionTokens?: number;
  outputPerMillionTokens?: number;
  currency?: string;
  costTier?: 'free' | 'low' | 'medium' | 'high';
  p50Ms?: number;
  p95Ms?: number;
  requestsPerMinute?: number;
  tokensPerMinute?: number;
  requestsPerDay?: number;
  maxConcurrentRequests?: number;
  availability?: number;
  tags?: string[];
  documentationUrl?: string;
  matrix?: ProviderMatrixInput[];
}

export interface UpdateProviderDTO {
  name?: string;
  description?: string;
  owner?: string;
  tags?: string[];
  documentationUrl?: string;
  inputPerMillionTokens?: number;
  outputPerMillionTokens?: number;
  currency?: string;
  costTier?: 'free' | 'low' | 'medium' | 'high';
  p50Ms?: number;
  p95Ms?: number;
  requestsPerMinute?: number;
  tokensPerMinute?: number;
  requestsPerDay?: number;
  maxConcurrentRequests?: number;
  availability?: number;
}

// ── Query DTOs ───────────────────────────────────────────────────────────

export interface ProviderQueryDTO {
  query?: string;
  families?: ProviderFamily[];
  lifecycleStatuses?: ProviderLifecycleStatus[];
  capabilities?: CapabilityType[];
  modalities?: ModalityType[];
  tags?: string[];
  minHealthScore?: number;
  minContextLength?: number;
  feature?: 'streaming' | 'vision' | 'function_calling' | 'embeddings';
  page?: number;
  limit?: number;
}

// ── Response DTOs ─────────────────────────────────────────────────────────

export type ProviderModelDTO = ProviderModelInput;

export type ProviderMatrixDTO = ProviderMatrixInput;

export interface ProviderDTO {
  id: string;
  family: ProviderFamily;
  name: string;
  description: string;
  owner: string;
  models: ProviderModelDTO[];
  capabilities: CapabilityType[];
  supportedModalities: ModalityType[];
  inputPerMillionTokens: number;
  outputPerMillionTokens: number;
  currency: string;
  costTier: 'free' | 'low' | 'medium' | 'high';
  p50Ms: number;
  p95Ms: number;
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay: number;
  maxConcurrentRequests: number;
  availability: number;
  health: {
    status: ProviderHealthStatus;
    healthScore: number;
    latencyMs: number;
    successCount: number;
    failureCount: number;
    quotaUsedPercent: number;
    rateLimitRemaining: number;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastCheckedAt: string;
  };
  lifecycleStatus: ProviderLifecycleStatus;
  version: string;
  tags: string[];
  documentationUrl?: string;
  matrix: ProviderMatrixDTO[];
  bestQuality: number;
  bestCostUsd: number;
  maxContextLength: number;
  hasStreaming: boolean;
  hasVision: boolean;
  hasFunctionCalling: boolean;
  hasEmbeddings: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCapabilityMatrixDTO {
  rows: Array<{
    capability: CapabilityType;
    providerCount: number;
    bestProviderId: string | null;
    rankings: Array<{
      providerId: string;
      providerName: string;
      quality: number;
      expectedCostUsd: number;
      expectedLatencyMs: number;
      expectedInputTokens: number;
      expectedOutputTokens: number;
      confidence: number;
      historicalSuccess: number;
      qualityTier: QualityTier;
    }>;
  }>;
}

export interface ProviderFleetHealthDTO {
  healthyCount: number;
  degradedCount: number;
  unstableCount: number;
  downCount: number;
  totalCount: number;
  averageHealthScore: number;
  averageLatencyMs: number;
  totalFailures: number;
  snapshots: Array<{
    providerId: string;
    providerName: string;
    status: ProviderHealthStatus;
    healthScore: number;
    latencyMs: number;
    successCount: number;
    failureCount: number;
    quotaUsedPercent: number;
    lastCheckedAt: string;
  }>;
}

export interface ProviderMarketplaceDTO {
  providers: ProviderDTO[];
  total: number;
  activeCount: number;
  healthyCount: number;
  countByLifecycleStatus: Record<ProviderLifecycleStatus, number>;
  countByFamily: Record<ProviderFamily, number>;
  countByCapability: Record<CapabilityType, number>;
}

// ── Benchmark Datasets (definitions only — EI-002) ──────────────────────────

export interface ProviderBenchmarkQueryDTO {
  category?: ProviderBenchmarkCategory;
  capability?: CapabilityType;
  difficulty?: BenchmarkDifficulty;
}

export interface ProviderBenchmarkDatasetDTO {
  items: ProviderBenchmarkDefinition[];
  total: number;
  summary: {
    total: number;
    byCategory: Partial<Record<ProviderBenchmarkCategory, number>>;
    byDifficulty: Partial<Record<BenchmarkDifficulty, number>>;
  };
}

// ── Model Registry (every model across the fleet) ───────────────────────────

export interface ProviderModelRegistryEntryDTO {
  providerId: string;
  providerName: string;
  model: ProviderModelDTO;
}

export interface ProviderModelRegistryDTO {
  models: ProviderModelRegistryEntryDTO[];
  total: number;
}
