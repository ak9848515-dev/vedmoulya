// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Tracing
// Tracing spans for knowledge graph operations
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import { traceProvider } from '@vedmoulya/core';
import type { Span, Tracer } from '@vedmoulya/core';

export class KnowledgeTracer {
  /** Create a tracing span for an async knowledge operation */
  async traceSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
    const tracer: Tracer = traceProvider.getTracer();
    const span = tracer.startSpan(name);

    try {
      const result = await fn(span);
      tracer.endSpan(span, 'ok');
      return result;
    } catch (error) {
      tracer.recordError(span, error instanceof Error ? error : new Error(String(error)));
      tracer.endSpan(span, 'error');
      throw error;
    }
  }

  /** Set attributes on the current span */
  setSpanAttributes(span: Span, attributes: Record<string, string | number | boolean>): void {
    try {
      const tracer = traceProvider.getTracer();
      for (const [key, value] of Object.entries(attributes)) {
        tracer.setAttribute(span, key, value);
      }
    } catch {
      // Silently fail — tracing should never break business logic
    }
  }
}
