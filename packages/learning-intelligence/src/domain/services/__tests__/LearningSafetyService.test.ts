// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Learning Safety Service
// EI-007 — Enterprise Learning Intelligence Platform
// Human approval, version history, rollback, audit trail.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { LearningSafetyService } from '../LearningSafetyService.js';
import type { LearningModel, LearningRecommendation } from '../../../types/learning-types.js';

function model(overrides: Partial<LearningModel>): LearningModel {
  return {
    category: 'provider',
    entityType: 'provider',
    entityId: 'openai',
    entityLabel: 'OpenAI',
    sampleCount: 10,
    successCount: 9,
    failureCount: 1,
    successRate: 0.9,
    avgCostUsd: 0.01,
    avgLatencyMs: 400,
    avgAccuracy: 0.95,
    avgRetries: 0.1,
    avgQuality: 0.92,
    avgFeedback: 0.9,
    avgBusinessOutcome: 0.8,
    confidence: 0.9,
    trend: 0.05,
    lastSeen: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

function recommendation(overrides: Partial<LearningRecommendation> = {}): LearningRecommendation {
  return {
    recommendationId: 'rec_best_provider_openai',
    type: 'best_provider',
    category: 'provider',
    title: 'Best Provider',
    description: 'Recommend OpenAI.',
    targetEntity: { entityType: 'provider', entityId: 'openai', entityLabel: 'OpenAI' },
    value: 0.9,
    confidence: 0.9,
    sampleCount: 10,
    status: 'pending',
    version: 1,
    rationale: ['10 runs'],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('LearningSafetyService — eligibility', () => {
  it('approves eligibility for well-sampled confident models', () => {
    const service = new LearningSafetyService();
    expect(service.isEligible(model({})).eligible).toBe(true);
  });

  it('rejects eligibility for low-sample models', () => {
    const service = new LearningSafetyService();
    const result = service.isEligible(model({ sampleCount: 2 }));
    expect(result.eligible).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

describe('LearningSafetyService — canApprove gate', () => {
  it('blocks approval below the approval sample threshold', () => {
    const service = new LearningSafetyService();
    const gate = service.canApprove(model({ sampleCount: 3, confidence: 0.95 }));
    expect(gate.allowed).toBe(false);
    expect(gate.reasons.join(' ')).toContain('Insufficient samples');
  });

  it('blocks approval below the confidence threshold', () => {
    const service = new LearningSafetyService();
    const gate = service.canApprove(model({ sampleCount: 10, confidence: 0.2 }));
    expect(gate.allowed).toBe(false);
    expect(gate.reasons.join(' ')).toContain('Confidence below');
  });

  it('allows approval with sufficient samples and confidence', () => {
    const service = new LearningSafetyService();
    expect(service.canApprove(model({ sampleCount: 10, confidence: 0.9 })).allowed).toBe(true);
  });

  it('blocks approval when the model is missing', () => {
    const service = new LearningSafetyService();
    expect(service.canApprove(undefined).allowed).toBe(false);
  });

  it('allows approval without the gate when approvalRequired is false', () => {
    const service = new LearningSafetyService({ approvalRequired: false });
    expect(service.canApprove(model({ sampleCount: 1, confidence: 0.1 })).allowed).toBe(true);
  });
});

describe('LearningSafetyService — decision lifecycle', () => {
  it('creates a pending decision with version 1 and a created audit entry', () => {
    const service = new LearningSafetyService();
    const decision = service.createDecision(recommendation(), 'human-owner');
    expect(decision.status).toBe('pending');
    expect(decision.version).toBe(1);
    expect(decision.audit).toHaveLength(1);
    expect(decision.audit[0]?.action).toBe('created');
    expect(decision.audit[0]?.actor).toBe('human-owner');
    expect(decision.decisionId).toBe('decision_rec_best_provider_openai');
  });

  it('approves a pending decision with version bump and audit entry', () => {
    const service = new LearningSafetyService();
    const decision = service.approve(
      service.createDecision(recommendation(), 'owner'),
      'approver',
      'looks good',
    );
    expect(decision.status).toBe('approved');
    expect(decision.version).toBe(2);
    expect(decision.audit).toHaveLength(2);
    expect(decision.audit[1]?.action).toBe('approved');
    expect(decision.audit[1]?.note).toBe('looks good');
  });

  it('rejects a pending decision', () => {
    const service = new LearningSafetyService();
    const decision = service.reject(service.createDecision(recommendation(), 'owner'), 'approver');
    expect(decision.status).toBe('rejected');
    expect(decision.version).toBe(2);
  });

  it('rolls back an approved decision and rejects invalid transitions', () => {
    const service = new LearningSafetyService();
    const approved = service.approve(service.createDecision(recommendation(), 'owner'), 'approver');
    const rolledBack = service.rollback(approved, 'reviewer', 'reverting');
    expect(rolledBack.status).toBe('rolled_back');
    expect(rolledBack.version).toBe(3);
    expect(rolledBack.audit).toHaveLength(3);
    expect(rolledBack.audit[2]?.action).toBe('rolled_back');

    // Cannot roll back a pending decision.
    expect(() => service.rollback(service.createDecision(recommendation(), 'o'), 'r')).toThrow();
    // Cannot approve an approved decision twice.
    expect(() => service.approve(approved, 'approver')).toThrow();
  });

  it('preserves the full audit trail across the lifecycle', () => {
    const service = new LearningSafetyService();
    let decision = service.createDecision(recommendation(), 'owner');
    decision = service.approve(decision, 'approver');
    decision = service.rollback(decision, 'reviewer');
    expect(decision.audit.map((a) => a.action)).toEqual(['created', 'approved', 'rolled_back']);
    expect(decision.audit.map((a) => a.version)).toEqual([1, 2, 3]);
  });

  it('respects custom thresholds', () => {
    const strict = new LearningSafetyService({ minSamplesForApproval: 50 });
    expect(strict.canApprove(model({ sampleCount: 10, confidence: 0.9 })).allowed).toBe(false);
  });
});
