// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Engine Integration Client
// Consumes ONLY BLD-007 contracts.
// Retrieves experiences, timeline entries, observations, past decisions.
// Never modifies memories directly.
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { getDecisionConfig } from '../config/DecisionConfig.js';
import { withRetry } from '../utils/DecisionUtils.js';
import { EXTERNAL_API_PATHS } from '../constants/DecisionConstants.js';
import { logger } from '@vedmoulya/core';
import type { MemoryResult } from '../types/DecisionTypes.js';

export interface PastDecisionData {
  memoryId: string;
  decisionId: string;
  title: string;
  outcome: string;
  confidence: number;
  timestamp: Date;
  feedback?: string;
}

export interface ExperienceData {
  memoryId: string;
  content: string;
  category: string;
  importance: number;
  confidence: number;
  timestamp: Date;
}

export interface MemoryIntegrationData {
  pastDecisions: PastDecisionData[];
  relevantExperiences: ExperienceData[];
  observations: string[];
}

export class MemoryEngineClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retryCount: number;
  private readonly enabled: boolean;

  constructor() {
    const config = getDecisionConfig().memory;
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeoutMs;
    this.retryCount = config.retryCount;
    this.enabled = config.enabled;
  }

  /** Check if the Memory Engine integration is enabled */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Retrieve memory context relevant to a decision */
  async getMemoryContext(decisionId: string, userId: string): Promise<MemoryIntegrationData> {
    if (!this.enabled) {
      return { pastDecisions: [], relevantExperiences: [], observations: [] };
    }

    try {
      const pastDecisions = await this.getPastDecisions(userId);
      const relevantExperiences = await this.getRelevantExperiences(userId, decisionId);

      return {
        pastDecisions,
        relevantExperiences,
        observations: relevantExperiences.map((e) => e.content),
      };
    } catch (error) {
      logger.warn('Failed to retrieve memory context', {
        decisionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { pastDecisions: [], relevantExperiences: [], observations: [] };
    }
  }

  /** Retrieve past decisions from memory */
  async getPastDecisions(userId: string): Promise<PastDecisionData[]> {
    if (!this.enabled) return [];

    try {
      const response = await withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, this.timeout);

          try {
            const res = await fetch(`${this.baseUrl}${EXTERNAL_API_PATHS.MEMORY.QUERY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                intent: 'past_decision',
                context: { userId },
                minConfidence: 0.3,
                limit: 20,
              }),
              signal: controller.signal,
            });

            if (!res.ok) throw new Error(`Memory query returned ${String(res.status)}`);
            const data = (await res.json()) as { results: MemoryResult[] };
            return data;
          } finally {
            clearTimeout(timeoutId);
          }
        },
        { maxRetries: this.retryCount, baseDelayMs: 200 },
      );

      return response.results
        .filter((r) => r.type === 'decision')
        .map((r) => ({
          memoryId: r.memoryId,
          decisionId: r.content,
          title: r.content,
          outcome: r.type,
          confidence: r.confidence,
          timestamp: r.timestamp,
        }));
    } catch (error) {
      logger.warn('Failed to retrieve past decisions', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /** Retrieve relevant experiences from memory */
  async getRelevantExperiences(userId: string, _context?: string): Promise<ExperienceData[]> {
    if (!this.enabled) return [];

    try {
      const response = await withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, this.timeout);

          try {
            const res = await fetch(`${this.baseUrl}${EXTERNAL_API_PATHS.MEMORY.CONTEXT}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId,
                contextType: 'relevant',
                maxMemories: 10,
              }),
              signal: controller.signal,
            });

            if (!res.ok) throw new Error(`Memory context returned ${String(res.status)}`);
            return (await res.json()) as { memories: ExperienceData[] };
          } finally {
            clearTimeout(timeoutId);
          }
        },
        { maxRetries: this.retryCount, baseDelayMs: 200 },
      );

      return response.memories;
    } catch (error) {
      logger.warn('Failed to retrieve relevant experiences', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
