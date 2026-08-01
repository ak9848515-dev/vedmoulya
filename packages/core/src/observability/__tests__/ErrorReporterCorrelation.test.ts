// ──────────────────────────────────────────────────────────────────
// VedMoulya — Error Reporter & Correlation Edge Cases
// Remaining branch coverage for correlation.ts (ID format, return
// values, nested contexts, ensureCorrelationId) and errorReporter.ts
// (context override, payload shape, hub clear/resilience, singleton).
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createCorrelationId,
  runWithCorrelation,
  withNewCorrelation,
  getCorrelationId,
  ensureCorrelationId,
} from '../correlation.js';
import {
  ConsoleErrorReporter,
  HttpErrorReporter,
  ErrorReporterHub,
  errorReporter,
} from '../errorReporter.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CorrelationContext edge cases', () => {
  it('returns undefined outside any correlation context', () => {
    expect(getCorrelationId()).toBeUndefined();
  });

  it('generates a corr_-prefixed id with 13 characters', () => {
    const id = createCorrelationId();
    // randomUUID().slice(0, 13) may include a hyphen: corr_XXXXXXXX-XXXX
    expect(id).toMatch(/^corr_[0-9a-f]{8}-?[0-9a-f]{4}$/);
    expect(id.length).toBe(5 + 13);
  });

  it('runWithCorrelation returns the function result', () => {
    const result = runWithCorrelation('corr-1', () => 42);
    expect(result).toBe(42);
    const asyncResult = runWithCorrelation('corr-2', async () => 'value');
    expect(asyncResult).toBeInstanceOf(Promise);
    return asyncResult.then((v) => expect(v).toBe('value'));
  });

  it('restores the outer context after a nested run', () => {
    const captured: Array<string | undefined> = [];
    runWithCorrelation('outer', () => {
      captured.push(getCorrelationId());
      runWithCorrelation('inner', () => {
        captured.push(getCorrelationId());
      });
      captured.push(getCorrelationId());
    });
    expect(captured).toEqual(['outer', 'inner', 'outer']);
  });

  it('nested contexts do not leak outside the outer run', () => {
    runWithCorrelation('scoped', () => {
      expect(getCorrelationId()).toBe('scoped');
    });
    expect(getCorrelationId()).toBeUndefined();
  });

  it('withNewCorrelation returns the function result and a fresh id', () => {
    const id = withNewCorrelation(() => {
      const inner = getCorrelationId();
      expect(inner).toMatch(/^corr_[0-9a-f]{8}-?[0-9a-f]{4}$/);
      return inner;
    });
    expect(id).toMatch(/^corr_[0-9a-f]{8}-?[0-9a-f]{4}$/);
  });

  it('ensureCorrelationId creates a new id outside a context', () => {
    const id = ensureCorrelationId();
    expect(id).toMatch(/^corr_[0-9a-f]{8}-?[0-9a-f]{4}$/);
  });

  it('ensureCorrelationId reuses the active id inside a context', () => {
    runWithCorrelation('existing-id', () => {
      expect(ensureCorrelationId()).toBe('existing-id');
    });
  });

  it('a new correlation id differs from an existing one', () => {
    runWithCorrelation('fixed-id', () => {
      const fresh = createCorrelationId();
      expect(fresh).not.toBe('fixed-id');
    });
  });
});

describe('HttpErrorReporter payload edge cases', () => {
  it('prefers context.service over the configured service', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    const reporter = new HttpErrorReporter({
      endpoint: 'https://errors.internal/ingest',
      service: 'configured-service',
    });
    reporter.report(new Error('boom'), { service: 'overriding-service' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { service: string };
    expect(body.service).toBe('overriding-service');
  });

  it('falls back to the configured service when context has none', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    const reporter = new HttpErrorReporter({
      endpoint: 'https://errors.internal/ingest',
      service: 'configured-service',
    });
    reporter.report(new Error('boom'));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { service: string };
    expect(body.service).toBe('configured-service');
  });

  it('includes error name, stack, and the full context object in the payload', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    const reporter = new HttpErrorReporter({ endpoint: 'https://x', service: 's' });
    const error = new Error('boom');
    error.name = 'ValidationError';

    reporter.report(error, {
      operation: 'createUser',
      tags: { region: 'eu-west' },
      data: { userId: 42 },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      error: { name: string; message: string; stack?: string };
      context: { operation: string; tags: Record<string, string>; data: Record<string, unknown> };
    };
    expect(body.error.name).toBe('ValidationError');
    expect(body.error.message).toBe('boom');
    expect(body.error.stack).toBeDefined();
    expect(body.context.operation).toBe('createUser');
    expect(body.context.tags).toEqual({ region: 'eu-west' });
    expect(body.context.data).toEqual({ userId: 42 });
  });

  it('sends the api key as a Bearer header when configured', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    const reporter = new HttpErrorReporter({
      endpoint: 'https://x',
      service: 's',
      apiKey: 'sk-123',
    });
    reporter.report(new Error('boom'));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk-123');
    expect(headers['content-type']).toBe('application/json');
  });
});

describe('ErrorReporterHub resilience', () => {
  it('report is a no-op after clearReporters', () => {
    const hub = new ErrorReporterHub();
    hub.clearReporters();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => hub.report(new Error('x'))).not.toThrow();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('continues to healthy reporters when one throws', () => {
    const hub = new ErrorReporterHub();
    hub.clearReporters();
    const broken = {
      report: () => {
        throw new Error('broken reporter');
      },
    };
    const healthy = vi.fn();
    hub.addReporter(broken);
    hub.addReporter({ report: healthy });

    const error = new Error('app error');
    expect(() => hub.report(error)).not.toThrow();
    expect(healthy).toHaveBeenCalledWith(error, undefined);
  });

  it('reports to the healthy reporter before and after the broken one', () => {
    const hub = new ErrorReporterHub();
    hub.clearReporters();
    const first = vi.fn();
    const broken = {
      report: () => {
        throw new Error('broken reporter');
      },
    };
    const last = vi.fn();
    hub.addReporter({ report: first });
    hub.addReporter(broken);
    hub.addReporter({ report: last });

    hub.report(new Error('app error'), { operation: 'op' });

    expect(first).toHaveBeenCalledTimes(1);
    expect(last).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith(expect.any(Error), { operation: 'op' });
  });

  it('default singleton supports adding extra reporters', () => {
    const spy = vi.fn();
    const originalReporters = errorReporter as { reporters: unknown[] };
    const savedLength = originalReporters.reporters.length;
    try {
      errorReporter.addReporter({ report: spy });
      errorReporter.report(new Error('app error'));
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      // Restore the singleton to its original reporter set.
      errorReporter.clearReporters();
      for (let i = 0; i < savedLength; i++) {
        errorReporter.addReporter(new ConsoleErrorReporter());
      }
    }
  });
});
