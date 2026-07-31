import { describe, it, expect } from 'vitest';
import {
  createKnowledgeEvent,
  createNodeEvent,
  createEdgeEvent,
  createGraphEvent,
} from '../events/KnowledgeEvent.js';

describe('KnowledgeEvent', () => {
  describe('createKnowledgeEvent', () => {
    it('creates an event with the given type', () => {
      const event = createKnowledgeEvent('knowledge.node.created');
      expect(event.type).toBe('knowledge.node.created');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('accepts optional data', () => {
      const event = createKnowledgeEvent('knowledge.search.executed', {
        query: 'test',
        results: 5,
      });
      expect(event.data).toEqual({ query: 'test', results: 5 });
    });

    it('defaults data to empty object', () => {
      const event = createKnowledgeEvent('knowledge.cycle.detected');
      expect(event.data).toEqual({});
    });

    it('does not set node/edge/graph IDs', () => {
      const event = createKnowledgeEvent('knowledge.node.created');
      expect(event.nodeId).toBeUndefined();
      expect(event.edgeId).toBeUndefined();
      expect(event.graphId).toBeUndefined();
    });
  });

  describe('createNodeEvent', () => {
    it('creates an event with a node ID', () => {
      const nodeId = { value: 'node-1', toString: () => 'node-1' } as never;
      const event = createNodeEvent('knowledge.node.updated', nodeId);
      expect(event.type).toBe('knowledge.node.updated');
      expect(event.nodeId).toBe(nodeId);
    });

    it('accepts optional data', () => {
      const nodeId = { value: 'node-1', toString: () => 'node-1' } as never;
      const event = createNodeEvent('knowledge.node.deleted', nodeId, { reason: 'cleanup' });
      expect(event.data).toEqual({ reason: 'cleanup' });
    });
  });

  describe('createEdgeEvent', () => {
    it('creates an event with an edge ID', () => {
      const edgeId = { value: 'edge-1', toString: () => 'edge-1' } as never;
      const event = createEdgeEvent('knowledge.edge.created', edgeId);
      expect(event.type).toBe('knowledge.edge.created');
      expect(event.edgeId).toBe(edgeId);
    });
  });

  describe('createGraphEvent', () => {
    it('creates an event with a graph ID', () => {
      const graphId = { value: 'graph-1', toString: () => 'graph-1' } as never;
      const event = createGraphEvent('knowledge.graph.archived', graphId, { reason: 'old' });
      expect(event.type).toBe('knowledge.graph.archived');
      expect(event.graphId).toBe(graphId);
      expect(event.data.reason).toBe('old');
    });
  });

  describe('event types', () => {
    it('supports all node event types', () => {
      const types = [
        'knowledge.node.created',
        'knowledge.node.updated',
        'knowledge.node.deleted',
        'knowledge.node.merged',
        'knowledge.node.split',
        'knowledge.node.status_changed',
      ] as const;
      for (const type of types) {
        const event = createKnowledgeEvent(type);
        expect(event.type).toBe(type);
      }
    });

    it('supports all edge event types', () => {
      const types = [
        'knowledge.edge.created',
        'knowledge.edge.updated',
        'knowledge.edge.deleted',
      ] as const;
      for (const type of types) {
        const event = createKnowledgeEvent(type);
        expect(event.type).toBe(type);
      }
    });

    it('supports all graph event types', () => {
      const types = [
        'knowledge.graph.created',
        'knowledge.graph.updated',
        'knowledge.graph.archived',
        'knowledge.graph.snapshot',
      ] as const;
      for (const type of types) {
        const event = createKnowledgeEvent(type);
        expect(event.type).toBe(type);
      }
    });
  });
});
