// ──────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-009: Requirements Application Service
// Tests the requirements.* service contract (start → answer →
// defaults → plan → approve → handoff + owner-scoped list/get/delete)
// and the DTO boundary.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { RequirementsApplicationService } from '../RequirementsApplicationService.js';
import { InMemoryRequirementSessionStore } from '../../infrastructure/InMemoryRequirementSessionStore.js';

function createService(): RequirementsApplicationService {
  return new RequirementsApplicationService({
    store: new InMemoryRequirementSessionStore(),
    clock: { now: (): string => '2026-08-09T00:00:00.000Z' },
  });
}

async function restaurantToApproval(
  service: RequirementsApplicationService,
  userId: string,
): Promise<string> {
  const started = await service.start({
    idea: 'Build a modern restaurant app with delivery and an admin dashboard.',
    userId,
  });
  const sessionId = started.sessionId;
  await service.answer({
    sessionId,
    userId,
    answers: [
      { questionId: 'q-restaurant-service-modes', answer: 'all' },
      { questionId: 'q-restaurant-payment', answer: 'at_restaurant' },
      { questionId: 'q-restaurant-admin', answer: 'staff_dashboard' },
    ],
  });
  await service.acceptAllDefaults(sessionId, userId);
  const session = await service.get(sessionId, userId);
  for (const d of session.defaults ?? []) {
    if (d.status === 'proposed') {
      await service.decideDefault(sessionId, userId, d.id, 'accepted');
    }
  }
  await service.plan(sessionId, userId);
  await service.approve(sessionId, userId);
  return sessionId;
}

describe('RequirementsApplicationService', () => {
  it('start returns the question bundles and readiness state', async () => {
    const service = createService();
    const started = await service.start({ idea: 'Build a restaurant app.', userId: 'u1' });
    expect(started.sessionId).toMatch(/^req-/);
    expect(started.phase).toBe('QUESTIONS');
    expect(started.questionBundles.length).toBeGreaterThan(0);
    expect(started.blockingCount).toBeGreaterThan(0);
    expect(started.completenessReady).toBe(false);
  });

  it('answer updates the session DTO', async () => {
    const service = createService();
    const started = await service.start({ idea: 'Build a restaurant app.', userId: 'u1' });
    const updated = await service.answer({
      sessionId: started.sessionId,
      userId: 'u1',
      answers: [{ questionId: 'q-restaurant-payment', answer: 'online' }],
    });
    expect(
      updated.requirements?.requirements.some((r) => r.description.includes('tokenized')),
    ).toBe(true);
  });

  it('full lifecycle: start → answers → defaults → plan → approve → handoff', async () => {
    const service = createService();
    const sessionId = await restaurantToApproval(service, 'u1');
    const approved = await service.get(sessionId, 'u1');
    expect(approved.phase).toBe('APPROVED');
    expect(approved.review?.ready).toBe(true);
    const handoff = await service.handoffGoal(sessionId, 'u1');
    expect(handoff.goal.length).toBeGreaterThan(50);
    expect(handoff.confirmedRequirements).toBeGreaterThan(0);
  });

  it('list returns owner-scoped summaries', async () => {
    const service = createService();
    await service.start({ idea: 'Build a restaurant app.', userId: 'u1' });
    await service.start({ idea: 'Build an ABAP debugger.', userId: 'u2' });
    const u1 = await service.list('u1');
    const u2 = await service.list('u2');
    expect(u1).toHaveLength(1);
    expect(u2).toHaveLength(1);
    expect(u1[0]?.sessionId).not.toBe(u2[0]?.sessionId);
  });

  it('deleteSession works and get then fails', async () => {
    const service = createService();
    const started = await service.start({ idea: 'Build a restaurant app.', userId: 'u1' });
    const { deleted } = await service.deleteSession(started.sessionId, 'u1');
    expect(deleted).toBe(true);
    await expect(service.get(started.sessionId, 'u1')).rejects.toThrow();
  });

  it('changeImpact returns the analysis DTO', async () => {
    const service = createService();
    const sessionId = await restaurantToApproval(service, 'u1');
    const impact = await service.changeImpact(sessionId, 'u1', 'Add online payments');
    expect(impact.securityImpact.length).toBeGreaterThan(0);
    expect(impact.requiresApproval).toBe(true);
  });

  it('rejects a foreign user on every operation', async () => {
    const service = createService();
    const started = await service.start({ idea: 'Build a restaurant app.', userId: 'u1' });
    await expect(service.get(started.sessionId, 'u2')).rejects.toThrow();
    await expect(service.plan(started.sessionId, 'u2')).rejects.toThrow();
    await expect(service.approve(started.sessionId, 'u2')).rejects.toThrow();
    await expect(service.deleteSession(started.sessionId, 'u2')).rejects.toThrow();
  });

  it('reject marks the session REJECTED through the service boundary', async () => {
    const service = createService();
    const started = await service.start({ idea: 'Build a restaurant app.', userId: 'u1' });
    const rejected = await service.reject(started.sessionId, 'u1', 'changed my mind');
    expect(rejected.phase).toBe('REJECTED');
  });

  it('resolveConflict resolves an open conflict through the service boundary', async () => {
    const store = new InMemoryRequirementSessionStore();
    const service = new RequirementsApplicationService({
      store,
      clock: { now: (): string => '2026-08-09T00:00:00.000Z' },
    });
    const started = await service.start({ idea: 'Build a restaurant app.', userId: 'u1' });
    // Seed a conflicting requirement pair into the persisted session.
    const session = (await store.get(started.sessionId))!;
    const base = session.requirements?.requirements ?? [];
    const pair = [
      {
        id: 'REQ-Z1',
        description: 'Only employees should access the system.',
        category: 'security',
        priority: 'CRITICAL',
        confidence: 0.9,
        source: 'USER',
        dependencies: [],
        risks: [],
        status: 'CONFIRMED',
        version: 1,
      },
      {
        id: 'REQ-Z2',
        description: 'Anyone should be able to edit company records.',
        category: 'functional',
        priority: 'HIGH',
        confidence: 0.9,
        source: 'USER',
        dependencies: [],
        risks: [],
        status: 'CONFIRMED',
        version: 1,
      },
    ];
    await store.save({
      ...session,
      requirements: session.requirements
        ? { ...session.requirements, requirements: [...base, ...pair] }
        : session.requirements,
    });
    await service.acceptAllDefaults(started.sessionId, 'u1');

    const withConflict = await service.get(started.sessionId, 'u1');
    const open = withConflict.conflicts?.find((c) => c.status === 'open');
    expect(open).toBeDefined();
    const resolved = await service.resolveConflict(
      started.sessionId,
      'u1',
      open?.id ?? '',
      'Add roles: public read-only + authenticated write',
    );
    expect(resolved.conflicts?.find((c) => c.reqAId === 'REQ-Z1')?.status).toBe('resolved');
  });
});
