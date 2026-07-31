// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Config Tests
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getDecisionConfig,
  updateDecisionConfig,
  resetDecisionConfig,
} from '../src/config/DecisionConfig.js';

describe('DecisionConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetDecisionConfig();
  });

  it('returns default config with environment-based values', () => {
    const config = getDecisionConfig();
    expect(config.database.url).toBe('postgres://localhost:5432/vedmoulya_decision');
    expect(config.database.poolMax).toBe(10);
    expect(config.cache.defaultTTLms).toBe(300000);
    expect(config.scoring.defaultPriorityScore).toBe(5);
    expect(config.knowledge.enabled).toBe(true);
    expect(config.memory.enabled).toBe(true);
    expect(config.aiOrchestrator.enabled).toBe(true);
  });

  it('reads DATABASE_URL from environment', () => {
    vi.stubEnv('DECISION_DATABASE_URL', 'postgres://custom:5432/mydb');
    resetDecisionConfig();
    const config = getDecisionConfig();
    expect(config.database.url).toBe('postgres://custom:5432/mydb');
  });

  it('reads pool max from environment', () => {
    vi.stubEnv('DECISION_DB_POOL_MAX', '20');
    resetDecisionConfig();
    const config = getDecisionConfig();
    expect(config.database.poolMax).toBe(20);
  });

  it('allows partial override of config', () => {
    updateDecisionConfig({
      cache: { defaultTTLms: 60000, maxSize: 500 },
      scoring: {
        defaultPriorityScore: 8,
        minPriorityScore: 0,
        maxPriorityScore: 10,
        defaultConfidenceScore: 0.5,
      },
    });
    const config = getDecisionConfig();
    expect(config.cache.defaultTTLms).toBe(60000);
    expect(config.scoring.defaultPriorityScore).toBe(8);
    expect(config.database.url).toBe('postgres://localhost:5432/vedmoulya_decision'); // unchanged
  });

  it('reset restores defaults', () => {
    updateDecisionConfig({ cache: { defaultTTLms: 999, maxSize: 500 } });
    resetDecisionConfig();
    const config = getDecisionConfig();
    expect(config.cache.defaultTTLms).toBe(300000);
  });

  it('returns a copy, not the original', () => {
    const config1 = getDecisionConfig();
    const config2 = getDecisionConfig();
    expect(config1).toEqual(config2);
    // Mutating config1 should not affect config2
    (config1 as Record<string, unknown>).extra = 'test';
    expect((config2 as Record<string, unknown>).extra).toBeUndefined();
  });
});
