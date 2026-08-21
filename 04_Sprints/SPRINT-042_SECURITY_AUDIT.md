# SPRINT-042 — SECURITY AUDIT

**NEW ENGINES CREATED: 0**
**Date:** 2026-08-16

---

## 1. Authentication

- Every mutation goes through the existing gateway `createAuthMiddleware`
  (`isAuthenticated` — JWT required; verified live: no token → 401).
- The web tRPC client attaches `Authorization: Bearer <jwt>` from the auth
  store on every request; the authRefreshLink retries once on 401 with a
  refreshed token (existing behavior, untouched).

## 2. Authorization / IDOR

- Central guard `assertUserIdMatchesSession` reads the **raw** input and
  rejects any procedure whose `userId` does not equal the session user.
- **Verified live (Scenario 9):** a request with `userId: 'usr_someone_else_123'`
  against the session's access token returns **403 FORBIDDEN** — the mutation
  is rejected before reaching the world model.
- The UI never accepts an arbitrary userId — it always uses the authenticated
  session's own userId from the auth store.

## 3. Ownership scoping

- All world stores are owner-scoped (`ownerId`); `problemList`, `prospectsList`
  and every mutation filter by the owner from the input, which the IDOR guard
  has already pinned to the session.

## 4. Provenance / evidence-state bypass

- Observation and prospect forms REQUIRE provenance at the UI level AND the
  backend enforces it independently (verified live: missing provenance →
  refused, no record created).
- The claim-state select never offers "Verified" — the honest options are
  HYPOTHESIS/OBSERVED/ESTIMATED-class states; the backend downgrades
  self-claimed VERIFIED (existing domain rule).
- `VERIFIED_PAYMENT` requires real payment-evidence text — the form refuses
  empty evidence and the backend enforces PAYMENT_EVIDENCE_REQUIRED
  (SPRINT-041 D1; regression-tested).

## 5. Revenue-state bypass

- The UI cannot set revenue state; it only requests `VERIFIED_PAYMENT` when
  the bounded chain permits (from PAYMENT_REQUESTED) and the backend is the
  sole authority for the revenue ladder.

## 6. Voice / UI authorization

- VOICE ≠ AUTHORIZATION unchanged: the Command Center voice presentation is
  read-only; this sprint adds no voice mutation surface.

## 7. Rate limiting

- All new UI paths reuse `standardProcedure` (100 req/min per user). The
  limiter is honest (`distributed:false` in-memory default). Verified live:
  exceeding the window returns 429 and the UI surfaces the message honestly
  ("Could not reach the gateway: Rate limit exceeded…") instead of hiding it.
- **Defect D2 fixed:** the panel's open-effect refetched the problem list in
  an infinite loop (30+ refetches in 2s), each burning a rate-limit token —
  a machine-paced session could trip 429 purely from UI overhead. Fixed;
  regression-tested.

## 8. Sensitive data

- No passwords, tokens, JWTs, or secrets are logged by the panel or the diag.
- The diag logs only booleans, statuses, and route names.
- No credentials exist in source; the browser verification uses fresh
  timestamped LOCAL TEST accounts.

## 9. Form safety

- Required-field validation on every form; loading state (double-submit
  guard via `submitting`); backend error messages displayed verbatim; 401/403/
  429/network failures all surface as user-safe errors (no stack traces).

## 10. Conclusion

No security boundary was weakened. The UI is presentation + form entry only;
every mutation passes through the existing authenticated, rate-limited,
IDOR-guarded, zod-validated gateway. Central authorization remains the
authority.
