import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEcosystemWorkflowRouter } from '../routers/EcosystemWorkflowRouter.js';

function createMockService() {
  return {
    start: vi.fn().mockResolvedValue({ success: true, data: { executionId: 'exec-1' } }),
    get: vi.fn().mockResolvedValue({ success: true, data: { executionId: 'exec-1' } }),
    list: vi.fn().mockResolvedValue({ success: true, data: [] }),
    approve: vi.fn().mockResolvedValue({ success: true }),
    reject: vi.fn().mockResolvedValue({ success: true }),
    pause: vi.fn().mockResolvedValue({ success: true }),
    resume: vi.fn().mockResolvedValue({ success: true }),
    cancel: vi.fn().mockResolvedValue({ success: true }),
  };
}

const ctx = { userId: 'user-1' };

describe('EcosystemWorkflowRouter', () => {
  let service: ReturnType<typeof createMockService>;
  let router: ReturnType<typeof createEcosystemWorkflowRouter>;

  beforeEach(() => {
    service = createMockService();
    router = createEcosystemWorkflowRouter(service as never);
  });

  describe('start', () => {
    it('delegates to service.start with workflowId and ownerId', async () => {
      const result = await router.start({ workflowId: 'wf-1' }, ctx);
      expect(service.start).toHaveBeenCalledWith({ workflowId: 'wf-1', ownerId: 'user-1' });
      expect(result).toEqual({ success: true, data: { executionId: 'exec-1' } });
    });
  });

  describe('get', () => {
    it('delegates to service.get with executionId and userId', async () => {
      const result = await router.get({ executionId: 'exec-1' }, ctx);
      expect(service.get).toHaveBeenCalledWith('exec-1', 'user-1');
      expect(result).toEqual({ success: true, data: { executionId: 'exec-1' } });
    });
  });

  describe('list', () => {
    it('delegates to service.list with userId', async () => {
      const result = await router.list({}, ctx);
      expect(service.list).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ success: true, data: [] });
    });
  });

  describe('approve', () => {
    it('delegates to service.approve with all params', async () => {
      const result = await router.approve(
        { executionId: 'exec-1', stepId: 'step-1', note: 'looks good' },
        ctx,
      );
      expect(service.approve).toHaveBeenCalledWith('exec-1', 'user-1', 'step-1', 'looks good');
      expect(result).toEqual({ success: true });
    });

    it('delegates without optional note', async () => {
      await router.approve({ executionId: 'exec-1', stepId: 'step-1' }, ctx);
      expect(service.approve).toHaveBeenCalledWith('exec-1', 'user-1', 'step-1', undefined);
    });
  });

  describe('reject', () => {
    it('delegates to service.reject with all params', async () => {
      await router.reject({ executionId: 'exec-1', stepId: 'step-1', note: 'not ready' }, ctx);
      expect(service.reject).toHaveBeenCalledWith('exec-1', 'user-1', 'step-1', 'not ready');
    });

    it('delegates without optional note', async () => {
      await router.reject({ executionId: 'exec-1', stepId: 'step-1' }, ctx);
      expect(service.reject).toHaveBeenCalledWith('exec-1', 'user-1', 'step-1', undefined);
    });
  });

  describe('pause', () => {
    it('delegates to service.pause', async () => {
      const result = await router.pause({ executionId: 'exec-1' }, ctx);
      expect(service.pause).toHaveBeenCalledWith('exec-1', 'user-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('resume', () => {
    it('delegates to service.resume', async () => {
      const result = await router.resume({ executionId: 'exec-1' }, ctx);
      expect(service.resume).toHaveBeenCalledWith('exec-1', 'user-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('cancel', () => {
    it('delegates to service.cancel', async () => {
      const result = await router.cancel({ executionId: 'exec-1' }, ctx);
      expect(service.cancel).toHaveBeenCalledWith('exec-1', 'user-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('listWorkflows', () => {
    it('returns the certification workflow catalog', async () => {
      const result = (await router.listWorkflows({}, ctx)) as {
        success: boolean;
        data: Array<{ id: string; name: string }>;
      };
      expect(result.success).toBe(true);
      expect(result.data.length).toBe(3);
      expect(result.data.map((w) => w.id)).toContain('certification-knowledge-summary');
      expect(result.data.map((w) => w.id)).toContain('multi-agent-research-summary');
      expect(result.data.map((w) => w.id)).toContain('career-freelance-intelligence');
    });
  });

  describe('getWorkflow', () => {
    it('returns knowledge summary workflow details', async () => {
      const result = (await router.getWorkflow(
        { workflowId: 'certification-knowledge-summary' },
        ctx,
      )) as { success: boolean; data: { id: string; steps: unknown[] } };
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('certification-knowledge-summary');
      expect(result.data.steps.length).toBe(4);
    });

    it('returns research summary workflow details', async () => {
      const result = (await router.getWorkflow(
        { workflowId: 'multi-agent-research-summary' },
        ctx,
      )) as { success: boolean; data: { id: string; steps: unknown[] } };
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('multi-agent-research-summary');
      expect(result.data.steps.length).toBe(5);
    });

    it('returns career intelligence workflow details', async () => {
      const result = (await router.getWorkflow(
        { workflowId: 'career-freelance-intelligence' },
        ctx,
      )) as { success: boolean; data: { id: string; steps: unknown[] } };
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('career-freelance-intelligence');
      expect(result.data.steps.length).toBe(7);
    });

    it('returns error for unknown workflow', async () => {
      const result = (await router.getWorkflow({ workflowId: 'unknown' }, ctx)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
      expect(result.error).toContain('Workflow not found');
    });
  });
});
