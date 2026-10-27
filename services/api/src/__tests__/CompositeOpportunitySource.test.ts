import { describe, expect, it } from 'vitest';
import { CompositeOpportunitySource } from '../services/CompositeOpportunitySource.js';
import type {
  ExternalCandidatesResult,
  ExternalOpportunitySourcePort,
} from '../infrastructure/OpportunityMonitoringPorts.js';

describe('CompositeOpportunitySource', () => {
  it('combines candidates from multiple sources', async () => {
    const source1: ExternalOpportunitySourcePort = {
      name: 'source1',
      status: { configured: true, reason: 'ok' },
      fetchCandidates: async (): Promise<ExternalCandidatesResult> => ({
        success: true,
        candidates: [
          {
            source: 'source1',
            sourceReference: 'ref-1',
            title: 'Opp 1',
            description: 'Desc 1',
          },
        ],
      }),
    };

    const source2: ExternalOpportunitySourcePort = {
      name: 'source2',
      status: { configured: true, reason: 'ok' },
      fetchCandidates: async (): Promise<ExternalCandidatesResult> => ({
        success: true,
        candidates: [
          {
            source: 'source2',
            sourceReference: 'ref-2',
            title: 'Opp 2',
            description: 'Desc 2',
          },
        ],
      }),
    };

    const composite = new CompositeOpportunitySource([source1, source2]);
    expect(composite.status.configured).toBe(true);
    expect(composite.status.reason).toContain('2/2 active opportunity sources configured');

    const result = await composite.fetchCandidates();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map((c) => c.title)).toEqual(['Opp 1', 'Opp 2']);
  });

  it('resiliently returns candidates if at least one source succeeds', async () => {
    const failingSource: ExternalOpportunitySourcePort = {
      name: 'failing',
      status: { configured: false, reason: 'unconfigured' },
      fetchCandidates: async (): Promise<ExternalCandidatesResult> => ({
        success: false,
        code: 'SOURCE_NOT_CONFIGURED',
        message: 'No token',
      }),
    };

    const healthySource: ExternalOpportunitySourcePort = {
      name: 'healthy',
      status: { configured: true, reason: 'ok' },
      fetchCandidates: async (): Promise<ExternalCandidatesResult> => ({
        success: true,
        candidates: [
          {
            source: 'healthy',
            sourceReference: 'h-1',
            title: 'Healthy Opp',
            description: 'Healthy Desc',
          },
        ],
      }),
    };

    const composite = new CompositeOpportunitySource([failingSource, healthySource]);
    const result = await composite.fetchCandidates();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.title).toBe('Healthy Opp');
  });
});
