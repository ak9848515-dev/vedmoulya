// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Assembler Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { MarketplaceAssembler } from '../MarketplaceAssembler.js';
import type { MarketplaceAssetDTO } from '../MarketplaceDTO.js';

function createMockServices() {
  return {
    identity: { getUserById: vi.fn().mockResolvedValue({ id: 'u1', displayName: 'Test' }) },
    memory: { getStats: vi.fn().mockResolvedValue({ totalMemories: 10 }) },
    decision: { getStats: vi.fn().mockResolvedValue({ totalDecisions: 5 }) },
    execution: { getStats: vi.fn().mockResolvedValue({ activePlans: 2 }) },
    knowledge: { getStats: vi.fn().mockResolvedValue({ totalEntries: 100 }) },
    ai: { orchestrate: vi.fn().mockResolvedValue({ success: true, data: { response: 'test' } }) },
  };
}

function makeAsset(
  overrides: Partial<MarketplaceAssetDTO> & { id: string; name: string },
): MarketplaceAssetDTO {
  return {
    type: 'ai_provider',
    description: '',
    category: 'general',
    version: '1.0.0',
    author: 'test',
    publisher: 'test',
    tags: [],
    rating: 3,
    downloadCount: 0,
    isInstalled: false,
    isActive: false,
    isBuiltIn: false,
    size: 0,
    requirements: [],
    screenshots: [],
    changelog: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('MarketplaceAssembler', () => {
  it('assemble returns complete snapshot', async () => {
    const mocks = createMockServices();
    const assembler = new MarketplaceAssembler(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const snapshot = await assembler.assemble('u1', 'Test User');
    expect(snapshot.id).toContain('msnap_');
    expect(snapshot.userId).toBe('u1');
    expect(snapshot.catalog).toBeDefined();
    expect(snapshot.installedAssets).toEqual([]);
    expect(snapshot.recommendations.length).toBeGreaterThan(0);
    expect(snapshot.quickActions.length).toBe(8);
    expect(snapshot.metrics).toBeDefined();
    expect(snapshot.health).toBeDefined();
  });

  it('assemble handles identity failure gracefully', async () => {
    const mocks = createMockServices();
    mocks.identity.getUserById.mockRejectedValue(new Error('Identity down'));
    const assembler = new MarketplaceAssembler(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const snapshot = await assembler.assemble('u1', 'Test User');
    expect(snapshot.aiContext.contextSummary).toContain('Test User');
  });

  it('assemble handles AI failure gracefully', async () => {
    const mocks = createMockServices();
    mocks.ai.orchestrate.mockRejectedValue(new Error('AI down'));
    const assembler = new MarketplaceAssembler(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const snapshot = await assembler.assemble('u1', 'Test User');
    expect(snapshot.aiContext.contextSummary).not.toContain('AI analysis');
  });

  it('assemble with installed assets creates installation timeline entries', async () => {
    const mocks = createMockServices();
    const assembler = new MarketplaceAssembler(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const assetService = assembler.getAssetService();
    assetService.registerAsset(makeAsset({ id: 'a1', name: 'Test Provider' }));
    assetService.installAsset('u1', makeAsset({ id: 'a1', name: 'Test Provider' }));
    const snapshot = await assembler.assemble('u1', 'Test');
    expect(snapshot.installedAssets.length).toBe(1);
    expect(snapshot.installedAssets[0].name).toBe('Test Provider');
  });

  it('assemble with providers populates provider list', async () => {
    const mocks = createMockServices();
    const assembler = new MarketplaceAssembler(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const providerService = assembler.getProviderService();
    providerService.registerProvider({
      id: 'p1',
      name: 'OpenAI',
      type: 'ai',
      provider: 'openai',
      version: '1.0.0',
      status: 'active',
      config: {},
      capabilities: ['text'],
      isDefault: true,
      apiKeyConfigured: true,
      latency: 100,
      errorRate: 0.01,
      lastChecked: new Date().toISOString(),
      installedAt: new Date().toISOString(),
    });
    const snapshot = await assembler.assemble('u1', 'Test');
    expect(snapshot.providers.length).toBe(1);
    expect(snapshot.providers[0].name).toBe('OpenAI');
  });

  it('assemble AI failure uses fallback context', async () => {
    const mocks = createMockServices();
    mocks.ai.orchestrate.mockRejectedValue(new Error('AI service unavailable'));
    const assembler = new MarketplaceAssembler(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const snapshot = await assembler.assemble('u1', 'Test User');
    expect(snapshot.aiContext.contextSummary).toContain('Test User');
  });

  it('assemble with completed installation creates timeline entries', async () => {
    const mocks = createMockServices();
    const assembler = new MarketplaceAssembler(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const installService = assembler.getInstallationService();
    const inst = installService.startInstallation('a1', 'Test Asset', 'ai_provider', '1.0.0');
    installService.completeInstallation(inst.id);
    const snapshot = await assembler.assemble('u1', 'Test');
    expect(snapshot.installationHistory.length).toBe(1);
    expect(snapshot.timeline.entries.length).toBeGreaterThan(0);
  });

  it('assemble with activated asset creates activation timeline entries', async () => {
    const mocks = createMockServices();
    const assembler = new MarketplaceAssembler(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const actService = assembler.getActivationService();
    actService.activateAsset('a1', 'Test Provider');
    const snapshot = await assembler.assemble('u1', 'Test');
    expect(snapshot.timeline.totalEntries).toBeGreaterThan(0);
  });

  it('assemble compatibility reflects incompatible requirement', async () => {
    const mocks = createMockServices();
    const assembler = new MarketplaceAssembler(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const assetService = assembler.getAssetService();
    const asset = makeAsset({
      id: 'a1',
      name: 'Old Asset',
      type: 'ai_provider',
      requirements: [{ name: 'platform', version: '2.0.0', optional: false }],
    });
    assetService.registerAsset(asset);
    assetService.installAsset('u1', asset);
    const snapshot = await assembler.assemble('u1', 'Test');
    expect(snapshot.compatibility.overall).toBe('incompatible');
  });

  it('service accessors return correct instances', () => {
    const mocks = createMockServices();
    const assembler = new MarketplaceAssembler(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    expect(assembler.getCatalogService()).toBeDefined();
    expect(assembler.getAssetService()).toBeDefined();
    expect(assembler.getProviderService()).toBeDefined();
    expect(assembler.getInstallationService()).toBeDefined();
    expect(assembler.getActivationService()).toBeDefined();
    expect(assembler.getVersionService()).toBeDefined();
    expect(assembler.getCompatibilityService()).toBeDefined();
    expect(assembler.getInsightService()).toBeDefined();
    expect(assembler.getRecommendationService()).toBeDefined();
  });
});
