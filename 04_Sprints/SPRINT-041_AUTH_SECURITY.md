# SPRINT-041 — AUTH REGRESSION + SECURITY AUDIT

**Phases 8–9** · 2026-08-16

## Phase 8 — Authentication regression (SPRINT-040 fixes hold)

Live verification against the local Identity service (Docker Postgres):

- ✅ Sign-up 201 (dev auto-verification active under `NODE_ENV=development`).
- ✅ Duplicate sign-up **409** (`REGISTRATION_FAILED`).
- ✅ Weak password refused **400** with exact zod messages (≥8 chars, upper/lower/digit).
- ✅ Wrong password sign-in refused **401**.
- ✅ Session verification 200 (returns userId); sign-out 200 (audit-recorded; JWT revocation is expiry-based by design — client token cleared, protected routes redirect, as browser-verified in SPRINT-040/041A).
- ✅ Gateway access without token → **401**; protected procedures enforced.
- ✅ Dev-only auto-verification gate confirmed at `AuthService.signUp`: `NODE_ENV !== production && !== staging` → `user.verifyEmail()`. **Production/staging behavior UNCHANGED** — users stay unverified and the domain rule keeps blocking sign-in until a real verification flow ships. No weakening.
- Identity suite: **283/283 PASS** (unchanged).

## Phase 9 — Security audit

| Check                                     | Result                                                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| IDOR (cross-user input)                   | ✅ **403 FORBIDDEN** live — `assertUserIdMatchesSession` on every `standardProcedure` (raw input compared against session `ctx.userId`)              |
| Missing authentication                    | ✅ **401 UNAUTHORIZED** without token (live)                                                                                                         |
| Provenance bypass                         | ✅ refused at zod boundary; no silent acceptance                                                                                                     |
| Evidence-state bypass                     | ✅ claimed VERIFIED downgraded; VERIFIED_PAYMENT requires real evidence text (D1)                                                                    |
| Revenue-state bypass                      | ✅ only `verified_payment` evidence reaches revenue states; ladder unchanged                                                                         |
| Duplicate-payment promotion               | ✅ bounded by evidence audit trail (text/reference mandatory); founder remains the authority for truthfulness of claimed payments (ledger semantics) |
| Arbitrary userId injection                | ✅ blocked by the central IDOR guard (live 403)                                                                                                      |
| Cross-user evidence access                | ✅ owner-scoped stores + IDOR (control check passes)                                                                                                 |
| Unsafe voice authorization                | ✅ voice is read-only presentation; the only Command Center mutation routes through the Brain approval authority; no voice path to the evidence loop |
| Sensitive logging                         | ✅ zero password/secret logging in identity (grep audit)                                                                                             |
| Secrets in source                         | ✅ none introduced; no credentials in the working tree (test tokens cleaned up)                                                                      |
| Local-test fixtures leaking to production | ✅ all test records explicitly `LOCAL TEST`, dev in-memory stores, restart-test data in the local Docker DB only                                     |

Central authorization remains authoritative; no auth/authorization boundary was weakened.
