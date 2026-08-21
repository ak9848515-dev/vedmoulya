// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Fabric · ResultNormalizer
// SPRINT-030 — G-5 · provider-agnostic result contract.
//
// Different providers return different shapes. This normalizer maps a raw
// provider response into the shared `NormalizedProviderResult` so provider-
// specific formats never leak through the application. Rules:
//   • error is always normalized (code + safe message — never raw internals)
//   • cost is only carried when actually reported (never fabricated)
//   • confidence is only carried when explicitly provided (never inferred)
//   • text vs structured vs tool is decided deterministically from the input
// ─────────────────────────────────────────────────────────────────────────────

import type { NormalizedProviderResult, NormalizedUsage } from '../types/fabric-types.js';

export interface RawProviderResponse {
  text?: string;
  data?: unknown;
  toolCall?: { name: string; arguments?: unknown };
  error?: { code?: string; message?: string };
  usage?: NormalizedUsage;
  costUsd?: number;
  latencyMs?: number;
  providerId?: string;
  modelId?: string;
  confidence?: number;
  /** Provider-specific metadata to carry through unchanged. */
  extraMetadata?: Record<string, string | number | boolean>;
}

/** Normalize a raw provider response into the shared contract. */
export function normalizeResult(raw: RawProviderResponse): NormalizedProviderResult {
  const metadata: Record<string, string | number | boolean> = { ...(raw.extraMetadata ?? {}) };

  if (raw.error) {
    const code = raw.error.code ?? 'PROVIDER_ERROR';
    const message = sanitizeMessage(raw.error.message ?? 'Provider returned an error.');
    return {
      kind: 'error',
      error: { code, message },
      metadata,
      costUsd: raw.costUsd,
      latencyMs: raw.latencyMs,
      providerId: raw.providerId,
      modelId: raw.modelId,
      usage: raw.usage,
    };
  }

  if (raw.toolCall) {
    return {
      kind: 'tool',
      toolCall: { name: raw.toolCall.name, arguments: raw.toolCall.arguments },
      metadata,
      usage: raw.usage,
      costUsd: raw.costUsd,
      latencyMs: raw.latencyMs,
      providerId: raw.providerId,
      modelId: raw.modelId,
      confidence: raw.confidence,
    };
  }

  if (raw.data !== undefined) {
    return {
      kind: 'structured',
      data: raw.data,
      metadata,
      usage: raw.usage,
      costUsd: raw.costUsd,
      latencyMs: raw.latencyMs,
      providerId: raw.providerId,
      modelId: raw.modelId,
      confidence: raw.confidence,
    };
  }

  return {
    kind: 'text',
    text: raw.text ?? '',
    metadata,
    usage: raw.usage,
    costUsd: raw.costUsd,
    latencyMs: raw.latencyMs,
    providerId: raw.providerId,
    modelId: raw.modelId,
    confidence: raw.confidence,
  };
}

/** Never leak raw provider internals (stack traces, headers, keys) into UI/logs.
 *  Redacts both secret LABELS (api_key, authorization, bearer, secret) and
 *  common secret VALUES (sk-…, key=… patterns). */
function sanitizeMessage(message: string): string {
  return message
    .slice(0, 300)
    .replace(
      /(api[_-]?key|authorization|bearer|secret|sk-[A-Za-z0-9_-]{4,}|(?:key|token)\s*[=:]\s*\S+)/gi,
      '[REDACTED]',
    );
}
