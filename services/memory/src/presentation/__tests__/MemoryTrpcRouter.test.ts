import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMemoryTrpcRouter } from '../trpc/MemoryRouter.js';

function createMockService() {
  return {
    captureMemory: vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } }),
    recallMemory: vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } }),
    updateMemory: vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } }),
    forgetMemory: vi.fn().mockResolvedValue({ success: true }),
    strengthenMemory: vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } }),
    weakenMemory: vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } }),
    archiveMemory: vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } }),
    restoreMemory: vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } }),
    mergeMemories: vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } }),
    getMemory: vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } }),
    searchMemories: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    getStats: vi.fn().mockResolvedValue({ success: true, data: { total: 0 } }),
    listMemories: vi.fn().mockResolvedValue({ success: true, data: [] }),
    count: vi.fn().mockResolvedValue(0),
    countByCategory: vi.fn().mockResolvedValue({}),
    countByState: vi.fn().mockResolvedValue({}),
    countLinked: vi.fn().mockResolvedValue(0),
  };
}

describe('MemoryTrpcRouter', () => {
  let router: ReturnType<typeof createMemoryTrpcRouter>;
  let service: ReturnType<typeof createMockService>;

  beforeEach(() => {
    service = createMockService();
    router = createMemoryTrpcRouter(service as never);
  });

  it('creates a tRPC router object', () => {
    expect(router).toBeDefined();
    expect(typeof router).toBe('object');
  });
});
