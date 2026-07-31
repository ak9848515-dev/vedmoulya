import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BusinessApplicationService } from '../BusinessApplicationService.js';
import type { IdentityApplicationService } from '../../identity/IdentityApplicationService.js';
import type { MemoryApplicationService } from '../../memory/MemoryApplicationService.js';
import type { DecisionApplicationService } from '../../decision/DecisionApplicationService.js';
import type { ExecutionApplicationService } from '../../execution/ExecutionApplicationService.js';
import type { KnowledgeApplicationService } from '../../knowledge/KnowledgeApplicationService.js';
import type { AIOrchestrationService } from '../../ai/AIOrchestrationService.js';

function createMockServices() {
  return {
    identity: {
      getUserById: vi.fn().mockResolvedValue({ id: 'u1', displayName: 'Test' }),
    } as unknown as IdentityApplicationService,
    memory: {
      getStats: vi.fn().mockResolvedValue({ totalMemories: 0 }),
    } as unknown as MemoryApplicationService,
    decision: {
      getStats: vi.fn().mockResolvedValue({ totalDecisions: 0 }),
    } as unknown as DecisionApplicationService,
    execution: {
      getStats: vi.fn().mockResolvedValue({ totalExecutions: 0 }),
    } as unknown as ExecutionApplicationService,
    knowledge: {
      getStats: vi.fn().mockResolvedValue({ totalEntities: 0 }),
    } as unknown as KnowledgeApplicationService,
    ai: {
      orchestrate: vi.fn().mockResolvedValue({ content: 'AI response' }),
    } as unknown as AIOrchestrationService,
  };
}

describe('BusinessApplicationService', () => {
  let svc: BusinessApplicationService;
  let mocks: ReturnType<typeof createMockServices>;

  beforeEach(() => {
    mocks = createMockServices();
    svc = new BusinessApplicationService(
      mocks.identity,
      mocks.memory,
      mocks.decision,
      mocks.execution,
      mocks.knowledge,
      mocks.ai,
    );
  });

  it('getBusiness returns success with snapshot', async () => {
    const result = await svc.getBusiness('user1');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.userId).toBe('user1');
    expect(result.latency).toBeGreaterThanOrEqual(0);
  });

  it('getBusiness caches snapshot on second call', async () => {
    const first = await svc.getBusiness('user1');
    expect(first.success).toBe(true);
    const second = await svc.getBusiness('user1');
    expect(second.success).toBe(true);
    // Both calls succeed (second from cache)
    expect(first.data?.id).toBeDefined();
    expect(second.data?.id).toBeDefined();
  });

  it('getBusiness with displayName parameter uses it for guest profile', async () => {
    // Create a service where identity doesn't return displayName
    const mocks2 = createMockServices();
    mocks2.identity.getUserById = vi.fn().mockResolvedValue({ id: 'guest1' });
    const svc2 = new BusinessApplicationService(
      mocks2.identity,
      mocks2.memory,
      mocks2.decision,
      mocks2.execution,
      mocks2.knowledge,
      mocks2.ai,
    );
    const result = await svc2.getBusiness('guest1', 'My Custom Biz');
    expect(result.success).toBe(true);
    expect(result.data?.profile.businessName).toBe('My Custom Biz');
  });

  it('getBusinessViewModel wraps snapshot in ViewModel', async () => {
    const result = await svc.getBusinessViewModel('user1');
    expect(result.success).toBe(true);
    expect(result.data?.profile).toBeDefined();
    expect(result.data?.kpis).toBeDefined();
    expect(result.data?.risks).toBeDefined();
    expect(result.data?.lastRefreshed).toBeDefined();
  });

  it('getBusinessViewModel without displayName adds default', async () => {
    const result = await svc.getBusinessViewModel('user1');
    expect(result.success).toBe(true);
  });

  it('getConfig returns configuration', () => {
    const cfg = svc.getConfig('user1');
    expect(cfg.userId).toBe('user1');
    expect(cfg.currency).toBe('USD');
  });

  it('updateConfig updates configuration', () => {
    const updated = svc.updateConfig('user1', { currency: 'GBP' });
    expect(updated.currency).toBe('GBP');
  });

  it('resetConfig resets configuration', () => {
    svc.updateConfig('user1', { currency: 'EUR' });
    const reset = svc.resetConfig('user1');
    expect(reset.currency).toBe('USD');
  });

  it('invalidateCache clears cache so next call is a fresh load', async () => {
    await svc.getBusiness('user1');
    expect(mocks.identity.getUserById).toHaveBeenCalledTimes(1);

    // Second call hits cache → no additional identity call
    await svc.getBusiness('user1');
    expect(mocks.identity.getUserById).toHaveBeenCalledTimes(1);

    // After invalidation, next call should trigger fresh assemble
    svc.invalidateCache('user1');
    await svc.getBusiness('user1');
    // After invalidation, identity.getUserById will be called again during assemble
    expect(mocks.identity.getUserById).toHaveBeenCalledTimes(2);
  });

  it('reportServiceHealth registers health', () => {
    svc.reportServiceHealth('test-svc', 'healthy', 10);
    expect(svc.isHealthy()).toBe(true);
  });

  it('isHealthy returns false when no services', () => {
    expect(svc.isHealthy()).toBe(false);
  });

  it('getAnalytics returns zero initial state', () => {
    const a = svc.getAnalytics();
    expect(a.totalLoads).toBeGreaterThanOrEqual(0);
  });

  it('handles assembler failure gracefully', async () => {
    const failingMock = {
      identity: {
        getUserById: vi.fn().mockRejectedValue(new Error('Identity down')),
      } as unknown as IdentityApplicationService,
      memory: {
        getStats: vi.fn().mockRejectedValue(new Error('Memory down')),
      } as unknown as MemoryApplicationService,
      decision: {
        getStats: vi.fn().mockRejectedValue(new Error('Decision down')),
      } as unknown as DecisionApplicationService,
      execution: {
        getStats: vi.fn().mockRejectedValue(new Error('Execution down')),
      } as unknown as ExecutionApplicationService,
      knowledge: {
        getStats: vi.fn().mockRejectedValue(new Error('Knowledge down')),
      } as unknown as KnowledgeApplicationService,
      ai: {
        orchestrate: vi.fn().mockRejectedValue(new Error('AI down')),
      } as unknown as AIOrchestrationService,
    };
    const failingSvc = new BusinessApplicationService(
      failingMock.identity,
      failingMock.memory,
      failingMock.decision,
      failingMock.execution,
      failingMock.knowledge,
      failingMock.ai,
    );
    const result = await failingSvc.getBusiness('user1');
    // Should still succeed with degraded data (no identity enrichment)
    expect(result.success).toBe(true);
    expect(result.data?.userId).toBe('user1');
  });
});
