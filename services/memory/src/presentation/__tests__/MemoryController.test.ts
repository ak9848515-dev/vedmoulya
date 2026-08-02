import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMemoryRouter } from '../routes/MemoryRoutes.js';
import type { MemoryApplicationService } from '@vedmoulya/services';

function createMockService(): {
  service: MemoryApplicationService;
  captureMemory: ReturnType<typeof vi.fn>;
  recallMemory: ReturnType<typeof vi.fn>;
  updateMemory: ReturnType<typeof vi.fn>;
  forgetMemory: ReturnType<typeof vi.fn>;
  strengthenMemory: ReturnType<typeof vi.fn>;
  weakenMemory: ReturnType<typeof vi.fn>;
  archiveMemory: ReturnType<typeof vi.fn>;
  restoreMemory: ReturnType<typeof vi.fn>;
  mergeMemories: ReturnType<typeof vi.fn>;
  getMemory: ReturnType<typeof vi.fn>;
  searchMemories: ReturnType<typeof vi.fn>;
  getStats: ReturnType<typeof vi.fn>;
} {
  const captureMemory = vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } });
  const recallMemory = vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } });
  const updateMemory = vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } });
  const forgetMemory = vi.fn().mockResolvedValue({ success: true });
  const strengthenMemory = vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } });
  const weakenMemory = vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } });
  const archiveMemory = vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } });
  const restoreMemory = vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } });
  const mergeMemories = vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } });
  const getMemory = vi.fn().mockResolvedValue({ success: true, data: { id: 'mem-1' } });
  const searchMemories = vi.fn().mockResolvedValue({ success: true, data: { items: [] } });
  const getStats = vi.fn().mockResolvedValue({ success: true, data: { total: 0 } });

  const service = {
    captureMemory,
    recallMemory,
    updateMemory,
    forgetMemory,
    strengthenMemory,
    weakenMemory,
    archiveMemory,
    restoreMemory,
    mergeMemories,
    getMemory,
    searchMemories,
    getStats,
  } as unknown as MemoryApplicationService;

  return {
    service,
    captureMemory,
    recallMemory,
    updateMemory,
    forgetMemory,
    strengthenMemory,
    weakenMemory,
    archiveMemory,
    restoreMemory,
    mergeMemories,
    getMemory,
    searchMemories,
    getStats,
  };
}

