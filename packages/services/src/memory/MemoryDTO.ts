// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Application DTOs
// Data Transfer Objects for the Memory Engine application layer
// ──────────────────────────────────────────────────────────────────

import type { MemoryStateValue } from '@vedmoulya/domain';
import type { MemoryCategoryValue } from '@vedmoulya/domain';

// ── Command DTOs ─────────────────────────────────────────────────────────

export interface CreateMemoryDTO {
  category: string;
  title: string;
  content: string;
  importanceScore?: number;
  confidenceScore?: number;
  sourceType?: string;
  sourceDetail?: string;
  knowledgeNodeId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  retentionClass?: string;
}

export interface UpdateMemoryDTO {
  title?: string;
  content?: string;
  category?: string;
  importanceScore?: number;
  confidenceScore?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface RecallMemoryDTO {
  success: boolean;
}

// ── Query DTOs ───────────────────────────────────────────────────────────

export interface MemoryQueryDTO {
  query?: string;
  categories?: MemoryCategoryValue[];
  states?: MemoryStateValue[];
  importanceMin?: number;
  importanceMax?: number;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  knowledgeNodeId?: string;
  page?: number;
  limit?: number;
}

export interface TimelineQueryDTO {
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// ── Response DTOs ─────────────────────────────────────────────────────────

export interface MemoryDTO {
  id: string;
  category: string;
  title: string;
  content: string;
  importance: { level: string; score: number };
  confidence: { level: string; score: number };
  strength: { value: number; interval: number; easeFactor: number };
  state: string;
  source: { type: string; detail: string };
  version: string;
  retentionPolicy: string;
  knowledgeNodeId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastRecalledAt?: string;
}

export interface MemoryListDTO {
  data: MemoryDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TimelineEntryDTO {
  memory: MemoryDTO;
  date: string;
  type: 'created' | 'recalled' | 'updated' | 'archived';
}

export interface MemoryStatsDTO {
  total: number;
  byCategory: Record<string, number>;
  byState: Record<string, number>;
  linkedCount: number;
}

export interface DecayResultDTO {
  memoryId: string;
  previousStrength: number;
  newStrength: number;
  transitioned: boolean;
  newState?: string;
}

export interface ConsolidationSuggestionDTO {
  sourceId: string;
  targetId: string;
  reason: string;
  confidence: number;
}

export interface RetentionResultDTO {
  archived: number;
  forgotten: number;
}

// ── Contract Events ──────────────────────────────────────────────────────

export interface MemoryContractEvent {
  type:
    | 'memory.created'
    | 'memory.recalled'
    | 'memory.archived'
    | 'memory.forgotten'
    | 'memory.consolidated';
  memoryId: string;
  timestamp: string;
  data: Record<string, unknown>;
}
