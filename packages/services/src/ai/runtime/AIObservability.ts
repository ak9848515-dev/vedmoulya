// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Observability Abstraction
// AI-RUNTIME-002 C-03 — production observability without hard-coding
// the runtime to any single exporter.
//
// Provides:
//   - a NOOP exporter (default, zero overhead)
//   - a TEST exporter (in-memory span capture for tests)
//   - an OTel-compatible exporter seam (bridges to @vedmoulya/core
//     TraceProvider / OtelExporter)
//   - a Langfuse-compatible seam (configurable endpoint + auth)
//   - redaction: no sensitive prompt content is emitted by default;
//     payload capture is configurable and redacts secrets.
// ──────────────────────────────────────────────────────────────────

/** A single AI execution span. */
export interface AISpan {
  /** Stable span name, e.g. 'ai.retrieval'. */
  name: string;
  /** Request ID correlating the whole AI run. */
  requestId: string;
  /** Optional user/tenant correlation (only when permitted). */
  userId?: string;
  tenantId?: string;
  /** Start/end timestamps (epoch ms). */
  startedAt: number;
  endedAt?: number;
  /** Duration in ms (set on end). */
  durationMs?: number;
  /** Structured attributes (redacted). */
  attributes: Record<string, string | number | boolean>;
  /** Optional error message (redacted). */
  error?: string;
  /** Parent span name (for nesting). */
  parent?: string;
}

/** Payload capture policy — controls what content is emitted. */
export interface PayloadCapturePolicy {
  /** Capture user input (redacted). Default false. */
  captureUserInput?: boolean;
  /** Capture retrieved document content (redacted). Default false. */
  captureRetrievedContent?: boolean;
  /** Capture model output (redacted). Default false. */
  captureModelOutput?: boolean;
  /** Maximum characters per captured payload. Default 500. */
  maxPayloadChars?: number;
}

/** AI observability exporter contract. */
export interface AIObservabilityExporter {
  /** Emit a completed span. */
  exportSpan(span: AISpan): void;
  /** Flush any buffered spans (no-op for NOOP/TEST). */
  flush?(): Promise<void>;
}

/** Options for the AI observability manager. */
export interface AIObservabilityOptions {
  /** Exporter to use. Defaults to NOOP. */
  exporter?: AIObservabilityExporter;
  /** Payload capture policy (redaction applied). */
  payloadCapture?: PayloadCapturePolicy;
  /** Whether to emit user/tenant correlation. Default false. */
  emitUserTenantCorrelation?: boolean;
}

// ── Redaction ───────────────────────────────────────────────────────────────

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{8,}/g, // OpenAI keys
  /sk-ant-[A-Za-z0-9_-]{8,}/g, // Anthropic keys
  /AIza[A-Za-z0-9_-]{8,}/g, // Google keys
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, // Bearer tokens
  /api[_-]?key["']?\s*[:=]\s*["']?[A-Za-z0-9_-]{8,}/gi, // api_key=...
  /password["']?\s*[:=]\s*["']?[^"'\s,;]{4,}/gi, // password=...
  /secret["']?\s*[:=]\s*["']?[^"'\s,;]{4,}/gi, // secret=...
  /token["']?\s*[:=]\s*["']?[^"'\s,;]{4,}/gi, // token=...
];

/** Redact known secret patterns from a string. */
export function redactSecrets(input: string): string {
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

/** Truncate a payload to the configured maximum. */
export function truncatePayload(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input;
  return `${input.slice(0, maxChars)}…[truncated ${input.length - maxChars} chars]`;
}

// ── NOOP exporter ───────────────────────────────────────────────────────────

/** Zero-overhead exporter (default). */
export class NoopAIObservabilityExporter implements AIObservabilityExporter {
  exportSpan(_span: AISpan): void {
    // Intentionally empty — no telemetry emitted.
  }
}

// ── TEST exporter ───────────────────────────────────────────────────────────

/** In-memory span capture for tests. */
export class TestAIObservabilityExporter implements AIObservabilityExporter {
  readonly spans: AISpan[] = [];

  exportSpan(span: AISpan): void {
    this.spans.push(span);
  }

  clear(): void {
    this.spans.length = 0;
  }
}

// ── OTel-compatible exporter ────────────────────────────────────────────────

/**
 * Bridges AI spans to the @vedmoulya/core TraceProvider + OtelExporter.
 * The core exporter is injected so this module stays provider-agnostic.
 */
export interface OtelBridge {
  startSpan(
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): {
    end(status?: 'ok' | 'error'): void;
    setAttribute(key: string, value: string | number | boolean): void;
  };
}

/** OTel-compatible exporter using the injected bridge. */
export class OtelAIObservabilityExporter implements AIObservabilityExporter {
  constructor(private readonly bridge: OtelBridge) {}

  exportSpan(span: AISpan): void {
    const otelSpan = this.bridge.startSpan(span.name, {
      'ai.request_id': span.requestId,
      'ai.duration_ms': span.durationMs ?? 0,
      ...(span.userId ? { 'ai.user_id': span.userId } : {}),
      ...(span.tenantId ? { 'ai.tenant_id': span.tenantId } : {}),
      ...span.attributes,
    });
    if (span.error) {
      otelSpan.setAttribute('ai.error', span.error);
      otelSpan.end('error');
    } else {
      otelSpan.end('ok');
    }
  }
}

// ── Langfuse-compatible seam ────────────────────────────────────────────────

/**
 * Langfuse-compatible exporter seam. The runtime never hard-codes Langfuse;
 * operators configure the endpoint + auth and this adapter posts OTLP-style
 * spans to the Langfuse-compatible endpoint. Failures are swallowed so
 * telemetry never breaks the AI request.
 */
export interface LangfuseExporterOptions {
  endpoint: string;
  publicKey?: string;
  secretKey?: string;
  flushIntervalMs?: number;
}

export class LangfuseAIObservabilityExporter implements AIObservabilityExporter {
  private readonly endpoint: string;
  private readonly publicKey?: string;
  private readonly secretKey?: string;
  private readonly pending: AISpan[] = [];
  private readonly timer?: ReturnType<typeof setInterval>;

  constructor(options: LangfuseExporterOptions) {
    this.endpoint = options.endpoint.replace(/\/$/, '');
    this.publicKey = options.publicKey;
    this.secretKey = options.secretKey;
    if (options.flushIntervalMs && options.flushIntervalMs > 0) {
      this.timer = setInterval(() => {
        void this.flush();
      }, options.flushIntervalMs);
      this.timer.unref();
    }
  }

  exportSpan(span: AISpan): void {
    this.pending.push(span);
  }

  async flush(): Promise<void> {
    if (this.pending.length === 0) return;
    const spans = this.pending.splice(0, this.pending.length);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, 2000);
      await fetch(`${this.endpoint}/api/public/traces`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.publicKey ? { 'x-langfuse-public-key': this.publicKey } : {}),
          ...(this.secretKey ? { 'x-langfuse-secret-key': this.secretKey } : {}),
        },
        body: JSON.stringify({ spans }),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch {
      // Swallow exporter errors — telemetry must not break the AI request.
    }
  }
}

