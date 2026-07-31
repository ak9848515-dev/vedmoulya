// ──────────────────────────────────────────────────────────────────
// VedMoulya — AIRequest Factory
// Creates and reconstructs AIRequest aggregate roots
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import { AIRequest } from '../entities/AIRequest.js';
import { AIRequestId } from '../value-objects/AIRequestId.js';
import { Capability } from '../value-objects/Capability.js';
import { Prompt } from '../value-objects/Prompt.js';
import type { QualityTier, CapabilityType } from '../../types/index.js';

export interface CreateAIRequestParams {
  id?: string;
  capability: CapabilityType;
  systemInstructions: string;
  userInput: string;
  userContext?: string;
  taskContext?: string;
  constraints?: string[];
  safetyInstructions?: string[];
  qualityTier: QualityTier;
  userId?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

export class AIRequestFactory {
  /**
   * Create a new AIRequest for execution
   */
  createNewRequest(params: CreateAIRequestParams): AIRequest {
    const prompt = Prompt.create({
      systemInstructions: params.systemInstructions,
      userContext: params.userContext,
      taskContext: params.taskContext,
      constraints: params.constraints,
      safetyInstructions: params.safetyInstructions,
      userInput: params.userInput,
    });

    return AIRequest.create({
      id: params.id ? AIRequestId.create(params.id) : undefined,
      capability: Capability.create(params.capability),
      prompt,
      qualityTier: params.qualityTier,
      userId: params.userId,
      conversationId: params.conversationId,
      constraints: {},
      metadata: params.metadata ?? {},
    });
  }
}
