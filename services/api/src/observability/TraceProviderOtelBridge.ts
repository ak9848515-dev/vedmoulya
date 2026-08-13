// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — TraceProvider OTel Bridge
// EPIC-012 — Production Observability & Control Plane (Phases 2/3)
//
// Adapts the frozen AIObservability exporter seam (`OtelBridge`) onto the
// EPIC-012 ExecutionTrace spine. Every AI span emitted by the runtime
// (`ai.run`, `ai.provider_execution`, `ai.retrieval`, `ai.retry`,
// `ai.fallback`, …) lands in the correlated trace store — WITHOUT touching
// the frozen runtime and WITHOUT coupling engines to a vendor SDK.
//
// Redaction: string attributes pass through `redactSecrets` (the same
// redactor the AI runtime uses) so no key/secret pattern can leak into a
// trace. Telemetry failures are swallowed by the exporter itself.
// ─────────────────────────────────────────────────────────────────────────────

import { ExecutionTraceProvider } from '@vedmoulya/core';
import { redactSecrets } from '@vedmoulya/services';
import type { OtelBridge } from '@vedmoulya/services';
import type { TelemetrySpanHandle } from '@vedmoulya/core';

/**
 * Bridges AIObservability's OtelBridge seam into the ExecutionTraceProvider.
 * Called inside an active engine span (`withSpan`), the ambient AsyncLocalStorage
 * context parents each AI span under the engine trace — so a single trace
 * reconstructs ENGINE → AI → PROVIDER → RETRY → FALLBACK → VALIDATION.
 */
export class TraceProviderOtelBridge implements OtelBridge {
  constructor(private readonly provider: ExecutionTraceProvider) {}

  startSpan(
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): {
    end(status?: 'ok' | 'error'): void;
    setAttribute(key: string, value: string | number | boolean): void;
  } {
    const handle: TelemetrySpanHandle = this.provider.startSpan({
      name,
      kind: 'ai',
      attributes: redactAttributes(attributes),
    });
    return {
      end: (status: 'ok' | 'error' = 'ok'): void => {
        handle.end(status === 'error' ? 'ERROR' : 'OK');
      },
      setAttribute: (key: string, value: string | number | boolean): void => {
        handle.setAttribute(key, typeof value === 'string' ? redactSecrets(value) : value);
      },
    };
  }
}

/** Redact string attributes (defense-in-depth; structured numbers pass). */
function redactAttributes(
  attributes?: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  if (!attributes) return {};
  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [
      key,
      typeof value === 'string' ? redactSecrets(value) : value,
    ]),
  );
}
