// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Validation Schemas
// Zod schemas for all memory API request validation
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { z } from 'zod';

// ── Category Enum ──────────────────────────────────────────────────────────

const memoryCategorySchema = z.enum([
  'experience',
  'observation',
  'history',
  'reflection',
  'context',
  'conversation',
  'learning',
  'insight',
  'feedback',
  'decision',
]);

// ── Memory Schemas ─────────────────────────────────────────────────────────

export const captureMemorySchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  category: memoryCategorySchema,
  sourceType: z.string().optional(),
  sourceDetail: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  importanceScore: z.number().min(0).max(10).optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  knowledgeNodeId: z.string().optional(),
  retentionClass: z.enum(['permanent', 'long_term', 'short_term', 'transient']).optional(),
});

export const updateMemorySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  importanceScore: z.number().min(0).max(10).optional(),
});

export const mergeMemoriesSchema = z.object({
  sourceIds: z.array(z.string()).min(2).max(20),
  targetLabel: z.string().min(1).max(200),
  targetDescription: z.string().optional(),
  targetContent: z.string().optional(),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchQuery = z.object({
  q: z.string().optional(),
  category: memoryCategorySchema.optional(),
  state: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const timelineQuery = z.object({
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const recallQuery = z.object({
  strengthen: z
    .preprocess((val) => {
      if (val === 'false' || val === '0') return false;
      if (val === 'true' || val === '1') return true;
      return val;
    }, z.boolean())
    .default(true),
});
