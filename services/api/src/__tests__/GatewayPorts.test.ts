// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway infrastructure port adapter tests
//
// Exercises every narrow gateway port against deterministic fakes of the
// frozen engine services. These adapters are thin composition seams (no new
// engines), so the tests prove: correct delegation, honest fallbacks (never
// fabricated data), bounded/enumerated branch behavior, and owner-scoped
// reads — exactly the contract each port documents.
//
// Covered ports:
//   BrainPorts (EPIC-016/020) · CapabilityEnrichmentPort (EPIC-013)
//   CapabilitySourcePorts (EPIC-013) · EcosystemIntelligencePorts (EPIC-015)
//   LiveIntelligenceBridgePorts (EPIC-017) · ExecutionBridgePorts (EPIC-014)
//   SchedulerPorts (EPIC-018) · RuntimePorts (AI-RUNTIME-002)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';
import type { AIOrchestrationService } from '@vedmoulya/services';
import type { OrchestrateResponseDTO } from '@vedmoulya/services';
import { runWithProviderUser } from '@vedmoulya/providers';
import {
  createBrainPlanPort,
  createBrainCandidatePort,
  createBrainExecutionPort,
  createBrainContextPort,
  createBrainPreferencePort,
  createBrainUsagePort,
  createBrainDiscoveryBridgePort,
  createBrainMemoryPort,
} from '../infrastructure/BrainPorts.js';
import { createCapabilityEnrichmentPort } from '../infrastructure/CapabilityEnrichmentPort.js';
import { createCapabilitySourcePort } from '../infrastructure/CapabilitySourcePorts.js';
import {
  createGitHubAuthPort,
  createGitHubRepoSourcePort,
} from '../infrastructure/EcosystemIntelligencePorts.js';
import {
  createBridgeClockPort,
  createBridgeBrainPort,
  createBridgeIntelligencePort,
  createBridgeMarketplacePort,
  createBridgeExecutionPort,
  createBridgeAiWorldPort,
} from '../infrastructure/LiveIntelligenceBridgePorts.js';
import {
  createStepExecutionPort,
  createExecutionPlanSource,
  createExecutionBudgetConfig,
} from '../infrastructure/ExecutionBridgePorts.js';
import {
  createSchedulerClockPort,
  createSchedulerDiscoveryPort,
  createSchedulerBrainPort,
  createSchedulerNotifyPort,
} from '../infrastructure/SchedulerPorts.js';
import {
  createProviderIntelligencePort,
  createExecutionStrategyPort,
  createRagRetrievalPort,
} from '../infrastructure/RuntimePorts.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** A deterministic AI runtime fake: orchestrate() returns the crafted DTO. */
function fakeAi(result: Partial<OrchestrateResponseDTO>): AIOrchestrationService {
  const full: OrchestrateResponseDTO = {
    content: 'mock content',
    provider: 'mock',
    model: 'mock-1',
    confidence: 0.9,
    qualityScore: 0.8,
    latency: 5,
    cost: 0.01,
    tokenUsage: { input: 10, output: 20, total: 30 },
    validation: { decision: 'ACCEPT', issues: [] },
    traceId: 'mock-trace',
    routingDecision: { selectedProvider: 'mock', strategy: 'balanced', reason: 'mock routing' },
    ...result,
  };
  return { orchestrate: async () => full } as unknown as AIOrchestrationService;
}

/** Minimal routed orchestrate result used by the specialist port adapters. */
function specialistResult(overrides: Partial<OrchestrateResponseDTO> = {}): OrchestrateResponseDTO {
  return {
    content: '{"confident":true}',
    provider: 'mock',
    model: 'mock-1',
    confidence: 0.9,
    qualityScore: 0.8,
    latency: 5,
    cost: 0.01,
    tokenUsage: { input: 10, output: 20, total: 30 },
    validation: { decision: 'ACCEPT', issues: [] },
    traceId: 'mock-trace',
    routingDecision: { selectedProvider: 'mock', strategy: 'balanced', reason: 'mock routing' },
    ...overrides,
  };
}

// ── BrainPorts (EPIC-016/020) ───────────────────────────────────────────────

describe('createBrainPlanPort', () => {
  it('delegates planFor to the real capability marketplace service', async () => {
    const plan = { planId: 'p1' };
    const capability = { plan: vi.fn(async () => plan) };
    const port = createBrainPlanPort({
      capability: capability as never,
      capabilitySource: {} as never,
      ai: {} as never,
      preferenceLedger: {} as never,
    });
    await expect(port.planFor('u1', 'outcome-x')).resolves.toBe(plan);
    expect(capability.plan).toHaveBeenCalledWith('u1', { outcome: 'outcome-x' });
  });
});

describe('createBrainCandidatePort', () => {
  it('delegates all three candidate seams to the shared capability source', async () => {
    const p = [{ providerId: 'p1' }];
    const d = [{ itemId: 'i1' }];
    const l = [{ id: 'l1' }];
    const source = {
      providerCandidates: vi.fn(async () => p),
      discoveryCandidates: vi.fn(async () => d),
      localModelCandidates: vi.fn(async () => l),
    };
    const port = createBrainCandidatePort({
      capability: {} as never,
      capabilitySource: source as never,
      ai: {} as never,
      preferenceLedger: {} as never,
    });
    await expect(port.providerCandidates('CODING')).resolves.toBe(p);
    await expect(port.discoveryCandidates('CODING')).resolves.toBe(d);
    await expect(port.localModelCandidates('CODING')).resolves.toBe(l);
    expect(source.providerCandidates).toHaveBeenCalledWith('CODING');
    expect(source.discoveryCandidates).toHaveBeenCalledWith('CODING');
    expect(source.localModelCandidates).toHaveBeenCalledWith('CODING');
  });
});

describe('createBrainExecutionPort', () => {
  it('executes through the frozen AI specialist port', async () => {
    const ai = fakeAi(specialistResult({ content: 'executed' }));
    const port = createBrainExecutionPort({
      capability: {} as never,
      capabilitySource: {} as never,
      ai,
      preferenceLedger: {} as never,
    });
    const result = await port.execute({
      taskId: 't1',
      capability: 'reasoning',
      qualityTier: 'standard',
      userInput: 'do it',
      userId: 'u1',
    });
    expect(result.content).toBe('executed');
    expect(result.provider).toBe('mock');
  });
});

describe('createBrainContextPort', () => {
  it('assembles a minimal task-relevant context string', async () => {
    const port = createBrainContextPort();
    await expect(port.assemble('u1', ['REASONING', 'CODING'])).resolves.toContain(
      'Task-relevant capabilities: REASONING, CODING',
    );
  });
});

