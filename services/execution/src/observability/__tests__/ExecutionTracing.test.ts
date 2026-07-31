import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define mock objects before vi.mock is hoisted
const { mockSpan, mockTracer } = vi.hoisted(() => ({
  mockSpan: { name: 'test-span', attributes: {} as Record<string, string | number | boolean> },
  mockTracer: {
    startSpan: vi.fn().mockReturnValue({
      name: 'test-span',
      attributes: {} as Record<string, string | number | boolean>,
    }),
    endSpan: vi.fn(),
    recordError: vi.fn(),
    setAttribute: vi.fn(),
  },
}));

vi.mock('@vedmoulya/core', () => ({
  traceProvider: { getTracer: vi.fn().mockReturnValue(mockTracer) },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  metrics: { increment: vi.fn() },
}));

import { ExecutionTracer } from '../ExecutionTracing.js';

describe('ExecutionTracer', () => {
  let tracer: ExecutionTracer;

  beforeEach(() => {
    vi.clearAllMocks();
    tracer = new ExecutionTracer();
  });

  describe('traceSpan', () => {
    it('creates a span, executes fn, ends with ok', async () => {
      const result = await tracer.traceSpan('test-op', async (span) => {
        expect(span).toBeDefined();
        return 'done';
      });
      expect(result).toBe('done');
      expect(mockTracer.startSpan).toHaveBeenCalledWith('test-op');
      expect(mockTracer.endSpan).toHaveBeenCalled();
    });

    it('records error and rethrows on failure', async () => {
      const err = new Error('Failed');
      await expect(
        tracer.traceSpan('fail-op', async () => {
          throw err;
        }),
      ).rejects.toThrow('Failed');
      expect(mockTracer.recordError).toHaveBeenCalled();
      expect(mockTracer.endSpan).toHaveBeenCalled();
    });

    it('wraps string errors in Error objects', async () => {
      await expect(
        tracer.traceSpan('str-err', async () => {
          throw 'Boom';
        }),
      ).rejects.toThrow('Boom');
      expect(mockTracer.recordError).toHaveBeenCalled();
    });

    it('supports nested tracing', async () => {
      const result = await tracer.traceSpan('outer', async () => {
        return await tracer.traceSpan('inner', async () => 'inner-done');
      });
      expect(result).toBe('inner-done');
      expect(mockTracer.startSpan).toHaveBeenCalledTimes(2);
      expect(mockTracer.endSpan).toHaveBeenCalledTimes(2);
    });
  });

  describe('setSpanAttributes', () => {
    it('sets attributes on span', () => {
      tracer.setSpanAttributes(mockSpan, { planId: 'p1', priority: 'high', count: 5 });
      expect(mockTracer.setAttribute).toHaveBeenCalledTimes(3);
    });

    it('handles empty attributes', () => {
      expect(() => tracer.setSpanAttributes(mockSpan, {})).not.toThrow();
      expect(mockTracer.setAttribute).not.toHaveBeenCalled();
    });

    it('does not throw when tracer setAttribute fails', () => {
      mockTracer.setAttribute.mockImplementationOnce(() => {
        throw new Error('Tracer error');
      });
      expect(() => tracer.setSpanAttributes(mockSpan, { key: 'val' })).not.toThrow();
    });
  });
});
