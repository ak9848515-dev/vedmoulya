import { describe, it, expect, vi } from 'vitest';
import {
  createProactiveBrainPort,
  createProactiveCapabilityPort,
} from '../infrastructure/ProactiveBridgePorts.js';

describe('ProactiveBridgePorts', () => {
  describe('createProactiveBrainPort', () => {
    const makeBrain = () => ({
      dailyPriorities: vi.fn(),
      listOpportunities: vi.fn(),
      listTasks: vi.fn(),
      listIntelligenceEvents: vi.fn(),
      listOutcomeMemory: vi.fn(),
      discoverIntelligence: vi.fn(),
    });

    it('dailyPriorities maps data and derives urgency labels', () => {
      const brain = makeBrain();
      brain.dailyPriorities.mockReturnValue({
        success: true,
        data: [
          { id: 'p1', title: 'Do thing', priorityScore: 0.8, reason: 'because' },
          { id: 'p2', title: 'Do other', priorityScore: 0.4, reason: 'why' },
          { id: 'p3', title: 'Do tiny', priorityScore: 0.1, reason: 'meh' },
          { id: 'p4', title: 'No score', reason: 'unclear' },
        ],
      });
      const port = createProactiveBrainPort(brain as never);
      const result = port.dailyPriorities('user-1');
      expect(result.success).toBe(true);
      const data = (result as { success: true; data: Array<{ urgency: string }> }).data;
      expect(data[0].urgency).toBe('HIGH');
      expect(data[1].urgency).toBe('MEDIUM');
      expect(data[2].urgency).toBe('LOW');
      expect(data[3].urgency).toBe('UNKNOWN');
    });

    it('dailyPriorities returns failure when brain fails', () => {
      const brain = makeBrain();
      brain.dailyPriorities.mockReturnValue({ success: false, error: 'fail', code: 'ERR' });
      const port = createProactiveBrainPort(brain as never);
      const result = port.dailyPriorities('user-1');
      expect(result.success).toBe(false);
    });

    it('dailyPriorities handles null data', () => {
      const brain = makeBrain();
      brain.dailyPriorities.mockReturnValue({ success: true, data: null });
      const port = createProactiveBrainPort(brain as never);
      const result = port.dailyPriorities('user-1');
      expect(result.success).toBe(true);
      const data = (result as { data: unknown[] }).data;
      expect(data).toEqual([]);
    });

    it('listOpportunities maps data correctly', () => {
      const brain = makeBrain();
      brain.listOpportunities.mockReturnValue({
        success: true,
        data: [
          {
            id: 'o1',
            userId: 'u1',
            category: 'tech',
            title: 'Opp',
            description: 'desc',
            evidence: 'ev',
            uncertainty: 0.2,
            estimatedValue: 100,
            requiredCapabilities: ['cap1'],
            risk: 'LOW',
            status: 'NEW',
            createdAt: new Date(),
          },
        ],
      });
      const port = createProactiveBrainPort(brain as never);
      const result = port.listOpportunities('user-1');
      expect(result.success).toBe(true);
      const data = (result as { data: Array<{ id: string }> }).data;
      expect(data[0].id).toBe('o1');
    });

    it('listOpportunities returns failure when brain fails', () => {
      const brain = makeBrain();
      brain.listOpportunities.mockReturnValue({ success: false, error: 'fail' });
      const port = createProactiveBrainPort(brain as never);
      expect(port.listOpportunities('user-1').success).toBe(false);
    });

    it('listTasks maps data correctly', () => {
      const brain = makeBrain();
      brain.listTasks.mockReturnValue({
        success: true,
        data: [
          {
            id: 't1',
            userId: 'u1',
            objective: 'Task',
            status: 'active',
            stage: 'exec',
            createdAt: new Date(),
          },
        ],
      });
      const port = createProactiveBrainPort(brain as never);
      const result = port.listTasks('user-1');
      expect(result.success).toBe(true);
      const data = (result as { data: Array<{ id: string }> }).data;
      expect(data[0].id).toBe('t1');
    });

    it('listTasks returns failure when brain fails', () => {
      const brain = makeBrain();
      brain.listTasks.mockReturnValue({ success: false, error: 'fail' });
      const port = createProactiveBrainPort(brain as never);
      expect(port.listTasks('user-1').success).toBe(false);
    });

    it('listIntelligenceEvents maps data correctly', () => {
      const brain = makeBrain();
      brain.listIntelligenceEvents.mockReturnValue({
        success: true,
        data: [
          {
            id: 'e1',
            userId: 'u1',
            kind: 'insight',
            title: 'Event',
            description: 'desc',
            relevance: 0.9,
            createdAt: new Date(),
          },
        ],
      });
      const port = createProactiveBrainPort(brain as never);
      const result = port.listIntelligenceEvents('user-1');
      expect(result.success).toBe(true);
      const data = (result as { data: Array<{ id: string }> }).data;
      expect(data[0].id).toBe('e1');
    });

    it('listIntelligenceEvents returns failure when brain fails', () => {
      const brain = makeBrain();
      brain.listIntelligenceEvents.mockReturnValue({ success: false, error: 'fail' });
      const port = createProactiveBrainPort(brain as never);
      expect(port.listIntelligenceEvents('user-1').success).toBe(false);
    });

    it('listOutcomeMemory always returns empty', () => {
      const port = createProactiveBrainPort({} as never);
      const result = port.listOutcomeMemory('user-1');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('discoverIntelligence delegates to brain', async () => {
      const brain = makeBrain();
      brain.discoverIntelligence.mockResolvedValue({ success: true, data: [], error: undefined });
      const port = createProactiveBrainPort(brain as never);
      const result = await port.discoverIntelligence('user-1');
      expect(result.success).toBe(true);
    });
  });

  describe('createProactiveCapabilityPort', () => {
    it('returns capabilities from cache on second call', async () => {
      const fetchCaps = vi.fn().mockResolvedValue(['cap-a', 'cap-b']);
      const boundary = { assess: vi.fn().mockReturnValue({ automation: 'AUTO', reasons: [] }) };
      const port = createProactiveCapabilityPort(boundary, fetchCaps);

      // First call — cache miss, triggers async fetch
      const first = port.availableCapabilities('user-1');
      expect(first.success).toBe(true);

      // Wait for the async fetch to populate cache
      await new Promise((r) => setTimeout(r, 10));

      // Second call — cache hit
      const second = port.availableCapabilities('user-1');
      expect(second.success).toBe(true);
    });

    it('assessAutomation delegates to the boundary', () => {
      const boundary = {
        assess: vi.fn().mockReturnValue({ automation: 'MANUAL', reasons: ['too risky'] }),
      };
      const port = createProactiveCapabilityPort(boundary, vi.fn());
      const result = port.assessAutomation(['candidate1'], true);
      expect(result.automation).toBe('MANUAL');
      expect(result.reasons).toContain('too risky');
      expect(boundary.assess).toHaveBeenCalledWith(['candidate1'], true);
    });
  });
});