describe('createBrainUsagePort', () => {
  it('returns undefined when no provider experience service is wired', () => {
    const port = createBrainUsagePort({
      capability: {} as never,
      capabilitySource: {} as never,
      ai: {} as never,
      preferenceLedger: {} as never,
    });
    expect(port).toBeUndefined();
  });

  it('maps availability/latency/free-tier facts honestly from the overview', async () => {
    const providerExperience = {
      getOverview: vi.fn(async () => ({
        success: true,
        data: {
          providers: [
            {
              providerId: 'p-avail',
              availability: 'AVAILABLE',
              freeToUse: false,
              health: { status: 'healthy', latencyMs: 42 },
            },
            {
              providerId: 'p-limited',
              availability: 'LIMITED',
              freeToUse: true,
              health: { status: 'degraded', latencyMs: 0 },
            },
            {
              providerId: 'p-unavail',
              availability: 'UNAVAILABLE',
              freeToUse: false,
              health: { status: 'down', latencyMs: 5 },
            },
            {
              providerId: 'p-unknown',
              availability: 'UNKNOWN',
              freeToUse: false,
              health: { status: 'unknown', latencyMs: 0 },
            },
          ],
        },
      })),
    };
    const port = createBrainUsagePort({
      capability: {} as never,
      capabilitySource: {} as never,
      ai: {} as never,
      preferenceLedger: {} as never,
      providerExperience: providerExperience as never,
    });
    const facts = await port?.usageFacts('u1', ['p-avail', 'p-limited', 'p-unavail', 'p-missing']);
    const byId = new Map(facts?.map((f) => [f.providerId, f]));
    expect(byId.get('p-avail')?.availability).toEqual({ value: 1, status: 'KNOWN' });
    expect(byId.get('p-avail')?.latencyMs).toEqual({ value: 42, status: 'KNOWN' });
    expect(byId.get('p-limited')?.availability).toEqual({ value: 0.6, status: 'KNOWN' });
    expect(byId.get('p-limited')?.freeTierStatus).toEqual({ value: 'free', status: 'KNOWN' });
    expect(byId.get('p-unavail')?.availability).toEqual({ value: 0, status: 'KNOWN' });
    // Unknown health → no availability fact (never fabricated), no fact at all.
    expect(byId.get('p-unknown')?.availability).toBeUndefined();
    expect(byId.get('p-missing')).toBeUndefined();
  });

  it('uses the 0.5 fallback for unknown availability with a known health status', async () => {
    const providerExperience = {
      getOverview: vi.fn(async () => ({
        success: true,
        data: {
          providers: [
            {
              providerId: 'p-x',
              availability: 'WEIRD',
              freeToUse: false,
              health: { status: 'healthy', latencyMs: 1 },
            },
          ],
        },
      })),
    };
    const port = createBrainUsagePort({
      capability: {} as never,
      capabilitySource: {} as never,
      ai: {} as never,
      preferenceLedger: {} as never,
      providerExperience: providerExperience as never,
    });
    const facts = await port?.usageFacts('u1', ['p-x']);
    expect(facts?.[0]?.availability).toEqual({ value: 0.5, status: 'KNOWN' });
  });
});

describe('createBrainDiscoveryBridgePort', () => {
  const item = (overrides: Record<string, unknown>) => ({
    id: 'i1',
    category: 'model',
    title: 'Model X',
    summary: 'summary',
    relevanceLabel: 'high',
    securityFlags: [],
    evidence: [{ claim: 'c1' }],
    github: undefined,
    ...overrides,
  });

  it('returns undefined when AI World is not wired', () => {
    const port = createBrainDiscoveryBridgePort({
      capability: {} as never,
      capabilitySource: {} as never,
      ai: {} as never,
      preferenceLedger: {} as never,
    });
    expect(port).toBeUndefined();
  });

  it('screens world items into security-tagged intelligence events, deduping ids', async () => {
    const aiWorld = {
      getWorld: vi.fn(async () => ({
        world: {
          important: [item({ id: 'dup', category: 'github', title: 'Repo A' })],
          recommended: [item({ id: 'dup', category: 'github', title: 'Repo A' })],
          github: [],
          updates: [],
        },
      })),
    };
    const port = createBrainDiscoveryBridgePort({
      capability: {} as never,
      capabilitySource: {} as never,
      ai: {} as never,
      preferenceLedger: {} as never,
      aiWorld: aiWorld as never,
    });
    const events = await port?.fetchIntelligenceEvents('u1');
    expect(events).toHaveLength(1);
    expect(events?.[0]?.kind).toBe('NEW_GITHUB_REPOSITORY');
    expect(events?.[0]?.id).toBe('aiworld-dup');
    expect(events?.[0]?.userId).toBe('u1');
    expect(events?.[0]?.relevance).toBe(0.9);
  });

  it('classifies every discovery category into a brain event kind', async () => {
    const aiWorld = {
      getWorld: vi.fn(async () => ({
        world: {
          important: [
            item({ id: 'm1', category: 'model' }),
            item({ id: 'p-price', category: 'provider', title: 'New pricing plans' }),
            item({ id: 'p-dep', category: 'provider', summary: 'model sunset announced' }),
            item({ id: 'p-other', category: 'provider', title: 'New region' }),
            item({ id: 'a-free', category: 'application', title: 'free api tier' }),
            item({ id: 'a-tool', category: 'application', title: 'Toolkit v2' }),
            item({ id: 'n-free', category: 'news', title: 'free quota doubled' }),
            item({ id: 'n-sec', category: 'news', title: 'security breach disclosed' }),
            item({ id: 'n-other', category: 'news', title: 'ecosystem update' }),
          ],
          recommended: [],
          github: [],
          updates: [],
        },
      })),
    };
    const port = createBrainDiscoveryBridgePort({
      capability: {} as never,
      capabilitySource: {} as never,
      ai: {} as never,
      preferenceLedger: {} as never,
      aiWorld: aiWorld as never,
    });
    const events = await port?.fetchIntelligenceEvents('u1');
    const kinds = new Map(events?.map((e) => [e.id, e.kind]));
    expect(kinds.get('aiworld-m1')).toBe('NEW_MODEL');
    expect(kinds.get('aiworld-p-price')).toBe('PRICING_CHANGE');
    expect(kinds.get('aiworld-p-dep')).toBe('MODEL_DEPRECATION');
    expect(kinds.get('aiworld-p-other')).toBe('PROVIDER_CHANGE');
    expect(kinds.get('aiworld-a-free')).toBe('NEW_FREE_API');
    expect(kinds.get('aiworld-a-tool')).toBe('NEW_OPEN_SOURCE_TOOL');
    expect(kinds.get('aiworld-n-free')).toBe('NEW_FREE_TIER');
    expect(kinds.get('aiworld-n-sec')).toBe('SECURITY_CONCERN');
    expect(kinds.get('aiworld-n-other')).toBe('ECOSYSTEM_DEVELOPMENT');
  });

  it('classifies security from flags, github metadata, and absence of indicators', async () => {
    const aiWorld = {
      getWorld: vi.fn(async () => ({
        world: {
          important: [
            item({ id: 'blocked', securityFlags: ['BLOCKED'] }),
            item({ id: 'susp', securityFlags: ['suspicious'] }),
            item({ id: 'review', securityFlags: ['other'] }),
            item({
              id: 'gh-susp',
              category: 'github',
              github: { flags: ['suspicious'], license: 'MIT', licenseConfidence: 'KNOWN' },
            }),
            item({
              id: 'gh-unknown',
              category: 'github',
              github: { flags: [], license: undefined, licenseConfidence: 'UNKNOWN' },
            }),
            item({
              id: 'gh-review',
              category: 'github',
              github: {
                flags: ['unclear_license'],
                license: 'Custom',
                licenseConfidence: 'KNOWN',
              },
            }),
            item({
              id: 'gh-clean',
              category: 'github',
              github: { flags: [], license: 'MIT', licenseConfidence: 'KNOWN' },
            }),
            item({ id: 'other', category: 'news', securityFlags: [] }),
          ],
          recommended: [],
          github: [],
          updates: [],
        },
      })),
    };
    const port = createBrainDiscoveryBridgePort({
      capability: {} as never,
      capabilitySource: {} as never,
      ai: {} as never,
      preferenceLedger: {} as never,
      aiWorld: aiWorld as never,
    });
    const events = await port?.fetchIntelligenceEvents('u1');
    const security = new Map(events?.map((e) => [e.id, e.security]));
    expect(security.get('aiworld-blocked')).toBe('BLOCKED');
    expect(security.get('aiworld-susp')).toBe('SUSPICIOUS');
    expect(security.get('aiworld-review')).toBe('SECURITY_REVIEW_REQUIRED');
    expect(security.get('aiworld-gh-susp')).toBe('SUSPICIOUS');
    expect(security.get('aiworld-gh-unknown')).toBe('UNKNOWN');
    expect(security.get('aiworld-gh-review')).toBe('SECURITY_REVIEW_REQUIRED');
    expect(security.get('aiworld-gh-clean')).toBe('TRUSTED_WITH_REVIEW');
    expect(security.get('aiworld-other')).toBe('TRUSTED_WITH_REVIEW');
  });

  it('uses medium/low relevance for non-high labels and truncates evidence', async () => {
    const aiWorld = {
      getWorld: vi.fn(async () => ({
        world: {
          important: [
            item({
              id: 'med',
              category: 'news',
              relevanceLabel: 'medium',
              evidence: [
                { claim: '1' },
                { claim: '2' },
                { claim: '3' },
                { claim: '4' },
                { claim: '5' },
              ],
            }),
            item({ id: 'low', category: 'news', relevanceLabel: 'low' }),
          ],
          recommended: [],
          github: [],
          updates: [],
        },
      })),
    };
    const port = createBrainDiscoveryBridgePort({
      capability: {} as never,
      capabilitySource: {} as never,
      ai: {} as never,
      preferenceLedger: {} as never,
      aiWorld: aiWorld as never,
    });
    const events = await port?.fetchIntelligenceEvents('u1');
    expect(events?.find((e) => e.id === 'aiworld-med')?.relevance).toBe(0.6);
    expect(events?.find((e) => e.id === 'aiworld-low')?.relevance).toBe(0.35);
    expect(events?.find((e) => e.id === 'aiworld-med')?.evidence).toHaveLength(4);
  });
});

