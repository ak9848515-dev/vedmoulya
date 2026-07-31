import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryTracer } from '../../observability/MemoryTracing.js';

// Mock @vedmoulya/core — use vi.hoisted to avoid hoisting issues
const mockGetTracer = vi.hoisted(() => vi.fn());
const mockStartSpan = vi.hoisted(() =>
  vi.fn().mockReturnValue({ name: 'test-span', attributes: {} }),
);
const mockEndSpan = vi.hoisted(() => vi.fn());
const mockRecordError = vi.hoisted(() => vi.fn());
const mockSetAttribute = vi.hoisted(() => vi.fn());

mockGetTracer.mockReturnValue({
  startSpan: mockStartSpan,
  endSpan: mockEndSpan,
  recordError: mockRecordError,
  setAttribute: mockSetAttribute,
});

vi.mock('@vedmoulya/core', () => ({
  traceProvider: {
    getTracer: mockGetTracer,
  },
}));

describe('MemoryTracer', () => {
  let tracer: MemoryTracer;

  beforeEach(() => {
    tracer = new MemoryTracer();
    vi.clearAllMocks();
    mockStartSpan.mockReturnValue({ name: 'test-span', attributes: {} });
  });

  it('creates a span and completes it successfully', async () => {
    const result = await tracer.traceSpan('test-op', async (span) => {
      expect(span.name).toBe('test-span');
      return 'success';
    });

    expect(result).toBe('success');
    expect(mockStartSpan).toHaveBeenCalledWith('test-op');
    expect(mockEndSpan).toHaveBeenCalledWith(expect.any(Object), 'ok');
  });

  it('records error and re-throws on failure', async () => {
    const testError = new Error('operation failed');

    await expect(
      tracer.traceSpan('failing-op', async () => {
        throw testError;
      }),
    ).rejects.toThrow('operation failed');

    expect(mockRecordError).toHaveBeenCalledWith(expect.any(Object), testError);
    expect(mockEndSpan).toHaveBeenCalledWith(expect.any(Object), 'error');
  });

  it('setSpanAttributes sets attributes on the span', () => {
    const span = { name: 'test', attributes: { existing: 'value' } } as never;
    tracer.setSpanAttributes(span, { key1: 'value1', key2: 42, key3: true });

    expect(mockSetAttribute).toHaveBeenCalledWith(span, 'key1', 'value1');
    expect(mockSetAttribute).toHaveBeenCalledWith(span, 'key2', 42);
    expect(mockSetAttribute).toHaveBeenCalledWith(span, 'key3', true);
  });

  it('setSpanAttributes does not throw on errors', () => {
    mockSetAttribute.mockImplementationOnce(() => {
      throw new Error('tracing error');
    });

    expect(() => tracer.setSpanAttributes({} as never, { key: 'value' })).not.toThrow();
  });
});
