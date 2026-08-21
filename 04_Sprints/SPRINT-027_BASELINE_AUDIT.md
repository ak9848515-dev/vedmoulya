# SPRINT-027 — Baseline Audit (Re-Audit Before Implementation)

> **Sprint:** SPRINT-027 — Platform Integrity & Speech Foundation
> **Type:** Implementation sprint (with a mandatory Phase 0 re-audit first)
> **Date:** 2026-08-13
> **Verdict:** 🟢 **FINDINGS RE-VERIFIED — IMPLEMENTATION PROCEEDED ON EVIDENCE**

---

## 1. Re-Audit Method (Phase 0)

The SPRINT-026 audit findings were **independently re-verified against source
before any code was changed** — completion reports were not trusted blindly.
Every finding below lists the verification performed and the outcome.

### Reproducible verification executed

| Check                           | Command                                                                                                                               | Result                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Git state                       | `git status` / `git log --oneline -3`                                                                                                 | `main` @ `5bba63c` (SPRINT-025); pre-existing working-tree changes (`ExecutionRunner.tsx`, `PersistenceStores.test.ts`) unrelated to this sprint             |
| Rate-limit middleware           | read `services/api/src/middleware/rate-limit.ts`                                                                                      | Found: **in-memory Map + sync `checkRateLimit`** — per-process only, no distributed option, no explicit degradation path → **R-1 CONFIRMED**                 |
| Gateway audit                   | read `services/api/src/middleware/audit.ts` + consumers                                                                               | Found: audit written to a module-level in-memory array, no persistence → **R-2 CONFIRMED**                                                                   |
| Dead service                    | `grep -rln "services/notifications"` across `apps services packages scripts tooling .github` + `grep -rn "createNotificationService"` | **Zero references** outside the service itself → **S-1 CONFIRMED DEAD** (delete path proven)                                                                 |
| Dead Mic control                | read `apps/web/src/components/AICompanion.tsx`                                                                                        | `onClick={() => {}}` on the Mic button + `aria-label="Voice input"` → **UX-1 CONFIRMED**                                                                     |
| Phoenix branding                | `grep -rn "Phoenix"` in `apps/web/src`, `packages/services`                                                                           | `AICompanion.tsx` badge + footer; `DashboardAssembler.ts:510` "Ask Phoenix" description → **UX-2 CONFIRMED**                                                 |
| Frozen-repo `sql.json()` (DB-2) | `grep -rn "::jsonb"` + read `PostgresCapabilityRepository.ts`, `PostgresDiscoveryStore.ts`, `PersistenceStores.ts`                    | The pre-022 double-encoding fix (`sql.json(...)` single-encoding + comments) is **ALREADY APPLIED repo-wide** — DB-2 was a **stale finding**, no work needed |
| Speech capability seams         | `grep -rn "TEXT_TO_SPEECH\|SPEECH_TO_TEXT"` in provider adapters                                                                      | Catalog-only in `capability-marketplace`; **no production provider adapter declares `speech`** → speech foundation genuinely missing (Phase 3 scope)         |
| Conversation store              | grep for an owner-scoped conversation store                                                                                           | None exists (only outcome memory / preferences / learning stores) → Phase 5 scope                                                                            |
| Provider selection authority    | `QualityFirstSelector` + `ProviderRoleAssigner` in `capability-marketplace`                                                           | QUALITY→EVIDENCE→USABILITY→AVAILABILITY→COST hierarchy verified intact — **no duplicate selector needed**                                                    |
| Approval authority              | `ApprovalEngine` in `capability-marketplace`                                                                                          | Fail-closed, SENSITIVE_ACTIONS-driven — **no duplicate approval engine needed**                                                                              |

---

## 2. Implementation-Gap Table (produced before coding)

| #    | Gap                                                                                          | Severity                                 | Evidence                                                                | Phase |
| ---- | -------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- | ----- |
| R-1  | Rate limiting is in-memory, per-process, sync, no distributed path                           | P1                                       | `rate-limit.ts` (Map-based, sync)                                       | 1     |
| R-2  | Gateway audit log is in-memory only (lost on restart, invisible to operators)                | P1                                       | `audit.ts` (module-level array)                                         | 1     |
| S-1  | `services/notifications` is dead code (never imported anywhere)                              | P2                                       | grep across all workspaces = 0 refs                                     | 2     |
| UX-1 | Dead Mic button in AICompanion advertises voice that does not exist                          | P2                                       | `AICompanion.tsx` `onClick={() => {}}`                                  | 2, 6  |
| UX-2 | "Phoenix AI" branding inconsistent with VedMoulya                                            | P2                                       | `AICompanion.tsx`, `DashboardAssembler.ts:510`                          | 2     |
| V-1  | No `SpeechToTextPort` / `TextToSpeechPort` seams; no provider adapter declares `speech`      | P1 (foundation)                          | provider adapter scan                                                   | 3     |
| V-2  | No VOICE ≠ AUTHORIZATION contract or tests                                                   | P1 (safety)                              | none existed                                                            | 4     |
| V-3  | No owner-scoped conversation store (memory/outcome stores exist but no conversation history) | P2                                       | store inventory                                                         | 5     |
| DB-2 | Frozen pre-022 `sql.json()` double-encoding                                                  | P3                                       | **ALREADY FIXED** in source — stale finding, closed as verified         | —     |
| B-1  | `next build` fails (client bundle pulls server-only `node:*` via `@vedmoulya/brain` barrel)  | **P1 (pre-existing, found this sprint)** | `problem-panel.tsx` → brain barrel → `PostgresBrainStores` → `node:net` | 2     |

**Duplicate-engine check:** no new engine was introduced for any of these gaps. Rate
limiting, audit, speech, conversation and the VOICE ≠ AUTHORIZATION gate are all narrow
ports/stores/gates composed over the existing Brain-governed architecture.

---

## 3. What was NOT re-implemented (and why)

- **Provider selection** — `QualityFirstSelector` verified as the authority; untouched.
- **Approval** — `ApprovalEngine` verified as the authority; the voice gate only classifies + refuses.
- **Budget / verification / learning / scheduler / notifications** — verified intact, untouched.
- **`sql.json()`** — already correct in source; no change made.
