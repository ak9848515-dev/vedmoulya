# EPIC-018 — AI World Scheduler: Security Model

**Status:** IMPLEMENTED (2026-08-11)

## 1. Threat posture

All external discovery sources are treated as **UNTRUSTED INPUT** — GitHub
repositories, news, model catalogues, external URLs and AI-generated metadata
carry no authority. The scheduler never executes, installs, clones, activates or
pays for anything; it only produces bounded discovery + evidence + notification
decisions.

## 2. What the scheduler NEVER does

- Never executes discovered code
- Never installs discovered packages
- Never clones and executes repositories automatically
- Never exposes API keys / GitHub tokens / secrets in prompts, logs or the UI
- Never activates providers, subscribes to paid tools, or connects accounts
  (approval stays in the existing EPIC-014/017 + policy surfaces)
- Never lets discovery mean authorization, or recommendation mean activation

## 3. Layered controls

| Control                               | Where                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Untrusted-content scanning            | EPIC-012C `SecurityScanner` inside the existing discovery pipeline (prompt-injection / malicious-link rejection before storage) |
| No privileged manual path             | `runNow` goes through the identical budget/policy/rate-limit/security path                                                      |
| Budget fail-closed                    | `RunBudgetGuard` over `LoopBudget` — checked BEFORE every call; wall-clock enforced post-run                                    |
| Retry/backoff bounds                  | `maxRetries` + capped exponential backoff — no infinite retries                                                                 |
| Crawl bounds                          | discovery budgets, per-source windows, cooldowns, `maxDiscoveryCalls`/`maxSourceCalls`                                          |
| Concurrent/duplicate prevention       | `inFlight` + `nextRunAt` guards                                                                                                 |
| Cancellation                          | `cancelRequested` observed at every discovery boundary                                                                          |
| Failure isolation                     | one failed source never blocks the run                                                                                          |
| Relevance gate                        | the scheduler surfaces only what the intelligence layer marks relevant                                                          |
| Notification dedup                    | item cooldowns — no notification spam                                                                                           |
| Separate GitHub auth model (EPIC-015) | preserved — Google auth is NEVER a GitHub credential                                                                            |

## 4. Ownership & IDOR

- Every per-user record (schedules, jobs, runs, ledger, cooldowns) is keyed
  `(userId, …)` in the stores — IDOR-safe by construction.
- Gateway: every `aiWorldScheduler.*` procedure is authenticated +
  rate-limited; the auth middleware refuses `input.userId ≠ session.userId`
  (second line of defence).
- Source policies are platform-wide infrastructure state (like the discovery
  store) — never user data.
- Records are deep-cloned on read so callers cannot mutate stored state through
  a reference.

## 5. Notifications

Reuse the existing relevance-gated notification surface (EPIC-015 notify + AI
World bell). No second notification system; no secrets cross the port; only
meaningful, relevant, deduplicated, cooldown-aware events surface.

## 6. Honest boundaries

Live GitHub/news/provider discovery is an operator step (deterministic static
catalog is the hermetic default). Production persistence (Postgres) and wiring
the `tick` seam to a real cron/interval are operator deployment steps.
