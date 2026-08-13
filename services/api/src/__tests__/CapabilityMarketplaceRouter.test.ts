// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: capability.* namespace tests
// EPIC-013 — AI Capability Marketplace & Factory Intelligence
//
// Exercises the capability.* procedures through the REAL tRPC pipeline
// (auth + rate-limit middleware + RouterRegistry handler closures):
//   plan         — outcome → FactoryCapabilityPlan (steps, candidates,
//                  automation, approvals, evidence)
//   getPlan      — owner-scoped read-back
//   listPlans    — owner-scoped history
//   capabilities — marketplace view model
// Plus IDOR: a foreign userId must be refused by the gateway guard.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  CapabilityMarketplaceApplicationService,
  InMemoryCapabilityPlanStore,
} from '@vedmoulya/capability-marketplace';
import type {
  CapabilityEnrichmentPort,
  CapabilitySourcePort,
  ProviderCandidateFact,
} from '@vedmoulya/capability-marketplace';
import { createAppRouter } from '../services/RouterRegistry.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';

// Deterministic source port: one configured provider (OpenAI) + one local
// model + one GitHub discovery. No live external services.
function testSource(): CapabilitySourcePort {
  const openai: ProviderCandidateFact = {
    providerId: 'prov-openai',
    family: 'openai',
    name: 'OpenAI',
    modelId: 'gpt-4o',
    modelName: 'GPT-4o',
    capabilities: ['TEXT_GENERATION', 'REASONING', 'CODING', 'VISION'],
    quality: 0.92,
    costTier: 'medium',
    availability: 0.99,
    configured: true,
    evidence: [
      {
        claim: 'Registered provider with capability matrix',
        source: 'provider-registry',
        confidence: 'VERIFIED',
      },
    ],
  };
  return {
    providerCandidates: async (capability) =>
      ['TEXT_GENERATION', 'REASONING', 'CODING', 'VISION'].includes(capability) ? [openai] : [],
    discoveryCandidates: async () => [
      {
        itemId: 'disc-gh-1',
        category: 'github',
        title: 'pgvector — Postgres vector similarity',
        capabilities: ['RAG', 'EMBEDDINGS'],
        freeClass: 'OPEN_SOURCE',
        localAvailability: 'yes',
        configurable: false,
        github: { name: 'pgvector/pgvector', license: 'PostgreSQL', flags: [] },
        evidence: [
          {
            claim: 'Open-source vector extension for Postgres',
            source: 'ai-world',
            confidence: 'VERIFIED',
          },
        ],
        securityFlags: [],
      },
    ],
    localModelCandidates: async (capability) =>
      ['TEXT_GENERATION', 'REASONING'].includes(capability)
        ? [
            {
              id: 'llama3.2',
              name: 'llama3.2',
              sizeGb: 4.9,
              runtime: 'ollama',
              capabilities: [capability],
              capabilitiesProvenance: 'INFERRED',
              available: true,
              evidence: [
                {
                  claim: 'Discovered via Ollama runtime',
                  source: 'local-discovery',
                  confidence: 'MEASURED',
                },
              ],
            },
          ]
        : [],
  };
}

function makeService(
  source: CapabilitySourcePort = testSource(),
  enrichment?: CapabilityEnrichmentPort,
): CapabilityMarketplaceApplicationService {
  return new CapabilityMarketplaceApplicationService({
    source,
    store: new InMemoryCapabilityPlanStore(),
    enrichment,
    now: () => new Date('2026-08-13T09:00:00Z'),
  });
}

// Deterministic confident enrichment — no live AI service.
function confidentEnrichment(): CapabilityEnrichmentPort {
  return {
    enrich: async () => ({
      confident: true,
      suggestedCapabilities: ['RESEARCH', 'TEXT_GENERATION', 'TEXT_TO_SPEECH'],
      suggestedSteps: ['Research', 'Draft script', 'Narrate with voice'],
      summary:
        'Research the topic, draft the narration, then generate voice and visuals before assembling the final cut.',
      provider: 'openai',
      model: 'gpt-4o-mini',
    }),
  };
}

const services = {
  capability: makeService(),
} as unknown as ApiApplicationService;

const router = createAppRouter(services);
const ctx = (userId: string) => ({ userId, email: `${userId}@vm.local`, role: 'user' });

