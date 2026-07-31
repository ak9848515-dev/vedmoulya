// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Orchestrator Integration Client
// Uses ONLY BLD-005 contracts.
// AI may assist with reasoning, but Decision Engine owns the
// final decision model. Never allows providers to bypass
// decision policies, constraints, confidence scoring,
// explainability, or risk assessment.
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { getDecisionConfig } from '../config/DecisionConfig.js';
import { withRetry } from '../utils/DecisionUtils.js';
import { EXTERNAL_API_PATHS } from '../constants/DecisionConstants.js';
import { logger } from '@vedmoulya/core';
import type { AIReasoningRequest, AIReasoningResponse } from '../types/DecisionTypes.js';

export interface AIAnalysisResult {
  content: string;
  confidence: number;
  provider: string;
  traceId: string;
}

export class AIOrchestratorClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retryCount: number;
  private readonly enabled: boolean;
  private readonly defaultQualityTier: string;

  constructor() {
    const config = getDecisionConfig().aiOrchestrator;
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeoutMs;
    this.retryCount = 2;
    this.enabled = config.enabled;
    this.defaultQualityTier = config.defaultQualityTier;
  }

  /** Check if the AI Orchestrator integration is enabled */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Request AI-assisted reasoning for a decision */
  async requestReasoning(input: AIReasoningRequest): Promise<AIAnalysisResult> {
    if (!this.enabled) {
      return { content: '', confidence: 0, provider: 'none', traceId: '' };
    }

    try {
      const response = await withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, this.timeout);

          try {
            const res = await fetch(
              `${this.baseUrl}${EXTERNAL_API_PATHS.ORCHESTRATOR.CAPABILITY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  capability: input.capability,
                  userInput: input.userInput,
                  userId: input.context.userId,
                  qualityTier: input.qualityTier ?? this.defaultQualityTier,
                  constraints: input.constraints,
                  context: input.context,
                  requestId: input.requestId,
                }),
                signal: controller.signal,
              },
            );

            if (!res.ok) {
              throw new Error(`Orchestrator returned ${String(res.status)}`);
            }

            return (await res.json()) as AIReasoningResponse;
          } finally {
            clearTimeout(timeoutId);
          }
        },
        { maxRetries: this.retryCount, baseDelayMs: 200 },
      );

      logger.info('AI reasoning completed', {
        capability: input.capability,
        provider: response.provider,
        confidence: response.confidence,
      });

      return {
        content: response.content,
        confidence: response.confidence,
        provider: response.provider,
        traceId: response.traceId,
      };
    } catch (error) {
      logger.warn('AI reasoning failed', {
        capability: input.capability,
        error: error instanceof Error ? error.message : String(error),
      });

      // Decision Engine owns the final decision — AI failure doesn't block decisions
      return {
        content: '',
        confidence: 0,
        provider: 'none',
        traceId: '',
      };
    }
  }

  /** Generate natural language options from analysis data */
  async generateOptions(decisionContext: Record<string, unknown>): Promise<string[]> {
    const result = await this.requestReasoning({
      capability: 'option_generation',
      userInput: 'Generate decision options based on the provided context.',
      context: { ...decisionContext, purpose: 'option_generation' },
      constraints: { format: 'list' },
    });

    if (result.confidence < 0.3 || !result.content) {
      return [];
    }

    // Parse options from AI response
    return result.content
      .split('\n')
      .filter(
        (line) =>
          line.trim().startsWith('-') || line.trim().startsWith('*') || /^\d+\./.test(line.trim()),
      )
      .map((line) => line.replace(/^[-*\d.]+/, '').trim())
      .filter(Boolean);
  }

  /** Generate natural language explanation for a decision */
  async generateExplanation(decisionData: Record<string, unknown>): Promise<string> {
    const result = await this.requestReasoning({
      capability: 'explanation',
      userInput: 'Generate a clear, concise explanation for this decision.',
      context: { ...decisionData, purpose: 'explanation' },
      constraints: { format: 'text', maxLength: 500 },
    });

    return result.confidence >= 0.3 ? result.content : '';
  }
}
