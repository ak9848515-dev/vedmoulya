// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision Config unit tests
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { getDecisionConfig, updateDecisionConfig, resetDecisionConfig } from '../DecisionConfig.js';

describe('DecisionConfig', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    resetDecisionConfig();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetDecisionConfig();
  });

  it('loads defaults from the environment', () => {
    const config = getDecisionConfig();
    expect(config.database.poolMax).toBe(10);
    expect(config.cache.defaultTTLms).toBe(300000);
    expect(config.scoring.defaultPriorityScore).toBe(5);
    expect(config.scoring.maxPriorityScore).toBe(10);
    expect(config.explainability.defaultFormat).toBe('standard');
    expect(config.explainability.maxAlternatives).toBe(3);
    expect(config.explainability.includeAlternatives).toBe(true);
    expect(config.knowledge.enabled).toBe(true);
    expect(config.knowledge.baseUrl).toBe('http://localhost:4003');
    expect(config.memory.enabled).toBe(true);
    expect(config.memory.baseUrl).toBe('http://localhost:4004');
    expect(config.aiOrchestrator.enabled).toBe(true);
    expect(config.aiOrchestrator.baseUrl).toBe('http://localhost:4001');
    expect(config.aiOrchestrator.defaultQualityTier).toBe('standard');
  });

  it('reads custom values from the environment', () => {
    vi.stubEnv('DECISION_DB_POOL_MAX', '25');
    vi.stubEnv('DECISION_CACHE_TTL_MS', '60000');
    vi.stubEnv('DECISION_DEFAULT_PRIORITY', '8');
    vi.stubEnv('DECISION_DEFAULT_CONFIDENCE', '0.7');
    vi.stubEnv('DECISION_EXPLANATION_FORMAT', 'detailed');
    vi.stubEnv('DECISION_MAX_ALTERNATIVES', '5');
    vi.stubEnv('DECISION_INCLUDE_ALTERNATIVES', 'false');
    vi.stubEnv('DECISION_KNOWLEDGE_ENABLED', 'false');
    vi.stubEnv('DECISION_MEMORY_ENABLED', 'false');
    vi.stubEnv('DECISION_AI_ENABLED', 'false');
    vi.stubEnv('DECISION_AI_QUALITY_TIER', 'premium');
    vi.stubEnv('KNOWLEDGE_SERVICE_URL', 'http://knowledge:1');
    vi.stubEnv('MEMORY_SERVICE_URL', 'http://memory:1');
    vi.stubEnv('ORCHESTRATOR_SERVICE_URL', 'http://orchestrator:1');
    resetDecisionConfig();
    const config = getDecisionConfig();
    expect(config.database.poolMax).toBe(25);
    expect(config.cache.defaultTTLms).toBe(60000);
    expect(config.scoring.defaultPriorityScore).toBe(8);
    expect(config.scoring.defaultConfidenceScore).toBe(0.7);
    expect(config.explainability.defaultFormat).toBe('detailed');
    expect(config.explainability.maxAlternatives).toBe(5);
    expect(config.explainability.includeAlternatives).toBe(false);
    expect(config.knowledge.enabled).toBe(false);
    expect(config.memory.enabled).toBe(false);
    expect(config.aiOrchestrator.enabled).toBe(false);
    expect(config.aiOrchestrator.defaultQualityTier).toBe('premium');
    expect(config.knowledge.baseUrl).toBe('http://knowledge:1');
    expect(config.memory.baseUrl).toBe('http://memory:1');
    expect(config.aiOrchestrator.baseUrl).toBe('http://orchestrator:1');
  });

  it('updateDecisionConfig merges partial overrides deeply', () => {
    const updated = updateDecisionConfig({
      scoring: { defaultPriorityScore: 9 },
      knowledge: { baseUrl: 'http://new-knowledge:1' },
    });
    expect(updated.scoring.defaultPriorityScore).toBe(9);
    expect(updated.scoring.maxPriorityScore).toBe(10); // untouched sibling
    expect(updated.knowledge.baseUrl).toBe('http://new-knowledge:1');
    expect(updated.knowledge.enabled).toBe(true); // untouched sibling
  });

  it('resetDecisionConfig restores values from the environment', () => {
    updateDecisionConfig({ cache: { defaultTTLms: 999 } });
    resetDecisionConfig();
    expect(getDecisionConfig().cache.defaultTTLms).toBe(300000);
  });
});
