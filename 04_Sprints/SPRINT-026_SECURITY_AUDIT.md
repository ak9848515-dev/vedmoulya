# SPRINT-026 — Security Audit

> **Sprint:** SPRINT-026 — Voice Intelligence + Complete-System Architecture Audit
> **Scope:** Phase 10 (Security Audit) + Phase 4 findings (voice authorization)
> **Date:** 2026-08-13
> **Verdict:** 🟡 **Strong defense-in-depth and fail-closed posture; two P1 operational gaps (rate-limit and audit durability) and one P2 dead service must be resolved before multi-instance/GA.**

---

## 1. Adversarial review — verified controls

| Attack surface                               | Posture     | Verified control                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authentication                               | 🟢          | JWT HS256 (`jose`) with issuer `vedmoulya` / audience `vedmoulya-api` / `type=access`; gateway verifies on every request; fail-closed `authenticateRequest`. `services/identity` issues access+refresh pairs (15m/7d). `PLACEHOLDER_PATTERN` rejects weak secrets.                                           |
| Authorization / IDOR                         | 🟢          | 3 layers: gateway `assertUserIdMatchesSession` (raw-input IDOR guard), engine-level `requireTask(userId)` in Brain/goals/factory, and DB `PRIMARY KEY (owner, key)` in the persistence stores. Cross-user refusal is regression-tested in every new router suite (BrainRouter, GoalsRouter, FactoryRouter…). |
| Privilege escalation                         | 🟢          | Role is a JWT claim; all protected procedures enforce authentication; no admin-only escalation surface found in the audited routers. (Session revocation/rotation is not implemented — see R-3.)                                                                                                             |
| API exposure                                 | 🟢          | Only `healthProcedure` is public; everything else is auth + rate-tiered. CORS hardened with preflight handling + allowlist.                                                                                                                                                                                  |
| Secret leakage                               | 🟢          | Secrets never logged/printed (leak regression tests); AI keys env-injected; cadence logs aggregate-only; audit entries store metadata only.                                                                                                                                                                  |
| Rate limiting                                | 🔴          | **In-memory per-process, keyed by userId+tier** — bypassable across instances and shared-bucket for unauthenticated traffic. P1.                                                                                                                                                                             |
| Audit trail                                  | 🔴          | **In-memory, bounded 10k, shifted** — no durable transport-level audit. Brain decision records persist (owner-scoped), so the _governed decisions_ are auditable; raw API audit is not. P1.                                                                                                                  |
| Prompt injection                             | 🟢          | Evidence-First runtime treats retrieved content as untrusted; abstention on conflicting/unsupported evidence; prompt-injection handling tested (`accuracy:evaluate`). Transcripts (future) are user input, never system instructions.                                                                        |
| Tool injection / arbitrary command execution | 🟢          | `ToolRuntime` typed registry + authz + validation + audit; `AI_TOOL_ALLOWLIST` default-disabled; CODE_EXECUTION has **no runtime path by design**; `NodeArtifactReader` never executes commands.                                                                                                             |
| Path traversal / arbitrary file access       | 🟢          | `ArtifactReaderPort` root-confined, size-bounded, read-only; absolute/`..`/drive/backslash/symlink-escape denied; found-but-unreadable → honest UNKNOWN.                                                                                                                                                     |
| SSRF / unsafe URL fetching                   | 🟢          | GitHub repo scanning is approve-gated; discovery treats content as untrusted (`SecurityScanner`); no raw user-controlled URL fetch surface found in the gateway.                                                                                                                                             |
| Malicious artifacts                          | 🟢          | Discovered repos are READ ≠ CLONE ≠ EXECUTE ≠ INSTALL; acquisition lifecycle is gated.                                                                                                                                                                                                                       |
| Untrusted AI output → fact                   | 🟢          | `LearningSignals` FACT/INFERENCE/UNKNOWN separation; one observation never promoted; UNKNOWN verdict never yields FACT; `correctLearning` EXPLICIT > INFERRED.                                                                                                                                               |
| AI output → authorization                    | 🟢          | `BrainPolicyEngine.checkAction` requires `authorizedActions` + `approvalGranted`; AI cannot self-grant; the approval journey tests prove 0 executions before approval.                                                                                                                                       |
| Voice authorization bypass                   | 🟢 (design) | Phase 4 model: voice never authorizes by default; confirmation requires non-voice gesture + recorded decision. To be regression-tested when implemented.                                                                                                                                                     |
| Budget bypass                                | 🟢          | `BrainBudgetGuard` + `RunBudgetGuard` fail-closed; budget-stop tests.                                                                                                                                                                                                                                        |
| Provider compromise                          | 🟡          | Providers are adapters with timeouts, retry bounds, and failure classification; a compromised provider can only produce outputs that fail verification/abstain — it cannot reach user data beyond what the ports expose. Provider output is never trusted as fact.                                           |
| XSS (JWT in localStorage)                    | 🟡          | Web stores the access JWT in localStorage (`auth-store.ts` — platform-aware: secure storage on native). Mitigated by hardened CSP (OS-002). Recommend httpOnly-cookie option or token rotation as hardening. P3.                                                                                             |
| Session revocation                           | 🟡          | No revocation list / rotation on refresh. Acceptable for v1 with 15m access expiry; document for multi-user product. P3.                                                                                                                                                                                     |

---

## 2. Findings (severity-ordered)

| ID   | Sev | Finding                                                                                                                                                        | Fix (sprint)                                                                                                 |
| ---- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| R-1  | P1  | **Rate limiting is per-process in-memory** — multi-instance deployment bypasses it entirely; `'anonymous'` bucket shared by all unauthenticated traffic.       | Redis-backed sliding-window limiter (S1); keep tiers env-configurable.                                       |
| R-2  | P1  | **Gateway audit is in-memory only** — no durable audit trail; compliance/forensics gap (SPRINT-022 persisted the _decision_ records, not the transport audit). | Durable audit store via `WriteThroughDocumentStore` pattern (S1); wire `middleware/audit.ts` writes through. |
| S-1  | P2  | **`services/notifications` is dead code** — never imported anywhere; two live notification stores (dashboard + ecosystem) with two drawers.                    | Delete/archive the dead service; document the single notification surface (S1).                              |
| R-3  | P3  | No refresh-token rotation / revocation list; JWT in localStorage on web.                                                                                       | httpOnly-cookie session option or rotation (S4 pre-GA).                                                      |
| UX-2 | P3  | "Powered by Phoenix AI" mislabels the real provider.                                                                                                           | Fix label (S1).                                                                                              |
| P-3  | P3  | No provider-level rate-limit awareness in selection (429-prone provider could still be picked first; failover covers it).                                      | Advisory signal in `ProviderRoutingAdvisor` (S3).                                                            |

---

## 3. Verification performed

- Live spot checks this sprint: auth middleware, IDOR guard, rate-limit tiers, audit middleware, policy engine, artifact reader, secret placeholder validation (all code read; core suites + typecheck green).
- CI G6 security job runs `npm audit --omit=dev --audit-level=high` + full `--audit-level=critical` + CodeQL (typescript) — present in `.github/workflows/ci.yml`.

## 4. Verdict

Security posture is **strong by construction**: fail-closed policy, three-layer IDOR,
evidence-first abstention, no-fabrication invariants, and a documented no-execution
boundary. The two P1 gaps are **operational** (multi-instance rate-limit and durable
audit), not design flaws. Voice must preserve all of the above — and per Phase 4,
**voice is never automatic authorization**.
