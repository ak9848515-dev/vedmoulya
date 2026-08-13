// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · DailyOutcomeEngine tests
// EPIC-020 (Outcome & Revenue layer) — mission §8.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { DailyOutcomeEngine } from '../domain/DailyOutcomeEngine.js';
import type { BrainTask } from '../types/brain-types.js';
import type { IntelligenceEvent, Opportunity } from '../types/continuous-types.js';

function baseTask(id: string): BrainTask {
  return {
    id,
    userId: 'u1',
    objective: 'Write a weekly report',
    originalInput: 'Write a weekly report',
    intent: {
      objective: 'Write a weekly report',
      domain: 'business',
      desiredOutcome: 'report',
      constraints: [],
      qualityTarget: 'MEDIUM',
      privacyRequirement: 'STANDARD',
      urgency: 'NORMAL',
      authorizedActions: [],
      ambiguities: [],
      assumptions: [],
    },
    mode: 'BALANCED',
    domain: 'business',
    qualityTarget: 'MEDIUM',
    privacyRequirement: 'STANDARD',
    budget: { maxTokens: 10000, maxCostUsd: 0.5, maxIterations: 3, maxLatencyMs: 60000 },
    requiredCapabilities: ['TEXT_GENERATION'],
    roleAssignments: [],
    graph: { nodes: [], edges: [], waves: [] },
    status: 'RUNNING',
    stage: 'EXECUTION',
    stageStatuses: {
      UNDERSTANDING: 'completed',
      PLAN: 'completed',
      INTELLIGENCE: 'completed',
      EXECUTION: 'running',
      VERIFICATION: 'pending',
      RESULT: 'pending',
      CANCELLED: 'pending',
      FAILED: 'pending',
    },
    providerOutputs: [],
    conflicts: [],
    failoverEvents: [],
    decisionRecords: [],
    approvalRequired: [],
    approvalGranted: [],
    traceId: 'trace-1',
    createdAt: '2026-08-16T09:00:00Z',
    updatedAt: '2026-08-16T09:00:00Z',
  };
}

function opportunity(
  overrides: Partial<Opportunity> & { id: string; category: Opportunity['category'] },
): Opportunity {
  return {
    userId: 'u1',
    title: 'New free API for document processing',
    description: 'Screened discovery',
    evidence: ['catalog'],
    uncertainty: 0.4,
    source: 'ai-world-discovery',
    createdAt: '2026-08-16T09:00:00Z',
    status: 'NEW',
    ...overrides,
  };
}

describe('DailyOutcomeEngine', () => {
  const engine = new DailyOutcomeEngine();

  it('surfaces pending approvals as the top action', () => {
    const task = baseTask('t1');
    task.status = 'AWAITING_APPROVAL';
    task.approvalRequired = ['subscribe'];
    const result = engine.plan({ tasks: [task], opportunities: [], events: [] }, 5);
    expect(result[0]?.category).toBe('APPROVAL');
    expect(result[0]?.requiresApproval).toBe('subscribe');
  });

  it('ranks earning opportunities above routine in-flight tasks', () => {
    const result = engine.plan(
      {
        tasks: [baseTask('t1')],
        opportunities: [
          opportunity({
            id: 'o1',
            category: 'earning',
            title: 'Freelance brief for a local business',
          }),
        ],
        events: [],
      },
      5,
    );
    expect(result[0]?.category).toBe('EARNING');
    expect(result[0]?.source.kind).toBe('opportunity');
  });

  it('excludes blocked/suspicious discoveries', () => {
    const events: IntelligenceEvent[] = [
      {
        id: 'e1',
        userId: 'u1',
        kind: 'NEW_GITHUB_REPOSITORY',
        title: 'Suspicious repo',
        description: 'x',
        relevance: 0.9,
        security: 'SUSPICIOUS',
        evidence: [],
        adoptionRequired: [],
        source: 'ai-world',
        createdAt: '2026-08-16T09:00:00Z',
        status: 'NEW',
      },
    ];
    const result = engine.plan({ tasks: [], opportunities: [], events }, 5);
    expect(result.some((r) => r.title.includes('Suspicious'))).toBe(false);
  });

  it('produces a bounded Today Top N (default 5)', () => {
    const tasks = Array.from({ length: 8 }, (_, i) => baseTask(`t${i}`));
    const result = engine.plan({ tasks, opportunities: [], events: [] }, 5);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('exposes why-it-matters + recommended next action for every item', () => {
    const result = engine.plan(
      {
        tasks: [],
        opportunities: [opportunity({ id: 'o1', category: 'cost_saving' })],
        events: [],
      },
      5,
    );
    expect(result.length).toBeGreaterThan(0);
    for (const item of result) {
      expect(item.whyItMatters.length).toBeGreaterThan(0);
      expect(item.recommendedNextAction.length).toBeGreaterThan(0);
      expect(item.priorityScore).toBeGreaterThan(0);
    }
  });
});
