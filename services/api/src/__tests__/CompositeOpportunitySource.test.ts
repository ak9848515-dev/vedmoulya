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

  it('reports SOURCE_UNAVAILABLE listing every failure when no source yields a candidate', async () => {
    const unconfigured: ExternalOpportunitySourcePort = {
      name: 'freelancer',
      status: { configured: false, reason: 'no token' },
      fetchCandidates: async (): Promise<ExternalCandidatesResult> => ({
        success: false,
        code: 'SOURCE_NOT_CONFIGURED',
        message: 'No token',
      }),
    };
    const broken: ExternalOpportunitySourcePort = {
      name: 'github',
      status: { configured: true, reason: 'ok' },
      fetchCandidates: async (): Promise<ExternalCandidatesResult> => {
        throw new Error('502 from upstream');
      },
    };

    const composite = new CompositeOpportunitySource([unconfigured, broken]);
    const result = await composite.fetchCandidates();

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.code).toBe('SOURCE_UNAVAILABLE');
    expect(result.message).toContain('freelancer: SOURCE_NOT_CONFIGURED - No token');
    expect(result.message).toContain('github: 502 from upstream');
  });

  it('records a non-Error rejection without losing the source name', async () => {
    const throwing: ExternalOpportunitySourcePort = {
      name: 'bounties',
      status: { configured: true, reason: 'ok' },
      fetchCandidates: async (): Promise<ExternalCandidatesResult> => {
        throw 'rate limited'; // eslint-disable-line @typescript-eslint/only-throw-error
      },
    };

    const composite = new CompositeOpportunitySource([throwing]);
    const result = await composite.fetchCandidates();

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.message).toContain('bounties: rate limited');
  });

  it('succeeds with no candidates when there are no sources at all', async () => {
    const composite = new CompositeOpportunitySource([]);

    expect(composite.status).toEqual({
      configured: false,
      reason: '0/0 active opportunity sources configured',
    });
    await expect(composite.fetchCandidates()).resolves.toEqual({
      success: true,
      candidates: [],
    });
  });
});