// ── AI Observability Manager ────────────────────────────────────────────────

/**
 * Central AI observability manager. Emits spans through the configured
 * exporter, applies redaction + payload capture policy, and correlates
 * request IDs with user/tenant when permitted.
 */
export class AIObservability {
  private readonly exporter: AIObservabilityExporter;
  private readonly payloadCapture: Required<PayloadCapturePolicy>;
  private readonly emitUserTenantCorrelation: boolean;

  constructor(options: AIObservabilityOptions = {}) {
    this.exporter = options.exporter ?? new NoopAIObservabilityExporter();
    this.payloadCapture = {
      captureUserInput: options.payloadCapture?.captureUserInput ?? false,
      captureRetrievedContent: options.payloadCapture?.captureRetrievedContent ?? false,
      captureModelOutput: options.payloadCapture?.captureModelOutput ?? false,
      maxPayloadChars: options.payloadCapture?.maxPayloadChars ?? 500,
    };
    this.emitUserTenantCorrelation = options.emitUserTenantCorrelation ?? false;
  }

  /** Start a span (returns a handle to end it). */
  startSpan(
    name: string,
    requestId: string,
    attributes: Record<string, string | number | boolean> = {},
    context?: { userId?: string; tenantId?: string; parent?: string },
  ): {
    end(status?: 'ok' | 'error', error?: string): void;
    setAttribute(key: string, value: string | number | boolean): void;
  } {
    const span: AISpan = {
      name,
      requestId,
      startedAt: Date.now(),
      attributes: { ...attributes },
      ...(this.emitUserTenantCorrelation && context?.userId ? { userId: context.userId } : {}),
      ...(this.emitUserTenantCorrelation && context?.tenantId
        ? { tenantId: context.tenantId }
        : {}),
      ...(context?.parent ? { parent: context.parent } : {}),
    };

    return {
      end: (status: 'ok' | 'error' = 'ok', error?: string): void => {
        span.endedAt = Date.now();
        span.durationMs = span.endedAt - span.startedAt;
        if (status === 'error' && error) {
          span.error = redactSecrets(error);
        }
        // C-05: telemetry failure MUST NOT break the AI request — an exporter
        // crash is swallowed here so spans are best-effort by construction.
        try {
          this.exporter.exportSpan(span);
        } catch {
          // Best-effort telemetry: ignore exporter failures.
        }
      },
      setAttribute: (key: string, value: string | number | boolean): void => {
        // Span attribute keys come from runtime code, never from user input.
        // eslint-disable-next-line security/detect-object-injection
        span.attributes[key] = value;
      },
    };
  }

  /** Capture a user input payload (redacted + truncated). */
  captureUserInput(input: string): string | undefined {
    if (!this.payloadCapture.captureUserInput) return undefined;
    return truncatePayload(redactSecrets(input), this.payloadCapture.maxPayloadChars);
  }

  /** Capture retrieved document content (redacted + truncated). */
  captureRetrievedContent(content: string): string | undefined {
    if (!this.payloadCapture.captureRetrievedContent) return undefined;
    return truncatePayload(redactSecrets(content), this.payloadCapture.maxPayloadChars);
  }

  /** Capture model output (redacted + truncated). */
  captureModelOutput(output: string): string | undefined {
    if (!this.payloadCapture.captureModelOutput) return undefined;
    return truncatePayload(redactSecrets(output), this.payloadCapture.maxPayloadChars);
  }

  /** Flush the exporter (no-op for NOOP/TEST). */
  async flush(): Promise<void> {
    await this.exporter.flush?.();
  }
}