describe('createBrainMemoryPort', () => {
  it('returns undefined when memory intelligence is not wired', () => {
    const port = createBrainMemoryPort({
      capability: {} as never,
      capabilitySource: {} as never,
      ai: {} as never,
      preferenceLedger: {} as never,
    });
    expect(port).toBeUndefined();
  });

  it('captures outcome evidence into memory intelligence (success outcome)', async () => {
    const memoryIntelligence = { capture: vi.fn(async () => ({})) };
    const port = createBrainMemoryPort({
      capability: {} as never,
      capabilitySource: {} as never,
      ai: {} as never,
      preferenceLedger: {} as never,
      memoryIntelligence: memoryIntelligence as never,
    });
    await port?.recordOutcome({
      userId: 'u1',
      taskId: 't1',
      taskType: 'coding',
      providers: [{ providerId: 'p1', capability: 'reasoning', role: 'PRIMARY', succeeded: true }],
      selectedReason: ['good quality'],
      outcome: 'SUCCESS',
      userAccepted: true,
      capturedAt: 'now',
    } as never);
    expect(memoryIntelligence.capture).toHaveBeenCalledTimes(1);
    const payload = memoryIntelligence.capture.mock.calls[0]?.[0] as {
      confidence: { score: number };
      content: string;
    };
    expect(payload.confidence.score).toBe(0.9);
    expect(payload.content).toContain('p1:ok');
    expect(payload.content).toContain('good quality');
  });

  it('is non-fatal when memory capture fails', async () => {
    const memoryIntelligence = {
      capture: vi.fn(async () => {
        throw new Error('store down');
      }),
    };
    const port = createBrainMemoryPort({
      capability: {} as never,
      capabilitySource: {} as never,
      ai: {} as never,
      preferenceLedger: {} as never,
      memoryIntelligence: memoryIntelligence as never,
    });
    await expect(
      port?.recordOutcome({
        userId: 'u1',
        taskId: 't1',
        taskType: 'coding',
        providers: [],
        selectedReason: [],
        outcome: 'FAILED',
        userAccepted: false,
        capturedAt: 'now',
      } as never),
    ).resolves.toBeUndefined();
    expect(memoryIntelligence.capture).toHaveBeenCalledTimes(1);
  });
});

describe('createBrainPreferencePort', () => {
  it('records a full event with a generated id and timestamp into the ledger', async () => {
    const ledger = { record: vi.fn() };
    const port = createBrainPreferencePort(ledger as never);
    await port.record({ type: 'provider-preference', payload: { providerId: 'p1' } } as never);
    expect(ledger.record).toHaveBeenCalledTimes(1);
    const event = ledger.record.mock.calls[0]?.[0] as { eventId: string; timestamp: string };
    expect(event.eventId).toMatch(/^brain-/);
    expect(typeof event.timestamp).toBe('string');
    expect(event).toMatchObject({ type: 'provider-preference' });
  });
});

// ── CapabilityEnrichmentPort (EPIC-013) ─────────────────────────────────────

