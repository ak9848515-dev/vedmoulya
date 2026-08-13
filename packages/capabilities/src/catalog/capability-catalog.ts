// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Catalog (Seed Data)
// EI-001 — Enterprise Capability Registry & Marketplace
// The initial registry content: atomic capabilities + compositions.
// Business modules (Content Agency, Learning, Career, Marketing)
// consume capabilities through this registry — no direct AI calls.
// ──────────────────────────────────────────────────────────────────

import { Capability } from '../domain/entities/Capability.js';
import { CapabilityStatus } from '../domain/value-objects/CapabilityStatus.js';
import { createCapabilityId } from '../domain/value-objects/CapabilityId.js';

interface CatalogEntry {
  id: string;
  name: string;
  category: Capability['category'];
  description: string;
  owner: string;
  inputs?: string[];
  outputs?: string[];
  dependencies?: string[];
  requiredAIFeatures?: Capability['requiredAIFeatures'][number][];
  costTier: Capability['cost']['tier'];
  estimatedCostUsd: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  p50Ms: number;
  p95Ms: number;
  qualityTarget: number;
  qualityMinimum: number;
  confidence: number;
  status: Capability['status']['value'];
  tags: string[];
  businessModules: Capability['businessModules'][number][];
  documentationUrl?: string;
  /** Composition children (slot → capability id). */
  composition?: Array<{ slot: string; id: string }>;
}

