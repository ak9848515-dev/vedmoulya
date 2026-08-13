// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: AI Observability Abstraction
// AI-RUNTIME-002 C-03 — verifies redaction, payload capture policy,
// NOOP/TEST/OTel/Langfuse exporters, and that secrets are never
// emitted into telemetry.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import {
  AIObservability,
  NoopAIObservabilityExporter,
  TestAIObservabilityExporter,
  OtelAIObservabilityExporter,
  LangfuseAIObservabilityExporter,
  redactSecrets,
  truncatePayload,
} from '../AIObservability.js';

describe('redactSecrets', () => {
  it('redacts OpenAI API keys', () => {
    expect(redactSecrets('key=sk-abcdefghijklmnopqrstuvwxyz123456')).toContain('[REDACTED]');
    expect(redactSecrets('key=sk-abcdefghijklmnopqrstuvwxyz123456')).not.toContain(
      'sk-abcdefghijklmnopqrstuvwxyz123456',
    );
  });

  it('redacts Anthropic API keys', () => {
    expect(redactSecrets('key=sk-ant-abcdefghijklmnopqrstuvwxyz123456')).toContain('[REDACTED]');
  });

  it('redacts Google API keys', () => {
    expect(redactSecrets('key=AIzaSyA-abcdefghijklmnopqrstuvwxyz123456')).toContain('[REDACTED]');
  });

  it('redacts Bearer tokens', () => {
    expect(redactSecrets('Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456')).toContain(
      '[REDACTED]',
    );
  });

  it('redacts api_key= patterns', () => {
    expect(redactSecrets('api_key=abcdefghijklmnopqrstuvwxyz123456')).toContain('[REDACTED]');
  });

  it('redacts password= patterns', () => {
    expect(redactSecrets('password=supersecretvalue')).toContain('[REDACTED]');
  });

  it('redacts secret= patterns', () => {
    expect(redactSecrets('secret=supersecretvalue')).toContain('[REDACTED]');
  });

  it('redacts token= patterns', () => {
    expect(redactSecrets('token=supersecretvalue')).toContain('[REDACTED]');
  });

  it('leaves non-secret text unchanged', () => {
    expect(redactSecrets('The Content Agency automates client content production.')).toBe(
      'The Content Agency automates client content production.',
    );
  });
});

describe('truncatePayload', () => {
  it('returns the input unchanged when within the limit', () => {
    expect(truncatePayload('short', 10)).toBe('short');
  });

  it('truncates and annotates when over the limit', () => {
    const result = truncatePayload('a'.repeat(100), 10);
    expect(result).toContain('a'.repeat(10));
    expect(result).toContain('[truncated 90 chars]');
  });
});

describe('NoopAIObservabilityExporter', () => {
  it('emits nothing', () => {
    const exporter = new NoopAIObservabilityExporter();
    expect(() =>
      exporter.exportSpan({
        name: 'ai.test',
        requestId: 'r1',
        startedAt: 0,
        attributes: {},
      }),
    ).not.toThrow();
  });
});

describe('TestAIObservabilityExporter', () => {
  it('captures spans in memory', () => {
    const exporter = new TestAIObservabilityExporter();
    exporter.exportSpan({
      name: 'ai.retrieval',
      requestId: 'r1',
      startedAt: 0,
      endedAt: 10,
      durationMs: 10,
      attributes: { topK: 5 },
    });
    expect(exporter.spans).toHaveLength(1);
    expect(exporter.spans[0]?.name).toBe('ai.retrieval');
    expect(exporter.spans[0]?.attributes.topK).toBe(5);
  });

  it('clears captured spans', () => {
    const exporter = new TestAIObservabilityExporter();
    exporter.exportSpan({
      name: 'ai.test',
      requestId: 'r1',
      startedAt: 0,
      attributes: {},
    });
    exporter.clear();
    expect(exporter.spans).toHaveLength(0);
  });
});

