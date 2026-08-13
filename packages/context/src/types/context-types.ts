// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context: Domain Types
// EI-003 — Enterprise Context Intelligence Engine
// Before ANY AI request, VedMoulya must automatically determine
// WHAT information, HOW MUCH, WHICH, and IN WHAT ORDER to send.
// This sprint builds the intelligence layer — no execution.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';

// ── Context Sources ─────────────────────────────────────────────────────────

export type ContextSource =
  | 'conversation_memory'
  | 'enterprise_memory'
  | 'knowledge_base'
  | 'business_rules'
  | 'client_data'
  | 'project_data'
  | 'capability_metadata'
  | 'documents'
  | 'prompt_templates'
  | 'historical_success'
  | 'benchmark_knowledge';

export const CONTEXT_SOURCES: readonly ContextSource[] = [
  'conversation_memory',
  'enterprise_memory',
  'knowledge_base',
  'business_rules',
  'client_data',
  'project_data',
  'capability_metadata',
  'documents',
  'prompt_templates',
  'historical_success',
  'benchmark_knowledge',
] as const;

// ── Context Categories ──────────────────────────────────────────────────────

export type ContextCategory =
  | 'user_profile'
  | 'conversation'
  | 'memory'
  | 'knowledge'
  | 'business'
  | 'client'
  | 'project'
  | 'capability'
  | 'document'
  | 'prompt'
  | 'strategy'
  | 'brand'
  | 'market'
  | 'system';

export const CONTEXT_CATEGORIES: readonly ContextCategory[] = [
  'user_profile',
  'conversation',
  'memory',
  'knowledge',
  'business',
  'client',
  'project',
  'capability',
  'document',
  'prompt',
  'strategy',
  'brand',
  'market',
  'system',
] as const;

// ── Priority ────────────────────────────────────────────────────────────────

export type ContextPriority = 'critical' | 'high' | 'medium' | 'low' | 'background';

export const CONTEXT_PRIORITIES: readonly ContextPriority[] = [
  'critical',
  'high',
  'medium',
  'low',
  'background',
] as const;

// ── Confidence Level ────────────────────────────────────────────────────────

export type ContextConfidenceLevel = 'very_high' | 'high' | 'medium' | 'low' | 'very_low';

// ── Compression Strategy ────────────────────────────────────────────────────

export type CompressionStrategy =
  'extractive' | 'abstractive' | 'summary' | 'top_k' | 'threshold' | 'hybrid';

export const COMPRESSION_STRATEGIES: readonly CompressionStrategy[] = [
  'extractive',
  'abstractive',
  'summary',
  'top_k',
  'threshold',
  'hybrid',
] as const;

// ── Context Object ──────────────────────────────────────────────────────────

export interface ContextItem {
  contextId: string;
  source: ContextSource;
  category: ContextCategory;
  priority: ContextPriority;
  importance: number; // 0–1
  confidence: number; // 0–1
  freshness: number; // 0–1 (1 = just created, 0 = very old)
  size: number; // bytes
  estimatedTokens: number;
  language: string;
  tags: string[];
  business: string[]; // business module identifiers
  capability: CapabilityType[];
  version: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  sourceId: string; // original source identifier
}

// ── Scoring ─────────────────────────────────────────────────────────────────

export interface ContextScore {
  priorityScore: number; // 0–1 based on priority level
  relevanceScore: number; // 0–1 relevance to the request
  freshnessScore: number; // 0–1 recency-based
  businessScore: number; // 0–1 alignment with business context
  confidenceScore: number; // 0–1 data quality confidence
  finalScore: number; // 0–1 weighted composite
}

// ── Ranking Input ───────────────────────────────────────────────────────────

export interface ContextRankingInput {
  items: ContextItem[];
  requestCapability: CapabilityType;
  requestIntent?: string;
  businessContext?: string[];
  userPreferences?: string[];
  timeWindow?: { start: string; end: string };
}

// ── Filtering ───────────────────────────────────────────────────────────────

export interface ContextFilterCriteria {
  sources?: ContextSource[];
  categories?: ContextCategory[];
  priorities?: ContextPriority[];
  capabilities?: CapabilityType[];
  business?: string[];
  tags?: string[];
  minConfidence?: number;
  minImportance?: number;
  maxTokens?: number;
  timeRange?: { start: string; end: string };
  excludeIds?: string[];
  userFilter?: string;
}

export interface ContextFilterResult {
  retained: ContextItem[];
  removed: Array<{ item: ContextItem; reason: string }>;
}

// ── Compression ─────────────────────────────────────────────────────────────

export interface CompressionInput {
  items: ContextItem[];
  targetTokens: number;
  strategy: CompressionStrategy;
  preserveCritical?: boolean; // always keep critical priority items
  minConfidence?: number;
}

export interface CompressionResult {
  items: ContextItem[];
  originalTokens: number;
  compressedTokens: number;
  reductionPercent: number;
  strategy: CompressionStrategy;
  confidence: number; // 0–1 estimate of retained quality
  chunksRemoved: number;
  chunksMerged: number;
  compressionTimeMs: number;
}

export interface CompressionStep {
  strategy: CompressionStrategy;
  itemsBefore: number;
  itemsAfter: number;
  tokensBefore: number;
  tokensAfter: number;
  description: string;
}

// ── Assembly ────────────────────────────────────────────────────────────────

export interface EnterpriseContextPackage {
  packageId: string;
  goal: string;
  capability: CapabilityType;
  memory: ContextItem[];
  knowledge: ContextItem[];
  business: ContextItem[];
  client: ContextItem[];
  documents: ContextItem[];
  prompt: string;
  metadata: {
    totalItems: number;
    estimatedTokens: number;
    confidence: number;
    sources: ContextSource[];
    categories: ContextCategory[];
    compressionSteps: CompressionStep[];
    assembledAt: string;
    version: string;
  };
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export interface ContextMetrics {
  originalTokens: number;
  compressedTokens: number;
  reductionPercent: number;
  compressionTimeMs: number;
  qualityEstimate: number; // 0–1
  confidence: number; // 0–1
  itemsProcessed: number;
  itemsRemoved: number;
  itemsMerged: number;
  timestamp: string;
}

// ── Discovery ───────────────────────────────────────────────────────────────

export interface ContextDiscoveryResult {
  total: number;
  items: ContextItem[];
  scores: Record<string, ContextScore>;
  appliedFilters: ContextFilterCriteria;
}

export interface ContextPreview {
  contextId: string;
  snippet: string;
  source: ContextSource;
  category: ContextCategory;
  priority: ContextPriority;
  estimatedTokens: number;
  confidence: number;
  score: ContextScore;
}

export interface ContextExplanation {
  contextId: string;
  source: ContextSource;
  whyRelevant: string;
  score: ContextScore;
  scoreBreakdown: string;
  compressionSavings?: string;
}

// ── Search ──────────────────────────────────────────────────────────────────

export interface ContextSearchCriteria {
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