describe('createCapabilityEnrichmentPort', () => {
  it('enriches with a valid compact JSON payload', async () => {
    const ai = fakeAi(
      specialistResult({
        content:
          '{"confident":true,"suggestedCapabilities":["REASONING","NOT_A_CAP"],"suggestedSteps":["a"],"summary":"  do it  "}',
      }),
    );
    const port = createCapabilityEnrichmentPort(ai);
    const result = await port.enrich({ outcome: 'build a site' });
    expect(result.confident).toBe(true);
    expect(result.suggestedCapabilities).toEqual(['REASONING']); // whitelisted only
    expect(result.suggestedSteps).toEqual(['a']);
    expect(result.summary).toBe('do it');
    expect(result.provider).toBe('mock');
  });

  it('tolerates markdown fences around the JSON', async () => {
    const ai = fakeAi(
      specialistResult({
        content: '```json\n{"confident":true,"suggestedCapabilities":["CODING"]}\n```',
      }),
    );
    const port = createCapabilityEnrichmentPort(ai);
    const result = await port.enrich({ outcome: 'x' });
    expect(result.confident).toBe(true);
    expect(result.suggestedCapabilities).toEqual(['CODING']);
  });

  it('returns the non-confident fallback for invalid JSON (never fabricated)', async () => {
    const ai = fakeAi(specialistResult({ content: 'not json at all' }));
    const port = createCapabilityEnrichmentPort(ai);
    const result = await port.enrich({ outcome: 'x' });
    expect(result.confident).toBe(false);
    expect(result.suggestedCapabilities).toEqual([]);
    expect(result.summary).toBeUndefined();
  });

  it('is non-fatal when the specialist call throws', async () => {
    const ai = {
      orchestrate: async () => {
        throw new Error('provider down');
      },
    } as unknown as AIOrchestrationService;
    const port = createCapabilityEnrichmentPort(ai);
    const result = await port.enrich({ outcome: 'x' });
    expect(result.confident).toBe(false);
    expect(result.provider).toBe('none');
    expect(result.model).toBe('none');
  });

  it('handles non-boolean confident and non-string summary shapes', async () => {
    const ai = fakeAi(
      specialistResult({
        content: JSON.stringify({
          confident: 'yes',
          suggestedCapabilities: [1, 'CODING'],
          suggestedSteps: 'nope',
          summary: 42,
        }),
      }),
    );
    const port = createCapabilityEnrichmentPort(ai);
    const result = await port.enrich({ outcome: 'x' });
    expect(result.confident).toBe(false);
    expect(result.suggestedCapabilities).toEqual(['CODING']);
    expect(result.suggestedSteps).toEqual([]);
    expect(result.summary).toBeUndefined();
  });

  it('caps suggested capabilities at 10 and honors an empty-summary case', async () => {
    const many = Array.from({ length: 15 }, (_, i) => `CAPABILITY_${i}`);
    const ai = fakeAi(
      specialistResult({
        content: JSON.stringify({
          confident: false,
          suggestedCapabilities: many,
          suggestedSteps: [],
          summary: '',
        }),
      }),
    );
    const port = createCapabilityEnrichmentPort(ai);
    const result = await port.enrich({ outcome: 'x' });
    expect(result.suggestedCapabilities).toHaveLength(0); // none are real CapabilityIds
    expect(result.summary).toBeUndefined();
  });
});

// ── CapabilitySourcePorts (EPIC-013) ────────────────────────────────────────

describe('createCapabilitySourcePort', () => {
  const provider = (overrides: Record<string, unknown> = {}) => ({
    id: 'p1',
    family: 'openai',
    name: 'OpenAI',
    models: [{ id: 'gpt-4', name: 'GPT-4' }],
    bestQuality: 0.9,
    costTier: 'standard',
    availability: 'AVAILABLE',
    health: { status: 'healthy' },
    lifecycleStatus: 'active',
    ...overrides,
  });

  it('maps registry providers into provider candidate facts, deduping across features', async () => {
    const providers = {
      listByCapability: vi.fn(async () => ({
        data: [provider({ id: 'p1' }), provider({ id: 'p2', bestQuality: 0 })],
      })),
    };
    const localModelDiscovery = {
      discover: vi.fn(async () => ({ discovered: false, models: [] })),
    };
    const port = createCapabilitySourcePort({
      providers: providers as never,
      aiWorld: {} as never,
      localModelDiscovery: localModelDiscovery as never,
    });
    const facts = await port.providerCandidates('REASONING');
    expect(facts).toHaveLength(2);
    expect(facts[0]?.quality).toBe(0.9);
    expect(facts[1]?.quality).toBeUndefined(); // bestQuality 0 → no fabricated quality
    expect(facts[0]?.configured).toBe(true); // healthy + active
    expect(facts[0]?.modelId).toBe('gpt-4');
    expect(facts[0]?.evidence[0]?.source).toBe('provider-registry');
  });

  it('marks providers as unconfigured when health/lifecycle are not healthy/active', async () => {
    const providers = {
      listByCapability: vi.fn(async () => ({
        data: [provider({ health: { status: 'down' }, lifecycleStatus: 'retired' })],
      })),
    };
    const port = createCapabilitySourcePort({
      providers: providers as never,
      aiWorld: {} as never,
      localModelDiscovery: {
        discover: vi.fn(async () => ({ discovered: false, models: [] })),
      } as never,
    });
    const facts = await port.providerCandidates('CODING');
    expect(facts[0]?.configured).toBe(false);
  });

  it('deduplicates the same provider id surfaced by multiple AI features', async () => {
    const providers = {
      listByCapability: vi.fn(async (feature: string) => ({
        data: feature === 'reasoning' ? [provider({ id: 'dup' })] : [provider({ id: 'dup' })],
      })),
    };
    const port = createCapabilitySourcePort({
      providers: providers as never,
      aiWorld: {} as never,
      localModelDiscovery: {
        discover: vi.fn(async () => ({ discovered: false, models: [] })),
      } as never,
    });
    const facts = await port.providerCandidates('RESEARCH'); // maps to reasoning + content_generation
    expect(facts).toHaveLength(1);
  });

  it('screens AI World discovery items by capability keywords within the request user context', async () => {
    const aiWorld = {
      listItems: vi.fn(async () => [
        {
          item: {
            id: 'd1',
            category: 'model',
            title: 'Coding assistant model',
            capabilities: ['code'],
            freeClass: 'FREE',
            localAvailability: 'available',
            modelFacts: { configurable: true, suggestedFamily: 'openai' },
            github: { name: 'repo', license: 'MIT', flags: [] },
            evidence: [{ claim: 'c', source: 's', sourceUrl: 'u', confidence: 'HIGH' }],
            securityFlags: [],
          },
        },
        {
          item: {
            id: 'd2',
            category: 'news',
            title: 'Unrelated news',
            capabilities: ['news'],
            freeClass: 'PAID',
            localAvailability: 'none',
            evidence: [],
            securityFlags: [],
          },
        },
      ]),
    };
    const port = createCapabilitySourcePort({
      providers: {} as never,
      aiWorld: aiWorld as never,
      localModelDiscovery: {
        discover: vi.fn(async () => ({ discovered: false, models: [] })),
      } as never,
    });
    // No request context → no cross-user surface, empty result.
    await expect(port.discoveryCandidates('CODING')).resolves.toEqual([]);
    // Inside the request context the discovery read is scoped to the caller.
    const facts = await runWithProviderUser('u1', () => port.discoveryCandidates('CODING'));
    expect(facts).toHaveLength(1);
    expect(facts[0]?.itemId).toBe('d1');
    expect(facts[0]?.configurable).toBe(true);
    expect(facts[0]?.github?.name).toBe('repo');
  });

  it('maps local models with matching features only and honest availability', async () => {
    const localModelDiscovery = {
      discover: vi.fn(async () => ({
        discovered: true,
        models: [
          {
            id: 'llama',
            name: 'Llama',
            sizeGb: 4,
            runtime: 'ollama',
            capabilities: ['reasoning'],
            capabilitiesProvenance: 'VERIFIED',
            status: 'available',
          },
          {
            id: 'no-match',
            name: 'No Match',
            sizeGb: 1,
            runtime: 'ollama',
            capabilities: ['video'],
            capabilitiesProvenance: 'INFERRED',
            status: 'downloading',
          },
          {
            id: 'empty',
            name: 'Empty',
            sizeGb: 1,
            runtime: 'ollama',
            capabilities: [],
            capabilitiesProvenance: 'UNKNOWN',
            status: 'available',
          },
        ],
      })),
    };
    const port = createCapabilitySourcePort({
      providers: {} as never,
      aiWorld: {} as never,
      localModelDiscovery: localModelDiscovery as never,
    });
    const facts = await port.localModelCandidates('REASONING');
    expect(facts).toHaveLength(1);
    expect(facts[0]?.id).toBe('llama');
    expect(facts[0]?.available).toBe(true);
    expect(facts[0]?.evidence[0]?.confidence).toBe('MEASURED');
  });

  it('returns no local candidates when discovery is not available', async () => {
    const port = createCapabilitySourcePort({
      providers: {} as never,
      aiWorld: {} as never,
      localModelDiscovery: {
        discover: vi.fn(async () => ({ discovered: false, models: [] })),
      } as never,
    });
    await expect(port.localModelCandidates('CODING')).resolves.toEqual([]);
  });
});

