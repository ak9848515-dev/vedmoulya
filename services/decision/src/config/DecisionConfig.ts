// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Engine Configuration
// Centralized configuration for the Decision Intelligence Engine
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { config, requireProdExternalUrl } from '@vedmoulya/core';

export interface DatabaseConfig {
  url: string;
  poolMax: number;
  ssl: boolean | 'require';
}

export interface CacheConfig {
  defaultTTLms: number;
  maxSize: number;
}

export interface ScoringConfig {
  defaultPriorityScore: number;
  minPriorityScore: number;
  maxPriorityScore: number;
  defaultConfidenceScore: number;
}

export interface ExplainabilityConfig {
  defaultFormat: 'short' | 'standard' | 'detailed' | 'raw';
  maxAlternatives: number;
  includeAlternatives: boolean;
}

export interface KnowledgeIntegrationConfig {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  retryCount: number;
}

export interface MemoryIntegrationConfig {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  retryCount: number;
}

export interface AIOrchestratorConfig {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  defaultQualityTier: 'premium' | 'standard' | 'economy';
}

export interface DecisionConfig {
  database: DatabaseConfig;
  cache: CacheConfig;
  scoring: ScoringConfig;
  explainability: ExplainabilityConfig;
  knowledge: KnowledgeIntegrationConfig;
  memory: MemoryIntegrationConfig;
  aiOrchestrator: AIOrchestratorConfig;
}

/**
 * Load configuration from the environment. Reads env vars on every call so
 * that resetDecisionConfig() re-reads the current environment (tests rely on
 * this via vi.stubEnv).
 */
function loadConfigFromEnv(): DecisionConfig {
  return {
    database: {
      // Production/staging: DECISION_DATABASE_URL must be a real non-localhost URL (PH-001/T2).
      // SPRINT-088 — dev/test fallback inherits the platform database URL
      // (see services/memory DatabaseConnection for the rationale: the old
      // credential-less localhost default could never authenticate).
      url: requireProdExternalUrl(
        'DECISION_DATABASE_URL',
        process.env.DATABASE_URL || config.database.url,
      ),
      poolMax: Number(process.env.DECISION_DB_POOL_MAX ?? '10'),
      ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
    },
    cache: {
      defaultTTLms: Number(process.env.DECISION_CACHE_TTL_MS ?? '300000'), // 5 min
      maxSize: Number(process.env.DECISION_CACHE_MAX_SIZE ?? '1000'),
    },
    scoring: {
      defaultPriorityScore: Number(process.env.DECISION_DEFAULT_PRIORITY ?? '5'),
      minPriorityScore: 0,
      maxPriorityScore: 10,
      defaultConfidenceScore: Number(process.env.DECISION_DEFAULT_CONFIDENCE ?? '0'),
    },
    explainability: {
      defaultFormat: (process.env.DECISION_EXPLANATION_FORMAT ?? 'standard') as
        'short' | 'standard' | 'detailed' | 'raw',
      maxAlternatives: Number(process.env.DECISION_MAX_ALTERNATIVES ?? '3'),
      includeAlternatives: process.env.DECISION_INCLUDE_ALTERNATIVES !== 'false',
    },
    knowledge: {
      enabled: process.env.DECISION_KNOWLEDGE_ENABLED !== 'false',
      baseUrl: process.env.KNOWLEDGE_SERVICE_URL ?? 'http://localhost:4003',
      timeoutMs: Number(process.env.DECISION_KNOWLEDGE_TIMEOUT_MS ?? '5000'),
      retryCount: Number(process.env.DECISION_KNOWLEDGE_RETRY ?? '2'),
    },
    memory: {
      enabled: process.env.DECISION_MEMORY_ENABLED !== 'false',
      baseUrl: process.env.MEMORY_SERVICE_URL ?? 'http://localhost:4004',
      timeoutMs: Number(process.env.DECISION_MEMORY_TIMEOUT_MS ?? '5000'),
      retryCount: Number(process.env.DECISION_MEMORY_RETRY ?? '2'),
    },
    aiOrchestrator: {
      enabled: process.env.DECISION_AI_ENABLED !== 'false',
      baseUrl: process.env.ORCHESTRATOR_SERVICE_URL ?? 'http://localhost:4001',
      timeoutMs: Number(process.env.DECISION_AI_TIMEOUT_MS ?? '10000'),
      defaultQualityTier: (process.env.DECISION_AI_QUALITY_TIER ?? 'standard') as
        'premium' | 'standard' | 'economy',
    },
  };
}

// Deferred until first access so importing the module never evaluates
// configuration at module scope (keeps `next build` page-data collection
// inert without env vars; fail-fast still runs at first real use).
let currentConfig: DecisionConfig | null = null;

function getCurrentConfig(): DecisionConfig {
  if (currentConfig === null) {
    currentConfig = loadConfigFromEnv();
  }
  return currentConfig;
}

export function getDecisionConfig(): DecisionConfig {
  return { ...getCurrentConfig() };
}

export function updateDecisionConfig(overrides: Partial<DecisionConfig>): DecisionConfig {
  const base = getCurrentConfig();
  currentConfig = {
    ...base,
    ...overrides,
    database: { ...base.database, ...overrides.database },
    cache: { ...base.cache, ...overrides.cache },
    scoring: { ...base.scoring, ...overrides.scoring },
    explainability: { ...base.explainability, ...overrides.explainability },
    knowledge: { ...base.knowledge, ...overrides.knowledge },
    memory: { ...base.memory, ...overrides.memory },
    aiOrchestrator: { ...base.aiOrchestrator, ...overrides.aiOrchestrator },
  };
  return getDecisionConfig();
}

export function resetDecisionConfig(): void {
  currentConfig = loadConfigFromEnv();
}
