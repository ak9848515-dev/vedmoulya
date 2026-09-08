// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Trace Sanitization
//
// Traces must never contain: API keys, OAuth tokens, passwords, secrets,
// unnecessary raw prompts, or raw tool arguments. This module provides:
//   1. a structural guarantee (traces are built only from recorded fields —
//      never from prompts/arguments — see buildExecutionTrace),
//   2. a content sanitizer applied to every free-text field that is
//      persisted/exported (result summaries, errors, messages).
// ──────────────────────────────────────────────────────────────────

const SECRET_FIELD_PATTERN =
  /(api[_-]?key|access[_-]?key|secret|token|password|passwd|authorization|bearer|client[_-]?secret)\b([^a-z0-9_])[^\s,;]*/gi;

/** Long opaque values that are very likely credentials (hex/base64/jwt).
 *  GitHub access-token prefixes are handled permissively: classic PATs
 *  (`ghp_`/`gho_`/`ghu_`/`ghs_`) AND the bare `gh_` prefix with a long
 *  opaque tail are redacted rather than risk leaking a credential. */
const SECRET_VALUE_PATTERN =
  /([a-f0-9]{32,}|eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}|gh(?:[pous]_|_)[a-zA-Z0-9]{20,}|sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16})/g;

export interface SanitizeOptions {
  /** Extra sensitive substrings to redact (e.g. a live API key seen in output). */
  extraSensitive?: string[];
  /** Max length of the returned text (default 2 000). */
  maxLength?: number;
}

/** Redact credential-looking content from a free-text field. */
export function sanitizeTraceText(text: string, options: SanitizeOptions = {}): string {
  const maxLength = options.maxLength ?? 2_000;
  let cleaned = text;
  for (const marker of options.extraSensitive ?? []) {
    if (marker && marker.length >= 6) {
      cleaned = cleaned.split(marker).join('[REDACTED]');
    }
  }
  cleaned = cleaned.replace(SECRET_FIELD_PATTERN, '$1$2[REDACTED]');
  cleaned = cleaned.replace(SECRET_VALUE_PATTERN, '[REDACTED]');
  if (cleaned.length > maxLength) {
    cleaned = `${cleaned.slice(0, maxLength)}…`;
  }
  return cleaned;
}

/** Deterministic slice for observations fed to later steps (no secrets). */
export function safeSlice(text: string, maxLength = 8_000): string {
  const cleaned = sanitizeTraceText(text, { maxLength: maxLength + 1 });
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
}
