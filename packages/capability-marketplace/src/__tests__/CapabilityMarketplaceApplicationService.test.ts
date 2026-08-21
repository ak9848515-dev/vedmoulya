// ──────────────────────────────────────────────────────────────────
// VedMoulya — CapabilityMarketplaceApplicationService tests
// EPIC-013 — plan creation, owner-scoped reads (IDOR), capabilities view.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { CapabilityMarketplaceApplicationService } from '../application/CapabilityMarketplaceApplicationService.js';
import type { CapabilityEnrichmentPort } from '../contracts/CapabilitySourcePort.js';
import { InMemoryCapabilityPlanStore } from '../infrastructure/InMemoryCapabilityPlanStore.js';
import {
  configuredProvider,
  localModel,
  testSource,
  unconfiguredProvider,
  videoRequest,
} from './fixtures.js';

function service(
  options: { source?: ReturnType<typeof testSource> } = {},
): CapabilityMarketplaceApplicationService {
  return new CapabilityMarketplaceApplicationService({
    source: options.source ?? testSource(),
    store: new InMemoryCapabilityPlanStore(),
    now: () => new Date('2026-08-13T09:00:00Z'),
  });
}

function confidentEnrichment(): CapabilityEnrichmentPort {
  return {
    enrich: async () => ({
      confident: true,
      suggestedCapabilities: ['RESEARCH', 'TEXT_GENERATION', 'VIDEO_GENERATION', 'TEXT_TO_SPEECH'],
      suggestedSteps: ['Research', 'Draft script', 'Generate visuals', 'Narrate with voice'],
      summary:
        'Produce the video by researching the topic, scripting the narration, generating visuals and voice, then assembling and reviewing the final cut.',
      provider: 'openai',
      model: 'gpt-4o-mini',
    }),
  };
}

describe('CapabilityMarketplaceApplicationService — plan lifecycle', () => {
  it('creates a plan and reads it back owner-scoped', async () => {
    const svc = service();
    const created = await svc.plan('user-a', videoRequest());
    expect(created.id).toBeDefined();
    const read = await svc.getPlan('user-a', created.id);
    expect(read?.requestedOutcome).toContain('educational video');
  });

  it('refuses foreign-owner plan reads (IDOR)', async () => {
    const svc = service();
    const created = await svc.plan('user-a', videoRequest());
    const foreign = await svc.getPlan('user-b', created.id);
    expect(foreign).toBeUndefined();
  });

  it('lists only the caller’s own plans', async () => {
    const svc = service();
    await svc.plan('user-a', videoRequest());
    await svc.plan('user-b', videoRequest());
    const a = await svc.listPlans('user-a');
    expect(a).toHaveLength(1);
  });

  it('reports the capability marketplace view with readiness', async () => {
    const svc = service({
      source: testSource({
        providerCandidates: async () => [configuredProvider()],
        localModelCandidates: async () => [],
      }),
    });
    const view = await svc.capabilities('user-a');
    const text = view.capabilities.find((c) => c.id === 'TEXT_GENERATION');
    expect(text?.ready).toBe(true);
    expect(text?.bestCandidate).toContain('OpenAI');
  });

  it('works without an enrichment port (deterministic core)', async () => {
    const svc = service();
    const created = await svc.plan('user-a', { outcome: 'Create a blog post' });
    expect(created.steps.length).toBeGreaterThan(0);
    expect(created.aiInsight).toBeUndefined();
  });

  it('attaches a confident AI enrichment as an advisory aiInsight overlay', async () => {
    const svc = new CapabilityMarketplaceApplicationService({
      source: testSource(),
      store: new InMemoryCapabilityPlanStore(),
      enrichment: confidentEnrichment(),
      now: () => new Date('2026-08-13T09:00:00Z'),
    });
    const created = await svc.plan('user-a', videoRequest());
    expect(created.aiInsight?.confident).toBe(true);
    expect(created.aiInsight?.summary).toContain('Produce the video');
    expect(created.aiInsight?.suggestedSteps).toContain('Draft script');
    expect(created.aiInsight?.provider).toBe('openai');
    expect(created.aiInsight?.model).toBe('gpt-4o-mini');
    // The deterministic plan stays authoritative — steps are untouched.
    expect(created.steps.length).toBeGreaterThan(0);
    // The overlay persists with the owner-scoped plan.
    const read = await svc.getPlan('user-a', created.id);
    expect(read?.aiInsight?.confident).toBe(true);
  });

  it('never fails the plan when enrichment throws (non-fatal seam)', async () => {
    const failing: CapabilityEnrichmentPort = {
      enrich: async () => {
        throw new Error('provider unavailable');
      },
    };
    const svc = new CapabilityMarketplaceApplicationService({
      source: testSource(),
      store: new InMemoryCapabilityPlanStore(),
      enrichment: failing,
      now: () => new Date('2026-08-13T09:00:00Z'),
    });
    const created = await svc.plan('user-a', videoRequest());
    expect(created.steps.length).toBeGreaterThan(0);
    expect(created.aiInsight).toBeUndefined();
  });

  it('does not attach an insight when enrichment is not confident', async () => {
    const notConfident: CapabilityEnrichmentPort = {
      enrich: async () => ({
        confident: false,
        suggestedCapabilities: [],
        suggestedSteps: [],
        provider: 'none',
        model: 'none',
      }),
    };
    const svc = new CapabilityMarketplaceApplicationService({
      source: testSource(),
      store: new InMemoryCapabilityPlanStore(),
      enrichment: notConfident,
      now: () => new Date('2026-08-13T09:00:00Z'),
    });
    const created = await svc.plan('user-a', videoRequest());
    expect(created.aiInsight).toBeUndefined();
  });
});

describe('CapabilityMarketplaceApplicationService — marketplace view branches', () => {
  it('marks a capability configurable when only an unconfigured provider exists', async () => {
    const svc = service({
      source: testSource({
        providerCandidates: async () => [unconfiguredProvider()],
        localModelCandidates: async () => [],
      }),
    });
    const view = await svc.capabilities('user-a');
    const text = view.capabilities.find((c) => c.id === 'TEXT_GENERATION');
    expect(text?.ready).toBe(false);
    expect(text?.configurable).toBe(true);
    expect(text?.bestCandidate).toContain('Anthropic');
  });

  it('marks a capability configurable when only an unavailable local model exists', async () => {
    const svc = service({
      source: testSource({
        providerCandidates: async () => [],
        localModelCandidates: async () => [localModel({ available: false })],
      }),
    });
    const view = await svc.capabilities('user-a');
    const text = view.capabilities.find((c) => c.id === 'TEXT_GENERATION');
    expect(text?.ready).toBe(false);
    expect(text?.configurable).toBe(true);
    expect(text?.bestCandidate).toContain('llama3.2');
  });

  it('reports neither ready nor configurable when no candidates exist', async () => {
    const svc = service({
      source: testSource({
        providerCandidates: async () => [],
        localModelCandidates: async () => [],
      }),
    });
    const view = await svc.capabilities('user-a');
    const text = view.capabilities.find((c) => c.id === 'TEXT_GENERATION');
    expect(text?.ready).toBe(false);
    expect(text?.configurable).toBe(false);
    expect(text?.bestCandidate).toBeUndefined();
  });
});
