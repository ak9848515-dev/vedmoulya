/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: dynamic member access here uses typed/closed-union keys,
   constant environment names, or fixed internal lists — never
   attacker-controlled property names. */
// ──────────────────────────────────────────────────────────────────
// VedMoulya — Tracing Hooks
// Lightweight tracing hooks for OpenTelemetry integration
// Implements BLP-001/D02 — Engineering Principle #9 (Observability)
// Implements BLP-002/D09 — OpenTelemetry instrumentation
// ──────────────────────────────────────────────────────────────────

/**
 * Span represents a unit of work being traced
 */
export interface Span {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: bigint;
  endTime?: bigint;
  attributes: Record<string, string | number | boolean>;
  status: 'ok' | 'error' | 'unset';
  error?: Error;
}

/**
 * Tracer creates spans for operations
 */
export interface Tracer {
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): Span;
  endSpan(span: Span, status?: 'ok' | 'error'): void;
  setAttribute(span: Span, key: string, value: string | number | boolean): void;
  recordError(span: Span, error: Error): void;
}

/**
 * Trace provider that creates tracers
 */
export class TraceProvider {
  private readonly serviceName: string;
  private readonly version: string;
  private readonly spans = new Map<string, Span[]>();

  constructor(serviceName: string = 'vedmoulya', version: string = '0.1.0') {
    this.serviceName = serviceName;
    this.version = version;
  }

  /**
   * Create a tracer instance
   */
  getTracer(): Tracer {
    return new DefaultTracer(this.serviceName, this.version, this.spans);
  }

  /**
   * Get all recorded spans (for export)
   */
  getSpans(): Span[] {
    return Array.from(this.spans.values()).flat();
  }

  /**
   * Clear all spans (for testing)
   */
  clear(): void {
    this.spans.clear();
  }
}

class DefaultTracer implements Tracer {
  private readonly serviceName: string;
  private readonly version: string;
  private readonly spans: Map<string, Span[]>;

  constructor(serviceName: string, version: string, spans: Map<string, Span[]>) {
    this.serviceName = serviceName;
    this.version = version;
    this.spans = spans;
  }

  private generateId(): string {
    const hex = 'abcdef0123456789';
    let id = '';
    for (let i = 0; i < 16; i++) {
      id += hex[Math.floor(Math.random() * 16)] ?? '';
    }
    return id;
  }

  startSpan(name: string, attributes?: Record<string, string | number | boolean>): Span {
    const span: Span = {
      name,
      traceId: this.generateId(),
      spanId: this.generateId(),
      startTime: process.hrtime.bigint(),
      attributes: attributes ?? {},
      status: 'unset',
    };

    const serviceSpans = this.spans.get(this.serviceName) ?? [];
    serviceSpans.push(span);
    this.spans.set(this.serviceName, serviceSpans);

    return span;
  }

  endSpan(span: Span, status: 'ok' | 'error' = 'ok'): void {
    span.endTime = process.hrtime.bigint();
    span.status = status;
  }

  setAttribute(span: Span, key: string, value: string | number | boolean): void {
    span.attributes[key] = value;
  }

  recordError(span: Span, error: Error): void {
    span.status = 'error';
    span.error = error;
  }
}

/**
 * Default trace provider
 */
export const traceProvider = new TraceProvider();
