// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capabilities: Domain Types
// EI-001 — Enterprise Capability Registry & Marketplace
// The capability system is business-module agnostic: modules consume
// capabilities without knowing providers, workflows, or orchestration.
// ──────────────────────────────────────────────────────────────────

// ── Lifecycle ──────────────────────────────────────────────────────────────

export type CapabilityStatus =
  'design' | 'draft' | 'testing' | 'active' | 'deprecated' | 'archived';

export const CAPABILITY_STATUSES: readonly CapabilityStatus[] = [
  'design',
  'draft',
  'testing',
  'active',
  'deprecated',
  'archived',
] as const;

// ── Category ───────────────────────────────────────────────────────────────

export type CapabilityCategory =
  | 'content'
  | 'research'
  | 'writing'
  | 'review'
  | 'seo'
  | 'publishing'
  | 'analytics'
  | 'memory'
  | 'knowledge'
  | 'context'
  | 'ocr'
  | 'vision'
  | 'translation'
  | 'validation'
  | 'speech'
  | 'platform';

export const CAPABILITY_CATEGORIES: readonly CapabilityCategory[] = [
  'content',
  'research',
  'writing',
  'review',
  'seo',
  'publishing',
  'analytics',
  'memory',
  'knowledge',
  'context',
  'ocr',
  'vision',
  'translation',
  'validation',
  'speech',
  'platform',
] as const;

// ── Business Modules (consumers) ───────────────────────────────────────────

export type BusinessModule =
  'content-agency' | 'learning' | 'career' | 'marketing' | 'business' | 'platform';

export const BUSINESS_MODULES: readonly BusinessModule[] = [
  'content-agency',
  'learning',
  'career',
  'marketing',
  'business',
  'platform',
] as const;

// ── Profiles ───────────────────────────────────────────────────────────────

export interface CostProfile {
  /** Estimated cost per invocation in USD (may be a small fraction). */
  estimatedCostUsd: number;
  /** Optional cost tier label for display. */
  tier: 'free' | 'low' | 'medium' | 'high';
}

export interface TokenProfile {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
}

export interface LatencyProfile {
  /** Expected p50 latency in milliseconds. */
  p50Ms: number;
  /** Expected p95 latency in milliseconds. */
  p95Ms: number;
}

export interface QualityProfile {
  /** Expected quality score target (0–1). */
  target: number;
  /** Minimum acceptable quality score (0–1). */
  minimum: number;
}

// ── Required AI Features (capability-level, provider-agnostic) ─────────────

/**
 * AI features a capability needs from the orchestration layer. These align
 * with the `packages/ai` CapabilityType taxonomy but are expressed here as
 * provider-agnostic feature names — consumers never see providers.
 */
export type RequiredAIFeature =
  | 'reasoning'
  | 'coding'
  | 'vision'
  | 'embeddings'
  | 'summarization'
  | 'classification'
  | 'translation'
  | 'speech'
  | 'image_understanding'
  | 'general_conversation'
  | 'content_generation';

export const REQUIRED_AI_FEATURES: readonly RequiredAIFeature[] = [
  'reasoning',
  'coding',
  'vision',
  'embeddings',
  'summarization',
  'classification',
  'translation',
  'speech',
  'image_understanding',
  'general_conversation',
  'content_generation',
] as const;

// ── Capability definition (input contract) ─────────────────────────────────

export interface CapabilityDefinition {
  id: string;
  name: string;
  category: CapabilityCategory;
  description: string;
  owner: string;
  /** Named input slots the capability accepts. */
  inputs: string[];
  /** Named output artifacts the capability produces. */
  outputs: string[];
  /** Direct dependency capability ids (DAG edges). */
  dependencies: string[];
  /** AI features required to execute (provider-agnostic). */
  requiredAIFeatures: RequiredAIFeature[];
  cost: CostProfile;
  tokens: TokenProfile;
  latency: LatencyProfile;
  quality: QualityProfile;
  /** Registry confidence in the estimates (0–1). */
  confidence: number;
  version: string;
  status: CapabilityStatus;
  tags: string[];
  /** Business modules consuming this capability. */
  businessModules: BusinessModule[];
  /** Optional documentation URL for the marketplace card. */
  documentationUrl?: string;
}

// ── Search ─────────────────────────────────────────────────────────────────

export interface CapabilitySearchCriteria {
  query?: string;
  categories?: CapabilityCategory[];
  statuses?: CapabilityStatus[];
  businessModules?: BusinessModule[];
  tags?: string[];
  /** Filter to capabilities that depend on this id. */
  dependsOn?: string;
  /** Include only capabilities that are compositions (have children). */
  onlyCompositions?: boolean;
}
