// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Validation Schemas
// Zod schemas for all decision API request validation
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { z } from 'zod';

// ── Category Enum ──────────────────────────────────────────────────────────

const decisionCategorySchema = z.enum([
  'strategic',
  'tactical',
  'operational',
  'technical',
  'business',
  'career',
  'learning',
  'personal',
]);

// ── Decision Schemas ─────────────────────────────────────────────────────────

export const createDecisionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  category: decisionCategorySchema,
  priorityScore: z.number().min(0).max(10).optional(),
  initiator: z.string().optional(),
  requester: z.string().optional(),
  requestReason: z.string().optional(),
  requestContext: z.string().optional(),
  knowledgeNodeIds: z.array(z.string()).optional(),
  memoryIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateDecisionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  priorityScore: z.number().min(0).max(10).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const addOptionSchema = z.object({
  label: z.string().min(1).max(200),
  description: z.string(),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  estimatedEffort: z.string().optional(),
  estimatedCost: z.string().optional(),
});

export const scoreOptionSchema = z.object({
  optionId: z.string(),
  criteria: z.array(
    z.object({
      criterion: z.string(),
      score: z.number().min(0).max(100),
      weight: z.number().min(0).max(1),
    }),
  ),
});

export const assessRiskSchema = z.object({
  optionId: z.string(),
  riskScore: z.number().min(0).max(1),
  description: z.string(),
  mitigation: z.string().optional(),
});

export const assessOpportunitySchema = z.object({
  optionId: z.string(),
  opportunityScore: z.number().min(0).max(1),
  description: z.string(),
  expectedValue: z.string().optional(),
});

export const decideSchema = z.object({
  optionId: z.string(),
  reasoningMethod: z.string(),
  reasoningSummary: z.string(),
  assumptions: z.array(z.string()).optional(),
  pros: z.array(z.string()).optional(),
  cons: z.array(z.string()).optional(),
});

export const completeDecisionSchema = z.object({
  result: z.enum(['success', 'partial', 'neutral', 'failure', 'unknown']),
  description: z.string(),
  actualImpact: z.string().optional(),
  lessons: z.array(z.string()).optional(),
});

export const mergeDecisionsSchema = z.object({
  sourceIds: z.array(z.string()).min(2).max(20),
  targetTitle: z.string().min(1).max(200),
  targetDescription: z.string().optional(),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchQuery = z.object({
  q: z.string().optional(),
  category: decisionCategorySchema.optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
