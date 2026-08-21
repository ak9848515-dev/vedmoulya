# SPRINT-026 — Automation Map

> **Sprint:** SPRINT-026 — Voice Intelligence + Complete-System Architecture Audit
> **Scope:** Phase 5 (Proactive AI Assistant) + Phase 6 (Automation Audit)
> **Date:** 2026-08-13
> **Verdict:** 🟢 **The estate already supports proactive assistance and automation by composition. No autonomous-agent engine is justified.**

---

## 1. Proactive Assistant (Phase 5)

### 1.1 Requirements mapped to existing composition

| User utterance                            | Meaning               | Composes (all existing)                                                                                           |
| ----------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| "Tell me what needs my attention."        | Daily digest          | `brain.dailyPriorities` (OutcomePriorityEngine over tasks+opportunities+events) + dashboard data                  |
| "Prepare today's work."                   | Pre-populate plan     | `brain.createTask` per priority + `goals.understandProblem`; drafts await approval                                |
| "Check what changed."                     | What's new            | `discoverIntelligence` + ecosystem events + AI World digest (`aiWorld.getDigest`)                                 |
| "Find opportunities."                     | Opportunity scan      | `brain.discoverIntelligence` → `OpportunityIntelligence` (uncertainty always, no income promises)                 |
| "Prepare the report."                     | Document draft        | capabilities (DOCUMENT_PROCESSING/TEXT_GENERATION) via Brain pipeline; C-class (draft+approval)                   |
| "Draft it but don't send."                | Draft-only            | **Default posture for external actions** — `ApprovalEngine` gates send; draft = D-class/C-class                   |
| "Remind me."                              | One-shot or recurring | `ai-world-scheduler` (schedules/jobs/cooldowns) + notification surface                                            |
| "Do this every weekday."                  | Recurring cadence     | scheduler `ScheduleEngine` (existing due-ness/cooldown logic)                                                     |
| "Tell me if something important happens." | Watch events          | ecosystem `NotificationGate` (relevance-gated) + `discoverIntelligence` refresh on the existing cadence heartbeat |

### 1.2 Why NO new agent engine

- The Brain is already a **deterministic, budgeted, approval-gated, verification-checked
  executor** — precisely the properties a proactive system needs.
- The scheduler already has **due-ness, cooldowns, budgets, dedup and a runtime
  heartbeat** (cadence driver).
- The notification surface is already **relevance-gated and deduplicated**.
- A proactive assistant is therefore **a digest composer + a trigger mapping**, not an
  engine. Adding an "autonomous agent" would duplicate budget, approval, scheduler and
  notification logic — the exact anti-pattern this audit forbids.

### 1.3 Proactive posture principles

1. **Read-only by default.** "Tell me" / "Check" / "Prepare a draft" never execute external effects without approval.
2. **Draft-not-send is the default.** Any external action (email, publish, purchase) is C-class until the user explicitly approves.
3. **Relevance-gated noise.** Notifications reuse the existing gate; users configure cadence (daily/weekly) and can pause.
4. **Honest uncertainty.** Opportunities always carry uncertainty; nothing speculative is presented as fact.
5. **No fabricated "success".** Proactive summaries use the same verdict vocabulary (SUCCESS/FAILED/UNKNOWN/…).

---

## 2. Automation Audit (Phase 6)

### 2.1 Classification model (existing)

`AutomationBoundaryEngine` (`capability-marketplace/src/domain/AutomationBoundaryEngine.ts`)
already emits FULLY / PARTIALLY / HUMAN_APPROVAL / MANUAL — the audit's A/B/C/D map to it 1:1:

| Audit class                    | BoundaryEngine class | Meaning                                                                                  |
| ------------------------------ | -------------------- | ---------------------------------------------------------------------------------------- |
| **A — Fully automatic**        | FULLY                | No external effect; deterministic; verified outcome                                      |
| **B — Automatic + notify**     | PARTIALLY            | Runs automatically, always reports (verification + verdict)                              |
| **C — Draft + human approval** | HUMAN_APPROVAL       | Everything external/sensitive: draft, read, approve, execute, verify                     |
| **D — Human-only**             | MANUAL               | Never automated (legal/financial decisions, code execution, deployments, account access) |

### 2.2 Candidate automation catalogue

