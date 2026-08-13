// ──────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-009: Analysis Engines
// Deterministic tests (Phase 31): requirement graph (dependencies,
// blockers, cycles, architecture-changing), ambiguity detection,
// conflict detection and completeness (score never overrides a
// critical unknown).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { IntentUnderstandingEngine } from '../IntentUnderstandingEngine.js';
import { RequirementExtractionEngine } from '../RequirementExtractionEngine.js';
import { RequirementGraphBuilder } from '../RequirementGraphBuilder.js';
import { AmbiguityEngine } from '../AmbiguityEngine.js';
import { ConflictDetector } from '../ConflictDetector.js';
import { CompletenessEngine } from '../CompletenessEngine.js';
import type { Requirement, RequirementSet, SafeDefault } from '../../types/requirement-types.js';

const INTENT = new IntentUnderstandingEngine();
const EXTRACTION = new RequirementExtractionEngine();
const GRAPH = new RequirementGraphBuilder();
const AMBIGUITY = new AmbiguityEngine();
const CONFLICTS = new ConflictDetector();
const COMPLETENESS = new CompletenessEngine();

function extract(idea: string, sessionId: string): RequirementSet {
  return EXTRACTION.extract({ sessionId, intent: INTENT.derive({ sessionId, idea }) });
}

describe('RequirementGraphBuilder (Phase 4)', () => {
  it('builds nodes and dependency edges from the requirement set', () => {
    const set = extract('Build a restaurant app.', 'g1');
    const graph = GRAPH.build({ sessionId: 'g1', requirements: set });
    expect(graph.nodes.length).toBe(set.requirements.length);
    expect(graph.roots.length).toBeGreaterThan(0);
    expect(graph.leaves.length).toBeGreaterThan(0);
  });

  it('flags architecture-changing requirements', () => {
    const set = extract('Build a restaurant app with online payment.', 'g2');
    const graph = GRAPH.build({ sessionId: 'g2', requirements: set });
    expect(graph.architectureChanging.length).toBeGreaterThan(0);
  });

  it('reports UNKNOWN dependencies as blockers', () => {
    const reqs: Requirement[] = [
      {
        id: 'REQ-001',
        description: 'Manage orders',
        category: 'functional',
        priority: 'HIGH',
        confidence: 0.9,
        source: 'USER',
        dependencies: [],
        risks: [],
        status: 'CONFIRMED',
        version: 1,
      },
      {
        id: 'REQ-002',
        description: 'Payment approach must be defined',
        category: 'security',
        priority: 'CRITICAL',
        confidence: 0.2,
        source: 'QUESTION',
        dependencies: [],
        risks: [],
        status: 'UNKNOWN',
        version: 1,
      },
      {
        id: 'REQ-003',
        description: 'Orders include a payment step',
        category: 'functional',
        priority: 'HIGH',
        confidence: 0.5,
        source: 'QUESTION',
        dependencies: ['REQ-002'],
        risks: [],
        status: 'PROPOSED',
        version: 1,
      },
    ];
    const set: RequirementSet = {
      sessionId: 'g3',
      requirements: reqs,
      byCategory: {
        functional: ['REQ-001', 'REQ-003'],
        security: ['REQ-002'],
      } as RequirementSet['byCategory'],
      confidence: 0.5,
      counts: {
        total: 3,
        byStatus: {} as RequirementSet['counts']['byStatus'],
        byPriority: {} as RequirementSet['counts']['byPriority'],
      },
    };
    const graph = GRAPH.build({ sessionId: 'g3', requirements: set });
    const orderBlocker = graph.blockers.find((b) => b.requirementId === 'REQ-003');
    expect(orderBlocker?.blockedBy).toContain('REQ-002');
  });

  it('detects no cycles in the extraction output', () => {
    const set = extract('Build an ABAP debugger assistant.', 'g4');
    const graph = GRAPH.build({ sessionId: 'g4', requirements: set });
    expect(graph.cycles).toEqual([]);
  });

  it('adds conflict edges when conflicts are provided', () => {
    const set = extract('Build a restaurant app.', 'g5');
    const fakeConflict = {
      id: 'CFL-1',
      reqAId: set.requirements[0]?.id ?? 'A',
      reqBId: set.requirements[1]?.id ?? 'B',
      description: 'conflict',
      explanation: 'explained',
      alternatives: ['a', 'b'],
      severity: 'HIGH' as const,
      status: 'open' as const,
    };
    const graph = GRAPH.build({ sessionId: 'g5', requirements: set, conflicts: [fakeConflict] });
    expect(graph.edges.some((e) => e.kind === 'conflict')).toBe(true);
  });

  it('reports dependency cycles instead of looping forever', () => {
    const reqs: Requirement[] = [
      {
        id: 'REQ-001',
        description: 'A depends on B',
        category: 'functional',
        priority: 'HIGH',
        confidence: 0.9,
        source: 'USER',
        dependencies: ['REQ-002'],
        risks: [],
        status: 'CONFIRMED',
        version: 1,
      },
      {
        id: 'REQ-002',
        description: 'B depends on A',
        category: 'functional',
        priority: 'HIGH',
        confidence: 0.9,
        source: 'USER',
        dependencies: ['REQ-001'],
        risks: [],
        status: 'CONFIRMED',
        version: 1,
      },
    ];
    const set: RequirementSet = {
      sessionId: 'g6',
      requirements: reqs,
      byCategory: { functional: ['REQ-001', 'REQ-002'] } as RequirementSet['byCategory'],
      confidence: 0.9,
      counts: {
        total: 2,
        byStatus: {} as RequirementSet['counts']['byStatus'],
        byPriority: {} as RequirementSet['counts']['byPriority'],
      },
    };
    const graph = GRAPH.build({ sessionId: 'g6', requirements: set });
    expect(graph.cycles.length).toBeGreaterThan(0);
    expect(graph.cycles[0]?.ids).toContain('REQ-001');
  });
});

