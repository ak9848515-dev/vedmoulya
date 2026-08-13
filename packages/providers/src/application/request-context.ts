// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Request Context
// EPIC-012A — AI Provider Intelligence (Phases 5 / 26)
//
// A minimal AsyncLocalStorage seam that carries the CURRENT REQUEST
// user into provider-domain queries WITHOUT changing any frozen
// contract. The API gateway sets it once per authenticated request
// (the auth middleware), so every provider-backed call made during
// that request — including the AI runtime's candidate port — sees the
// user's owner-scoped preferences (e.g. disabled providers are
// excluded from automatic routing immediately).
//
// When no context is present (tests, offline engines), behavior is
// unchanged (no user filter). This keeps the provider domain hermetic
// and the frozen AI runtime untouched.
// ──────────────────────────────────────────────────────────────────

import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage<string | undefined>();

/** Run `fn` with the given userId scoped for provider queries. */
export function runWithProviderUser<T>(userId: string, fn: () => T): T {
  return storage.run(userId, fn);
}

/** The current request's userId, or undefined when unset (no filtering). */
export function currentProviderUser(): string | undefined {
  return storage.getStore();
}
