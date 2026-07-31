// ──────────────────────────────────────────────────────────────────
// VedMoulya — AIRequest Repository Interface
// Repository contract for AI request persistence
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import type { AIRequest } from '../entities/AIRequest.js';
import type { AIRequestId } from '../value-objects/AIRequestId.js';
import type { PaginationParams, PaginatedResult } from '@vedmoulya/core';

export interface AIRequestRepository {
  findById(id: AIRequestId): Promise<AIRequest | null>;
  save(request: AIRequest): Promise<void>;
  update(request: AIRequest): Promise<void>;
  delete(id: AIRequestId): Promise<void>;
  list(params: PaginationParams): Promise<PaginatedResult<AIRequest>>;
  findByUserId(userId: string, params: PaginationParams): Promise<PaginatedResult<AIRequest>>;
  countByStatus(status: string): Promise<number>;
  countByProvider(providerId: string): Promise<number>;
}