describe('AmbiguityEngine (Phase 5)', () => {
  it('flags vague adjectives', () => {
    const set = extract('Build a modern, fast, simple restaurant app.', 'a1');
    const report = AMBIGUITY.analyze({
      sessionId: 'a1',
      idea: 'Build a modern, fast, simple restaurant app.',
      archetype: 'restaurant-app',
      requirements: set,
    });
    expect(report.findings.some((f) => f.kind === 'ambiguous_language')).toBe(true);
  });

  it('flags unrealistic expectations', () => {
    const set = extract('Build a full restaurant app overnight for free.', 'a2');
    const report = AMBIGUITY.analyze({
      sessionId: 'a2',
      idea: 'Build a full restaurant app overnight for free.',
      archetype: 'restaurant-app',
      requirements: set,
    });
    expect(report.findings.some((f) => f.kind === 'unrealistic_expectation')).toBe(true);
  });

  it('flags security-sensitive uncertainty for unanswered sensitive questions', () => {
    const set = extract('Build a restaurant app.', 'a3');
    const report = AMBIGUITY.analyze({
      sessionId: 'a3',
      idea: 'Build a restaurant app.',
      archetype: 'restaurant-app',
      requirements: set,
    });
    expect(report.findings.some((f) => f.kind === 'security_sensitive_uncertainty')).toBe(true);
  });

  it('links findings to the questions that resolve them', () => {
    const set = extract('Build a restaurant app.', 'a4');
    const report = AMBIGUITY.analyze({
      sessionId: 'a4',
      idea: 'Build a restaurant app.',
      archetype: 'restaurant-app',
      requirements: set,
    });
    for (const f of report.findings) {
      if (f.relatedQuestionId) expect(f.relatedQuestionId.startsWith('q-')).toBe(true);
    }
  });
});

