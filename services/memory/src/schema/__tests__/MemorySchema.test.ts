import { describe, it, expect } from 'vitest';
import { memories, memoryTimeline, memorySnapshots } from '../memory.js';

describe('memory database schema', () => {
  it('defines the memories table with core columns', () => {
    expect(memories).toBeDefined();
    expect(memories.id.name).toBe('id');
    expect(memories.label.name).toBe('label');
    expect(memories.content.name).toBe('content');
    expect(memories.category.name).toBe('category');
    expect(memories.state.name).toBe('state');
  });

  it('defines lifecycle, importance, and retention columns', () => {
    expect(memories.importanceLevel.name).toBe('importance_level');
    expect(memories.importanceScore.name).toBe('importance_score');
    expect(memories.confidenceLevel.name).toBe('confidence_level');
    expect(memories.strengthScore.name).toBe('strength_score');
    expect(memories.freshnessScore.name).toBe('freshness_score');
    expect(memories.retentionClass.name).toBe('retention_class');
    expect(memories.retentionTtlDays.name).toBe('retention_ttl_days');
    expect(memories.recallCount.name).toBe('recall_count');
    expect(memories.lastRecalledAt.name).toBe('last_recalled_at');
  });

  it('defines knowledge graph reference columns', () => {
    expect(memories.knowledgeNodeId.name).toBe('knowledge_node_id');
    expect(memories.knowledgeEdgeId.name).toBe('knowledge_edge_id');
  });

  it('defines the memory timeline table with indexes', () => {
    expect(memoryTimeline).toBeDefined();
    expect(memoryTimeline.id.name).toBe('id');
    expect(memoryTimeline.memoryId.name).toBe('memory_id');
    expect(memoryTimeline.eventType.name).toBe('event_type');
    expect(memoryTimeline.timestamp.name).toBe('timestamp');
  });

  it('defines the memory snapshots table with version columns', () => {
    expect(memorySnapshots).toBeDefined();
    expect(memorySnapshots.id.name).toBe('id');
    expect(memorySnapshots.snapshotData.name).toBe('snapshot_data');
    expect(memorySnapshots.versionMajor.name).toBe('version_major');
    expect(memorySnapshots.versionMinor.name).toBe('version_minor');
    expect(memorySnapshots.versionPatch.name).toBe('version_patch');
  });
});
