// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: In-Memory Learning Repository
// EI-007 — Enterprise Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { InMemoryLearningRepository } from '../InMemoryLearningRepository.js';
import type { LearningDecision, LearningEvent } from '../../../types/learning-types.js';

function ev(overrides: Partial<LearningEvent>): LearningEvent {
  return {
    eventId: `levent_${overrides.entityId ?? 'x'}`,
    category: 'provider',
    entityType: 'provider',
    entityId: 'openai',
    entityLabel: 'OpenAI',
    outcome: 'success',
    confidence: 0.9,
    costUsd: 0.01,
    latencyMs: 400,
    accuracy: 0.95,
    retries: 0,
    quality: 0.92,
    metadata: {},
    occurredAt: '2026-08-01T10:00:00.000Z',
    createdAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

function decision(overrides: Partial<LearningDecision> = {}): LearningDecision {
  return {
    decisionId: 'decision_rec_x',
    recommendationId: 'rec_x',
    recommendationType: 'best_provider',
    targetEntityId: 'openai',
    status: 'approved',
    version: 2,
    actor: 'owner',
    audit: [],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('InMemoryLearningRepository — events', () => {
  it('saves and finds events by id', async () => {
    const repo = new InMemoryLearningRepository();
    const event = ev({ eventId: 'levent_a' });
    await repo.saveEvent(event);
    expect(await repo.findEventById('levent_a')).toEqual(event);
    expect(await repo.findEventById('missing')).toBeNull();
  });

  it('lists events sorted by occurredAt desc with filters and pagination', async () => {
    const repo = new InMemoryLearningRepository();
    await repo.saveEvent(
      ev({
        eventId: 'e1',
        entityId: 'a',
        category: 'provider',
        outcome: 'success',
        occurredAt: '2026-08-01T10:00:00.000Z',
      }),
    );
    await repo.saveEvent(
      ev({
        eventId: 'e2',
        entityId: 'b',
        category: 'prompt',
        outcome: 'failure',
        occurredAt: '2026-08-03T10:00:00.000Z',
      }),
    );
    await repo.saveEvent(
      ev({
        eventId: 'e3',
        entityId: 'a',
        category: 'provider',
        outcome: 'failure',
        occurredAt: '2026-08-02T10:00:00.000Z',
      }),
    );

    const all = await repo.listEvents({}, { page: 1, limit: 10 });
    expect(all.total).toBe(3);
    expect(all.data.map((e) => e.eventId)).toEqual(['e2', 'e3', 'e1']);

    const byCategory = await repo.listEvents({ category: 'provider' }, { page: 1, limit: 10 });
    expect(byCategory.total).toBe(2);

    const byOutcome = await repo.listEvents({ outcome: 'failure' }, { page: 1, limit: 10 });
    expect(byOutcome.total).toBe(2);

    const byEntity = await repo.listEvents({ entityId: 'a' }, { page: 1, limit: 10 });
    expect(byEntity.total).toBe(2);

    const page2 = await repo.listEvents({}, { page: 2, limit: 2 });
    expect(page2.totalPages).toBe(2);
    expect(page2.data).toHaveLength(1);
  });

  it('listAllEvents returns everything', async () => {
    const repo = new InMemoryLearningRepository([ev({ eventId: 's1' })]);
    await repo.saveEvent(ev({ eventId: 's2' }));
    expect(await repo.listAllEvents()).toHaveLength(2);
  });

  it('deletes events', async () => {
    const repo = new InMemoryLearningRepository([ev({ eventId: 'd1' })]);
    await repo.deleteEvent('d1');
    expect(await repo.findEventById('d1')).toBeNull();
  });

  it('counts events, by category, and by outcome', async () => {
    const repo = new InMemoryLearningRepository([
      ev({ eventId: 'c1', category: 'provider', outcome: 'success' }),
      ev({ eventId: 'c2', category: 'provider', outcome: 'failure' }),
      ev({ eventId: 'c3', category: 'prompt', outcome: 'success' }),
    ]);
    expect(await repo.countEvents()).toBe(3);
    const byCategory = await repo.countEventsByCategory();
    expect(byCategory.provider).toBe(2);
    expect(byCategory.prompt).toBe(1);
    expect(byCategory.failure).toBe(0);
    const byOutcome = await repo.countEventsByOutcome();
    expect(byOutcome.success).toBe(2);
    expect(byOutcome.failure).toBe(1);
  });
});

describe('InMemoryLearningRepository — safety decisions', () => {
  it('saves and finds decisions by id and by recommendation', async () => {
    const repo = new InMemoryLearningRepository();
    const d = decision();
    await repo.saveDecision(d);
    expect(await repo.findDecisionById(d.decisionId)).toEqual(d);
    expect(await repo.findDecisionByRecommendation('rec_x')).toEqual(d);
    expect(await repo.findDecisionByRecommendation('missing')).toBeNull();
  });

  it('lists decisions and filters by status', async () => {
    const repo = new InMemoryLearningRepository();
    await repo.saveDecision(
      decision({ decisionId: 'd1', recommendationId: 'r1', status: 'approved' }),
    );
    await repo.saveDecision(
      decision({ decisionId: 'd2', recommendationId: 'r2', status: 'pending' }),
    );
    expect(await repo.listDecisions()).toHaveLength(2);
    const approved = await repo.listDecisionsByStatus('approved');
    expect(approved).toHaveLength(1);
    expect(approved[0]?.recommendationId).toBe('r1');
  });

  it('deletes decisions', async () => {
    const repo = new InMemoryLearningRepository();
    await repo.saveDecision(decision({ decisionId: 'x' }));
    await repo.deleteDecision('x');
    expect(await repo.findDecisionById('x')).toBeNull();
  });
});
