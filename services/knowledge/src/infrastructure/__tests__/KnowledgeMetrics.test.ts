import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KnowledgeMetrics, MetricNames } from '../../observability/KnowledgeMetrics.js';

// Mock @vedmoulya/core metrics
const mockIncrement = vi.hoisted(() => vi.fn());

vi.mock('@vedmoulya/core', () => ({
  metrics: {
    increment: mockIncrement,
  },
}));

describe('KnowledgeMetrics', () => {
  let knowledgeMetrics: KnowledgeMetrics;

  beforeEach(() => {
    knowledgeMetrics = new KnowledgeMetrics();
    vi.clearAllMocks();
  });

  it('records node created metric', () => {
    knowledgeMetrics.recordNodeCreated();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.NODES_CREATED);
  });

  it('records node updated metric', () => {
    knowledgeMetrics.recordNodeUpdated();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.NODES_UPDATED);
  });

  it('records node deleted metric', () => {
    knowledgeMetrics.recordNodeDeleted();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.NODES_DELETED);
  });

  it('records edge created metric', () => {
    knowledgeMetrics.recordEdgeCreated();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.EDGES_CREATED);
  });

  it('records edge deleted metric', () => {
    knowledgeMetrics.recordEdgeDeleted();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.EDGES_DELETED);
  });

  it('records graph created metric', () => {
    knowledgeMetrics.recordGraphCreated();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.GRAPHS_CREATED);
  });

  it('records search executed metric', () => {
    knowledgeMetrics.recordSearchExecuted();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.SEARCHES_EXECUTED);
  });

  it('records traversal executed metric', () => {
    knowledgeMetrics.recordTraversalExecuted();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.TRAVERSALS_EXECUTED);
  });

  it('records impact analysis metric', () => {
    knowledgeMetrics.recordImpactAnalysis();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.IMPACT_ANALYSES);
  });

  it('records cycle detected metric', () => {
    knowledgeMetrics.recordCycleDetected();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.CYCLES_DETECTED);
  });

  it('records node merged metric', () => {
    knowledgeMetrics.recordNodeMerged();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.NODES_MERGED);
  });

  it('records node split metric', () => {
    knowledgeMetrics.recordNodeSplit();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.NODES_SPLIT);
  });

  it('records cache hit metric', () => {
    knowledgeMetrics.recordCacheHit();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.CACHE_HITS);
  });

  it('records cache miss metric', () => {
    knowledgeMetrics.recordCacheMiss();
    expect(mockIncrement).toHaveBeenCalledWith(MetricNames.CACHE_MISSES);
  });

  it('does not throw when core metrics fails', () => {
    mockIncrement.mockImplementationOnce(() => {
      throw new Error('metrics error');
    });

    expect(() => knowledgeMetrics.recordNodeCreated()).not.toThrow();
  });
});