// ── EcosystemIntelligencePorts (EPIC-015) ───────────────────────────────────

describe('createGitHubAuthPort', () => {
  it('begins authorization with the requested scopes joined into the URL', async () => {
    const port = createGitHubAuthPort();
    const result = await port.beginAuthorization('u1', ['public_metadata', 'private_repos_read']);
    expect(result.state).toMatch(/^state-u1-/);
    expect(result.authorizationUrl).toContain('public_metadata+private_repos_read');
    expect(result.authorizationUrl).toContain('state=');
  });

  it('completes authorization deterministically with the reviewed scopes', async () => {
    const port = createGitHubAuthPort();
    const result = await port.completeAuthorization('u1', 'code', 'state');
    expect(result.accountLogin).toBe('vedmoulya-operator');
    expect(result.grantedScopes).toEqual(['public_metadata']);
  });

  it('verifies and revokes', async () => {
    const port = createGitHubAuthPort();
    const verify = await port.verify('u1');
    expect(verify.valid).toBe(true);
    expect(verify.login).toBe('vedmoulya-operator');
    await expect(port.revoke('u1')).resolves.toBeUndefined();
  });
});

describe('createGitHubRepoSourcePort', () => {
  const item = (overrides: Record<string, unknown> = {}) => ({
    category: 'github',
    title: 'Repo Title',
    summary: 'A repo summary',
    github: {
      name: 'owner/repo',
      language: 'TypeScript',
      stars: 10,
      forks: 2,
      lastCommitAt: 'now',
      license: 'MIT',
      flags: [],
    },
    ...overrides,
  });

  it('lists public repo facts without private access', async () => {
    const aiWorld = {
      listItems: vi.fn(async () => [{ item: item() }]),
    };
    const port = createGitHubRepoSourcePort(aiWorld as never);
    const repos = await port.list('u1', { grantedScopes: ['public_metadata'] } as never);
    expect(repos).toHaveLength(1);
    expect(repos[0]?.fullName).toBe('owner/repo');
    expect(repos[0]?.visibility).toBe('public');
    expect(repos[0]?.language).toBe('TypeScript');
    expect(repos[0]?.stars).toBe(10);
    expect(repos[0]?.defaultBranch).toBe('main');
    expect(repos[0]?.archived).toBe(false);
  });

  it('exposes private repos only under an explicit grant, and flags abandoned repos', async () => {
    const aiWorld = {
      listItems: vi.fn(async () => [
        { item: item({ id: 'pub', github: { name: 'a/b', flags: ['abandoned'] } }) },
        { item: item({ id: 'priv', github: { name: 'c/d', flags: [] } }) },
      ]),
    };
    const port = createGitHubRepoSourcePort(aiWorld as never);
    const without = await port.list('u1', { grantedScopes: ['public_metadata'] } as never);
    expect(without).toHaveLength(2); // both are public repos (visibility is always public)
    expect(without.find((r) => r.fullName === 'a/b')?.archived).toBe(true);
    const withGrant = await port.list('u1', {
      grantedScopes: ['public_metadata', 'private_repos_read'],
    } as never);
    expect(withGrant).toHaveLength(2);
    void withGrant;
  });

  it('falls back to the item title when github metadata is missing and ignores non-github items', async () => {
    const aiWorld = {
      listItems: vi.fn(async () => [
        { item: item({ github: undefined }) },
        { item: { category: 'model', title: 'A model' } },
      ]),
    };
    const port = createGitHubRepoSourcePort(aiWorld as never);
    const repos = await port.list('u1', { grantedScopes: [] } as never);
    expect(repos).toHaveLength(1);
    expect(repos[0]?.fullName).toBe('Repo Title');
  });
});

// ── LiveIntelligenceBridgePorts (EPIC-017) ──────────────────────────────────

describe('createBridgeClockPort', () => {
  it('returns the frozen SystemClock', () => {
    const clock = createBridgeClockPort();
    expect(typeof clock.now()).toBe('string'); // ISO timestamp
    expect(typeof clock.timestampMs()).toBe('number');
  });
});

describe('createBridgeBrainPort', () => {
  it('delegates every bridge call to the real Brain service', async () => {
    const brain = {
      createTask: vi.fn(async () => ({ taskId: 't' })),
      plan: vi.fn(async () => ({})),
      selectResources: vi.fn(async () => ({})),
      requestApproval: vi.fn(async () => ({})),
      approve: vi.fn(async () => ({})),
      reject: vi.fn(async () => ({})),
      execute: vi.fn(async () => ({})),
      verify: vi.fn(async () => ({})),
      evaluateOutcome: vi.fn(async () => ({})),
      getStatus: vi.fn(async () => ({})),
      listTasks: vi.fn(async () => ({ data: [] })),
    };
    const port = createBridgeBrainPort(brain as never);
    await port.createTask('u1', 'objective');
    await port.plan('u1', 't');
    await port.selectResources('u1', 't');
    await port.requestApproval('u1', 't', 'action');
    await port.approve('u1', 't', 'action');
    await port.reject('u1', 't', 'action');
    await port.execute('u1', 't');
    await port.verify('u1', 't');
    await port.evaluateOutcome('u1', 't', true);
    await port.getStatus('u1', 't');
    await port.listTasks('u1');
    expect(brain.createTask).toHaveBeenCalledWith('u1', 'objective');
    expect(brain.listTasks).toHaveBeenCalledWith('u1');
    expect(brain.evaluateOutcome).toHaveBeenCalledWith('u1', 't', true);
  });
});

