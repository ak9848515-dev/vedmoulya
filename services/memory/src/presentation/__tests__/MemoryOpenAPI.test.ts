import { describe, it, expect, vi } from 'vitest';
import { memoryOpenApiSchema } from '../openapi/MemoryOpenAPI.js';
import { createMemoryTrpcRouter } from '../trpc/MemoryRouter.js';
import type { MemoryApplicationService } from '@vedmoulya/services';

describe('memoryOpenApiSchema', () => {
  it('declares the openapi version and service metadata', () => {
    expect(memoryOpenApiSchema.openapi).toBe('3.1.0');
    expect(memoryOpenApiSchema.info.title).toBe('Memory Engine API');
    expect(memoryOpenApiSchema.info.version).toBe('0.1.0');
  });

  it('defines the full set of memory engine paths', () => {
    const paths = Object.keys(memoryOpenApiSchema.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/v1/memory/memories',
        '/api/v1/memory/memories/{id}',
        '/api/v1/memory/memories/{id}/strengthen',
        '/api/v1/memory/memories/{id}/weaken',
        '/api/v1/memory/memories/{id}/archive',
        '/api/v1/memory/memories/{id}/restore',
        '/api/v1/memory/memories/{id}/timeline',
        '/api/v1/memory/memories/merge',
        '/api/v1/memory/search',
        '/api/v1/memory/stats',
        '/api/v1/memory/health',
      ]),
    );
  });

  it('documents captureMemory with required label/content/category', () => {
    const op = memoryOpenApiSchema.paths['/api/v1/memory/memories'].post;
    expect(op.operationId).toBe('captureMemory');
    const props = op.requestBody.content['application/json'].schema.properties;
    expect(props.label).toBeDefined();
    expect(props.content).toBeDefined();
    expect(props.category).toBeDefined();
    expect(op.requestBody.content['application/json'].schema.required).toEqual([
      'label',
      'content',
      'category',
    ]);
  });

  it('documents recallMemory with the strengthen query parameter', () => {
    const op = memoryOpenApiSchema.paths['/api/v1/memory/memories/{id}'].get;
    expect(op.operationId).toBe('recallMemory');
    const params = op.parameters;
    expect(params.some((p) => p.name === 'strengthen' && p.in === 'query')).toBe(true);
    expect(params.some((p) => p.name === 'id' && p.in === 'path')).toBe(true);
  });

  it('documents all lifecycle operations', () => {
    expect(
      memoryOpenApiSchema.paths['/api/v1/memory/memories/{id}/strengthen'].post.operationId,
    ).toBe('strengthenMemory');
    expect(memoryOpenApiSchema.paths['/api/v1/memory/memories/{id}/weaken'].post.operationId).toBe(
      'weakenMemory',
    );
    expect(memoryOpenApiSchema.paths['/api/v1/memory/memories/{id}/archive'].post.operationId).toBe(
      'archiveMemory',
    );
    expect(memoryOpenApiSchema.paths['/api/v1/memory/memories/{id}/restore'].post.operationId).toBe(
      'restoreMemory',
    );
  });

  it('documents timeline, merge, search, stats, and health operations', () => {
    expect(memoryOpenApiSchema.paths['/api/v1/memory/memories/{id}/timeline'].get.operationId).toBe(
      'getMemoryTimeline',
    );
    expect(memoryOpenApiSchema.paths['/api/v1/memory/memories/merge'].post.operationId).toBe(
      'mergeMemories',
    );
    expect(memoryOpenApiSchema.paths['/api/v1/memory/search'].get.operationId).toBe(
      'searchMemories',
    );
    expect(memoryOpenApiSchema.paths['/api/v1/memory/stats'].get.operationId).toBe(
      'getMemoryStatistics',
    );
    expect(memoryOpenApiSchema.paths['/api/v1/memory/health'].get.operationId).toBe('memoryHealth');
  });
});

describe('createMemoryTrpcRouter', () => {
  function createMockService(): MemoryApplicationService {
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
      listMemories: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }),
      searchMemories: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }),
      getStats: vi.fn().mockResolvedValue({ success: true, data: { total: 0 } }),
    } as unknown as MemoryApplicationService;
  }

  it('returns a router with all procedures callable', async () => {
    const service = createMockService();
    const router = createMemoryTrpcRouter(service) as {
      createCaller: (ctx: unknown) => Record<string, (input: never) => Promise<unknown>>;
    };
    const caller = router.createCaller({});

    await caller.captureMemory({
      title: 'T',
      content: 'C',
      category: 'experience',
    });
    await caller.recallMemory({ id: 'mem-1', strengthen: true });
    await caller.updateMemory({ id: 'mem-1', data: { title: 'Updated' } });
    await caller.forgetMemory('mem-1');
    await caller.strengthenMemory('mem-1');
    await caller.weakenMemory('mem-1');
    await caller.archiveMemory('mem-1');
    await caller.restoreMemory('mem-1');
    await caller.mergeMemories({ sourceId: 's1', targetId: 't1' });
    await caller.getMemory('mem-1');
    await caller.listMemories({ page: 1, limit: 20 });
    await caller.getStats();

    expect(service.captureMemory).toHaveBeenCalledWith(expect.objectContaining({ title: 'T' }));
    expect(service.recallMemory).toHaveBeenCalledWith('mem-1', true);
    expect(service.updateMemory).toHaveBeenCalledWith(
      'mem-1',
      expect.objectContaining({ title: 'Updated' }),
    );
    expect(service.forgetMemory).toHaveBeenCalledWith('mem-1');
    expect(service.strengthenMemory).toHaveBeenCalledWith('mem-1');
    expect(service.weakenMemory).toHaveBeenCalledWith('mem-1');
    expect(service.archiveMemory).toHaveBeenCalledWith('mem-1');
    expect(service.restoreMemory).toHaveBeenCalledWith('mem-1');
    expect(service.mergeMemories).toHaveBeenCalledWith('s1', 't1');
    expect(service.getMemory).toHaveBeenCalledWith('mem-1');
    expect(service.listMemories).toHaveBeenCalledWith(1, 20);
    expect(service.getStats).toHaveBeenCalled();
  });
});
