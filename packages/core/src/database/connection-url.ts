// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Connection-URL Safety Helpers
//
// PROD-03 — two real problems this module closes:
//
// 1. QUOTED ENV VALUES. A `.env`/platform variable may be written as
//    DATABASE_URL="postgres://user:pass@host/db". Node's `process.loadEnvFile`
//    and platform dashboards differ on whether the surrounding quotes survive;
//    a quoted value reaches `postgres()` (or `new URL()`) verbatim and throws
//    `TypeError: Invalid URL`. `normalizeConnectionUrl` strips a single matching
//    pair of surrounding quotes and whitespace, so the value is used as written.
//
// 2. DSNs IN ERROR OUTPUT. When a connection string is malformed, Node's
//    `ERR_INVALID_URL` error carries the ENTIRE value in `error.input` — and
//    crash reporters / `console.error(error)` print it verbatim. That put a real
//    PostgreSQL credential (user + password) into the process log. Every path
//    that turns a connection failure into an error or a log line must pass
//    through these helpers, which emit the variable NAME and a reason — never
//    the value.
//
// Nothing here ever returns or logs a credential.
// ─────────────────────────────────────────────────────────────────────────────

/** Unbalanced/odd quote characters are dropped; only a matching pair is removed. */
const SURROUNDING_QUOTES = /^(['"])(.*)\1$/s;

/**
 * Normalize a connection URL read from the environment: trim whitespace and
 * remove one matching pair of surrounding quotes. Returns an empty string for
 * an absent value (callers decide whether that is an error).
 */
export function normalizeConnectionUrl(raw: string | undefined | null): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  const match = SURROUNDING_QUOTES.exec(trimmed);
  return (match?.[2] ?? trimmed).trim();
}

/**
 * Redact connection strings (and password parameters) from arbitrary text.
 *
 * Only credential-bearing URLs are collapsed to `[REDACTED_CONNECTION_STRING]`,
 * so ordinary URLs (deployment origins, documentation links, OTLP endpoints)
 * stay readable for operators. A URL is treated as credential-bearing when it
 * contains a `user:pass@` authority.
 */
export function redactConnectionStrings(text: string): string {
  if (typeof text !== 'string' || text.length === 0) return text;
  if (!text.includes('://')) return text;
  return text
    .replace(
      /[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]*:[^\s"'<>@/]*@[^\s"'<>]*/gi,
      '[REDACTED_CONNECTION_STRING]',
    )
    .replace(/([?&](?:password|pass|pwd)=)[^&\s"']+/gi, '$1[REDACTED]');
}

/**
 * Build a loggable, credential-free reason for a failed connection attempt.
 *
 * The original message is redacted; a message that was nothing but the DSN
 * collapses to a generic statement so `error.input` values can never survive.
 */
export function safeConnectionError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message || error.name
      : typeof error === 'string'
        ? error
        : 'connection failed';
  const redacted = redactConnectionStrings(raw).trim();
  if (redacted.length === 0 || redacted === '[REDACTED_CONNECTION_STRING]') {
    return 'connection failed (details withheld — the value is a credential)';
  }
  return redacted;
}
