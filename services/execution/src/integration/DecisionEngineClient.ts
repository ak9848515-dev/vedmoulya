// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Engine Integration Client
// Consumes ONLY BLD-008 contracts.
// Execution never creates decisions. Execution only executes approved decisions.
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { logger } from '@vedmoulya/core';

export interface DecisionInfo {
  decisionId: string;
  title: string;
  selectedOption: string;
  confidence: number;
  status: string;
}

export class DecisionEngineClient {
  private readonly baseUrl: string;
  private readonly enabled: boolean;

  constructor() {
    this.baseUrl = process.env.DECISION_SERVICE_URL ?? 'http://localhost:4005';
    this.enabled = process.env.EXECUTION_DECISION_ENABLED !== 'false';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Retrieve decision information for linking to a plan */
  async getDecisionInfo(decisionId: string): Promise<DecisionInfo | null> {
    if (!this.enabled) return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/decision/decisions/${decisionId}`);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        data?: {
          id: string;
          title: string;
          selectedOption?: { label: string };
          confidence: { score: number };
          status: string;
        };
      };
      if (!data.data) return null;
      return {
        decisionId: data.data.id,
        title: data.data.title,
        selectedOption: data.data.selectedOption?.label ?? '',
        confidence: data.data.confidence.score,
        status: data.data.status,
      };
    } catch (error) {
      logger.warn('Failed to retrieve decision info', {
        decisionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
