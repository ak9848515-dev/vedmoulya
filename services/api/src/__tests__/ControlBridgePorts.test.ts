import { describe, it, expect, vi } from 'vitest';
import {
  createControlBrainPort,
  createControlProactivePort,
  createControlFabricPort,
  createControlStores,
} from '../infrastructure/ControlBridgePorts.js';

describe('ControlBridgePorts', () => {
  describe('createControlBrainPort', () => {
    it('returns tasks with approvals from brain', () => {
      const brain = {
        listTasks: vi.fn().mockReturnValue({
          success: true,
          data: [
            { id: 't1', objective: 'Task 1', approvalRequired: ['approve-deploy'] },
            { id: 't2', objective: 'Task 2', approvalRequired: [] },
          ],
        }),
      } as never;
      const port = createControlBrainPort(brain);
      const tasks = port.listTasksWithApprovals('user-1');
      expect(tasks).toHaveLength(1);
      expect(tasks[0].taskId).toBe('t1');
      expect(tasks[0].approvalRequired).toContain('approve-deploy');
    });

    it('returns empty array when brain fails', () => {
      const brain = {
        listTasks: vi.fn().mockReturnValue({ success: false, error: 'not found' }),
      } as never;
      const port = createControlBrainPort(brain);
      expect(port.listTasksWithApprovals('user-1')).toEqual([]);
    });

    it('returns empty array when no tasks', () => {
      const brain = {
        listTasks: vi.fn().mockReturnValue({ success: true, data: [] }),
      } as never;
      const port = createControlBrainPort(brain);
      expect(port.listTasksWithApprovals('user-1')).toEqual([]);
    });

    it('returns empty array when data is null', () => {
      const brain = {
        listTasks: vi.fn().mockReturnValue({ success: true, data: null }),
      } as never;
      const port = createControlBrainPort(brain);
      expect(port.listTasksWithApprovals('user-1')).toEqual([]);
    });

    it('outcomeCount always returns 0', () => {
      const port = createControlBrainPort({} as never);
      expect(port.outcomeCount('user-1')).toBe(0);
    });
  });

  describe('createControlProactivePort', () => {
    it('refresh delegates to proactive service', async () => {
      const proactive = {
        refresh: vi.fn().mockResolvedValue({ success: true }),
      } as never;
      const port = createControlProactivePort(proactive);
      const result = await port.refresh('user-1');
      expect(result.success).toBe(true);
      expect(proactive.refresh).toHaveBeenCalledWith('user-1', { runDiscovery: false });
    });

    it('refresh passes runDiscovery option', async () => {
      const proactive = {
        refresh: vi.fn().mockResolvedValue({ success: true }),
      } as never;
      const port = createControlProactivePort(proactive);
      await port.refresh('user-1', { runDiscovery: true });
      expect(proactive.refresh).toHaveBeenCalledWith('user-1', { runDiscovery: true });
    });

    it('refresh returns failure when proactive fails', async () => {
      const proactive = {
        refresh: vi.fn().mockResolvedValue({ success: false, error: 'fail' }),
      } as never;
      const port = createControlProactivePort(proactive);
      const result = await port.refresh('user-1');
      expect(result.success).toBe(false);
    });

    it('listRecommendations filters by status', () => {
      const proactive = {
        list: vi.fn().mockReturnValue({
          success: true,
          data: [
            {
              id: 'r1',
              title: 'Rec 1',
              category: 'cat1',
              authorizationRequired: true,
              riskLevel: 'HIGH',
              status: 'NEW',
            },
            {
              id: 'r2',
              title: 'Rec 2',
              category: 'cat2',
              authorizationRequired: false,
              riskLevel: 'LOW',
              status: 'DISMISSED',
            },
            {
              id: 'r3',
              title: 'Rec 3',
              category: 'cat3',
              authorizationRequired: false,
              riskLevel: 'MEDIUM',
              status: 'REVIEWED',
            },
            {
              id: 'r4',
              title: 'Rec 4',
              category: 'cat4',
              authorizationRequired: false,
              riskLevel: 'LOW',
              status: 'ACCEPTED',
            },
          ],
        }),
      } as never;
      const port = createControlProactivePort(proactive);
      const recs = port.listRecommendations('user-1');
      expect(recs).toHaveLength(3);
      expect(recs.map((r) => r.id)).toEqual(['r1', 'r3', 'r4']);
    });

    it('listRecommendations returns empty when proactive fails', () => {
      const proactive = {
        list: vi.fn().mockReturnValue({ success: false, error: 'fail' }),
      } as never;
      const port = createControlProactivePort(proactive);
      expect(port.listRecommendations('user-1')).toEqual([]);
    });
  });

  describe('createControlFabricPort', () => {
    it('allProviderHealth maps health data', () => {
      const fabric = {
        allProviderHealth: vi
          .fn()
          .mockReturnValue([{ providerId: 'openai', state: 'healthy', observedCalls: 100 }]),
      } as never;
      const port = createControlFabricPort(fabric);
      const health = port.allProviderHealth();
      expect(health).toHaveLength(1);
      expect(health[0].providerId).toBe('openai');
    });

    it('costSnapshot returns cost data when available', () => {
      const fabric = {
        costPort: {
          snapshot: vi.fn().mockReturnValue({ dailyUsd: 5.2, providerUsd: 3.1 }),
        },
      } as never;
      const port = createControlFabricPort(fabric);
      const cost = port.costSnapshot('user-1');
      expect(cost.dailyUsd).toBe(5.2);
      expect(cost.providerUsd).toBe(3.1);
    });

    it('costSnapshot returns empty when no costPort', () => {
      const fabric = {} as never;
      const port = createControlFabricPort(fabric);
      const cost = port.costSnapshot('user-1');
      expect(cost.dailyUsd).toBeUndefined();
      expect(cost.providerUsd).toBeUndefined();
    });
  });

  describe('createControlStores', () => {
    it('returns the stores as-is', () => {
      const stores = {
        settings: { get: vi.fn() },
        emergencyStop: { get: vi.fn() },
        opportunities: { get: vi.fn() },
      } as never;
      const result = createControlStores(stores);
      expect(result).toBe(stores);
    });
  });
});
