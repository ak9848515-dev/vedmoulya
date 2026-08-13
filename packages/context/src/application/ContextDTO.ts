// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Application DTOs
// Data Transfer Objects for the Enterprise Context Intelligence Engine
// EI-003 — Enterprise Context Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type {
  CompressionStrategy,
  ContextCategory,
  ContextPriority,
  ContextSource,
} from '../types/context-types.js';

// ── Command DTOs ─────────────────────────────────────────────────────────

export interface RegisterContextDTO {
  source: ContextSource;
  category: ContextCategory;
  priority: ContextPriority;
  importance: number;
  confidence: number;
  content: string;
  language?: string;
  tags?: string[];
  business?: string[];
  capability?: CapabilityType[];
  metadata?: Record<string, unknown>;
  sourceId: string;
}

export interface BulkRegisterContextDTO {
  items: RegisterContextDTO[];
}

// ── Query DTOs ───────────────────────────────────────────────────────────-

export interface ContextQueryDTO {
  query?: string;
  sources?: ContextSource[];
  categories?: ContextCategory[];
  priorities?: ContextPriority[];
  capabilities?: CapabilityType[];
  tags?: string[];
  confidence?: { min: number; max: number };
  importance?: { min: number; max: number };
  timeRange?: { start: string; end: string };
  page?: number;
  limit?: number;
}

// ── Response DTOs ─────────────────────────────────────────────────────────

export interface ContextItemDTO {
  contextId: string;
  source: ContextSource;
  category: ContextCategory;
  priority: ContextPriority;
  importance: number;
  confidence: number;
  freshness: number;
  estimatedTokens: number;
  language: string;
  tags: string[];
  business: string[];
  capability: CapabilityType[];
  version: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  sourceId: string;
}

export interface ContextScoreDTO {
  priorityScore: number;
  relevanceScore: number;
  freshnessScore: number;
  businessScore: number;
  confidenceScore: number;
  finalScore: number;
}

export interface ContextRankingDTO {
  scores: Record<string, ContextScoreDTO>;
  ranked: ContextItemDTO[];
}

export interface ContextFilterResultDTO {
  retained: ContextItemDTO[];
  removed: Array<{ contextId: string; reason: string }>;
}

export interface ContextCompressionResultDTO {
  items: ContextItemDTO[];
  originalTokens: number;
  compressedTokens: number;
  reductionPercent: number;
  strategy: CompressionStrategy;
  confidence: number;
  chunksRemoved: number;
  chunksMerged: number;
  compressionTimeMs: number;
  steps: Array<{
    strategy: CompressionStrategy;
    itemsBefore: number;
    itemsAfter: number;
    tokensBefore: number;
    tokensAfter: number;
    description: string;
  }>;
}

export interface EnterpriseContextPackageDTO {
  packageId: string;
  goal: string;
  capability: CapabilityType;
  memory: ContextItemDTO[];
  knowledge: ContextItemDTO[];
  business: ContextItemDTO[];
  client: ContextItemDTO[];
  documents: ContextItemDTO[];
  prompt: string;
  assembledPrompt: string;
  metadata: {
    totalItems: number;
    estimatedTokens: number;
    confidence: number;
    sources: ContextSource[];
    categories: ContextCategory[];
    compressionSteps: Array<{
      strategy: CompressionStrategy;
      itemsBefore: number;
      itemsAfter: number;
      tokensBefore: number;
      tokensAfter: number;
      description: string;
    }>;
    assembledAt: string;
    version: string;
  };
}

export interface ContextMetricsDTO {
  originalTokens: number;
  compressedTokens: number;
  reductionPercent: number;
  compressionTimeMs: number;
  qualityEstimate: number;
  confidence: number;
  itemsProcessed: number;
  itemsRemoved: number;
  itemsMerged: number;
  timestamp: string;
}

export interface ContextDiscoveryDTO {
  total: number;
  items: ContextItemDTO[];
  scores: Record<string, ContextScoreDTO>;
  appliedFilters: ContextQueryDTO;
}

export interface ContextPreviewDTO {
  contextId: string;
  snippet: string;
  source: ContextSource;
  category: ContextCategory;
  priority: ContextPriority;
  estimatedTokens: number;
  confidence: number;
  score: ContextScoreDTO;
}

export interface ContextExplanationDTO {
  contextId: string;
  source: ContextSource;
  whyRelevant: string;
  score: ContextScoreDTO;
  scoreBreakdown: string;
  compressionSavings?: string;
}

export interface ContextRegistrySummaryDTO {
  total: number;
  totalTokens: number;
  countBySource: Record<ContextSource, number>;
  countByCategory: Record<ContextCategory, number>;
  countByPriority: Record<ContextPriority, number>;
}
