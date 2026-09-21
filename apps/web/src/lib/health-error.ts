// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Health Endpoint Error Sanitization (PROD-03)
//
// /health/live, /health/ready and /health/check are UNAUTHENTICATED HTTP
// surface. Their error fields must never become an exfiltration channel for
// infrastructure configuration: a PostgreSQL driver error can carry the whole
// connection string (Node's ERR_INVALID_URL keeps it in `error.input`), a
// tenant/database name, a hostname, or an env var name — all of which describe
// credential material or internal topology.
//
// ONE sanitizer is shared by every health route so the contract cannot drift
// between endpoints. Diagnostics that do not describe credentials survive:
// a caller still learns whether the database is unhealthy and how long the
// probe took, never where the database lives or how to reach it.
//
// SECURITY: no message produced here is built from request input, and no
// branch echoes the value it received.
// ─────────────────────────────────────────────────────────────────────────────

import { redactConnectionStrings } from '@vedmoulya/core';

/** Generic, actionable-but-value-free message for an unreportable failure. */
export const GENERIC_DB_ERROR = 'Database health check failed';

/**
 * Collapse a database error into a safe, client-facing message.
 *
 * Order matters: the DSN redaction runs FIRST, so a message whose only useful
 * content was a credential-bearing URL collapses to a generic statement instead
 * of being re-emitted through a matching pattern branch.
 */
export function sanitizeDbError(error: string | undefined | null): string | undefined {
  if (!error || error.trim() === '') return undefined;

  // A connection string (or `?password=` parameter) anywhere in the message
  // means the message cannot be published verbatim.
  if (redactConnectionStrings(error) !== error) {
    return 'Database connection unavailable';
  }

  // Infrastructure wiring problems — name the state, never the variable.
  //
  // ORDER MATTERS: the specific, more actionable categories are tested before
  // the broad "something about the database" bucket, so a timeout or an auth
  // failure is reported as such instead of collapsing into the generic
  // connection message. Env-var NAMES are matched case-sensitively — the
  // `i` flag on a `DATABASE_URL` alternative would also match the ordinary
  // word "database" and swallow every other branch.
  if (/REDIS_URL|redis/i.test(error)) return 'Required infrastructure not configured';
  if (
    /connection refused|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|getaddrinfo|EHOSTUNREACH/i.test(
      error,
    )
  ) {
    return 'Database unreachable';
  }
  if (/password authentication failed|role .* does not exist|authentication/i.test(error)) {
    return 'Database authentication failed';
  }
  if (/timed out|timeout/i.test(error)) return 'Database readiness probe timed out';
  if (/does not exist|permission denied|relation/i.test(error)) {
    return 'Database schema unavailable';
  }
  if (/(IDENTITY_DATABASE_URL|DATABASE_URL)|database|pool is|connection string/.test(error)) {
    return 'Database connection unavailable';
  }

  return GENERIC_DB_ERROR;
}

/**
 * Sanitize an arbitrary thrown value from a health probe. Non-Error throwables
 * are reduced to the generic message rather than stringified, so an exotic
 * rejection cannot smuggle a credential through `String(value)`.
 */
export function sanitizeHealthError(error: unknown): string | undefined {
  if (error === undefined || error === null) return undefined;
  if (typeof error === 'string') return sanitizeDbError(error);
  if (error instanceof Error) return sanitizeDbError(error.message);
  return GENERIC_DB_ERROR;
}
