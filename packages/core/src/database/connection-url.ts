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

/** The replacement emitted for a credential-bearing URL. */
const REDACTED_CONNECTION_STRING = '[REDACTED_CONNECTION_STRING]';

/** Characters that terminate a URL run (`[^\s"'<>]` as a single-char test). */
const URL_STOP_CHAR = /[\s"'<>]/;

/** Scheme characters, per RFC 3986 (`[a-z0-9+.-]`, case-insensitive). */
const SCHEME_CHAR = /[a-z0-9+.-]/i;

const ASCII_LETTER = /[a-z]/i;

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
/**
 * Collapse every credential-bearing URL in `text` in a single left-to-right
 * pass.
 *
 * SECURITY (ReDoS): this used to be a backtracking regex in the shape
 * `[a-z][a-z0-9+.-]*://` followed by three greedy negated classes separated by
 * `:` and `@` (CodeQL `js/polynomial-redos`, alert 41). Because the scheme
 * prefix was unanchored,
 * every character inside a scheme could start a match, and each start scanned
 * the whole remaining run twice — measured quadratic: ~19 ms at 4 000 hostile
 * characters and ~1 206 ms at 32 000 (4× per doubling). Sanitising a credential
 * must not itself be a denial-of-service vector, so the scan is now explicit:
 * each index is visited at most once (linear), and the whole URL run up to the
 * next stop character is collapsed exactly as before.
 *
 * Intentional tightening: the previous password run excluded `/`, so
 * `user:pa/ss@host` was NOT redacted at all. It is redacted now.
 */
function redactCredentialUrls(text: string): string {
  let out = '';
  let cursor = 0;
  while (cursor < text.length) {
    const schemeSeparator = text.indexOf('://', cursor);
    if (schemeSeparator === -1) break;

    // Walk back over the scheme token (never past the last consumed index, so
    // the scan stays linear).
    let schemeStart = schemeSeparator;
    while (schemeStart > cursor && SCHEME_CHAR.test(text.charAt(schemeStart - 1))) schemeStart -= 1;
    const isScheme = ASCII_LETTER.test(text.charAt(schemeStart));

    // The URL runs up to the next whitespace/quote/angle bracket.
    let authorityEnd = schemeSeparator + 3;
    while (authorityEnd < text.length && !URL_STOP_CHAR.test(text.charAt(authorityEnd))) {
      authorityEnd += 1;
    }

    const authority = text.slice(schemeSeparator + 3, authorityEnd);
    const at = authority.indexOf('@');
    const colon = authority.indexOf(':');
    const credentialBearing = isScheme && at > 0 && colon >= 0 && colon < at;

    out += credentialBearing
      ? text.slice(cursor, schemeStart) + REDACTED_CONNECTION_STRING
      : text.slice(cursor, authorityEnd);
    cursor = authorityEnd;
  }
  return out + text.slice(cursor);
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
  return redactCredentialUrls(text).replace(
    /([?&](?:password|pass|pwd)=)[^&\s"']+/gi,
    '$1[REDACTED]',
  );
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
