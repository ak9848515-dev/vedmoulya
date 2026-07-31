// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Graph Integration Client
// Reads goals, projects, skills, context from Knowledge Graph
// Never modifies semantic knowledge directly.
// BLD-006 — Knowledge Graph Integration (read only)
// ──────────────────────────────────────────────────────────────────

import { logger } from '@vedmoulya/core';

interface KGSearchResponse {
  data?: Array<{
    id: string;
    label: string;
    description?: string;
    properties?: Record<string, unknown>;
  }>;
  metadata?: { totalResults: number };
}

export class KnowledgeGraphClient {
  private readonly baseUrl: string;
  private readonly enabled: boolean;

  constructor() {
    this.baseUrl = process.env.KNOWLEDGE_SERVICE_URL ?? 'http://localhost:4003';
    this.enabled = process.env.EXECUTION_KNOWLEDGE_ENABLED !== 'false';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Retrieve goals from Knowledge Graph for planning */
  async getGoals(
    userId: string,
  ): Promise<Array<{ id: string; label: string; description: string; priority: number }>> {
    if (!this.enabled) return [];
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/knowledge/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '', filters: { categories: ['goal'] }, page: 1, limit: 50 }),
      });
      if (!res.ok) return [];
      const body = (await res.json()) as KGSearchResponse;
      if (!body.data?.length) return [];
      return body.data.map((g) => ({
        id: g.id,
        label: g.label,
        description: g.description ?? '',
        priority: typeof g.properties?.priority === 'number' ? g.properties.priority : 5,
      }));
    } catch (error) {
      logger.warn('Failed to fetch goals from Knowledge Graph', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /** Retrieve projects from Knowledge Graph */
  async getProjects(userId: string): Promise<Array<{ id: string; name: string; status: string }>> {
    if (!this.enabled) return [];
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/knowledge/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '',
          filters: { categories: ['project'] },
          page: 1,
          limit: 50,
        }),
      });
      if (!res.ok) return [];
      const body = (await res.json()) as KGSearchResponse;
      if (!body.data?.length) return [];
      return body.data.map((p) => ({
        id: p.id,
        name: p.label,
        status: typeof p.properties?.status === 'string' ? p.properties.status : 'active',
      }));
    } catch (error) {
      logger.warn('Failed to fetch projects from Knowledge Graph', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