For each: TRIGGER → CONTEXT → AI CAPABILITY → PROVIDER → ACTION → VERIFICATION → APPROVAL → RESULT → MEMORY/LEARNING

| Task                                   | Class | TRIGGER                   | CONTEXT                  | CAPABILITY                            | ACTION                            | VERIFICATION                             | APPROVAL                                                        | RESULT → MEMORY               |
| -------------------------------------- | ----- | ------------------------- | ------------------------ | ------------------------------------- | --------------------------------- | ---------------------------------------- | --------------------------------------------------------------- | ----------------------------- |
| Data collection / monitoring           | A     | scheduler cadence         | owner stores             | RESEARCH/WEB_RESEARCH (catalog)       | gather+summarize into owner store | StepVerifier (schema/JSON)               | none                                                            | summary → outcome memory      |
| File processing / spreadsheet cleaning | B     | uploaded file / scheduled | doc store                | DOCUMENT_PROCESSING                   | transform → output artifact       | ArtifactVerifier (CALCULATION/CSV_VALID) | none (no external)                                              | artifact + verdict            |
| Anomaly detection                      | B     | scheduler                 | usage/ledger data        | CLASSIFICATION                        | flag deviations                   | deterministic checks                     | none                                                            | flags → events                |
| Summaries                              | B     | daily cadence             | tasks/events/activity    | SUMMARIZATION                         | digest                            | evidence-gated                           | none                                                            | digest → notification         |
| Report generation                      | C     | weekly / on-demand        | knowledge+outcome stores | TEXT_GENERATION + DOCUMENT_PROCESSING | draft report                      | StepVerifier                             | **user approves send/publish**                                  | report + approval record      |
| Recurring research                     | C     | scheduled                 | topics ledger            | RESEARCH                              | gather+annotate                   | evidence checks                          | review before use                                               | findings → knowledge store    |
| Opportunity discovery                  | B     | cadence (existing)        | AI World bridge          | OpportunityIntelligence               | screen+dedupe+rank                | uncertainty always attached              | acknowledge (existing)                                          | opportunities + notifications |
| Task planning                          | C     | daily                     | priorities               | Brain pipeline                        | plan for top N                    | plan review                              | approve plan                                                    | plan → tasks                  |
| Meeting preparation                    | C     | calendar event            | context-fabric           | RESEARCH+SUMMARIZATION                | briefing draft                    | evidence                                 | review                                                          | briefing + preferences        |
| Document drafting                      | C     | on-demand                 | knowledge                | TEXT_GENERATION                       | draft                             | verification                             | **draft-not-send default**                                      | draft + approval              |
| Email drafting                         | C     | on-demand                 | context                  | TEXT_GENERATION                       | draft                             | verification                             | **send always requires approval** (`send` in SENSITIVE_ACTIONS) | draft + approval              |
| Status reporting                       | B     | daily/weekly              | dashboards               | SUMMARIZATION                         | report                            | verdicts                                 | none (internal)                                                 | report → notification         |
| Repetitive analysis                    | B     | scheduled                 | data                     | REASONING                             | run analysis                      | deterministic                            | none                                                            | result → outcome memory       |

### 2.3 The hard boundaries (what is NEVER automated)

- **D-class permanently:** code execution (no runtime path by design), deployments (explicit deploy authorization exists), purchases (PIN/on-screen confirm), account/integration connection, deleting user data, sharing externally, legal/financial commitments.
- **A/B only when:** the action has no external effect **or** is fully reversible, verification exists, and budget holds.

### 2.4 Verification + learning for automation

- Every automated run goes through the **same StepVerifier/ArtifactVerifier** path — a generated artifact is verified before the run is reported complete.
- Every completed run records through `evaluateOutcome`/`recordLearning` — the **same** honest verdict-gating (UNKNOWN/FAILED never become SUCCESS).
- Automation does **not** create its own memory; outcomes feed `BrainOutcomeMemory`.

---

## 3. Sprint mapping

The proactive/automation capability is delivered in **two sprints** (see ROADMAP):

- **S1:** honest readiness (dead controls, audit/rate-limit), speech foundation, scheduler surfaces for user-defined cadence ("remind me" API-ready).
- **S3:** Proactive digest + automation catalogue v1 (B/C classes only) composed over the existing engines, with the A/B/C/D classification surfaced in the UI.
