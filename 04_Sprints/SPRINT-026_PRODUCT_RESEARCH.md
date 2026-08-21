# SPRINT-026 — Product & Market Research

> **Sprint:** SPRINT-026 — Voice Intelligence + Complete-System Architecture Audit
> **Scope:** Phase 12 (external research) + Phase 13 (capability map)
> **Date:** 2026-08-13
> **Method:** web research (2026 sources), clearly separated into REPOSITORY FACTS / MARKET RESEARCH / ARCHITECTURAL INFERENCE / PRODUCT RECOMMENDATION.

---

## 1. Repository Facts (this repo, verified)

1. VedMoulya is an **Execution Operating System**: a governed pipeline
   UNDERSTAND → PLAN → INTELLIGENCE → APPROVE → EXECUTE → VERIFY → LEARN with the
   Brain as coordinator and a quality-first multi-provider runtime.
2. It has **durable owner-scoped persistence** (19 Postgres stores), **honest verdicts**
   (UNKNOWN/FAILED never become SUCCESS), **verification from real artifacts**, and
   **learning that cannot fabricate facts**.
3. It has a **voice-shaped hole**: STT/TTS are catalog capabilities with **no runtime
   adapter**; the assistant UI has a dead Mic button.
4. It has a **scheduler + relevance-gated notifications + opportunity discovery** —
   the raw material for proactive assistance.
5. It has **no autonomous-agent engine** — by design (approval-gated, budgeted,
   deterministic loop).

## 2. Market Research (2026 — external sources)

Sources: Vellum (Jul 2026), Arahi (Jan 2026), Firecrawl (Jun 2026), Amplify (May 2026),
Mastra (Apr 2026), LinkedIn voice-agent architecture (Jun 2026), TowardsAI voice stack
(Apr 2026), Softcery (real-time vs cascading voice), Cloud Security Alliance
"Agentic Trust Framework" (Feb 2026), Responsible AI Labs agent-safety guide (2026).

1. **Memory is the market's #1 differentiator.** "The AI agent memory market reached
   $6.27B in 2026, projected to $28.45B by 2030 as stateless agents stopped meeting
   real needs" (Vellum). Personal assistants in 2026 are expected to "remember your
   context, connect to your tools, and take actions" (Amplify).
2. **Voice has moved from novelty to infrastructure.** Two viable architectures in 2026:
   chained STT→LLM→TTS (turn-based cascade, pragmatic, ~300-800ms) and real-time
   speech-to-speech (gpt-realtime-class). Streaming ASR with 200-300ms latency is the
   baseline for "conversational feel" (TowardsAI).
3. **Proactive/agentic is the expectation, but notification fatigue is the risk.**
   "Agentic AI workflows" are mainstream enterprise vocabulary; proactive assistants
   must be relevance-gated or they erode trust (multiple 2026 sources).
4. **Agent safety is now formalized.** Cloud Security Alliance's "Agentic Trust
   Framework" (Feb 2026): _no AI agent trusted by default_; human-in-the-loop, tool
   scoping, runtime guardrails are the 2026 baseline (RAIL guide).
5. **Multi-model orchestration is table stakes** — users expect best-available-provider
   selection, not a fixed default model (Firecrawl's 2026 assistant shortlist all do
   provider/tool orchestration).

## 3. What People Actually Need (synthesized from research + repo)

| Need                                                           | Market evidence                                                   | VedMoulya today                                 | Gap                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| **Continuity** — the assistant remembers what happened and why | memory market growth; "stateless agents stopped meeting needs"    | ✅ outcome memory, preference ledger, learning  | Transcript/context continuity for chat+voice     |
| **Actions, not just answers** — with guardrails                | "cross-app action" is a top-tier feature; Agentic Trust Framework | ✅ governed execution + approval + verification | Voice-triggered execution                        |
| **Honesty** — no fabricated success                            | trust is the adoption gate                                        | ✅ strongest asset (UNKNOWN/FAILED invariants)  | Surface it more loudly in marketing/UX           |
| **"What should I do today?"**                                  | proactive is expected                                             | ✅ dailyPriorities + opportunities              | A composed digest + cadence                      |
| **Talk to it**                                                 | voice is infrastructure now                                       | ⚠️ catalog-only STT/TTS + dead Mic              | STT/TTS runtime (S1/S2)                          |
| **Best model for the job, not cheapest**                       | orchestration is table stakes                                     | ✅ quality-first selection, calibrated          | Provider health probes (P-1)                     |
| **Trustworthy automation**                                     | agent safety is formalized                                        | ✅ AutomationBoundaryEngine A/B/C/D             | Expose classification to users; run C-class only |

## 4. Conceptual Comparison (no copying — positioning)

