// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Seed Catalog
// EI-005 — Enterprise Execution Orchestrator
// Realistic seed data: worker fleet + a sample blog-generation graph
// input derived from the EI-004 strategy conventions. Used for dev,
// the web explorer, and tests.
// ──────────────────────────────────────────────────────────────────

import type { ExecutionGraphInput, ExecutionWorker } from '../types/orchestrator-types.js';

export const SEED_WORKER_COUNT = 11;

/** The platform worker fleet (research → writing → review → …). */
export function createCatalogWorkers(): ExecutionWorker[] {
  const defs: Array<
    Omit<ExecutionWorker, 'workerId' | 'status' | 'activeTasks' | 'health' | 'metadata'>
  > = [
    {
      kind: 'research',
      name: 'Research Worker',
      capabilities: ['reasoning', 'summarization'],
      concurrency: 4,
    },
    {
      kind: 'writing',
      name: 'Writing Worker',
      capabilities: ['content_generation'],
      concurrency: 3,
    },
    {
      kind: 'review',
      name: 'Review Worker',
      capabilities: ['reasoning', 'classification'],
      concurrency: 3,
    },
    { kind: 'seo', name: 'SEO Worker', capabilities: ['classification'], concurrency: 2 },
    {
      kind: 'publishing',
      name: 'Publishing Worker',
      capabilities: ['content_generation'],
      concurrency: 2,
    },
    {
      kind: 'translation',
      name: 'Translation Worker',
      capabilities: ['translation'],
      concurrency: 2,
    },
    {
      kind: 'ocr',
      name: 'OCR Worker',
      capabilities: ['vision', 'image_understanding'],
      concurrency: 2,
    },
    {
      kind: 'vision',
      name: 'Vision Worker',
      capabilities: ['vision', 'image_understanding'],
      concurrency: 2,
    },
    { kind: 'memory', name: 'Memory Worker', capabilities: ['embeddings'], concurrency: 3 },
    {
      kind: 'knowledge',
      name: 'Knowledge Worker',
      capabilities: ['embeddings', 'summarization'],
      concurrency: 3,
    },
    {
      kind: 'custom',
      name: 'Custom Worker',
      capabilities: ['coding', 'general_conversation'],
      concurrency: 2,
    },
  ];
  return defs.map((d, idx) => ({
    ...d,
    workerId: `worker_${d.kind}_${String(idx + 1).padStart(2, '0')}`,
    status: 'idle' as const,
    activeTasks: 0,
    health: 0.95 + (idx % 3) * 0.02,
    metadata: { seed: true },
  }));
}

/** Blog-generation graph input (mirrors the EI-004 blog strategy). */
export function createBlogGraphInput(): ExecutionGraphInput {
  return {
    strategyId: 'strategy_blog_seed',
    goalId: 'goal_blog_001',
    goal: 'Generate a blog post about microservices architecture',
    steps: [
      {
        stepId: 'research',
        capability: 'reasoning',
        label: 'Research',
        flowType: 'sequential',
        weight: 0.25,
        eligibleFamilies: ['anthropic', 'openai', 'google'],
      },
      {
        stepId: 'writing',
        capability: 'content_generation',
        label: 'Writing',
        flowType: 'sequential',
        weight: 0.3,
        eligibleFamilies: ['anthropic', 'openai', 'google'],
      },
      {
        stepId: 'seo',
        capability: 'classification',
        label: 'SEO',
        flowType: 'parallel',
        weight: 0.15,
        eligibleFamilies: ['openai', 'deepseek'],
      },
      {
        stepId: 'review',
        capability: 'reasoning',
        label: 'Review',
        flowType: 'parallel',
        weight: 0.15,
        eligibleFamilies: ['anthropic', 'openai'],
      },
      {
        stepId: 'publishing',
        capability: 'content_generation',
        label: 'Publishing',
        flowType: 'sequential',
        weight: 0.15,
        eligibleFamilies: ['openai'],
      },
    ],
    mode: 'hybrid',
    priority: 'high',
    maxRetries: 2,
    retryDelayMs: 1000,
    maxLatencyMs: 30000,
    expectedTokens: 8000,
    maxCostUsd: 2,
  };
}

/** Newsletter graph input (second seed used by the explorer). */
export function createNewsletterGraphInput(): ExecutionGraphInput {
  return {
    strategyId: 'strategy_newsletter_seed',
    goalId: 'goal_newsletter_001',
    goal: 'Generate a monthly client newsletter',
    steps: [
      {
        stepId: 'research',
        capability: 'reasoning',
        label: 'Research',
        flowType: 'sequential',
        weight: 0.3,
        eligibleFamilies: ['openai', 'google'],
      },
      {
        stepId: 'writing',
        capability: 'content_generation',
        label: 'Writing',
        flowType: 'sequential',
        weight: 0.4,
        eligibleFamilies: ['openai'],
      },
      {
        stepId: 'review',
        capability: 'reasoning',
        label: 'Review',
        flowType: 'sequential',
        weight: 0.2,
        eligibleFamilies: ['anthropic', 'openai'],
      },
      {
        stepId: 'publishing',
        capability: 'content_generation',
        label: 'Publishing',
        flowType: 'sequential',
        weight: 0.1,
        eligibleFamilies: ['openai'],
      },
    ],
    mode: 'sequential',
    priority: 'medium',
    maxRetries: 1,
    retryDelayMs: 2000,
    maxLatencyMs: 20000,
    expectedTokens: 6000,
    maxCostUsd: 1.5,
  };
}