describe('capability namespace (EPIC-013)', () => {
  it('plan returns a FactoryCapabilityPlan with steps, automation and evidence', async () => {
    const caller = router.createCaller(ctx('cap-1'));
    const result = await caller.capability.plan({
      userId: 'cap-1',
      outcome: 'Create a 60-second educational video about the solar system',
    });

    expect(result.success).toBe(true);
    const plan = result.data as {
      id: string;
      requestedOutcome: string;
      steps: Array<{
        title: string;
        automation: string;
        selectedCandidateId?: string;
        irreversible: boolean;
        reasons: string[];
      }>;
      automationPercent: number;
      evidence: unknown[];
      humanApprovalPoints: Array<{ title: string }>;
      requiredCapabilities: string[];
    };
    expect(plan.requestedOutcome).toContain('educational video');
    expect(plan.steps.length).toBeGreaterThanOrEqual(8);
    // The video pipeline's script step picks the configured OpenAI model.
    const script = plan.steps.find((s) => s.title === 'Script');
    expect(script?.selectedCandidateId).toContain('prov-openai');
    // The Final Export step performs an irreversible action (publish) — it is
    // surfaced as a human approval point. With no deploy candidate in this
    // fixture it cannot claim automation, so it honestly stays MANUAL.
    const exportStep = plan.steps.find((s) => s.title === 'Final Export');
    expect(exportStep?.irreversible).toBe(true);
    expect(plan.humanApprovalPoints.map((p) => p.title)).toContain('Final Export');
    expect(exportStep?.automation).toBe('MANUAL');
    expect(plan.evidence.length).toBeGreaterThan(0);
    expect(plan.automationPercent).toBeGreaterThanOrEqual(0);
    expect(plan.automationPercent).toBeLessThanOrEqual(100);
  });

  it('getPlan reads back the created plan owner-scoped', async () => {
    const caller = router.createCaller(ctx('cap-2'));
    const created = (
      await caller.capability.plan({ userId: 'cap-2', outcome: 'Write a blog post' })
    ).data as {
      id: string;
    };
    const read = await caller.capability.getPlan({ userId: 'cap-2', planId: created.id });
    expect(read.success).toBe(true);
    expect((read.data as { id: string }).id).toBe(created.id);
  });

  it('listPlans returns only the caller’s plans', async () => {
    const caller = router.createCaller(ctx('cap-3'));
    await caller.capability.plan({ userId: 'cap-3', outcome: 'Write a blog post' });
    const listed = await caller.capability.listPlans({ userId: 'cap-3' });
    expect(listed.success).toBe(true);
    expect((listed.data as unknown[]).length).toBeGreaterThan(0);
  });

  it('capabilities returns the marketplace view model', async () => {
    const caller = router.createCaller(ctx('cap-4'));
    const result = await caller.capability.capabilities({ userId: 'cap-4' });
    expect(result.success).toBe(true);
    const view = result.data as {
      capabilities: Array<{ id: string; label: string; ready: boolean }>;
    };
    expect(view.capabilities.length).toBeGreaterThan(10);
    const text = view.capabilities.find((c) => c.id === 'TEXT_GENERATION');
    expect(text?.ready).toBe(true);
  });

  it('attaches a confident AI enrichment overlay through the real pipeline', async () => {
    const enrichedServices = {
      capability: makeService(testSource(), confidentEnrichment()),
    } as unknown as ApiApplicationService;
    const enrichedRouter = createAppRouter(enrichedServices);
    const caller = enrichedRouter.createCaller(ctx('cap-enrich'));
    const result = await caller.capability.plan({
      userId: 'cap-enrich',
      outcome: 'Create a 60-second educational video about the solar system',
    });
    expect(result.success).toBe(true);
    const plan = result.data as {
      aiInsight?: {
        summary?: string;
        suggestedSteps: string[];
        provider: string;
        model: string;
        confident: boolean;
      };
      steps: unknown[];
    };
    expect(plan.aiInsight?.confident).toBe(true);
    expect(plan.aiInsight?.summary).toContain('Research the topic');
    expect(plan.aiInsight?.suggestedSteps).toContain('Draft script');
    expect(plan.aiInsight?.provider).toBe('openai');
    // The deterministic plan is untouched by the overlay.
    expect(plan.steps.length).toBeGreaterThanOrEqual(8);
  });

  it('refuses a foreign userId (IDOR) on every capability procedure', async () => {
    const caller = router.createCaller(ctx('cap-owner'));
    await expect(
      caller.capability.plan({ userId: 'cap-attacker', outcome: 'Create a video' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.capability.getPlan({ userId: 'cap-attacker', planId: 'abc123' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller.capability.listPlans({ userId: 'cap-attacker' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(caller.capability.capabilities({ userId: 'cap-attacker' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