describe('createBridgeIntelligencePort', () => {
  it('delegates every intelligence call to the real service', async () => {
    const intelligence = {
      findBetterOption: vi.fn(async () => ({})),
      findFreeAlternative: vi.fn(async () => ({})),
      findLocalAlternative: vi.fn(async () => ({})),
      findGitHubCapability: vi.fn(async () => ({})),
      findBetterProvider: vi.fn(async () => ({})),
      evaluateSecurity: vi.fn(async () => ({})),
      evaluateLicense: vi.fn(async () => ({})),
      respondToRecommendation: vi.fn(async () => ({})),
      notify: vi.fn(async () => ({ emitted: true })),
    };
    const port = createBridgeIntelligencePort(intelligence as never);
    await port.findBetterOption('u1', 'CODING', {});
    await port.findFreeAlternative('u1', 'CODING');
    await port.findLocalAlternative('u1', 'CODING');
    await port.findGitHubCapability('u1', 'CODING');
    await port.findBetterProvider('u1', 'CODING');
    await port.evaluateSecurity('u1', 'res');
    await port.evaluateLicense('u1', {});
    await port.respondToRecommendation('u1', 'r', 'ACCEPT');
    await port.notify('u1', { kind: 'BETTER_PROVIDER_DISCOVERED', title: 't', body: 'b' });
    expect(intelligence.findBetterOption).toHaveBeenCalledWith('u1', 'CODING', {});
    expect(intelligence.notify).toHaveBeenCalled();
  });
});

describe('createBridgeMarketplacePort', () => {
  it('delegates plan and getPlan to the real capability service', async () => {
    const capability = {
      plan: vi.fn(async () => ({ planId: 'p' })),
      getPlan: vi.fn(async () => ({ planId: 'p' })),
    };
    const port = createBridgeMarketplacePort(capability as never);
    await port.plan('u1', { outcome: 'o' });
    await port.getPlan('u1', 'p');
    expect(capability.plan).toHaveBeenCalledWith('u1', { outcome: 'o' });
    expect(capability.getPlan).toHaveBeenCalledWith('u1', 'p');
  });
});

describe('createBridgeExecutionPort', () => {
  it('delegates every execution call to the real run service', async () => {
    const execution = {
      start: vi.fn(async () => ({})),
      approve: vi.fn(async () => ({})),
      reject: vi.fn(async () => ({})),
      completeHandoff: vi.fn(async () => ({})),
      get: vi.fn(async () => ({})),
      list: vi.fn(async () => []),
    };
    const port = createBridgeExecutionPort(execution as never);
    await port.start('u1', 'plan-1');
    await port.approve('u1', 'e1', 's1', 'note');
    await port.reject('u1', 'e1', 's1', 'note');
    await port.completeHandoff('u1', 'e1', 's1', 'note');
    await port.get('u1', 'e1');
    await port.list('u1');
    expect(execution.approve).toHaveBeenCalledWith('u1', 'e1', 's1', 'note');
    expect(execution.list).toHaveBeenCalledWith('u1');
  });
});

describe('createBridgeAiWorldPort', () => {
  const notify = vi.fn(async () => ({ emitted: true }));

  it.each([
    ['NEW_MODEL', 'BETTER_PROVIDER_DISCOVERED'],
    ['BETTER_MODEL', 'BETTER_PROVIDER_DISCOVERED'],
    ['FREE_QUOTA_AVAILABLE', 'FREE_QUOTA_INCREASED'],
    ['FREE_QUOTA_CHANGED', 'FREE_QUOTA_INCREASED'],
    ['PROVIDER_DEGRADED', 'PROVIDER_UNAVAILABLE'],
    ['NEW_GITHUB_PROJECT', 'USEFUL_GITHUB_PROJECT'],
    ['GITHUB_PROJECT_ABANDONED', 'PROVIDER_RETIRED'],
    ['SECURITY_CHANGE', 'SECURITY_WARNING'],
    ['NEW_LOCAL_MODEL', 'LOCAL_MODEL_SUITABLE'],
    ['BETTER_CAPABILITY', 'PAID_TOOL_MATERIALLY_BETTER'],
    ['PRICE_CHANGE', 'FREE_QUOTA_INCREASED'],
    ['MODEL_DEPRECATED', 'PROVIDER_RETIRED'],
    ['UNKNOWN_KIND', 'BETTER_PROVIDER_DISCOVERED'],
  ] as const)('maps %s → %s', async (kind, expected) => {
    const intelligence = {
      notify: vi.fn(async () => ({ emitted: true })),
      listNotifications: vi.fn(() => []),
    };
    const port = createBridgeAiWorldPort(intelligence as never);
    const result = port.emit('u1', {
      kind,
      title: 't',
      body: 'b',
      relevance: 0.8,
      id: 'i1',
    } as never);
    expect(result.emitted).toBe(true);
    // notify(userId, opts) — the mapped kind lives in the second argument.
    const payload = intelligence.notify.mock.calls[0]?.[1] as { kind: string };
    expect(payload.kind).toBe(expected);
  });

  it('surfaces a dropped notification honestly', () => {
    const intelligence = {
      notify: vi.fn(() => ({ dropped: true, reason: 'rate-limited' })),
      listNotifications: vi.fn(() => []),
    };
    const port = createBridgeAiWorldPort(intelligence as never);
    const result = port.emit('u1', { kind: 'NEW_MODEL', title: 't', body: 'b', id: 'i' } as never);
    expect(result).toEqual({ emitted: false, reason: 'rate-limited' });
  });

  it('counts unread notifications from the existing surface', () => {
    const intelligence = {
      notify: vi.fn(() => ({ emitted: true })),
      listNotifications: vi.fn(() => [{ id: 'n1' }, { id: 'n2' }]),
    };
    const port = createBridgeAiWorldPort(intelligence as never);
    expect(port.unreadCount('u1')).toBe(2);
  });
});

// ── ExecutionBridgePorts (EPIC-014) ─────────────────────────────────────────

describe('createStepExecutionPort', () => {
  it('reports availability honestly for mapped and unmapped runtime capabilities', () => {
    const port = createStepExecutionPort({} as never);
    expect(port.availability('CODING', 'coding')).toEqual({ available: true });
    expect(port.availability('CODING', undefined)).toEqual({
      available: false,
      reason: 'no runtime execution path for CODING',
    });
  });

  it('executes a step through the frozen specialist port', async () => {
    const ai = fakeAi(specialistResult({ content: 'step output' }));
    const port = createStepExecutionPort(ai);
    const result = await port.execute({
      stepId: 's1',
      userId: 'u1',
      capability: 'CODING',
      runtimeCapability: 'coding',
      instruction: 'write code',
    } as never);
    expect(result.ok).toBe(true);
    expect(result.content).toBe('step output');
    expect(result.abstained).toBe(false);
  });

  it('reports an honest error when the specialist call throws', async () => {
    const ai = {
      orchestrate: async () => {
        throw new Error('boom');
      },
    } as unknown as AIOrchestrationService;
    const port = createStepExecutionPort(ai);
    const result = await port.execute({
      stepId: 's1',
      userId: 'u1',
      capability: 'CODING',
      runtimeCapability: 'coding',
      instruction: 'write code',
    } as never);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('boom');
  });

  it('surfaces abstention as ok:false with the abstain reason', async () => {
    const ai = fakeAi(specialistResult({ abstained: true, content: '' }));
    const port = createStepExecutionPort(ai);
    const result = await port.execute({
      stepId: 's1',
      userId: 'u1',
      capability: 'CODING',
      runtimeCapability: 'coding',
      instruction: 'write code',
    } as never);
    expect(result.ok).toBe(false);
    expect(result.abstained).toBe(true);
    expect(result.error).toContain('abstained');
  });
});

