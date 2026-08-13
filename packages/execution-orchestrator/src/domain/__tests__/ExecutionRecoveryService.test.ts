// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator Tests: Recovery
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ExecutionGraphBuilderService } from '../services/ExecutionGraphBuilderService.js';
import { ExecutionRecoveryService } from '../services/ExecutionRecoveryService.js';
import { ExecutionSessionService } from '../services/ExecutionSessionService.js';
import { ExecutionStateMachineService } from '../services/ExecutionStateMachineService.js';
import { ExecutionEventService } from '../services/ExecutionEventService.js';
import { createBlogGraphInput } from '../../catalog/orchestrator-catalog.js';
import type { ExecutionResult } from '../../types/orchestrator-types.js';

describe('ExecutionRecoveryService', () => {
  const builder = new ExecutionGraphBuilderService();
  const recovery = new ExecutionRecoveryService();
  const sm = new ExecutionStateMachineService();
  const events = new ExecutionEventService();
  const sessions = new ExecutionSessionService(sm, events);

  function sessionWithFailure(failedNodeId: string, attempts = 1) {
    const graph = builder.build(createBlogGraphInput());
    const session = sessions.createSession(graph, 'strategy_blog_seed');
    // Complete the first nodes to establish checkpoints.
    const result: ExecutionResult = {
      nodeId: failedNodeId,
      success: false,
      outcome: 'simulated failure',
      costUsd: 0.1,
      tokensUsed: 500,
      latencyMs: 1200,
      attempts,
      completedAt: new Date().toISOString(),
      error: 'provider timeout',
    };
    const failed = sessions.recordNodeResult(session, graph, result);
    return { graph, session: failed };
  }

  it('plans a retry for a failed node', () => {
    const { graph, session } = sessionWithFailure('node_research');
    const plans = recovery.plan(graph, session, 'node_research');
    expect(
      plans.some((p) => p.action.type === 'retry' && p.action.nodeId === 'node_research'),
    ).toBe(true);
  });

  it('plans resume from the latest checkpoint', () => {
    const { graph, session } = sessionWithFailure('node_research');
    const plans = recovery.plan(graph, session, 'node_research');
    const resume = plans.find((p) => p.action.type === 'resume');
    expect(resume).toBeDefined();
    expect(resume?.action.type === 'resume' && resume.action.checkpointId).toBeTruthy();
  });

  it('plans rollback of dependents', () => {
    const { graph, session } = sessionWithFailure('node_research');
    const plans = recovery.plan(graph, session, 'node_research');
    const rollback = plans.find((p) => p.action.type === 'rollback');
    expect(rollback).toBeDefined();
    // Writing depends on research, so it must be rolled back.
    expect(rollback?.action.type === 'rollback' && rollback.action.nodeIds).toContain(
      'node_writing',
    );
  });

  it('plans restart-stage for the failed stage', () => {
    const { graph, session } = sessionWithFailure('node_seo');
    const plans = recovery.plan(graph, session, 'node_seo');
    const restartStage = plans.find((p) => p.action.type === 'restart-stage');
    expect(restartStage).toBeDefined();
  });

  it('always offers restart-session as the last resort', () => {
    const { graph, session } = sessionWithFailure('node_research');
    const plans = recovery.plan(graph, session, 'node_research');
    expect(plans[plans.length - 1]?.action.type).toBe('restart-session');
  });

  it('does not plan a retry past the max attempts', () => {
    const { graph, session } = sessionWithFailure('node_research', 99);
    const plans = recovery.plan(graph, session, 'node_research');
    expect(plans.some((p) => p.action.type === 'retry')).toBe(false);
  });

  it('returns the latest checkpoint before a failed node', () => {
    const { graph, session } = sessionWithFailure('node_research');
    const ckpt = recovery.latestCheckpointBefore(session, 'node_research');
    expect(ckpt).toBeDefined();
    expect(graph.checkpoints.some((c) => c.checkpointId === ckpt?.checkpointId)).toBe(true);
  });
});