const CATALOG: readonly CatalogEntry[] = [
  // ── Foundation: platform capabilities ───────────────────────────────────
  {
    id: 'memory_retrieval',
    name: 'Memory Retrieval',
    category: 'memory',
    description:
      'Retrieve relevant long-term and episodic memories for the current task context via the Memory engine.',
    owner: 'Memory Engine Team',
    inputs: ['query', 'entityIds', 'maxResults'],
    outputs: ['memoryFragments'],
    requiredAIFeatures: ['embeddings'],
    costTier: 'low',
    estimatedCostUsd: 0.0002,
    estimatedInputTokens: 400,
    estimatedOutputTokens: 0,
    p50Ms: 120,
    p95Ms: 400,
    qualityTarget: 0.9,
    qualityMinimum: 0.7,
    confidence: 0.85,
    status: 'active',
    tags: ['memory', 'retrieval', 'context'],
    businessModules: ['platform', 'content-agency'],
  },
  {
    id: 'knowledge_retrieval',
    name: 'Knowledge Retrieval',
    category: 'knowledge',
    description:
      'Query the Knowledge graph and vector index to ground generation in verified facts and relationships.',
    owner: 'Knowledge Engine Team',
    inputs: ['query', 'graphScopes', 'maxResults'],
    outputs: ['knowledgeFacts', 'evidence'],
    requiredAIFeatures: ['embeddings'],
    costTier: 'low',
    estimatedCostUsd: 0.0003,
    estimatedInputTokens: 500,
    estimatedOutputTokens: 0,
    p50Ms: 150,
    p95Ms: 500,
    qualityTarget: 0.92,
    qualityMinimum: 0.75,
    confidence: 0.88,
    status: 'active',
    tags: ['knowledge', 'rag', 'grounding'],
    businessModules: ['platform', 'content-agency', 'business'],
  },
  {
    id: 'context_assembly',
    name: 'Context Assembly',
    category: 'context',
    description:
      'Assemble and compress the minimal prompt context (business, client, brand, memory, knowledge) for a task.',
    owner: 'Context Intelligence Team',
    inputs: ['task', 'entityIds', 'budgetTokens'],
    outputs: ['minimalContext', 'contextScore'],
    requiredAIFeatures: ['embeddings', 'summarization'],
    costTier: 'low',
    estimatedCostUsd: 0.0004,
    estimatedInputTokens: 800,
    estimatedOutputTokens: 200,
    p50Ms: 250,
    p95Ms: 900,
    qualityTarget: 0.9,
    qualityMinimum: 0.7,
    confidence: 0.6,
    status: 'design',
    tags: ['context', 'compression', 'prompt'],
    businessModules: ['platform'],
  },
  {
    id: 'ocr_extraction',
    name: 'OCR Extraction',
    category: 'ocr',
    description:
      'Extract structured text from uploaded documents and images for content research and archiving.',
    owner: 'Document Platform Team',
    inputs: ['imageBase64', 'languageHint'],
    outputs: ['extractedText', 'layout'],
    requiredAIFeatures: ['vision'],
    costTier: 'free',
    estimatedCostUsd: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    p50Ms: 600,
    p95Ms: 2500,
    qualityTarget: 0.85,
    qualityMinimum: 0.6,
    confidence: 0.55,
    status: 'design',
    tags: ['ocr', 'documents', 'vision'],
    businessModules: ['content-agency', 'business'],
  },
  {
    id: 'vision_understanding',
    name: 'Vision Understanding',
    category: 'vision',
    description: 'Analyze brand imagery, logos, and reference visuals to keep content on-brand.',
    owner: 'AI Platform Team',
    inputs: ['imageBase64', 'analysisType'],
    outputs: ['visionInsights', 'descriptions'],
    requiredAIFeatures: ['vision', 'image_understanding'],
    costTier: 'medium',
    estimatedCostUsd: 0.004,
    estimatedInputTokens: 1200,
    estimatedOutputTokens: 300,
    p50Ms: 1800,
    p95Ms: 5000,
    qualityTarget: 0.88,
    qualityMinimum: 0.65,
    confidence: 0.5,
    status: 'design',
    tags: ['vision', 'brand', 'media'],
    businessModules: ['content-agency', 'business'],
  },

  // ── Content production pipeline ──────────────────────────────────────────
  {
    id: 'research',
    name: 'Research',
    category: 'research',
    description:
      'Gather verified facts, competitor insights, and audience research to brief a content piece.',
    owner: 'Content Agency Team',
    inputs: ['topic', 'audience', 'depth'],
    outputs: ['researchBrief', 'sources'],
    dependencies: ['knowledge_retrieval', 'memory_retrieval'],
    requiredAIFeatures: ['reasoning', 'summarization'],
    costTier: 'medium',
    estimatedCostUsd: 0.02,
    estimatedInputTokens: 4000,
    estimatedOutputTokens: 1500,
    p50Ms: 6000,
    p95Ms: 15000,
    qualityTarget: 0.9,
    qualityMinimum: 0.7,
    confidence: 0.82,
    status: 'active',
    tags: ['research', 'grounding', 'brief'],
    businessModules: ['content-agency', 'learning', 'career', 'marketing'],
  },
  {
    id: 'writing',
    name: 'Writing',
    category: 'writing',
    description:
      'Draft on-brand long-form or short-form content from a research brief and brand profile.',
    owner: 'Content Agency Team',
    inputs: ['brief', 'brandProfile', 'contentType'],
    outputs: ['draftContent'],
    dependencies: ['memory_retrieval', 'context_assembly'],
    requiredAIFeatures: ['content_generation'],
    costTier: 'medium',
    estimatedCostUsd: 0.035,
    estimatedInputTokens: 6000,
    estimatedOutputTokens: 4000,
    p50Ms: 12000,
    p95Ms: 30000,
    qualityTarget: 0.92,
    qualityMinimum: 0.75,
    confidence: 0.8,
    status: 'active',
    tags: ['writing', 'drafting', 'content'],
    businessModules: ['content-agency', 'learning', 'career', 'marketing'],
  },
  {
    id: 'review',
    name: 'Review',
    category: 'review',
    description:
      'Validate drafts for brand alignment, grammar, accuracy, and quality scoring before approval.',
    owner: 'Content Agency Team',
    inputs: ['draftContent', 'brandProfile', 'checklist'],
    outputs: ['reviewReport', 'qualityScore'],
    requiredAIFeatures: ['reasoning', 'classification'],
    costTier: 'low',
    estimatedCostUsd: 0.008,
    estimatedInputTokens: 3500,
    estimatedOutputTokens: 800,
    p50Ms: 4000,
    p95Ms: 9000,
    qualityTarget: 0.95,
    qualityMinimum: 0.8,
    confidence: 0.84,
    status: 'active',
    tags: ['review', 'quality', 'validation'],
    businessModules: ['content-agency', 'marketing'],
  },
  {
    id: 'seo_optimization',
    name: 'SEO Optimization',
    category: 'seo',
    description:
      'Optimize drafts for target keywords, structure, and readability to maximize organic reach.',
    owner: 'Marketing Team',
    inputs: ['draftContent', 'keywords'],
    outputs: ['seoReport', 'optimizedContent'],
    dependencies: ['research'],
    requiredAIFeatures: ['classification', 'reasoning'],
    costTier: 'low',
    estimatedCostUsd: 0.006,
    estimatedInputTokens: 3000,
    estimatedOutputTokens: 1200,
    p50Ms: 4500,
    p95Ms: 10000,
    qualityTarget: 0.88,
    qualityMinimum: 0.7,
    confidence: 0.78,
    status: 'active',
    tags: ['seo', 'keywords', 'optimization'],
    businessModules: ['content-agency', 'marketing'],
  },
  {
    id: 'publishing',
    name: 'Publishing',
    category: 'publishing',
    description:
      'Format, schedule, and publish approved content to target channels and deliverable formats.',
    owner: 'Content Agency Team',
    inputs: ['approvedContent', 'channelConfig'],
    outputs: ['publishedAssets', 'publicationRecord'],
    requiredAIFeatures: [],
    costTier: 'free',
    estimatedCostUsd: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    p50Ms: 800,
    p95Ms: 2000,
    qualityTarget: 0.95,
    qualityMinimum: 0.8,
    confidence: 0.9,
    status: 'active',
    tags: ['publishing', 'delivery', 'scheduling'],
    businessModules: ['content-agency', 'marketing'],
  },
  {
    id: 'translation',
    name: 'Translation',
    category: 'translation',
    description:
      'Translate approved content across supported languages while preserving brand voice.',
    owner: 'AI Platform Team',
    inputs: ['content', 'targetLanguages'],
    outputs: ['translatedContent'],
    requiredAIFeatures: ['translation'],
    costTier: 'medium',
    estimatedCostUsd: 0.015,
    estimatedInputTokens: 4000,
    estimatedOutputTokens: 4000,
    p50Ms: 8000,
    p95Ms: 20000,
    qualityTarget: 0.88,
    qualityMinimum: 0.7,
    confidence: 0.75,
    status: 'active',
    tags: ['translation', 'i18n', 'languages'],
    businessModules: ['content-agency', 'learning'],
  },
  {
    id: 'content_analytics',
    name: 'Content Analytics',
    category: 'analytics',
    description:
      'Measure content performance, delivery times, AI usage, and win rates for the business dashboard.',
    owner: 'Analytics Team',
    inputs: ['timeRange', 'filters'],
    outputs: ['analyticsReport', 'insights'],
    requiredAIFeatures: ['classification', 'summarization'],
    costTier: 'low',
    estimatedCostUsd: 0.002,
    estimatedInputTokens: 1500,
    estimatedOutputTokens: 500,
    p50Ms: 500,
    p95Ms: 1500,
    qualityTarget: 0.9,
    qualityMinimum: 0.7,
    confidence: 0.86,
    status: 'active',
    tags: ['analytics', 'reporting', 'metrics'],
    businessModules: ['content-agency', 'business', 'platform'],
  },

  // ── Composition: Content Generation = Research + Writing + Review ────────
  {
    id: 'content_generation',
    name: 'Content Generation',
    category: 'content',
    description:
      'End-to-end on-brand content production: research, drafting, and review. One capability consumed by every content-driven business module.',
    owner: 'Content Agency Team',
    inputs: ['topic', 'brandProfile', 'contentType', 'audience'],
    outputs: ['approvedContent', 'qualityReport', 'researchBrief'],
    dependencies: ['knowledge_retrieval', 'memory_retrieval', 'context_assembly'],
    requiredAIFeatures: ['content_generation', 'reasoning', 'classification'],
    costTier: 'medium',
    estimatedCostUsd: 0.06,
    estimatedInputTokens: 12000,
    estimatedOutputTokens: 6000,
    p50Ms: 18000,
    p95Ms: 45000,
    qualityTarget: 0.93,
    qualityMinimum: 0.8,
    confidence: 0.82,
    status: 'active',
    tags: ['content', 'generation', 'pipeline', 'composition'],
    businessModules: ['content-agency', 'learning', 'career', 'marketing'],
    composition: [
      { slot: 'research', id: 'research' },
      { slot: 'writing', id: 'writing' },
      { slot: 'review', id: 'review' },
    ],
  },
];