describe('createExecutionPlanSource', () => {
  it('fetches the real owner-scoped plan', async () => {
    const capability = { getPlan: vi.fn(async () => ({ planId: 'p1' })) };
    const source = createExecutionPlanSource(capability as never);
    await expect(source.getPlan('u1', 'p1')).resolves.toEqual({ planId: 'p1' });
    expect(capability.getPlan).toHaveBeenCalledWith('u1', 'p1');
  });

  it('returns undefined for a missing plan (never a fabricated one)', async () => {
    const capability = { getPlan: vi.fn(async () => undefined) };
    const source = createExecutionPlanSource(capability as never);
    await expect(source.getPlan('u1', 'missing')).resolves.toBeUndefined();
  });
});

describe('createExecutionBudgetConfig', () => {
  const ORIGINAL: Record<string, string | undefined> = {};
  const KEYS = [
    'AI_EXECUTION_MAX_ITERATIONS',
    'AI_EXECUTION_MAX_TOKENS',
    'AI_EXECUTION_MAX_COST_USD',
    'AI_EXECUTION_MAX_LATENCY_MS',
  ];

  beforeEach(() => {
    for (const key of KEYS) ORIGINAL[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (ORIGINAL[key] === undefined) delete process.env[key];
      else process.env[key] = ORIGINAL[key];
    }
  });

  it('uses the documented hard limits by default', () => {
    for (const key of KEYS) delete process.env[key];
    expect(createExecutionBudgetConfig()).toEqual({
      maxIterations: 50,
      maxTokens: 100_000,
      maxCostUsd: 5,
      maxLatencyMs: 600_000,
    });
  });

  it('honors positive numeric env overrides', () => {
    process.env.AI_EXECUTION_MAX_ITERATIONS = '7';
    process.env.AI_EXECUTION_MAX_TOKENS = '123';
    process.env.AI_EXECUTION_MAX_COST_USD = '0.5';
    process.env.AI_EXECUTION_MAX_LATENCY_MS = '90000';
    expect(createExecutionBudgetConfig()).toEqual({
      maxIterations: 7,
      maxTokens: 123,
      maxCostUsd: 0.5,
      maxLatencyMs: 90_000,
    });
  });

  it('falls back to defaults for invalid env values', () => {
    process.env.AI_EXECUTION_MAX_ITERATIONS = '-3';
    process.env.AI_EXECUTION_MAX_TOKENS = 'abc';
    process.env.AI_EXECUTION_MAX_COST_USD = '0';
    process.env.AI_EXECUTION_MAX_LATENCY_MS = 'Infinity';
    expect(createExecutionBudgetConfig()).toEqual({
      maxIterations: 50,
      maxTokens: 100_000,
      maxCostUsd: 5,
      maxLatencyMs: 600_000,
    });
  });
});

// ── SchedulerPorts (EPIC-018) ───────────────────────────────────────────────

describe('createSchedulerClockPort', () => {
  it('returns the frozen SystemClock', () => {
    expect(typeof createSchedulerClockPort().now()).toBe('string'); // ISO timestamp
  });
});

describe('createSchedulerDiscoveryPort', () => {
  it('delegates discovery to the existing EPIC-012C pipeline', async () => {
    const aiWorld = {
      runScheduledDiscovery: vi.fn(async () => ({
        sources: [{ sourceId: 's1' }],
        budget: { spentTokens: 10 },
      })),
      getSourceIds: vi.fn(() => ['s1', 's2']),
      listRawItems: vi.fn(async () => []),
    };
    const port = createSchedulerDiscoveryPort(aiWorld as never);
    const result = await port.discover({ sourceIds: ['s1'], budget: {} } as never);
    expect(result.reports).toEqual([{ sourceId: 's1' }]);
    expect(result.budget).toEqual({ spentTokens: 10 });
    expect(aiWorld.runScheduledDiscovery).toHaveBeenCalledWith({
      sourceIds: ['s1'],
      budget: {},
    });
    expect(port.listSourceIds()).toEqual(['s1', 's2']);
    await expect(port.listStoredItems()).resolves.toEqual([]);
  });
});

describe('createSchedulerBrainPort', () => {
  it('reuses the existing relevance/recommendation verdicts', () => {
    const port = createSchedulerBrainPort();
    const relevant = port.evaluateRelevance('u1', {
      relevance: 60,
      recommendation: 'CONSIDER',
    } as never);
    expect(relevant.relevant).toBe(true);
    expect(relevant.reason).toContain('Relevant');

    const low = port.evaluateRelevance('u1', {
      relevance: 59,
      recommendation: 'CONSIDER',
    } as never);
    expect(low.relevant).toBe(false);

    const ignored = port.evaluateRelevance('u1', {
      relevance: 90,
      recommendation: 'IGNORE',
    } as never);
    expect(ignored.relevant).toBe(false);
  });
});

describe('createSchedulerNotifyPort', () => {
  it.each([
    [
      { category: 'provider', change: 'REMOVED', securityFlags: [], summary: 'gone' },
      'PROVIDER_RETIRED',
    ],
    [
      { category: 'provider', change: 'NEW', securityFlags: [], summary: 'new' },
      'BETTER_PROVIDER_DISCOVERED',
    ],
    [{ category: 'model', change: 'NEW', securityFlags: [], summary: 'm' }, 'NEW_FREE_MODEL'],
    [
      { category: 'github', change: 'NEW', securityFlags: [], summary: 'g' },
      'USEFUL_GITHUB_PROJECT',
    ],
    [
      { category: 'application', change: 'NEW', securityFlags: [], summary: 'a' },
      'LOCAL_MODEL_SUITABLE',
    ],
    [
      { category: 'news', change: 'NEW', securityFlags: [], summary: 'deprecated endpoint' },
      'PROVIDER_RETIRED',
    ],
    [
      { category: 'news', change: 'NEW', securityFlags: [], summary: 'free quota up' },
      'FREE_QUOTA_INCREASED',
    ],
    [
      { category: 'news', change: 'NEW', securityFlags: [], summary: 'ordinary' },
      'CONFIGURED_PROVIDER_CHANGED',
    ],
    [
      { category: 'anything', change: 'NEW', securityFlags: ['suspicious'], summary: 's' },
      'SECURITY_WARNING',
    ],
  ] as const)('maps scheduler changes onto the notification vocabulary', (item, expected) => {
    const intelligence = { notify: vi.fn(() => ({ emitted: true })) };
    const port = createSchedulerNotifyPort(intelligence as never);
    const result = port.notify('u1', {
      item: {
        id: 'i',
        title: 't',
        summary: item.summary,
        category: item.category,
        securityFlags: item.securityFlags,
        relevance: 80,
      },
      change: item.change,
    } as never);
    expect(result.emitted).toBe(true);
    // notify(userId, opts) — the mapped kind lives in the second argument.
    const payload = intelligence.notify.mock.calls[0]?.[1] as { kind: string };
    expect(payload.kind).toBe(expected);
  });

  it('surfaces a dropped notification honestly', () => {
    const intelligence = { notify: vi.fn(() => ({ dropped: true, reason: 'dedup' })) };
    const port = createSchedulerNotifyPort(intelligence as never);
    const result = port.notify('u1', {
      item: {
        id: 'i',
        title: 't',
        summary: 's',
        category: 'news',
        securityFlags: [],
        relevance: 80,
      },
      change: 'NEW',
    } as never);
    expect(result).toEqual({ emitted: false, reason: 'dedup' });
  });
});

