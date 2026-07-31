// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Metrics
// Metrics instruments for knowledge graph operations monitoring
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import { metrics } from '@vedmoulya/core';

export const MetricNames = {
  NODES_CREATED: 'knowledge.nodes.created',
  NODES_UPDATED: 'knowledge.nodes.updated',
  NODES_DELETED: 'knowledge.nodes.deleted',
  EDGES_CREATED: 'knowledge.edges.created',
  EDGES_DELETED: 'knowledge.edges.deleted',
  GRAPHS_CREATED: 'knowledge.graphs.created',
  SEARCHES_EXECUTED: 'knowledge.searches.executed',
  TRAVERSALS_EXECUTED: 'knowledge.traversals.executed',
  IMPACT_ANALYSES: 'knowledge.impact.analyses',
  CYCLES_DETECTED: 'knowledge.cycles.detected',
  NODES_MERGED: 'knowledge.nodes.merged',
  NODES_SPLIT: 'knowledge.nodes.split',
  CACHE_HITS: 'knowledge.cache.hits',
  CACHE_MISSES: 'knowledge.cache.misses',
} as const;

export class KnowledgeMetrics {
  recordNodeCreated(): void {
    try {
      metrics.increment(MetricNames.NODES_CREATED);
    } catch {
      /* noop */
    }
  }

  recordNodeUpdated(): void {
    try {
      metrics.increment(MetricNames.NODES_UPDATED);
    } catch {
      /* noop */
    }
  }

  recordNodeDeleted(): void {
    try {
      metrics.increment(MetricNames.NODES_DELETED);
    } catch {
      /* noop */
    }
  }

  recordEdgeCreated(): void {
    try {
      metrics.increment(MetricNames.EDGES_CREATED);
    } catch {
      /* noop */
    }
  }

  recordEdgeDeleted(): void {
    try {
      metrics.increment(MetricNames.EDGES_DELETED);
    } catch {
      /* noop */
    }
  }

  recordGraphCreated(): void {
    try {
      metrics.increment(MetricNames.GRAPHS_CREATED);
    } catch {
      /* noop */
    }
  }

  recordSearchExecuted(): void {
    try {
      metrics.increment(MetricNames.SEARCHES_EXECUTED);
    } catch {
      /* noop */
    }
  }

  recordTraversalExecuted(): void {
    try {
      metrics.increment(MetricNames.TRAVERSALS_EXECUTED);
    } catch {
      /* noop */
    }
  }

  recordImpactAnalysis(): void {
    try {
      metrics.increment(MetricNames.IMPACT_ANALYSES);
    } catch {
      /* noop */
    }
  }

  recordCycleDetected(): void {
    try {
      metrics.increment(MetricNames.CYCLES_DETECTED);
    } catch {
      /* noop */
    }
  }

  recordNodeMerged(): void {
    try {
      metrics.increment(MetricNames.NODES_MERGED);
    } catch {
      /* noop */
    }
  }

  recordNodeSplit(): void {
    try {
      metrics.increment(MetricNames.NODES_SPLIT);
    } catch {
      /* noop */
    }
  }

  recordCacheHit(): void {
    try {
      metrics.increment(MetricNames.CACHE_HITS);
    } catch {
      /* noop */
    }
  }

  recordCacheMiss(): void {
    try {
      metrics.increment(MetricNames.CACHE_MISSES);
    } catch {
      /* noop */
    }
  }
}
