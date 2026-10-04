// ─────────────────────────────────────────────────────────────────────────────
// SPRINT (Phase 3) — Multi-AI architecture READINESS audit.
//
// AUDIT ONLY — this test asserts that the EXISTING architecture can already
// bound a future fan-out and already represent parent/child usage. It creates
// no fan-out runtime, no synthesis engine, no ensemble and no recursive
// spawning, and it does not modify the Mission lifecycle.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  auditFanoutIsBounded,
  auditParentChildUsage,
  readExistingBounds,
} from '../observability/MultiAiReadinessAudit.js';
import { InMemoryAiUsageStore } from '../observability/AiUsageLedger.js';
import { AiUsageRecorder } from '../observability/AiUsageRecorder.js';
import { aggregateAiUsage } from '../observability/AiUsageBoard.js';
import type { AiUsageEvent } from '../observability/AiUsageLedgerTypes.js';

describe('Phase 3 — existing bounds already constrain a future fan-out', () => {
  it('exposes the required hard limits from the EXISTING bounds authority', () => {
    const bounds = readExistingBounds();
    expect(bounds.maxParallelProviders).toBeGreaterThan(0);
    expect(bounds.maxSubtasks).toBeGreaterThan(0);
    expect(bounds.maxDepth).toBeGreaterThan(0);
    expect(bounds.maxProviderCalls).toBeGreaterThan(0);
    expect(bounds.maxCostUsd).toBeGreaterThan(0);
    expect(bounds.maxWallClockMs).toBeGreaterThan(0);
    expect(bounds.maxRetriesPerChild).toBeGreaterThan(0);
  });

  it('REFUSES an over-fanned-out plan through the existing validator', () => {
    const audit = auditFanoutIsBounded();
    expect(audit.fanoutWithinBounds).toBe(true);
    expect(audit.depthWithinBounds).toBe(true);
    expect(audit.tasksWithinBounds).toBe(true);
    expect(audit.overFanoutRefused).toBe(true);
  });

  it('no second autonomous loop: Mission remains the only lifecycle owner', () => {
    // The audit surface is pure data + pure validators. It exposes no executor,
    // no controller and no loop entry point — by construction it cannot spawn.
    const bounds = readExistingBounds();
    expect(Object.keys(bounds).sort()).toEqual(
      [
        'maxCostUsd',
        'maxDepth',
        'maxParallelProviders',
        'maxProviderCalls',
        'maxRetriesPerChild',
        'maxSubtasks',
        'maxWallClockMs',
      ].sort(),
    );
  });
});

describe('Phase 3 — the usage ledger already supports a parent/child tree', () => {
  it('represents a parent, children and a synthesis run with no schema change', () => {
    const shape = auditParentChildUsage();
    expect(shape.parent.executionId).toBe('P1');
    expect(shape.children).toHaveLength(3);
    expect(shape.synthesis.parentExecutionId).toBe('P1');
  });

  it('aggregates children into the parent total WITHOUT double counting', async () => {
    const shape = auditParentChildUsage();
    const store = new InMemoryAiUsageStore();
    const recorder = new AiUsageRecorder(store);
    const base = {
      userId: 'owner-1',
      providerFamily: 'google',
      model: 'gemini',
      costUsd: 0,
      costUnknown: false,
      currency: 'USD',
      timestamp: Date.UTC(2026, 9, 15, 12, 0, 0),
      status: 'success' as const,
      cached: false,
      retry: false,
    };
    const rows: AiUsageEvent[] = [
      ...shape.children.map((child, i) => ({
        eventId: child.executionId,
        ...base,
        provider: child.local ? 'ollama' : 'google',
        providerFamily: child.local ? 'ollama' : 'google',
        executionId: child.executionId,
        parentExecutionId: child.parentExecutionId,
        source: 'MULTI_AI_CHILD' as const,
        inputTokens: 100,
        outputTokens: 100,
        totalTokens: 200 + i,
        local: child.local,
      })),
      {
        eventId: shape.synthesis.executionId,
        ...base,
        provider: 'google',
        executionId: shape.synthesis.executionId,
        parentExecutionId: shape.synthesis.parentExecutionId,
        source: 'MULTI_AI_SYNTHESIS' as const,
        inputTokens: 50,
        outputTokens: 50,
        totalTokens: 100,
        local: false,
      },
    ];
    for (const row of rows) await recorder.record(row);

    const board = aggregateAiUsage(await store.list({ userId: 'owner-1' }));
    // 200 + 201 + 202 (children, one local) + 100 (synthesis) = 703
    expect(board.cloud.totalTokens + board.local.totalTokens).toBe(703);
    // The local child stays out of the cloud total.
    expect(board.cloud.totalTokens).toBe(200 + 201 + 100);
    expect(board.local.totalTokens).toBe(202);
    // Four executions, each counted exactly once.
    expect(board.cloud.executions + board.local.executions).toBe(4);
  });
});
