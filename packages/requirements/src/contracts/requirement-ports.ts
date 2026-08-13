// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence & Requirements Engine: Ports
// EPIC-009. The engines execute NO AI directly. An optional
// enrichment port lets the gateway feed the frozen AI runtime for
// intent enrichment; when absent the pipeline is fully deterministic.
// Sessions persist through an owner-scoped store (in-memory hermetic
// + Postgres in production) mirroring the app-factory repository.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type { RequirementSession } from '../types/requirement-types.js';

/** Owner-scoped session persistence (never cross-user). */
export interface RequirementSessionStore {
  save(session: RequirementSession): Promise<void>;
  get(sessionId: string): Promise<RequirementSession | undefined>;
  /** Owner-scoped listing. */
  list(owner?: string): Promise<RequirementSession[]>;
  delete(sessionId: string): Promise<boolean>;
}

/** Optional AI enrichment over the frozen AI runtime. When absent the
 *  pipeline is deterministic (this is the baseline tests exercise). */
export interface RequirementEnrichmentPort {
  enrich(input: { idea: string; archetype: AppArchetype; userId: string }): Promise<{
    additionalFeatures: string[];
    additionalIntegrations: string[];
    additionalConstraints: string[];
    confident: boolean;
    provider: string;
    model: string;
    tokens: number;
    costUsd: number;
  }>;
}

export interface ClockPort {
  now(): string;
}

export const SYSTEM_CLOCK: ClockPort = {
  now: (): string => new Date().toISOString(),
};
