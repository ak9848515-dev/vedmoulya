// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Platform Validation tests
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { OSValidationService } from '../services/OSValidationService.js';
import { OSHealthService } from '../services/OSHealthService.js';
import { makeEngines, failingGoalsFixture, emptyOrchestratorFixture } from './fixtures.js';

const healthService = new OSHealthService();
const service = new OSValidationService(healthService);

describe('OSValidationService', () => {
  it('validates a ready platform', async () => {
    const validation = await service.validatePlatform(makeEngines());
    expect(validation.valid).toBe(true);
    expect(validation.summary.passed).toBe(validation.summary.total);
    expect(validation.summary.score).toBe(100);
  });

  it('covers the spec validation areas', async () => {
    const validation = await service.validatePlatform(makeEngines());
    const ids = validation.checks.map((c) => c.id);
    for (const expected of [
      'check-engines',
      'check-dependencies',
      'check-contracts',
      'check-repositories',
      'check-lifecycle',
      'check-event-flow',
      'check-cross-engine',
      'check-performance',
    ]) {
      expect(ids).toContain(expected);
    }
  });

  it('fails when an engine is unreachable', async () => {
    const validation = await service.validatePlatform(makeEngines(failingGoalsFixture()));
    expect(validation.valid).toBe(false);
    const engines = validation.checks.find((c) => c.id === 'check-engines');
    const lifecycle = validation.checks.find((c) => c.id === 'check-lifecycle');
    const eventFlow = validation.checks.find((c) => c.id === 'check-event-flow');
    expect(engines?.passed).toBe(false);
    expect(lifecycle?.passed).toBe(false);
    expect(eventFlow?.passed).toBe(false);
  });

  it('validates from an existing health pass without re-probing', async () => {
    const health = await healthService.systemHealth(makeEngines());
    const validation = service.validateFromHealth(health);
    expect(validation.valid).toBe(true);
  });

  it('remains valid with tolerated not-started pipeline stages', async () => {
    const validation = await service.validatePlatform(makeEngines(emptyOrchestratorFixture()));
    expect(validation.valid).toBe(true);
  });

  it('reports PASS/FAIL detail on every check', async () => {
    const validation = await service.validatePlatform(makeEngines(failingGoalsFixture()));
    for (const check of validation.checks) {
      expect(check.detail).toMatch(/^(PASS|FAIL)$/);
    }
    expect(validation.summary.failed).toBeGreaterThan(0);
  });
});