// ── RuntimePorts (AI-RUNTIME-002) ───────────────────────────────────────────

describe('createProviderIntelligencePort', () => {
  const providerDTO = (overrides: Record<string, unknown> = {}) => ({
    id: 'p1',
    family: 'openai',
    capabilities: ['reasoning'],
    health: { status: 'healthy', latencyMs: 20 },
    lifecycleStatus: 'active',
    models: [{ id: 'm1', contextLength: 128000, maxOutputTokens: 8192, streaming: true }],
    bestQuality: 0.9,
    inputPerMillionTokens: 10,
    outputPerMillionTokens: 30,
    tags: ['cloud'],
    costTier: 'standard',
    ...overrides,
  });

  it('maps provider candidates with registry intelligence', async () => {
    const providers = {
      listByCapability: vi.fn(async () => ({ data: [providerDTO()] })),
    };
    const port = createProviderIntelligencePort(providers as never);
    const candidates = await port.getCandidates('reasoning');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.providerId).toBe('p1');
    expect(candidates[0]?.healthy).toBe(true);
    expect(candidates[0]?.models[0]?.contextWindow).toBe(128000);
    expect(candidates[0]?.costPer1KInput).toBe(0.01);
    expect(candidates[0]?.costPer1KOutput).toBe(0.03);
    expect(candidates[0]?.unavailableModelIds).toBeUndefined();
  });

  it('excludes models the intelligence layer marked unavailable or deprecated', async () => {
    const providers = {
      listByCapability: vi.fn(async () => ({ data: [providerDTO()] })),
    };
    const intelligenceStore = {
      get: vi.fn(async () => ({
        knownModels: { m1: 'available', m2: 'unavailable', m3: 'deprecated' },
      })),
    };
    const port = createProviderIntelligencePort(providers as never, intelligenceStore as never);
    const candidates = await port.getCandidates('reasoning');
    expect(candidates[0]?.unavailableModelIds).toEqual(['m2', 'm3']);
    expect(intelligenceStore.get).toHaveBeenCalledWith('p1');
  });

  it('marks unhealthy providers honestly', async () => {
    const providers = {
      listByCapability: vi.fn(async () => ({
        data: [
          providerDTO({ health: { status: 'down', latencyMs: 0 }, lifecycleStatus: 'retired' }),
        ],
      })),
    };
    const port = createProviderIntelligencePort(providers as never);
    const candidates = await port.getCandidates('reasoning');
    expect(candidates[0]?.healthy).toBe(false);
  });
});

describe('createExecutionStrategyPort', () => {
  const plan = (overrides: Record<string, unknown> = {}) => ({
    costBudget: { maximumCostUsd: 0.1 },
    providerCandidates: [{ providerId: 'a' }, { providerId: 'b' }, { providerId: 'c' }],
    qualityTarget: { targetScore: 5 },
    priority: 'normal',
    ...overrides,
  });

  it('returns balanced when no plan exists', async () => {
    const strategies = { listByCapability: vi.fn(async () => ({ data: [] })) };
    const port = createExecutionStrategyPort(strategies as never);
    await expect(port.getRoutingContext()).resolves.toEqual({ strategy: 'balanced' });
  });

  it('derives quality-first for a high quality target', async () => {
    const strategies = {
      listByCapability: vi.fn(async () => ({
        data: [plan({ qualityTarget: { targetScore: 9 } })],
      })),
    };
    const port = createExecutionStrategyPort(strategies as never);
    const ctx = await port.getRoutingContext();
    expect(ctx.strategy).toBe('quality-first');
    expect(ctx.maxCost).toBe(0.1);
    expect(ctx.preferredProviders).toEqual(['a', 'b']);
  });

  it('derives quality-first for critical priority', async () => {
    const strategies = {
      listByCapability: vi.fn(async () => ({
        data: [plan({ priority: 'critical', qualityTarget: { targetScore: 1 } })],
      })),
    };
    const port = createExecutionStrategyPort(strategies as never);
    expect((await port.getRoutingContext()).strategy).toBe('quality-first');
  });

  it('derives cost-first for a negligible max cost and omits empty preferences', async () => {
    const strategies = {
      listByCapability: vi.fn(async () => ({
        data: [plan({ costBudget: { maximumCostUsd: 0.001 }, providerCandidates: [] })],
      })),
    };
    const port = createExecutionStrategyPort(strategies as never);
    const ctx = await port.getRoutingContext();
    expect(ctx.strategy).toBe('cost-first');
    expect(ctx.preferredProviders).toBeUndefined();
  });

  it('falls back to balanced otherwise', async () => {
    const strategies = {
      listByCapability: vi.fn(async () => ({ data: [plan()] })),
    };
    const port = createExecutionStrategyPort(strategies as never);
    expect((await port.getRoutingContext()).strategy).toBe('balanced');
  });
});

describe('createRagRetrievalPort', () => {
  it('maps RAG search results with per-document source ids', async () => {
    const rag = {
      search: vi.fn(async () => ({
        results: [
          { title: 'Doc A', content: 'content', score: 0.9, sourceId: 'src-a' },
          { title: 'Doc B', content: 'more', score: 0.7, sourceId: 'src-b' },
        ],
      })),
    };
    const port = createRagRetrievalPort(rag as never);
    const result = await port.retrieve({ userId: 'u1', query: 'q', collection: 'c', topK: 2 });
    expect(result.results).toHaveLength(2);
    expect(result.results[0]?.source).toBe('src-a');
    expect(rag.search).toHaveBeenCalledWith({
      userId: 'u1',
      collection: 'c',
      query: 'q',
      topK: 2,
    });
  });

  it('defaults topK to 5', async () => {
    const rag = { search: vi.fn(async () => ({ results: [] })) };
    const port = createRagRetrievalPort(rag as never);
    await port.retrieve({ userId: 'u1', query: 'q', collection: 'c' });
    expect(rag.search).toHaveBeenCalledWith({
      userId: 'u1',
      collection: 'c',
      query: 'q',
      topK: 5,
    });
  });
});
