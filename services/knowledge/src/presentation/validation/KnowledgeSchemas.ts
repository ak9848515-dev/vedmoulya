// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Validation Schemas
// Zod schemas for request/response validation
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import { z } from 'zod';

// ── Common ─────────────────────────────────────────────────────────────────

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const graphIdParam = z.object({
  id: z.string().min(1, 'Graph ID is required'),
});

export const nodeIdParam = z.object({
  id: z.string().min(1, 'Node ID is required'),
});

export const edgeIdParam = z.object({
  id: z.string().min(1, 'Edge ID is required'),
});

// ── Knowledge Categories ──────────────────────────────────────────────────

export const knowledgeCategorySchema = z.enum([
  'user',
  'goal',
  'skill',
  'knowledge',
  'mission',
  'project',
  'task',
  'habit',
  'learning',
  'course',
  'book',
  'career',
  'job',
  'interview',
  'company',
  'business',
  'client',
  'service',
  'income',
  'expense',
  'decision',
  'problem',
  'opportunity',
  'achievement',
  'milestone',
  'portfolio',
  'document',
  'conversation',
  'memory',
  'relationship',
  'timeline_event',
  'competency',
  'evidence',
  'artifact',
  'reference',
]);

// ── Relationship Categories ───────────────────────────────────────────────

export const relationshipCategorySchema = z.enum([
  'ownership',
  'progression',
  'dependency',
  'causality',
  'composition',
  'association',
  'temporal',
]);

// ── Graph Management ──────────────────────────────────────────────────────

export const createGraphSchema = z.object({
  label: z.string().min(1, 'Graph label is required').max(200),
  description: z.string().max(2000).optional(),
});

// ── Node Management ───────────────────────────────────────────────────────

export const createNodeSchema = z.object({
  graphId: z.string().min(1, 'Graph ID is required'),
  category: knowledgeCategorySchema,
  label: z.string().min(1, 'Node label is required').max(200),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
  sourceType: z.string().optional(),
  sourceDetail: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateNodeSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  category: knowledgeCategorySchema.optional(),
});

// ── Edge Management ───────────────────────────────────────────────────────

export const createEdgeSchema = z.object({
  graphId: z.string().min(1, 'Graph ID is required'),
  sourceId: z.string().min(1, 'Source node ID is required'),
  targetId: z.string().min(1, 'Target node ID is required'),
  relationshipType: z.string().min(1, 'Relationship type is required'),
  relationshipCategory: relationshipCategorySchema,
  label: z.string().max(200).optional(),
  weight: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
  sourceType: z.string().optional(),
  sourceDetail: z.string().optional(),
});

// ── Traversal ─────────────────────────────────────────────────────────────

export const traverseQuery = z.object({
  maxDepth: z.coerce.number().int().positive().max(20).default(5),
});

export const shortestPathQuery = z.object({
  endNodeId: z.string().min(1, 'End node ID is required'),
});

// ── Operations ────────────────────────────────────────────────────────────

export const mergeNodesSchema = z.object({
  sourceId: z.string().min(1, 'Source node ID is required'),
  targetId: z.string().min(1, 'Target node ID is required'),
  mergedLabel: z.string().min(1, 'Merged label is required').max(200),
  mergedDescription: z.string().max(2000).optional(),
});

export const splitNodeSchema = z.object({
  nodeId: z.string().min(1, 'Node ID is required'),
  firstLabel: z.string().min(1, 'First label is required').max(200),
  secondLabel: z.string().min(1, 'Second label is required').max(200),
  firstDescription: z.string().max(2000).optional(),
  secondDescription: z.string().max(2000).optional(),
  edgesForFirst: z.array(z.string()),
  edgesForSecond: z.array(z.string()),
});

// ── Search ────────────────────────────────────────────────────────────────

export const searchQuery = z.object({
  q: z.string().min(1, 'Search query is required'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: knowledgeCategorySchema.optional(),
  status: z.string().optional(),
  tags: z.string().optional(), // comma-separated
});

// ── Inferred Types ────────────────────────────────────────────────────────

export type CreateGraphInput = z.infer<typeof createGraphSchema>;
export type CreateNodeInput = z.infer<typeof createNodeSchema>;
export type UpdateNodeInput = z.infer<typeof updateNodeSchema>;
export type CreateEdgeInput = z.infer<typeof createEdgeSchema>;
export type MergeNodesInput = z.infer<typeof mergeNodesSchema>;
export type SplitNodeInput = z.infer<typeof splitNodeSchema>;
export type SearchInput = z.infer<typeof searchQuery>;
export type PaginationInput = z.infer<typeof paginationQuery>;