describe('AIObservability', () => {
  it('defaults to the NOOP exporter', () => {
    const obs = new AIObservability();
    const span = obs.startSpan('ai.test', 'r1');
    expect(() => span.end()).not.toThrow();
  });

  it('emits spans through the configured exporter', () => {
    const exporter = new TestAIObservabilityExporter();
    const obs = new AIObservability({ exporter });
    const span = obs.startSpan('ai.retrieval', 'r1', { topK: 5 });
    span.end();
    expect(exporter.spans).toHaveLength(1);
    expect(exporter.spans[0]?.name).toBe('ai.retrieval');
    expect(exporter.spans[0]?.requestId).toBe('r1');
    expect(exporter.spans[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records errors with redaction', () => {
    const exporter = new TestAIObservabilityExporter();
    const obs = new AIObservability({ exporter });
    const span = obs.startSpan('ai.provider', 'r1');
    span.end('error', 'OpenAI API key sk-abcdefghijklmnopqrstuvwxyz123456 failed');
    expect(exporter.spans[0]?.error).toContain('[REDACTED]');
    expect(exporter.spans[0]?.error).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456');
  });

  it('does not emit user/tenant correlation by default', () => {
    const exporter = new TestAIObservabilityExporter();
    const obs = new AIObservability({ exporter });
    const span = obs.startSpan('ai.test', 'r1', {}, { userId: 'user-a', tenantId: 'tenant-a' });
    span.end();
    expect(exporter.spans[0]?.userId).toBeUndefined();
    expect(exporter.spans[0]?.tenantId).toBeUndefined();
  });

  it('emits user/tenant correlation when permitted', () => {
    const exporter = new TestAIObservabilityExporter();
    const obs = new AIObservability({ exporter, emitUserTenantCorrelation: true });
    const span = obs.startSpan('ai.test', 'r1', {}, { userId: 'user-a', tenantId: 'tenant-a' });
    span.end();
    expect(exporter.spans[0]?.userId).toBe('user-a');
    expect(exporter.spans[0]?.tenantId).toBe('tenant-a');
  });

  it('does not capture user input by default', () => {
    const exporter = new TestAIObservabilityExporter();
    const obs = new AIObservability({ exporter });
    expect(obs.captureUserInput('hello')).toBeUndefined();
  });

  it('captures user input when enabled, with redaction', () => {
    const exporter = new TestAIObservabilityExporter();
    const obs = new AIObservability({
      exporter,
      payloadCapture: { captureUserInput: true },
    });
    const captured = obs.captureUserInput('my api_key=abcdefghijklmnopqrstuvwxyz123456');
    expect(captured).toContain('[REDACTED]');
    expect(captured).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
  });

  it('truncates captured payloads to the configured maximum', () => {
    const exporter = new TestAIObservabilityExporter();
    const obs = new AIObservability({
      exporter,
      payloadCapture: { captureUserInput: true, maxPayloadChars: 10 },
    });
    const captured = obs.captureUserInput('a'.repeat(100));
    expect(captured).toContain('[truncated');
  });

  it('does not capture retrieved content by default', () => {
    const exporter = new TestAIObservabilityExporter();
    const obs = new AIObservability({ exporter });
    expect(obs.captureRetrievedContent('doc content')).toBeUndefined();
  });

  it('captures retrieved content when enabled', () => {
    const exporter = new TestAIObservabilityExporter();
    const obs = new AIObservability({
      exporter,
      payloadCapture: { captureRetrievedContent: true },
    });
    expect(obs.captureRetrievedContent('doc content')).toBe('doc content');
  });

  it('does not capture model output by default', () => {
    const exporter = new TestAIObservabilityExporter();
    const obs = new AIObservability({ exporter });
    expect(obs.captureModelOutput('model output')).toBeUndefined();
  });

  it('captures model output when enabled', () => {
    const exporter = new TestAIObservabilityExporter();
    const obs = new AIObservability({
      exporter,
      payloadCapture: { captureModelOutput: true },
    });
    expect(obs.captureModelOutput('model output')).toBe('model output');
  });
});

describe('OtelAIObservabilityExporter', () => {
  it('bridges spans to the OTel bridge', () => {
    const started: Array<{ name: string; attributes: Record<string, string | number | boolean> }> =
      [];
    const bridge = {
      startSpan: (name: string, attributes: Record<string, string | number | boolean>) => {
        started.push({ name, attributes });
        return {
          end: vi.fn(),
          setAttribute: vi.fn(),
        };
      },
    };
    const exporter = new OtelAIObservabilityExporter(bridge);
    exporter.exportSpan({
      name: 'ai.retrieval',
      requestId: 'r1',
      startedAt: 0,
      endedAt: 10,
      durationMs: 10,
      attributes: { topK: 5 },
    });
    expect(started).toHaveLength(1);
    expect(started[0]?.name).toBe('ai.retrieval');
    expect(started[0]?.attributes['ai.request_id']).toBe('r1');
    expect(started[0]?.attributes['ai.duration_ms']).toBe(10);
    expect(started[0]?.attributes.topK).toBe(5);
  });
});

describe('LangfuseAIObservabilityExporter', () => {
  it('buffers spans and flushes to the endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    const exporter = new LangfuseAIObservabilityExporter({
      endpoint: 'http://langfuse:3000',
      publicKey: 'pk-test',
      secretKey: 'sk-test',
    });
    exporter.exportSpan({
      name: 'ai.test',
      requestId: 'r1',
      startedAt: 0,
      attributes: {},
    });
    await exporter.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/public/traces');
    expect(init.headers).toMatchObject({
      'x-langfuse-public-key': 'pk-test',
      'x-langfuse-secret-key': 'sk-test',
    });
    vi.unstubAllGlobals();
  });

  it('swallows exporter failures so telemetry never breaks the AI request', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    const exporter = new LangfuseAIObservabilityExporter({
      endpoint: 'http://langfuse:3000',
    });
    exporter.exportSpan({
      name: 'ai.test',
      requestId: 'r1',
      startedAt: 0,
      attributes: {},
    });
    await expect(exporter.flush()).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });
});
