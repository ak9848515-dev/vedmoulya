// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Contracts
// Integration contract types for the Memory Engine
// BLD-005 — AI Orchestrator Integration (use only BLD-005 contracts)
// BLD-006 — Knowledge Graph Integration (never duplicate knowledge)
// ──────────────────────────────────────────────────────────────────

import type { MemoryCategoryValue, MemoryStateValue } from '@vedmoulya/domain';

// ── Query Contracts ───────────────────────────────────────────────────────

export interface MemoryQuery {
  query: string;
  categories?: MemoryCategoryValue[];
  states?: MemoryStateValue[];
  importanceMin?: number;
  limit?: number;
}

export interface MemoryContextQuery {
  userId: string;
  contextType: 'conversation' | 'reflection' | 'timeline' | 'relevant';
  maxMemories?: number;
  timeRange?: { from?: string; to?: string };
}

// ── Command Contracts ─────────────────────────────────────────────────────

export interface CaptureMemoryCommand {
  userId: string;
  category: string;
  title: string;
  content: string;
  importanceScore?: number;
  sourceType?: string;
  sourceDetail?: string;
  knowledgeNodeId?: string;
  tags?: string[];
}

export interface RecallMemoryCommand {
  memoryId: string;
  success: boolean;
}

// ── Result Contracts ──────────────────────────────────────────────────────

export interface MemoryContextResult {
  memories: Array<{
    id: string;
    title: string;
    content: string;
    category: string;
    importance: number;
    timestamp: string;
    knowledgeNodeId?: string;
  }>;
  total: number;
}

export interface MemoryContractMessage {
  type: 'memory_context' | 'memory_captured' | 'memory_recalled' | 'reflection';
  payload: Record<string, unknown>;
}

export interface MemoryContractResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
