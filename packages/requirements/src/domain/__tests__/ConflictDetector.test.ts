// ──────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-009: Conflict Detector (Phase 11)
// Focused unit tests: every contradiction rule fires with an
// explanation and alternatives; the engine BLOCKS the plan while a
// conflict is open and never silently picks a side.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ConflictDetector } from '../ConflictDetector.js';
import { ProductIntelligenceEngine } from '../ProductIntelligenceEngine.js';
import { InMemoryRequirementSessionStore } from '../../infrastructure/InMemoryRequirementSessionStore.js';
import type { Requirement, RequirementSet } from '../../types/requirement-types.js';

function store(): InMemoryRequirementSessionStore {
  return new InMemoryRequirementSessionStore();
}

function engine(storeImpl: InMemoryRequirementSessionStore): ProductIntelligenceEngine {
  return new ProductIntelligenceEngine({
    store: storeImpl,
    clock: { now: (): string => '2026-08-09T00:00:00.000Z' },
  });
}

/** Seed an open conflict by injecting the conflicting requirement pair into
 *  the persisted session and recomputing derived state via a mutating call. */
async function seedConflict(
  storeImpl: InMemoryRequirementSessionStore,
  eng: ProductIntelligenceEngine,
  owner: string,
): Promise<string> {
  const started = await eng.start({ idea: 'Build a restaurant app.', owner });
  const session = (await storeImpl.get(started.sessionId))!;
  const base = session.requirements?.requirements ?? [];
  const pair: Requirement[] = [
    {
      id: 'REQ-X1',
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
      id: 'REQ-X2',
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
  const mutated = {
    ...session,
    requirements: session.requirements
      ? { ...session.requirements, requirements: [...base, ...pair] }
      : session.requirements,
  };
  await storeImpl.save(mutated);
  await eng.acceptAllDefaults(started.sessionId, owner);
  return started.sessionId;
}

function req(description: string, category: Requirement['category'] = 'functional'): Requirement {
  return {
    id: `REQ-${Math.random().toString(36).slice(2, 8)}`,
    description,
    category,
    priority: 'HIGH',
    confidence: 0.9,
    source: 'USER',
    dependencies: [],
    risks: [],
    status: 'CONFIRMED',
    version: 1,
  };
}

function setFor(descriptions: string[]): RequirementSet {
  const requirements = descriptions.map((d) => req(d));
  const byCategory = { functional: requirements.map((r) => r.id) } as RequirementSet['byCategory'];
  return {
    sessionId: 'req-conflict-test',
    requirements,
    byCategory,
    confidence: 0.9,
    counts: {
      total: requirements.length,
      byStatus: {
        UNKNOWN: 0,
        PROPOSED: 0,
        CONFIRMED: requirements.length,
        REJECTED: 0,
        IMPLEMENTED: 0,
        VALIDATED: 0,
      },
      byPriority: { CRITICAL: 0, HIGH: requirements.length, MEDIUM: 0, LOW: 0 },
    },
  };
}

describe('ConflictDetector — Phase 11', () => {
  it('detects access-restriction vs open-access contradictions', () => {
    const detector = new ConflictDetector();
    const conflicts = detector.detect(
      setFor([
        'Only employees should access the system.',
        'Anyone should be able to edit company records.',
      ]),
    );
    const hit = conflicts.find((c) => c.explanation.includes('restricts access'));
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe('CRITICAL');
    expect(hit?.explanation).toContain('conflict');
    expect(hit?.alternatives.length).toBeGreaterThan(1);
  });

  it('detects free vs paid contradictions', () => {
    const detector = new ConflictDetector();
    const conflicts = detector.detect(
      setFor(['The product is completely free.', 'Customers pay a monthly subscription.']),
    );
    expect(conflicts.some((c) => c.explanation.includes('says the product is free'))).toBe(true);
  });

  it('detects anonymous vs account-required contradictions', () => {
    const detector = new ConflictDetector();
    const conflicts = detector.detect(
      setFor([
        'Allow guest checkout with no account.',
        'Customers must create an account to order.',
      ]),
    );
    expect(conflicts.some((c) => c.explanation.includes('wants anonymous use'))).toBe(true);
  });

  it('detects public vs private data contradictions', () => {
    const detector = new ConflictDetector();
    const conflicts = detector.detect(
      setFor([
        'All reports are public and shared with everyone.',
        'Only the owner can see personal data.',
      ]),
    );
    expect(conflicts.some((c) => c.explanation.includes('exposes data'))).toBe(true);
  });

  it('detects multi-tenant vs single-user contradictions', () => {
    const detector = new ConflictDetector();
    const conflicts = detector.detect(
      setFor(['A multi-tenant organization workspace.', 'A personal single-user app.']),
    );
    expect(conflicts.some((c) => c.explanation.includes('wants shared/tenanted access'))).toBe(
      true,
    );
  });

  it('returns no conflicts for a consistent set', () => {
    const detector = new ConflictDetector();
    const conflicts = detector.detect(
      setFor(['Customers can place orders.', 'Admins manage the menu.']),
    );
    expect(conflicts).toHaveLength(0);
  });

  it('the engine blocks the plan while a conflict is open and resolution persists (never silently picks)', async () => {
    const storeImpl = store();
    const eng = engine(storeImpl);
    const sessionId = await seedConflict(storeImpl, eng, 'u1');
    const session = await eng.get(sessionId, 'u1');
    const open = session.conflicts?.find((c) => c.status === 'open');
    expect(open).toBeDefined();

    // Blocking questions are resolved first so the only remaining blocker is the conflict.
    const blocking = session.questionPlan?.blocking ?? [];
    await eng.answer({
      sessionId,
      owner: 'u1',
      answers: blocking.map((q) => ({ questionId: q.id, answer: q.options?.[0]?.value ?? 'yes' })),
    });

    // The open conflict still blocks planning.
    await expect(eng.plan(sessionId, 'u1')).rejects.toThrow(/open conflict/);

    // Resolve explicitly → the resolution survives recomputation.
    await eng.resolveConflict(
      sessionId,
      'u1',
      open?.id ?? '',
      'Add roles: public read-only + authenticated write',
    );
    const after = await eng.get(sessionId, 'u1');
    expect(after.conflicts?.find((c) => c.reqAId === 'REQ-X1')?.status).toBe('resolved');
    // No silent re-opening: recomputation preserves the user's decision.
    await eng.acceptAllDefaults(sessionId, 'u1');
    const recheck = await eng.get(sessionId, 'u1');
    expect(recheck.conflicts?.find((c) => c.reqAId === 'REQ-X1')?.status).toBe('resolved');
  });
});
