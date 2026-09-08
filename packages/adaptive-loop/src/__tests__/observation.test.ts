// ──────────────────────────────────────────────────────────────────
// Observation normalization tests (PHASE 20 #1–#3):
//   normalization, sanitization (secrets never leak), bounded truncation.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  normalizeObservation,
  buildBoundedObservationContext,
  OBSERVATION_MAX_LENGTH,
} from '../domain/observation.js';
import type { AgentObservation } from '@vedmoulya/agent-execution';

const BASE = {
  runId: 'run-1',
  actionId: 'action-1',
  stepId: 'step-1',
  attempt: 1,
  observedAt: '2026-01-01T00:00:00.000Z',
};

describe('observation normalization', () => {
  it('normalizes a succeeded AI result into a structured observation', () => {
    const obs = normalizeObservation({
      ...BASE,
      status: 'succeeded',
      resultSummary: 'analysis complete',
      provider: 'mock',
      model: 'mock-1',
      capability: 'reasoning',
    });
    expect(obs.status).toBe('succeeded');
    expect(obs.actionId).toBe('action-1');
    expect(obs.stepId).toBe('step-1');
    expect(obs.provider).toBe('mock');
    expect(obs.model).toBe('mock-1');
    expect(obs.capability).toBe('reasoning');
    expect(obs.attempt).toBe(1);
    expect(obs.observedAt).toBe(BASE.observedAt);
  });

  it('classifies failure/timeout/permission-denial deterministically', () => {
    expect(normalizeObservation({ ...BASE, status: 'failed', resultSummary: 'boom' }).status).toBe(
      'failed',
    );
    expect(normalizeObservation({ ...BASE, status: 'success', resultSummary: 'ok' }).status).toBe(
      'succeeded',
    );
    expect(normalizeObservation({ ...BASE, status: 'abstained' }).status).toBe('unknown');
    expect(normalizeObservation({ ...BASE, denied: true, resultSummary: 'no' }).status).toBe(
      'denied',
    );
    expect(normalizeObservation({ ...BASE }).status).toBe('unknown');
  });

  it('never leaks secrets through the frozen sanitizer', () => {
    const obs = normalizeObservation({
      ...BASE,
      status: 'succeeded',
      resultSummary: 'done with api_key=sk-abc123456789 and token abc.def.ghi',
    });
    // The frozen sanitizer redacts the secret value following the marker.
    expect(obs.resultSummary).not.toContain('sk-abc123456789');
    expect(obs.resultSummary).not.toContain('abc.def.ghi');
  });

  it('sanitizes error text and keeps it bounded', () => {
    const obs = normalizeObservation({
      ...BASE,
      status: 'failed',
      resultSummary: 'failed',
      error: `provider error with password=hunter2 and key=${'k'.repeat(500)}`,
    });
    expect(obs.error).toBeDefined();
    // The frozen sanitizer truncates to maxLength and appends a '…' marker.
    expect((obs.error ?? '').length).toBeLessThanOrEqual(401);
    expect(obs.error).not.toContain('hunter2');
  });

  it('binds oversized output to the observation ceiling', () => {
    const huge = `x`.repeat(OBSERVATION_MAX_LENGTH * 3);
    const obs = normalizeObservation({ ...BASE, status: 'succeeded', resultSummary: huge });
    // Frozen sanitizer bound is maxLength + the '…' marker character.
    expect(obs.resultSummary.length).toBeLessThanOrEqual(OBSERVATION_MAX_LENGTH + 1);
  });

  it('binds artifacts and flattens structured results safely', () => {
    const obs = normalizeObservation({
      ...BASE,
      status: 'succeeded',
      structured: { json: { nested: { value: 'payload' } }, list: [1, 2, 3] },
      artifacts: Array.from({ length: 50 }, (_, i) => ({ name: `a${i}`, type: 'text' })),
    });
    expect(obs.artifacts.length).toBeLessThanOrEqual(20);
    expect(obs.resultSummary).toContain('payload');
  });
});

describe('bounded observation context (PHASE 17)', () => {
  function makeObservation(i: number): AgentObservation {
    return {
      observationId: `obs-${i}`,
      actionId: `action-${i}`,
      stepId: 'step-1',
      runId: 'run-1',
      attempt: i,
      status: 'succeeded',
      resultSummary: `summary ${i}`,
      artifacts: [],
      observedAt: `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z`,
    };
  }

  it('keeps only the most recent observations plus a compression marker', () => {
    const observations = Array.from({ length: 30 }, (_, i) => makeObservation(i));
    const context = buildBoundedObservationContext(observations, 5);
    // 5 recent + 1 compression marker.
    expect(context.length).toBe(6);
    expect(context[0].observationId).toBe('summary');
    expect(context[0].resultSummary).toContain('25 earlier observation(s)');
    expect(context[context.length - 1].observationId).toBe('obs-29');
  });

  it('returns all observations when below the bound', () => {
    const observations = [makeObservation(1), makeObservation(2)];
    const context = buildBoundedObservationContext(observations, 12);
    expect(context).toHaveLength(2);
    expect(context[0].observationId).toBe('obs-1');
  });

  it('classifies denied and blocked statuses deterministically (never inferred)', () => {
    expect(
      normalizeObservation({ ...BASE, status: 'denied', resultSummary: 'policy' }).status,
    ).toBe('denied');
    expect(normalizeObservation({ ...BASE, status: 'blocked', resultSummary: 'gate' }).status).toBe(
      'blocked',
    );
  });

  it('never crashes on an unserializable structured result', () => {
    const obs = normalizeObservation({
      ...BASE,
      status: 'succeeded',
      resultSummary: 'ok',
      structured: { bad: BigInt(1) } as unknown as Record<string, unknown>,
    });
    expect(obs.resultSummary).toContain('[structured result could not be serialized]');
    expect(obs.status).toBe('succeeded');
  });
});
