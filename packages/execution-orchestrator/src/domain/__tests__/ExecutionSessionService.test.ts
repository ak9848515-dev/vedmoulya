// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator Tests: Session Service
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ExecutionGraphBuilderService } from '../services/ExecutionGraphBuilderService.js';
import { ExecutionSessionService } from '../services/ExecutionSessionService.js';
import { ExecutionStateMachineService } from '../services/ExecutionStateMachineService.js';
import { ExecutionEventService } from '../services/ExecutionEventService.js';
import { createBlogGraphInput } from '../../catalog/orchestrator-catalog.js';
import type { ExecutionResult } from '../../types/orchestrator-types.js';

describe('ExecutionSessionService', () => {
  const builder = new ExecutionGraphBuilderService();
  const sm = new ExecutionStateMachineService();
  const events = new ExecutionEventService();
  const service = new ExecutionSessionService(sm, events);

  it('creates a session from a graph in created state', () => {
    const graph = builder.build(createBlogGraphInput());
    const session = service.createSession(graph, 'strategy_blog_seed');
    expect(session.status).toBe('created');
    expect(session.graphId).toBe(graph.graphId);
    expect(session.currentStage).toBe(graph.stages[0]?.stageId);
    expect(session.progress).toBe(0);
    expect(session.events[0]?.type).toBe('created');
  });

  it('starts a session through the state machine', () => {
    const graph = builder.build(createBlogGraphInput());
    const session = service.createSession(graph, 'strategy_blog_seed');
    const started = service.apply(session, { type: 'start' });
    expect(started.status).toBe('validated');
    expect(started.startedAt).toBeTruthy();
    expect(started.events.at(-1)?.type).toBe('started');
  });

  it('throws on illegal transitions', () => {
    const graph = builder.build(createBlogGraphInput());
    const session = service.createSession(graph, 'strategy_blog_seed');
    expect(() => service.apply(session, { type: 'complete' })).toThrow(/Illegal transition/);
  });

  it('records node results and advances progress', () => {
    const graph = builder.build(createBlogGraphInput());
    const session = service.createSession(graph, 'strategy_blog_seed');
    const first = graph.nodes[0];
    const result: ExecutionResult = {
      nodeId: first?.nodeId ?? 'node_research',
      success: true,
      outcome: 'done',
      costUsd: 0.2,
      tokensUsed: 1000,
      latencyMs: 800,
      attempts: 1,
      completedAt: new Date().toISOString(),
    };
    const updated = service.recordNodeResult(session, graph, result);
    expect(updated.results[result.nodeId]).toBeDefined();
    expect(updated.progress).toBeCloseTo(1 / graph.nodes.length);
    expect(updated.events.at(-1)?.type).toBe('completed');
  });

  it('completes the session when all nodes succeed', () => {
    const graph = builder.build(createBlogGraphInput());
    let session = service.createSession(graph, 'strategy_blog_seed');
    for (const node of graph.nodes) {
      const result: ExecutionResult = {
        nodeId: node.nodeId,
        success: true,
        outcome: 'done',
        costUsd: 0.1,
        tokensUsed: 500,
        latencyMs: 400,
        attempts: 1,
        completedAt: new Date().toISOString(),
      };
      session = service.recordNodeResult(session, graph, result);
    }
    expect(session.progress).toBe(1);
    expect(session.status).toBe('completed');
    expect(session.finishedAt).toBeTruthy();
  });

  it('records failure events without terminal state until commanded', () => {
    const graph = builder.build(createBlogGraphInput());
    const session = service.createSession(graph, 'strategy_blog_seed');
    const first = graph.nodes[0];
    const result: ExecutionResult = {
      nodeId: first?.nodeId ?? 'node_research',
      success: false,
      outcome: 'failed',
      costUsd: 0.1,
      tokensUsed: 300,
      latencyMs: 2000,
      attempts: 1,
      completedAt: new Date().toISOString(),
      error: 'boom',
    };
    const updated = service.recordNodeResult(session, graph, result);
    expect(updated.events.at(-1)?.type).toBe('failed');
    expect(updated.status).toBe('created'); // no auto-fail command applied
  });

  it('supports cancel with a finished timestamp', () => {
    const graph = builder.build(createBlogGraphInput());
    let session = service.createSession(graph, 'strategy_blog_seed');
    session = service.apply(session, { type: 'start' }); // validated
    session = service.apply(session, { type: 'start' }); // ready
    session = service.apply(session, { type: 'start' }); // running
    const cancelled = service.apply(session, { type: 'cancel' });
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.finishedAt).toBeTruthy();
  });
});
