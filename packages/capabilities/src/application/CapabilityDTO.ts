// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Application DTOs
// Data Transfer Objects for the Enterprise Capability Registry
// EI-001 — Enterprise Capability Registry & Marketplace
// ──────────────────────────────────────────────────────────────────

import type {
  BusinessModule,
  CapabilityCategory,
  CapabilityStatus,
  RequiredAIFeature,
} from '../types/capability-types.js';

// ── Command DTOs ─────────────────────────────────────────────────────────

export interface CreateCapabilityDTO {
  id: string;
  name: string;
  category: CapabilityCategory;
  description: string;
  owner: string;
  inputs?: string[];
  outputs?: string[];
  dependencies?: string[];
  requiredAIFeatures?: RequiredAIFeature[];
  estimatedCostUsd?: number;
  costTier?: 'free' | 'low' | 'medium' | 'high';
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  p50Ms?: number;
  p95Ms?: number;
  qualityTarget?: number;
  qualityMinimum?: number;
  confidence?: number;
  tags?: string[];
  businessModules?: BusinessModule[];
  documentationUrl?: string;
  /** Composition children (nested capabilities). */
  composition?: Array<{ id: string; slot?: string }>;
}

export interface UpdateCapabilityDTO {
  name?: string;
  category?: CapabilityCategory;
  description?: string;
  owner?: string;
  inputs?: string[];
  outputs?: string[];
  tags?: string[];
  documentationUrl?: string;
  estimatedCostUsd?: number;
  costTier?: 'free' | 'low' | 'medium' | 'high';
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  p50Ms?: number;
  p95Ms?: number;
  qualityTarget?: number;
  qualityMinimum?: number;
  confidence?: number;
  composition?: Array<{ id: string; slot?: string }>;
}

// ── Query DTOs ───────────────────────────────────────────────────────────

export interface CapabilityQueryDTO {
  query?: string;
  categories?: CapabilityCategory[];
  statuses?: CapabilityStatus[];
  businessModules?: BusinessModule[];
  tags?: string[];
  dependsOn?: string;
  onlyCompositions?: boolean;
  page?: number;
  limit?: number;
}

// ── Response DTOs ─────────────────────────────────────────────────────────

export interface CapabilityCompositionDTO {
  id: string;
  name: string;
  slot?: string;
  children: CapabilityCompositionDTO[];
  isComposition: boolean;
  leafCount: number;
}

export interface CapabilityDTO {
  id: string;
  name: string;
  category: CapabilityCategory;
  description: string;
  owner: string;
  inputs: string[];
  outputs: string[];
  dependencies: string[];
  requiredAIFeatures: RequiredAIFeature[];
  estimatedCostUsd: number;
  costTier: 'free' | 'low' | 'medium' | 'high';
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  p50Ms: number;
  p95Ms: number;
  qualityTarget: number;
  qualityMinimum: number;
  confidence: number;
  version: string;
  status: CapabilityStatus;
  tags: string[];
  businessModules: BusinessModule[];
  documentationUrl?: string;
  isComposition: boolean;
  composition: CapabilityCompositionDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CapabilityGraphDTO {
  nodes: Array<{
    id: string;
    name: string;
    dependencies: string[];
    depth: number;
    critical: boolean;
  }>;
  roots: string[];
  cycles: string[][];
  dangling: string[];
}

export interface CapabilityMarketplaceDTO {
  capabilities: CapabilityDTO[];
  total: number;
  activeCount: number;
  compositionCount: number;
  countByStatus: Record<CapabilityStatus, number>;
  countByCategory: Record<CapabilityCategory, number>;
  countByBusinessModule: Record<BusinessModule, number>;
}
