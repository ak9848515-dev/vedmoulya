// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Event Publisher unit tests
// ARC-003 — Knowledge Graph Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { KnowledgeEventPublisher } from '../KnowledgeEventPublisher.js';
import { logger } from '@vedmoulya/core';

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'knowledge.node.created',
    nodeId: 'node_1',
    edgeId: undefined,
    graphId: 'graph_1',
    timestamp: '2026-01-01T00:00:00Z',
    data: { label: 'Node' },
    ...overrides,
  };
}

function makeBus() {
  return { publish: vi.fn().mockResolvedValue(undefined) };
}

describe('KnowledgeEventPublisher', () => {
  it('publishes a node event with the right envelope', () => {
    const bus = makeBus();
    const publisher = new KnowledgeEventPublisher(bus as never);
    publisher.publish(makeEvent() as never);

    expect(bus.publish).toHaveBeenCalledTimes(1);
    const envelope = bus.publish.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(envelope.type).toBe('knowledge.node.created');
    expect(envelope.aggregateId).toBe('node_1');
    expect(envelope.aggregateType).toBe('KnowledgeNode');
    expect(envelope.data).toMatchObject({ label: 'Node', nodeId: 'node_1', graphId: 'graph_1' });
  });

  it('classifies edge and graph events by their aggregate type', () => {
    const edgeBus = makeBus();
    const edgePublisher = new KnowledgeEventPublisher(edgeBus as never);
    edgePublisher.publish(
      makeEvent({ type: 'knowledge.edge.created', nodeId: undefined, edgeId: 'edge_1' }) as never,
    );
    const edgeEnvelope = edgeBus.publish.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(edgeEnvelope.aggregateType).toBe('KnowledgeEdge');

    const graphBus = makeBus();
    const graphPublisher = new KnowledgeEventPublisher(graphBus as never);
    graphPublisher.publish(
      makeEvent({ type: 'knowledge.graph.created', nodeId: undefined, edgeId: undefined }) as never,
    );
    const graphEnvelope = graphBus.publish.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(graphEnvelope.aggregateType).toBe('KnowledgeGraph');
  });

  it('falls back to unknown aggregate when no ids are present', () => {
    const bus = makeBus();
    const publisher = new KnowledgeEventPublisher(bus as never);
    publisher.publish(
      makeEvent({ nodeId: undefined, edgeId: undefined, graphId: undefined }) as never,
    );

    const envelope = bus.publish.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(envelope.aggregateId).toBe('unknown');
  });

  it('publishes all events in a batch', () => {
    const bus = makeBus();
    const publisher = new KnowledgeEventPublisher(bus as never);
    publisher.publishAll([makeEvent() as never, makeEvent({ type: 'x.2' }) as never]);

    expect(bus.publish).toHaveBeenCalledTimes(2);
  });

  it('logs and swallows publish failures', () => {
    const bus = {
      publish: vi.fn().mockImplementation(() => {
        throw new Error('bus down');
      }),
    };
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const publisher = new KnowledgeEventPublisher(bus as never);

    expect(() => publisher.publish(makeEvent() as never)).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs String(error) when the bus throws a non-Error', () => {
    const bus = {
      publish: vi.fn().mockImplementation(() => {
        throw 'bus down';
      }),
    };
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const publisher = new KnowledgeEventPublisher(bus as never);

    expect(() => publisher.publish(makeEvent() as never)).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to publish knowledge event',
      expect.objectContaining({ error: 'bus down' }),
    );
    errorSpy.mockRestore();
  });
});
