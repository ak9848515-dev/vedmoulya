// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Identity Schema Readiness Gate (OPT-IN)
//
// WHY THIS EXISTS
//   The identity schema is applied at boot by the versioned migration layer
//   (`ensureIdentitySchema()`), which both boot paths AWAIT before they can
//   serve traffic. A healthy running process therefore never serves a database
//   that is behind the code. What boot-time migration cannot cover is a
//   database that becomes inconsistent AFTER boot, or an operator who wants a
//   deploy to be refused rather than silently repaired: the ledger can lose a
//   row (a restore from an older backup, a table dropped out of band), and
//   until now nothing surfaced that condition on the readiness endpoint.
//
//   `assertIdentitySchemaCurrent()` in `@vedmoulya/identity` answers exactly
//   that question. This module is the wiring, and it is deliberately OPT-IN:
//
//     IDENTITY_SCHEMA_READINESS_GATE=1   →  pending migration ⇒ readiness 503
//     (unset, or any other value)        →  gate absent, response unchanged
//
//   The default is DISABLED because turning "database is behind" into a 503 is
//   a runtime behaviour switch on a release-gated system; it must be an
//   explicit operator decision, never a silent change. When the flag is off the
//   gate performs NO I/O and adds NO key to the response, so the existing
//   readiness contract is byte-identical to before.
//
// FAIL-CLOSED CONTRACT (only while opted in)
//   • every pending migration ⇒ `pending`  ⇒ readiness is NOT ready
//   • any failure to determine the schema state (unreachable database, missing
//     configuration, timeout) ⇒ `unavailable` ⇒ readiness is NOT ready
//   There is no path in which an unknown schema state reports as ready.
//
// SECURITY
//   The result carries migration IDS and a version string only. Migration ids
//   are repository constants, not configuration. No connection string, host,
//   credential or environment-variable name can reach this value — the check
//   reads them from no source that could contain one — and `reason` is passed
//   through the SAME sanitizer the database probe uses.
// ─────────────────────────────────────────────────────────────────────────────

import { sanitizeHealthError } from './health-error.js';

/** Same bound as the database probe: readiness must never hang on one check. */
const GATE_TIMEOUT_MS = 5_000;

/** The opt-in flag name. Only its presence/value decides the gate. */
export const IDENTITY_SCHEMA_GATE_ENV = 'IDENTITY_SCHEMA_READINESS_GATE';

/**
 * Truthy tokens accepted for the flag. Anything else — including a blank
 * value, `0`, `false` and an unrecognised string — leaves the gate DISABLED,
 * because an unreadable opt-in must never activate a fail-closed behaviour.
 */
const ENABLING_TOKENS = new Set(['1', 'true', 'yes', 'on']);

/** Outcome of the gate. `status` is the only field readiness acts on. */
export interface IdentitySchemaGateResult {
  /**
   * `disabled`    — the flag is off; nothing was checked and nothing is added.
   * `current`     — the ledger matches the code; the schema is up to date.
   * `pending`     — migrations the code expects have not been applied.
   * `unavailable` — the schema state could not be determined (fail closed).
   */
  status: 'disabled' | 'current' | 'pending' | 'unavailable';
  /** Highest applied migration id, or null on a never-migrated database. */
  version?: string | null;
  /** Migration ids still pending (present only when `status` is `pending`). */
  pendingMigrations?: string[];
  /** Sanitized explanation, present only for `pending` / `unavailable`. */
  reason?: string;
}

/** Whether the operator has opted into the gate. Pure; performs no I/O. */
export function isIdentitySchemaGateEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  // Fold to OWN entries before answering, the same technique
  // `packages/providers`' credential resolver and `server-env.ts` use: a
  // dynamic `env[name]` lookup would also resolve an inherited
  // Object.prototype member, and the opt-in for a fail-closed check must never
  // be satisfied by anything but an explicitly configured value.
  for (const [name, value] of Object.entries(env)) {
    if (name !== IDENTITY_SCHEMA_GATE_ENV) continue;
    if (typeof value !== 'string') return false;
    return ENABLING_TOKENS.has(value.trim().toLowerCase());
  }
  return false;
}

/** Reject a promise that does not settle in time, so readiness cannot hang. */
function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('identity schema gate timed out'));
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * Evaluate the identity schema state. NEVER throws and NEVER performs I/O when
 * the gate is disabled — the disabled branch is the first statement.
 *
 * `env` is injectable for tests; production passes nothing and reads
 * `process.env`. The identity module is imported LAZILY so a deployment without
 * the gate pays nothing for it, and a failure to load the module is reported as
 * `unavailable` rather than crashing the health endpoint.
 */
export async function checkIdentitySchemaGate(
  env: Record<string, string | undefined> = process.env,
): Promise<IdentitySchemaGateResult> {
  if (!isIdentitySchemaGateEnabled(env)) return { status: 'disabled' };

  try {
    const identity = await import('@vedmoulya/identity');
    // Idempotent and lazy: shares the process-wide identity pool and performs
    // no network I/O until a query runs. Without this a direct caller (a test,
    // a worker) that never composed the gateway would report `unavailable`
    // merely because no one had opened the pool yet.
    //
    // `initializeDatabase()` RETURNS the pool, and the migration gate functions
    // operate on a `MigrationExecutor` — the argument is REQUIRED. Passing the
    // pool explicitly is what makes the gate reachable at all: omitting it made
    // both `assertIdentitySchemaCurrent`/`pendingMigrations` throw
    // (TypeError: cannot read properties of undefined), so an ENABLED gate
    // always reported `unavailable` and `/health/ready` was permanently 503.
    const db = identity.initializeDatabase();

    const run = async (): Promise<IdentitySchemaGateResult> => {
      try {
        // The SINGLE definition of "current" — the same gate the migration
        // layer exports, so readiness and the boot path can never disagree
        // about what up-to-date means.
        const version = await identity.assertIdentitySchemaCurrent(db);
        return { status: 'current', version };
      } catch (error) {
        // The gate rejected: distinguish "behind the code" from "cannot tell".
        try {
          const pending = await identity.pendingMigrations(db);
          if (pending.length > 0) {
            return {
              status: 'pending',
              pendingMigrations: pending.map((migration) => migration.id),
              reason: 'Identity schema is behind the deployed code',
            };
          }
          // The gate refused but the ledger lists nothing pending, so the two
          // disagree — an unknown state, which must not report as ready.
          return {
            status: 'unavailable',
            reason: sanitizeHealthError(error) ?? 'Identity schema state could not be determined',
          };
        } catch {
          return {
            status: 'unavailable',
            reason: sanitizeHealthError(error) ?? 'Identity schema state could not be determined',
          };
        }
      }
    };

    return await withTimeout(run(), GATE_TIMEOUT_MS);
  } catch (error) {
    return {
      status: 'unavailable',
      reason: sanitizeHealthError(error) ?? 'Identity schema state could not be determined',
    };
  }
}

/** Whether a gate result blocks readiness. `disabled`/`current` never block. */
export function identitySchemaGateBlocks(result: IdentitySchemaGateResult): boolean {
  return result.status === 'pending' || result.status === 'unavailable';
}
