// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Engine Configuration
// Centralized configuration for the Decision Intelligence Engine
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

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
      url: process.env.DECISION_DATABASE_URL ?? 'postgres://localhost:5432/vedmoulya_decision',
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

let currentConfig: DecisionConfig = loadConfigFromEnv();

export function getDecisionConfig(): DecisionConfig {
  return { ...currentConfig };
}

export function updateDecisionConfig(overrides: Partial<DecisionConfig>): DecisionConfig {
  currentConfig = {
    ...currentConfig,
    ...overrides,
    database: { ...currentConfig.database, ...overrides.database },
    cache: { ...currentConfig.cache, ...overrides.cache },
    scoring: { ...currentConfig.scoring, ...overrides.scoring },
    explainability: { ...currentConfig.explainability, ...overrides.explainability },
    knowledge: { ...currentConfig.knowledge, ...overrides.knowledge },
    memory: { ...currentConfig.memory, ...overrides.memory },
    aiOrchestrator: { ...currentConfig.aiOrchestrator, ...overrides.aiOrchestrator },
  };
  return getDecisionConfig();
}

export function resetDecisionConfig(): void {
  currentConfig = loadConfigFromEnv();
}