const CATALOG_EPOCH = new Date('2026-08-03T00:00:00.000Z');

/**
 * Build the seed catalog as domain Capability entities.
 * Deterministic creation timestamps keep tests and docs stable.
 */
export function createCatalogCapabilities(): Capability[] {
  return CATALOG.map((entry) =>
    Capability.create({
      id: createCapabilityId(entry.id),
      name: entry.name,
      category: entry.category,
      description: entry.description,
      owner: entry.owner,
      inputs: entry.inputs,
      outputs: entry.outputs,
      dependencies: (entry.dependencies ?? []).map((d) => createCapabilityId(d)),
      requiredAIFeatures: entry.requiredAIFeatures,
      cost: { estimatedCostUsd: entry.estimatedCostUsd, tier: entry.costTier },
      tokens: {
        estimatedInputTokens: entry.estimatedInputTokens,
        estimatedOutputTokens: entry.estimatedOutputTokens,
      },
      latency: { p50Ms: entry.p50Ms, p95Ms: entry.p95Ms },
      quality: { target: entry.qualityTarget, minimum: entry.qualityMinimum },
      confidence: entry.confidence,
      // version defaults to 1.0.0 (CapabilityVersion.initial())
      status: CapabilityStatus.fromStatus(entry.status),
      tags: entry.tags,
      businessModules: entry.businessModules,
      documentationUrl: entry.documentationUrl,
      composition: (entry.composition ?? []).map((c) => ({
        id: createCapabilityId(c.id),
        slot: c.slot,
      })),
      createdAt: CATALOG_EPOCH,
      updatedAt: CATALOG_EPOCH,
    }),
  );
}

/** Total seed catalog size (used by docs/tests). */
export const CATALOG_SIZE = CATALOG.length;