| Product/approach                        | What it does               | VedMoulya's differentiator vs it                                                                          |
| --------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| ChatGPT/Claude (chat)                   | Conversational answers     | VedMoulya executes governed tasks with verification + approval + durable memory; chat is one mode         |
| Lindy/Rewind (memory-first personal AI) | Memory + cross-app actions | VedMoulya's memory is **verdict-gated and evidence-first** (never fabricates); actions are approval-gated |
| Manus/OpenClaw (autonomous agents)      | Autonomous multi-step work | VedMoulya deliberately **rejects unbounded autonomy** — budget, approval, verification, honest abstention |
| Notion AI / per-app copilots            | In-app assist              | VedMoulya is the **life OS above apps** — goals, outcomes, learning across domains                        |
| Enterprise agent frameworks             | Workflow agents            | VedMoulya is single-user-first with owner-scoped stores and a personal OS posture                         |

**Unmet need this research highlights:** a personal OS that couples _memory_ with
_governed execution_ and _honest verification_ — the industry has memory-first apps and
action-first agents, but few bind the two with **auditable approval + evidence-gated
learning + voice access**. That is exactly VedMoulya's lane.

## 5. Capability Map (Phase 13)

| Capability                             | Status                                | Evidence                                                 | Human problem solved                                       |
| -------------------------------------- | ------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Governed task execution (Brain)        | ✅ CURRENTLY IMPLEMENTED              | BrainApplicationService + benchmarks                     | "Solve my real problem, safely"                            |
| Outcome verification (real artifacts)  | ✅ IMPLEMENTED                        | ArtifactVerifier/deriveOutcomeVerdict                    | "Did it actually work?"                                    |
| Learning / outcome memory              | ✅ IMPLEMENTED                        | LearningSignals + correctLearning                        | "Remember what worked for me"                              |
| Provider orchestration (quality-first) | ✅ IMPLEMENTED                        | ProviderRoleAssigner + calibration                       | "Use the best model, not the default"                      |
| Discovery / opportunities              | ✅ IMPLEMENTED                        | discoverIntelligence + OpportunityIntelligence           | "Show me what's worth my attention"                        |
| Scheduler + notifications              | ✅ IMPLEMENTED                        | scheduler + cadence + gate                               | "Do this regularly; tell me when it matters"               |
| Persistent intelligence                | ✅ IMPLEMENTED (19 stores)            | WriteThroughDocumentStore                                | "My OS survives restarts"                                  |
| Conversational Q&A                     | ✅ PARTIAL                            | AICompanion (stream, no memory/verdict dialect)          | "Ask my OS questions"                                      |
| **Voice assistant**                    | ⬜ **NEXT REQUIRED**                  | STT/TTS catalog-only; dead Mic                           | "Talk to my OS hands-free"                                 |
| **Proactive digest**                   | ⬜ **NEXT REQUIRED**                  | dailyPriorities + cadence exist; no composed surface     | "Tell me what needs my attention"                          |
| Automation catalogue (A/B/C/D)         | 🟡 PARTIAL                            | AutomationBoundaryEngine exists; no user-run automations | "Stop doing repetitive work"                               |
| Career/business intelligence           | ✅ IMPLEMENTED (services)             | career/business services + goals                         | "Grow my livelihood"                                       |
| Financial intelligence                 | 🟡 NOT RECOMMENDED as an engine       | money fields on Opportunity only                         | — (track spend via budgets; don't build a finance product) |
| Multi-agent workflows                  | ⬜ NOT RECOMMENDED                    | N-provider assignMany exists                             | — (single governed loop > agent swarm for this product)    |
| Provider marketplace (user-facing)     | ⬜ FUTURE                             | capability-marketplace is engine-level                   | "Choose my AI stack"                                       |
| Local AI                               | 🟡 PARTIAL                            | LOCAL_FAMILIES + catalog; no Ollama adapter              | "Run offline" (S3)                                         |
| AI cost optimization                   | ✅ PARTIAL                            | budgets + usage intelligence                             | "Don't blow my budget"                                     |
| AI health monitoring                   | 🟡 PARTIAL                            | runtime registry; no live probes                         | "Is my provider up?" (P-1)                                 |
| Personal digital twin                  | 🟡 FUTURE (context-fabric foundation) | permission-gated retrieval                               | "A model of me" — later                                    |

Every "NEXT REQUIRED" capability answers: **real human problems** (hands-free access,
daily focus, eliminating repetitive work). Every "NOT RECOMMENDED" capability fails the
"what real problem does this solve" test for a single-user-first life OS.

## 6. Product Recommendation (Phase 12 conclusion)

1. **Sprint order matters: integrity before voice.** Fix the P1 operational gaps
   (rate-limit/audit), delete dead surfaces, then build voice on a clean base.
2. **Voice = interaction layer, not a product pillar.** The pillar is the governed
   loop; voice makes it accessible. Never let voice weaken the guards.
3. **Ship the "attention digest" early** (compose existing engines) — it is the
   lowest-cost, highest-perceived-value proactive feature and reuses everything.
4. **Automation ships C-class first** (draft + human approval) — it builds trust; A/B
   classes follow only where verification is deterministic.
5. **Position on honesty.** "An AI OS that never fakes success and never acts without
   your approval" is a defensible, differentiated, 2026-relevant position.
