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
  constructor(
    private readonly provider: ExecutionTraceProvider,
    private readonly onSpanEnd?: (info: { name: string; traceId: string; spanId: string }) => void,
  ) {}

  startSpan(
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): {
    end(status?: 'ok' | 'error'): void;
    setAttribute(key: string, value: string | number | boolean): void;
  } {
    // OWNER-SCOPED TRACES: the AI runtime emits `ai.user_id` (the authenticated
    // session user) when user correlation is enabled. Promote it onto the trace
    // record as its `userId` so the owner-scoped CostLedger/TraceStore queries
    // can see real AI usage. This is the userId ONLY — never a credential,
    // token or secret (those are never placed in span attributes at all).
    const userId = ownerUserId(attributes);
    const handle: TelemetrySpanHandle = this.provider.startSpan({
      name,
      kind: 'ai',
      attributes: redactAttributes(attributes),
      ...(userId !== undefined ? { userId } : {}),
    });
    return {
      end: (status: 'ok' | 'error' = 'ok'): void => {
        handle.end(status === 'error' ? 'ERROR' : 'OK');
        try {
          this.onSpanEnd?.({ name, traceId: handle.traceId, spanId: handle.spanId });
        } catch {
          // Usage backfill is best-effort — never break telemetry.
        }
      },
      setAttribute: (key: string, value: string | number | boolean): void => {
        handle.setAttribute(key, typeof value === 'string' ? redactSecrets(value) : value);
      },
    };
  }
}

/**
 * The owning user id carried by an AI span, or undefined when absent. Only a
 * non-empty string is accepted, so a malformed value degrades to "no owner"
 * (the trace stays unattributed) rather than recording something untrue.
 */
function ownerUserId(attributes?: Record<string, string | number | boolean>): string | undefined {
  const value = attributes?.['ai.user_id'];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
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
