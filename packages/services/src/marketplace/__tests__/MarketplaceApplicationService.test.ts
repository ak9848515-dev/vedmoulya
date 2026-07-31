// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Application Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { MarketplaceApplicationService } from '../MarketplaceApplicationService.js';

function createMockServices() {
  return {
    identity: { getUserById: vi.fn().mockResolvedValue({ id: 'u1', displayName: 'Test User' }) },
    memory: { getStats: vi.fn().mockResolvedValue({ totalMemories: 10 }) },
    decision: { getStats: vi.fn().mockResolvedValue({ totalDecisions: 5 }) },
    execution: { getStats: vi.fn().mockResolvedValue({ activePlans: 2 }) },
    knowledge: { getStats: vi.fn().mockResolvedValue({ totalEntries: 100 }) },
    ai: { orchestrate: vi.fn().mockResolvedValue({ success: true, data: { response: 'test' } }) },
  };
}

describe('MarketplaceApplicationService', () => {
  it('getMarketplace returns snapshot for valid user', async () => {
    const mocks = createMockServices();
    const svc = new MarketplaceApplicationService(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const result = await svc.getMarketplace('u1');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.userId).toBe('u1');
  });

  it('getMarketplace uses custom displayName', async () => {
    const mocks = createMockServices();
    const svc = new MarketplaceApplicationService(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const result = await svc.getMarketplace('u1', 'My Studio');
    expect(result.success).toBe(true);
    expect(result.data?.aiContext.currentFocus).toContain('My Studio');
  });

  it('getMarketplace caches second call', async () => {
    const mocks = createMockServices();
    const svc = new MarketplaceApplicationService(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    await svc.getMarketplace('u1');
    const second = await svc.getMarketplace('u1');
    expect(second.success).toBe(true);
    expect(mocks.identity.getUserById).toHaveBeenCalledTimes(1); // second call hits cache
  });

  it('invalidateCache clears entry', async () => {
    const mocks = createMockServices();
    const svc = new MarketplaceApplicationService(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    await svc.getMarketplace('u1');
    svc.invalidateCache('u1');
    await svc.getMarketplace('u1');
    expect(mocks.identity.getUserById).toHaveBeenCalledTimes(2);
  });

  it('getMarketplace handles assembler error gracefully', async () => {
    const mocks = createMockServices();
    mocks.identity.getUserById.mockRejectedValue(new Error('Database connection failed'));
    mocks.ai.orchestrate.mockRejectedValue(new Error('AI unavailable'));
    const svc = new MarketplaceApplicationService(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    // The assembler wraps identity calls in safeCall, so errors are caught gracefully
    const result = await svc.getMarketplace('u1');
    // Assembler should produce a partial snapshot even with errors
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('getMarketplaceViewModel returns view model', async () => {
    const mocks = createMockServices();
    const svc = new MarketplaceApplicationService(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const result = await svc.getMarketplaceViewModel('u1');
    expect(result.success).toBe(true);
    expect(result.data?.catalog).toBeDefined();
    expect(result.data?.assets).toBeDefined();
    expect(result.data?.providers).toBeDefined();
  });

  it('getConfig returns configuration', async () => {
    const mocks = createMockServices();
    const svc = new MarketplaceApplicationService(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const config = svc.getConfig('u1');
    expect(config.userId).toBe('u1');
    expect(config.autoUpdate).toBe(true);
  });

  it('updateConfig updates configuration', async () => {
    const mocks = createMockServices();
    const svc = new MarketplaceApplicationService(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const updated = svc.updateConfig('u1', { autoUpdate: false });
    expect(updated.autoUpdate).toBe(false);
  });

  it('resetConfig restores defaults', async () => {
    const mocks = createMockServices();
    const svc = new MarketplaceApplicationService(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    svc.updateConfig('u1', { autoUpdate: false });
    const reset = svc.resetConfig('u1');
    expect(reset.autoUpdate).toBe(true);
  });

  it('isHealthy returns false initially', async () => {
    const mocks = createMockServices();
    const svc = new MarketplaceApplicationService(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    expect(svc.isHealthy()).toBe(false);
  });

  it('reportServiceHealth and isHealthy works', async () => {
    const mocks = createMockServices();
    const svc = new MarketplaceApplicationService(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    svc.reportServiceHealth('marketplace', 'healthy', 10);
    expect(svc.isHealthy()).toBe(true);
  });

  it('getAnalytics returns analytics data', async () => {
    const mocks = createMockServices();
    const svc = new MarketplaceApplicationService(
      mocks.identity as any,
      mocks.memory as any,
      mocks.decision as any,
      mocks.execution as any,
      mocks.knowledge as any,
      mocks.ai as any,
    );
    const analytics = svc.getAnalytics();
    expect(analytics.totalLoads).toBe(0);
  });
});
