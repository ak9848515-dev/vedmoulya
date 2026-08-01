// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision Tracing unit tests
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DecisionTracer } from '../DecisionTracing.js';
import { traceProvider } from '@vedmoulya/core';

function makeTracer() {
  return {
    getTracer: vi.fn().mockReturnValue({
      startSpan: vi.fn().mockReturnValue({ name: 'span' }),
      endSpan: vi.fn(),
      recordError: vi.fn(),
      setAttribute: vi.fn(),
    }),
  };
}

describe('DecisionTracer.traceSpan', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ends the span with ok on success', async () => {
    const mockTracer = makeTracer();
    vi.spyOn(traceProvider, 'getTracer').mockReturnValue(mockTracer.getTracer() as never);
    const tracer = new DecisionTracer();
    const result = await tracer.traceSpan('op', async (span) => {
      expect(span).toBeDefined();
      return 'done';
    });
    expect(result).toBe('done');
    const inner = mockTracer.getTracer();
    expect(inner.startSpan).toHaveBeenCalledWith('op');
    expect(inner.endSpan).toHaveBeenCalledWith({ name: 'span' }, 'ok');
  });

  it('records the error and ends with error on failure', async () => {
    const mockTracer = makeTracer();
    vi.spyOn(traceProvider, 'getTracer').mockReturnValue(mockTracer.getTracer() as never);
    const tracer = new DecisionTracer();
    await expect(
      tracer.traceSpan('op', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const inner = mockTracer.getTracer();
    expect(inner.recordError).toHaveBeenCalled();
    expect(inner.endSpan).toHaveBeenCalledWith({ name: 'span' }, 'error');
  });

  it('wraps non-Error rejections before recording the error', async () => {
    const mockTracer = makeTracer();
    vi.spyOn(traceProvider, 'getTracer').mockReturnValue(mockTracer.getTracer() as never);
    const tracer = new DecisionTracer();
    await expect(
      tracer.traceSpan('op', async () => {
        throw 'string-error';
      }),
    ).rejects.toBe('string-error');
    const inner = mockTracer.getTracer();
    expect(inner.recordError).toHaveBeenCalledWith({ name: 'span' }, expect.any(Error));
    expect(inner.endSpan).toHaveBeenCalledWith({ name: 'span' }, 'error');
  });
});

describe('DecisionTracer.setSpanAttributes', () => {
  it('sets each attribute on the span', () => {
    const mockTracer = makeTracer();
    vi.spyOn(traceProvider, 'getTracer').mockReturnValue(mockTracer.getTracer() as never);
    const tracer = new DecisionTracer();
    tracer.setSpanAttributes({ name: 'span' } as never, {
      category: 'strategic',
      priority: 7,
      highRisk: true,
    });
    const inner = mockTracer.getTracer();
    expect(inner.setAttribute).toHaveBeenCalledTimes(3);
  });

  it('swallows errors when the tracer is unavailable', () => {
    vi.spyOn(traceProvider, 'getTracer').mockImplementation(() => {
      throw new Error('no tracer');
    });
    const tracer = new DecisionTracer();
    expect(() => tracer.setSpanAttributes({} as never, { a: 1 })).not.toThrow();
  });
});
