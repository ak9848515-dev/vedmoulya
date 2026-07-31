// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Graph Integration Client
// Consumes ONLY BLD-006 contracts.
// Retrieves goals, skills, relationships, projects, and context.
// Never modifies Knowledge Graph directly.
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { getDecisionConfig } from '../config/DecisionConfig.js';
import { withRetry } from '../utils/DecisionUtils.js';
import { EXTERNAL_API_PATHS } from '../constants/DecisionConstants.js';
import { logger } from '@vedmoulya/core';
import type { KnowledgeQueryResponse, KnowledgeResult } from '../types/DecisionTypes.js';

export interface GoalData {
  id: string;
  label: string;
  description: string;
  priority: number;
  deadline?: Date;
  status: string;
}

export interface SkillData {
  id: string;
  name: string;
  level: number;
  category: string;
}

export interface ProjectData {
  id: string;
  name: string;
  description: string;
  status: string;
  skills: string[];
}

export interface KnowledgeContextData {
  goals: GoalData[];
  skills: SkillData[];
  projects: ProjectData[];
  relevantKnowledge: KnowledgeResult[];
}

export class KnowledgeGraphClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retryCount: number;
  private readonly enabled: boolean;

  constructor() {
    const config = getDecisionConfig().knowledge;
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeoutMs;
    this.retryCount = config.retryCount;
    this.enabled = config.enabled;
  }

  /** Check if the Knowledge Graph integration is enabled */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Retrieve decision-relevant context from Knowledge Graph */
  async getDecisionContext(userId: string, category?: string): Promise<KnowledgeContextData> {
    if (!this.enabled) {
      return { goals: [], skills: [], projects: [], relevantKnowledge: [] };
    }

    try {
      const response = await withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, this.timeout);

          try {
            const res = await fetch(`${this.baseUrl}${EXTERNAL_API_PATHS.KNOWLEDGE.CONTEXT}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                intent: 'decision',
                context: { userId, category },
                depth: 'standard',
              }),
              signal: controller.signal,
            });

            if (!res.ok) {
              throw new Error(`Knowledge Graph returned ${String(res.status)}`);
            }

            return (await res.json()) as {
              goals: GoalData[];
              skills: SkillData[];
              projects: ProjectData[];
              knowledge: { results: KnowledgeResult[] };
            };
          } finally {
            clearTimeout(timeoutId);
          }
        },
        { maxRetries: this.retryCount, baseDelayMs: 200 },
      );

      logger.info('Decision context retrieved from Knowledge Graph', {
        userId,
        goalsCount: response.goals.length,
        skillsCount: response.skills.length,
      });

      return {
        goals: response.goals,
        skills: response.skills,
        projects: response.projects,
        relevantKnowledge: response.knowledge.results,
      };
    } catch (error) {
      logger.warn('Failed to retrieve decision context from Knowledge Graph', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { goals: [], skills: [], projects: [], relevantKnowledge: [] };
    }
  }

  /** Query specific knowledge nodes for decision support */
  async queryKnowledge(query: string, scope?: string): Promise<KnowledgeQueryResponse> {
    if (!this.enabled) {
      return {
        results: [],
        metadata: { totalResults: 0, qualityRange: { min: 0, max: 0 }, queryTime: 0 },
      };
    }

    try {
      const response = await withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, this.timeout);

          try {
            const res = await fetch(`${this.baseUrl}${EXTERNAL_API_PATHS.KNOWLEDGE.SEARCH}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query, scope, qualityThreshold: 0.5 }),
              signal: controller.signal,
            });

            if (!res.ok) {
              throw new Error(`Knowledge search returned ${String(res.status)}`);
            }

            return (await res.json()) as KnowledgeQueryResponse;
          } finally {
            clearTimeout(timeoutId);
          }
        },
        { maxRetries: this.retryCount, baseDelayMs: 200 },
      );

      return response;
    } catch (error) {
      logger.warn('Knowledge query failed', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        results: [],
        metadata: { totalResults: 0, qualityRange: { min: 0, max: 0 }, queryTime: 0 },
      };
    }
  }

  /** Retrieve goals for a user */
  async getGoals(userId: string): Promise<GoalData[]> {
    const context = await this.getDecisionContext(userId);
    return context.goals;
  }

  /** Retrieve skills for a user */
  async getSkills(userId: string): Promise<SkillData[]> {
    const context = await this.getDecisionContext(userId);
    return context.skills;
  }
}