function post(router: ReturnType<typeof createMemoryRouter>, path: string, body: unknown) {
  return router.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('MemoryController', () => {
  let mocks: ReturnType<typeof createMockService>;
  let router: ReturnType<typeof createMemoryRouter>;

  beforeEach(() => {
    mocks = createMockService();
    router = createMemoryRouter(mocks.service);
  });

  describe('captureMemory', () => {
    const validBody = { title: 'My Memory', content: 'Content', category: 'experience' };

    it('returns 201 on success', async () => {
      const res = await post(router, '/memories', validBody);
      expect(res.status).toBe(201);
      expect(mocks.captureMemory).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'My Memory' }),
      );
    });

    it('returns 400 on validation failure', async () => {
      const res = await post(router, '/memories', { title: '' });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(mocks.captureMemory).not.toHaveBeenCalled();
    });

    it('returns 400 when the service fails', async () => {
      mocks.captureMemory.mockResolvedValue({ success: false, error: 'bad input' });
      const res = await post(router, '/memories', validBody);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('CAPTURE_ERROR');
    });

    it('maps thrown errors via the error mapper', async () => {
      mocks.captureMemory.mockRejectedValue(new Error('db down'));
      const res = await post(router, '/memories', validBody);
      expect(res.status).toBe(500);
    });
  });

  describe('recallMemory', () => {
    it('returns 200 with strengthen defaulting to true', async () => {
      const res = await router.request('/memories/mem-1');
      expect(res.status).toBe(200);
      expect(mocks.recallMemory).toHaveBeenCalledWith('mem-1', true);
    });

    it('passes strengthen=false from query', async () => {
      await router.request('/memories/mem-1?strengthen=false');
      expect(mocks.recallMemory).toHaveBeenCalledWith('mem-1', false);
    });

    it('returns 404 when memory is not found', async () => {
      mocks.recallMemory.mockResolvedValue({ success: false, error: 'not found' });
      const res = await router.request('/memories/mem-1');
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('updateMemory', () => {
    function patch(path: string, body: unknown) {
      return router.request(path, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    it('returns 200 on success', async () => {
      const res = await patch('/memories/mem-1', { title: 'Updated' });
      expect(res.status).toBe(200);
      expect(mocks.updateMemory).toHaveBeenCalledWith(
        'mem-1',
        expect.objectContaining({ title: 'Updated' }),
      );
    });

    it('returns 400 on validation failure', async () => {
      const res = await patch('/memories/mem-1', { title: '' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when memory is not found', async () => {
      mocks.updateMemory.mockResolvedValue({ success: false, error: 'not found' });
      const res = await patch('/memories/mem-1', { title: 'Updated' });
      expect(res.status).toBe(404);
    });
  });

  describe('forgetMemory', () => {
    it('returns 200 on success', async () => {
      const res = await router.request('/memories/mem-1', { method: 'DELETE' });
      expect(res.status).toBe(200);
      expect(mocks.forgetMemory).toHaveBeenCalledWith('mem-1');
    });

    it('returns 404 when memory is not found', async () => {
      mocks.forgetMemory.mockResolvedValue({ success: false, error: 'not found' });
      const res = await router.request('/memories/mem-1', { method: 'DELETE' });
      expect(res.status).toBe(404);
    });
  });

  describe('lifecycle endpoints', () => {
    it('strengthens and returns 200', async () => {
      const res = await post(router, '/memories/mem-1/strengthen', {});
      expect(res.status).toBe(200);
      expect(mocks.strengthenMemory).toHaveBeenCalledWith('mem-1');
    });

    it('returns 404 when strengthening an unknown memory', async () => {
      mocks.strengthenMemory.mockResolvedValue({ success: false, error: 'not found' });
      const res = await post(router, '/memories/mem-1/strengthen', {});
      expect(res.status).toBe(404);
    });

    it('weakens and returns 200', async () => {
      const res = await post(router, '/memories/mem-1/weaken', {});
      expect(res.status).toBe(200);
      expect(mocks.weakenMemory).toHaveBeenCalledWith('mem-1');
    });

    it('returns 404 when weakening an unknown memory', async () => {
      mocks.weakenMemory.mockResolvedValue({ success: false, error: 'not found' });
      const res = await post(router, '/memories/mem-1/weaken', {});
      expect(res.status).toBe(404);
    });

    it('archives and returns 200', async () => {
      const res = await post(router, '/memories/mem-1/archive', {});
      expect(res.status).toBe(200);
      expect(mocks.archiveMemory).toHaveBeenCalledWith('mem-1');
    });

    it('restores and returns 200', async () => {
      const res = await post(router, '/memories/mem-1/restore', {});
      expect(res.status).toBe(200);
      expect(mocks.restoreMemory).toHaveBeenCalledWith('mem-1');
    });

    it('returns 404 when restoring an unknown memory', async () => {
      mocks.restoreMemory.mockResolvedValue({ success: false, error: 'not found' });
      const res = await post(router, '/memories/mem-1/restore', {});
      expect(res.status).toBe(404);
    });
  });

  describe('mergeMemories', () => {
    it('returns 400 when sourceIds or targetId is missing', async () => {
      const res = await post(router, '/memories/merge', {});
      expect(res.status).toBe(400);
      expect(mocks.mergeMemories).not.toHaveBeenCalled();
    });

    it('returns 400 when sourceIds is empty', async () => {
      const res = await post(router, '/memories/merge', { sourceIds: [], targetId: 't' });
      expect(res.status).toBe(400);
    });

    it('returns 200 on success', async () => {
      const res = await post(router, '/memories/merge', {
        sourceIds: ['s1'],
        targetId: 't1',
      });
      expect(res.status).toBe(200);
      expect(mocks.mergeMemories).toHaveBeenCalledWith('s1', 't1');
    });

    it('returns 400 when the service fails', async () => {
      mocks.mergeMemories.mockResolvedValue({ success: false, error: 'merge failed' });
      const res = await post(router, '/memories/merge', {
        sourceIds: ['s1'],
        targetId: 't1',
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('MERGE_ERROR');
    });
  });

  describe('getTimeline', () => {
    it('returns 200 on success', async () => {
      const res = await router.request('/memories/mem-1/timeline');
      expect(res.status).toBe(200);
      expect(mocks.getMemory).toHaveBeenCalledWith('mem-1');
    });

    it('returns 404 when memory is not found', async () => {
      mocks.getMemory.mockResolvedValue({ success: false, error: 'not found' });
      const res = await router.request('/memories/mem-1/timeline');
      expect(res.status).toBe(404);
    });
  });

  describe('search', () => {
    it('returns 200 with filters', async () => {
      const res = await router.request('/search?q=test&category=experience&state=active');
      expect(res.status).toBe(200);
      expect(mocks.searchMemories).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'test', categories: ['experience'], states: ['active'] }),
      );
    });

    it('returns 400 on invalid category', async () => {
      const res = await router.request('/search?q=test&category=invalid');
      expect(res.status).toBe(400);
    });

    it('returns 500 when search fails', async () => {
      mocks.searchMemories.mockResolvedValue({ success: false, error: 'search failed' });
      const res = await router.request('/search?q=test');
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('SEARCH_ERROR');
    });
  });

  describe('getStatistics', () => {
    it('returns 200 on success', async () => {
      const res = await router.request('/stats');
      expect(res.status).toBe(200);
      expect(mocks.getStats).toHaveBeenCalled();
    });

    it('returns 500 when stats fail', async () => {
      mocks.getStats.mockResolvedValue({ success: false, error: 'stats failed' });
      const res = await router.request('/stats');
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('STATS_ERROR');
    });
  });

  describe('health', () => {
    it('returns healthy', async () => {
      const res = await router.request('/health');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe('healthy');
    });
  });

  describe('thrown service errors map to 500', () => {
    it('maps thrown errors for every endpoint', async () => {
      const endpoints: Array<{
        name:
          | 'recallMemory'
          | 'updateMemory'
          | 'forgetMemory'
          | 'strengthenMemory'
          | 'weakenMemory'
          | 'archiveMemory'
          | 'restoreMemory'
          | 'mergeMemories'
          | 'getMemory'
          | 'searchMemories'
          | 'getStats';
        request: (r: ReturnType<typeof createMemoryRouter>) => Promise<Response>;
      }> = [
        {
          name: 'recallMemory',
          request: (r) => r.request('/memories/mem-1'),
        },
        {
          name: 'updateMemory',
          request: (r) =>
            r.request('/memories/mem-1', {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ title: 'X' }),
            }),
        },
        {
          name: 'forgetMemory',
          request: (r) => r.request('/memories/mem-1', { method: 'DELETE' }),
        },
        {
          name: 'strengthenMemory',
          request: (r) => r.request('/memories/mem-1/strengthen', { method: 'POST' }),
        },
        {
          name: 'weakenMemory',
          request: (r) => r.request('/memories/mem-1/weaken', { method: 'POST' }),
        },
        {
          name: 'archiveMemory',
          request: (r) => r.request('/memories/mem-1/archive', { method: 'POST' }),
        },
        {
          name: 'restoreMemory',
          request: (r) => r.request('/memories/mem-1/restore', { method: 'POST' }),
        },
        {
          name: 'mergeMemories',
          request: (r) =>
            r.request('/memories/merge', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ sourceIds: ['s1'], targetId: 't1' }),
            }),
        },
        {
          name: 'getMemory',
          request: (r) => r.request('/memories/mem-1/timeline'),
        },
        {
          name: 'searchMemories',
          request: (r) => r.request('/search?q=test'),
        },
        {
          name: 'getStats',
          request: (r) => r.request('/stats'),
        },
      ];

      for (const ep of endpoints) {
        const fresh = createMockService();
        (fresh[ep.name] as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
        const r = createMemoryRouter(fresh.service);
        const res = await ep.request(r);
        expect(res.status, ep.name).toBe(500);
      }
    });
  });
});

describe('memoryRouteConfig', () => {
  it('exposes base path metadata', async () => {
    const { memoryRouteConfig } = await import('../routes/MemoryRoutes.js');
    expect(memoryRouteConfig.basePath).toBe('/api/v1/memory');
    expect(memoryRouteConfig.tags).toContain('Memory Engine');
  });
});

// PR-003B — cover the CORS configuration branches in createMemoryRouter
// (API_CORS_ORIGIN parse paths added by the CORS hardening sprint).
// Hono's cors() reflects a matching request Origin into the
// access-control-allow-origin header; a non-matching origin gets no header.
describe('MemoryRoutes CORS configuration', () => {
  const original = process.env.API_CORS_ORIGIN;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.API_CORS_ORIGIN;
    } else {
      process.env.API_CORS_ORIGIN = original;
    }
  });

  it('parses a single configured origin into the CORS allow-list', async () => {
    process.env.API_CORS_ORIGIN = 'https://app.vedmoulya.dev';
    const router = createMemoryRouter(createMockService().service);
    const res = await router.request('/health', {
      headers: { origin: 'https://app.vedmoulya.dev' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.vedmoulya.dev');
  });

  it('parses multiple comma-separated origins and allows each', async () => {
    process.env.API_CORS_ORIGIN = 'https://a.dev, https://b.dev';
    const router = createMemoryRouter(createMockService().service);
    for (const origin of ['https://a.dev', 'https://b.dev']) {
      const res = await router.request('/health', { headers: { origin } });
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBe(origin);
    }
  });

  it('does not reflect a non-allow-listed origin', async () => {
    process.env.API_CORS_ORIGIN = 'https://app.vedmoulya.dev';
    const router = createMemoryRouter(createMockService().service);
    const res = await router.request('/health', {
      headers: { origin: 'https://evil.example.com' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('falls back to the permissive wildcard when the configured list is empty', async () => {
    process.env.API_CORS_ORIGIN = ', ,';
    const router = createMemoryRouter(createMockService().service);
    const res = await router.request('/health');
    expect(res.status).toBe(200);
  });
});