describe('ConflictDetector (Phase 11)', () => {
  it('detects auth-vs-open-access contradictions', () => {
    const reqs: Requirement[] = [
      {
        id: 'REQ-001',
        description: 'Only employees should access the system',
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
        id: 'REQ-002',
        description: 'Anyone should be able to edit company records',
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
    const set: RequirementSet = {
      sessionId: 'c1',
      requirements: reqs,
      byCategory: {
        functional: ['REQ-002'],
        security: ['REQ-001'],
      } as RequirementSet['byCategory'],
      confidence: 0.9,
      counts: {
        total: 2,
        byStatus: {} as RequirementSet['counts']['byStatus'],
        byPriority: {} as RequirementSet['counts']['byPriority'],
      },
    };
    const found = CONFLICTS.detect(set);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]?.description).toBe('These requirements conflict.');
    expect(found[0]?.alternatives.length).toBeGreaterThan(0);
  });

  it('never silently chooses one side — it reports the conflict', () => {
    const reqs: Requirement[] = [
      {
        id: 'REQ-001',
        description: 'The app is free',
        category: 'business_rule',
        priority: 'HIGH',
        confidence: 0.9,
        source: 'USER',
        dependencies: [],
        risks: [],
        status: 'CONFIRMED',
        version: 1,
      },
      {
        id: 'REQ-002',
        description: 'Users pay a subscription',
        category: 'integration',
        priority: 'HIGH',
        confidence: 0.9,
        source: 'USER',
        dependencies: [],
        risks: [],
        status: 'CONFIRMED',
        version: 1,
      },
    ];
    const set: RequirementSet = {
      sessionId: 'c2',
      requirements: reqs,
      byCategory: {} as RequirementSet['byCategory'],
      confidence: 0.9,
      counts: {
        total: 2,
        byStatus: {} as RequirementSet['counts']['byStatus'],
        byPriority: {} as RequirementSet['counts']['byPriority'],
      },
    };
    const found = CONFLICTS.detect(set);
    expect(found.some((c) => c.id.startsWith('CFL-'))).toBe(true);
  });

  it('finds no conflicts for a consistent set', () => {
    const reqs: Requirement[] = [
      {
        id: 'REQ-001',
        description: 'Customers can place orders',
        category: 'functional',
        priority: 'HIGH',
        confidence: 0.9,
        source: 'USER',
        dependencies: [],
        risks: [],
        status: 'CONFIRMED',
        version: 1,
      },
      {
        id: 'REQ-002',
        description: 'Guest checkout with optional account',
        category: 'functional',
        priority: 'MEDIUM',
        confidence: 0.9,
        source: 'USER',
        dependencies: [],
        risks: [],
        status: 'CONFIRMED',
        version: 1,
      },
    ];
    const set: RequirementSet = {
      sessionId: 'c3',
      requirements: reqs,
      byCategory: {} as RequirementSet['byCategory'],
      confidence: 0.9,
      counts: {
        total: 2,
        byStatus: {} as RequirementSet['counts']['byStatus'],
        byPriority: {} as RequirementSet['counts']['byPriority'],
      },
    };
    expect(CONFLICTS.detect(set)).toEqual([]);
  });
});

describe('CompletenessEngine (Phase 10)', () => {
  it('returns NOT_READY when a critical unknown remains, regardless of score', () => {
    const set = extract('Build a restaurant app.', 'k1');
    const defaults: SafeDefault[] = [];
    const result = COMPLETENESS.evaluate({
      sessionId: 'k1',
      requirements: set,
      defaults,
      blockingQuestionIds: ['q-restaurant-payment', 'q-restaurant-service-modes'],
    });
    expect(result.ready).toBe(false);
    expect(result.verdict).toBe('NOT_READY');
    expect(result.criticalUnknowns.length).toBeGreaterThan(0);
  });

  it('becomes ready once critical unknowns are resolved', () => {
    const set = extract('Build a restaurant app.', 'k2');
    // Simulate the answers confirming the UNKNOWN requirements.
    const resolved = {
      ...set,
      requirements: set.requirements.map((r) =>
        r.status === 'UNKNOWN' ? { ...r, status: 'CONFIRMED' as const } : r,
      ),
    };
    const defaults: SafeDefault[] = [
      {
        id: 'd1',
        unknown: 'x',
        assumption: 'a',
        defaultValue: 'v',
        reason: 'r',
        impact: 'i',
        status: 'accepted',
        securitySensitive: false,
      },
    ];
    const result = COMPLETENESS.evaluate({
      sessionId: 'k2',
      requirements: resolved,
      defaults,
      blockingQuestionIds: [],
    });
    expect(result.ready).toBe(true);
    expect(result.criticalUnknowns).toEqual([]);
  });

  it('reports READY_WITH_ASSUMPTIONS when only assumptions remain', () => {
    const set = extract('Build a restaurant app.', 'k3');
    const resolved = {
      ...set,
      requirements: set.requirements.map((r) =>
        r.status === 'UNKNOWN' ? { ...r, status: 'CONFIRMED' as const } : r,
      ),
    };
    const defaults: SafeDefault[] = [
      {
        id: 'd1',
        unknown: 'delivery fees',
        assumption: 'configurable',
        defaultValue: 'configurable fee',
        reason: 'r',
        impact: 'i',
        status: 'proposed',
        securitySensitive: false,
      },
    ];
    const result = COMPLETENESS.evaluate({
      sessionId: 'k3',
      requirements: resolved,
      defaults,
      blockingQuestionIds: [],
    });
    expect(result.verdict).toBe('READY_WITH_ASSUMPTIONS');
  });

  it('computes a per-area score map', () => {
    const set = extract('Build a restaurant app.', 'k4');
    const result = COMPLETENESS.evaluate({
      sessionId: 'k4',
      requirements: set,
      defaults: [],
      blockingQuestionIds: ['q-1'],
    });
    expect(result.perArea.length).toBeGreaterThan(0);
    for (const area of result.perArea) {
      expect(area.score).toBeGreaterThanOrEqual(0);
      expect(area.score).toBeLessThanOrEqual(1);
    }
  });
});
