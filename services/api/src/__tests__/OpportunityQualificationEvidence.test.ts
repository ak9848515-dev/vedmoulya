// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya · S5.1 — Qualification evidence fallbacks
//
// Qualification may only consume evidence the system actually holds. When a
// read fails or a field is absent, the verdict must degrade to "no evidence"
// rather than invent capabilities or market signals. These are the fallback
// paths: a failed Brain task read, a successful read with no payload, and a
// discovery item without a publication date.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type { OpportunityLifecycleRecord } from '@vedmoulya/control-plane';
import type { BrainApplicationService } from '@vedmoulya/brain';
import { createOpportunityQualifier } from '../services/OpportunityQualification.js';

const NOW = '2026-10-06T09:00:00.000Z';

/** A Brain whose task read is scripted — qualification only calls listTasks. */
function brainWith(listTasks: () => unknown): BrainApplicationService {
  return { listTasks } as unknown as BrainApplicationService;
}

function record(overrides: Partial<OpportunityLifecycleRecord> = {}): OpportunityLifecycleRecord {
  return {
    id: 'opp-1',
    ownerId: 'owner-1',
    stableKey: 'owner-1|title',
    title: 'Build a TypeScript SDK',
    description: 'Client needs a typed SDK for their public API.',
    category: 'SaaS / digital product',
    status: 'DISCOVERED',
    evidence: [],
    riskLevel: 'MEDIUM',
    automationPotential: 'UNKNOWN',
    requiredCapabilities: ['typescript', 'api design'],
    transitions: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const TASK = {
  objective: 'Build a TypeScript SDK',
  status: 'completed' as const,
  createdAt: NOW,
};

describe('Opportunity qualification — evidence fallbacks', () => {
  it('qualifies with no historical evidence when the Brain task read fails', () => {
    const qualifier = createOpportunityQualifier({
      brain: brainWith(() => ({
        success: false,
        error: 'brain store unavailable',
        code: 'E_READ',
      })),
      now: () => NOW,
    });

    const result = qualifier.qualify(record());

    expect(result.inputsUsed.relatedWork).toBe(0);
    expect(result.inputsUsed.availableCapabilities).toBe(0);
    // Required capabilities still come from the record itself.
    expect(result.inputsUsed.requiredCapabilities).toBe(2);
    // Degrading to no evidence never becomes an approval.
    expect(result.approved).toBe(false);
    expect(result.authorizationRequired).toBe(true);
  });

  it('qualifies with no historical evidence when a successful read carries no tasks', () => {
    const qualifier = createOpportunityQualifier({
      brain: brainWith(() => ({ success: true })),
      now: () => NOW,
    });

    const result = qualifier.qualify(record());

    expect(result.inputsUsed.relatedWork).toBe(0);
    expect(result.inputsUsed.availableCapabilities).toBe(0);
    expect(result.assessment.score).toBeGreaterThanOrEqual(0);
  });

  it('uses the owner real tasks as the available-capability vocabulary', () => {
    const qualifier = createOpportunityQualifier({
      brain: brainWith(() => ({ success: true, data: [TASK, { ...TASK, objective: 'Ship API' }] })),
      now: () => NOW,
    });

    const result = qualifier.qualify(record());

    expect(result.inputsUsed.relatedWork).toBe(2);
    // "a" is too short to be a capability; the rest are real tokens.
    expect(result.inputsUsed.availableCapabilities).toBe(5); // build, typescript, sdk, ship, api
    expect(result.inputsUsed.marketSignals).toBe(0);
  });

  it('dates a market signal at qualification time when the item is undated', () => {
    const qualifier = createOpportunityQualifier({
      brain: brainWith(() => ({ success: true, data: [] })),
      rawDiscoveryItems: () => [
        { title: 'TypeScript SDK demand rises', description: 'market', source: 'rss' },
        {
          title: 'API tooling roundup',
          description: 'market',
          source: 'rss',
          publishedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      now: () => NOW,
    });

    const result = qualifier.qualify(record());

    expect(result.inputsUsed.marketSignals).toBe(2);
  });

  it('omits value intelligence entirely when no evidence port is wired', () => {
    const qualifier = createOpportunityQualifier({
      brain: brainWith(() => ({ success: true, data: [TASK] })),
      now: () => NOW,
    });

    expect(qualifier.qualify(record()).valueIntelligence).toBeUndefined();
  });
});
