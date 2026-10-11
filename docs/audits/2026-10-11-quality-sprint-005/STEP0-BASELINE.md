# VM-QUALITY-SPRINT-005 — Step 0 Baseline

**Date:** 2026-10-11
**Repository:** `D:/VedMoulya`
**Entered from:** `docs/audits/2026-10-11-quality-sprint-004/STEP7-FINAL-REPORT.md` (baseline score **7.2 / 10**).

## Git

| Item                  | Value                                                      |
| --------------------- | ---------------------------------------------------------- |
| Branch / upstream     | `main` → `origin/main`                                     |
| HEAD                  | `596309259b02535db365b2c80c2b6db8f443ada4`                 |
| Ahead / behind origin | **7 ahead / 0 behind** (sprint-003/004 commits not pushed) |
| Tracked modifications | none (`git status` clean)                                  |
| Untracked             | `_sprint3-live/` (generated sprint-003 evidence)           |
| Stashes               | **5 preserved** (indices 0–4) — untouched                  |

No destructive git commands were used. User work and stashes preserved.

## Infrastructure (observed, not assumed)

| Item               | Value                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker Postgres    | **up (healthy)** — `pgvector/pgvector:pg16`, `5432→5432`, container `vedmoulya-postgres`                                                        |
| Docker Redis       | **up (healthy)** — `redis:7-alpine`, `6379→6379`                                                                                                |
| Local Ollama       | **reachable** — `127.0.0.1:11434`; models `qwen2.5-coder:7b-instruct`, `qwen2.5-coder:3b`                                                       |
| Postgres databases | `vedmoulya`, `vedmoulya_ci`, `vedmoulya_content_agency`, `vedmoulya_decision`, `vedmoulya_execution`, `vedmoulya_knowledge`, `vedmoulya_memory` |
| Cloud provider key | OpenAI key present but **out of credits** (sprint-004 finding)                                                                                  |

> **Baseline correction discovered in Step 0/1:** the local `.env.local` pointed
> the four engine databases (`KNOWLEDGE_/DECISION_/EXECUTION_/MEMORY_DATABASE_URL`)
> at `localhost:55432` (a SPRINT-022 container port). Nothing listens on 55432 —
> the running compose database is on **5432**. This is the direct cause of the
> sprint-004 D-08b "knowledge graph" blocker (see `STEP1-KNOWLEDGE-GRAPH.md`).

## Latest accepted score and weights (unchanged)

Baseline = **7.2 / 10** (sprint 004). Weights remain:

Architecture 15% · End-to-End 15% · AI intelligence 12% · Runtime/recovery 12% ·
Tests 10% · Security 10% · Persistence 8% · UX/accessibility 8% · Performance 5% ·
Documentation/operations 5%.

Dimension maturities carried in: 6.8 / 7.8 / 7.4 / 6.9 / 8.1 / 7.5 / 6.3 / 7.0 / 5.5 / 7.2.

## Gate results at this HEAD

`typecheck` → **exit 0** (rerun this sprint). Focused suites rerun where relevant
(see `STEP4-VERIFICATION-AND-SCORES.md`). The full `npm run test` suite was **not**
run this sprint (time/CPU); reported as not run, not as passing.

## Open defects carried in

| ID    | Sev | Summary                                                       | This sprint                  |
| ----- | --- | ------------------------------------------------------------- | ---------------------------- |
| D-08a | P2  | Browser journeys unverified (cloud provider out of credits)   | **Step 3**                   |
| D-08b | P2  | Knowledge-graph DDL/`ILIKE` failure in the configured DB      | **Step 1**                   |
| D-10a | P3  | `packages/information` retention declared but unenforced      | out of scope                 |
| D-10b | P3  | Latent hard `deleteUser` dead code                            | out of scope                 |
| D-10c | P3  | Memory expiration has no automatic trigger                    | out of scope                 |
| D-09  | P2  | No staging backup/restore/rollback/restart drill              | not attempted                |
| D-02  | P2  | Oversized composition files (`RouterRegistry.ts` 7,041 lines) | **not touched (constraint)** |
| D-07  | P3  | 12 dev-only high advisories, 0 production                     | dispositioned                |

## Constraints restated (honored)

Frozen roadmap unchanged; `mission.*` is the only autonomous lifecycle; `brain.*`
unchanged; G-17 / second routing authority **not** enabled; no second autonomous
loop; `RouterRegistry.ts` **not** refactored; no credentials or local session
artifacts committed; no destructive git; no roadmap stage marked complete; no
blocked check reported as passing.
