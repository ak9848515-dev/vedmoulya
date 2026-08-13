# Build vs Adopt Matrix

> For every capability: the existing technology, license, fit, and the ADOPT / WRAP / BUILD decision with reasoning.
> Owner: Chief Technology Research Architect · Updated: 2026-08-03 (OSR-001 / EPIC-004)

## Purpose

Justify, capability by capability, whether VedMoulya adopts an existing technology, wraps it behind an interface, or builds it in-house — enforcing the constitution: reuse mature OSS, build only what differentiates us, wrap everything external.

## Scope

- Decision matrix across all 12 research areas
- Reasons grounded in license posture, stack fit (TypeScript/Node + Postgres/Redis), maintenance, and differentiation value
- Status (Adopted / Planned / Research / Rejected / Backlog)

## Current Status

Decisions ratified in OSR-001 (2026-08-03). Adoption plans are strategic; execution requires ADRs and the OSR-003 integration framework.

## Architecture

```
Capability need → existing technology? → license & fit check
  → ADOPT (use as-is) | WRAP (adopt behind interface) | BUILD (differentiate / no free option)
  → status → priority → replacement strategy
```

## Responsibilities

- Architecture Council: ratify decisions (ADR)
- Platform Engineering: execute adoptions
- Research Architect: keep the matrix current

## Deliverables

- The decision matrix (below)

## Dependencies

- [TECHNOLOGY_REGISTRY.md](./TECHNOLOGY_REGISTRY.md)
- [CAPABILITY_REGISTRY.md](./CAPABILITY_REGISTRY.md)
- [03_Architecture/OPEN_SOURCE_POLICY.md](./OPEN_SOURCE_POLICY.md)

## Future Work

- Review matrix each quarter and before each epic

## References

- [04_Sprints/OPEN_SOURCE/OSR-003_Integration_Framework.md](../04_Sprints/OPEN_SOURCE/OSR-003_Integration_Framework.md)
- [04_Sprints/OPEN_SOURCE/OSR-001_Open_Source_Research.md](../04_Sprints/OPEN_SOURCE/OSR-001_Open_Source_Research.md)

---

## Decision Matrix

| Capability                           | Existing Technology                                     | License                                 | Fit                                 | Adopt           | Wrap        | Build       | Reason                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------- | --------------------------------------- | ----------------------------------- | --------------- | ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Async job queue                      | BullMQ                                                  | MIT                                     | Perfect (already in stack)          | ✅              | —           | —           | Redis-backed, mature, zero migration                                                                                                                                                                                                                                          |
| Durable workflows / EI-007 scheduler | Hatchet                                                 | Apache-2.0                              | High (Postgres-native)              | —               | ✅          | —           | Durable multi-step LLM pipelines + built-in provider rate limiting; wrap behind Execution Engine interface                                                                                                                                                                    |
| Multi-agent orchestration            | LangGraph (LangChain.js)                                | MIT                                     | High (TS SDK, Postgres checkpoints) | —               | ✅          | —           | State graphs with human-in-the-loop for content pipelines; planner interface (EI-006) keeps us in control                                                                                                                                                                     |
| AI provider gateway                  | LiteLLM                                                 | MIT                                     | High                                | —               | ✅          | —           | 100+ providers, fallback, budgets, virtual keys — months of engineering saved; domain layer stays ours                                                                                                                                                                        |
| Provider adapters                    | OpenAI/Anthropic/Google/DeepSeek/OpenRouter/Ollama/Mock | Mixed (all usable)                      | Perfect (implemented)               | ✅              | —           | —           | Already implemented in `services/orchestrator`                                                                                                                                                                                                                                |
| UI streaming AI                      | Vercel AI SDK                                           | Apache-2.0                              | Perfect (in stack)                  | ✅              | —           | —           | Already adopted at the app layer                                                                                                                                                                                                                                              |
| Prompt caching                       | Provider-native (Anthropic/OpenAI)                      | N/A                                     | High                                | ✅              | —           | —           | 50–90% input cost reduction with no infra                                                                                                                                                                                                                                     |
| Semantic caching                     | GPTCache                                                | Apache-2.0                              | Medium (needs pgvector)             | —               | ✅          | —           | Extends our existing exact-key cache; wrap in orchestrator                                                                                                                                                                                                                    |
| Context compression                  | LLMLingua                                               | MIT                                     | Medium (Python worker)              | —               | —           | ❓ Research | Prefer selection/pruning (BUILD) over compression; evaluate worker if long docs demand it                                                                                                                                                                                     |
| Context assembly (EI-004)            | (none suitable — differentiation)                       | —                                       | —                                   | —               | —           | ✅ Build    | Our brand-aware, minimum-context pipeline is a differentiator; already partially realized in Content Agency                                                                                                                                                                   |
| Vector search                        | pgvector                                                | PostgreSQL license                      | Perfect (in stack)                  | ✅              | —           | —           | Single-DB simplicity at our scale; revisit Qdrant only at EPIC-007 scale                                                                                                                                                                                                      |
| Document partitioning                | Unstructured                                            | MIT                                     | High                                | —               | ✅          | —           | Best-in-class PDF/DOCX/tables parsing; containerized ingestion service                                                                                                                                                                                                        |
| OCR                                  | Tesseract.js                                            | Apache-2.0                              | High (in-Node)                      | ✅              | —           | —           | Node-native OCR for scanned documents                                                                                                                                                                                                                                         |
| Speech-to-text                       | faster-whisper                                          | MIT                                     | High (worker)                       | ✅              | —           | —           | `speech` capability exists; run as containerized worker                                                                                                                                                                                                                       |
| Email                                | Nodemailer → Resend                                     | MIT (both)                              | High                                | ✅ (Nodemailer) | ✅ (Resend) | —           | Nodemailer self-hosted today; wrap Resend (free tier) behind notifications adapter                                                                                                                                                                                            |
| Calendar/scheduling                  | Cal.com (cal.diy fork)                                  | MIT                                     | Medium                              | —               | —           | ❓ Research | Only if meeting-scheduling becomes a product need                                                                                                                                                                                                                             |
| Memory (user)                        | (own Memory service)                                    | —                                       | —                                   | —               | —           | ✅ Build    | Differentiator + data ownership; enhance with entity/temporal extraction (EI-009)                                                                                                                                                                                             |
| Knowledge graph                      | Apache AGE / Kùzu                                       | Apache-2.0 / MIT                        | Medium                              | —               | —           | ❓ Research | Evaluate graph-in-Postgres (AGE) vs embedded (Kùzu) before committing                                                                                                                                                                                                         |
| RAG orchestration                    | (own custom AI services)                                | —                                       | —                                   | —               | —           | ✅ Build    | Custom brand-aware retrieval beats framework lock-in; reuse `@langchain/core` primitives selectively                                                                                                                                                                          |
| LLM tracing + evals                  | Langfuse                                                | MIT (core)                              | High                                | ✅              | —           | —           | Single platform: tracing + prompt management + evals; self-hosted                                                                                                                                                                                                             |
| Prompt regression testing            | Promptfoo                                               | MIT                                     | High (CI)                           | ✅              | —           | —           | Declarative assertions + red-teaming in CI                                                                                                                                                                                                                                    |
| Production telemetry                 | OpenTelemetry + Grafana                                 | Apache-2.0 / AGPL-3.0 (self-hosted use) | Perfect (in stack)                  | ✅              | —           | —           | Already adopted; **AGPL justification:** Grafana runs as a self-hosted, internally-operated, isolated service (never distributed/modified as part of our product); AGPL obligations apply only to that instance, so adoption is safe — extend with GenAI semantic conventions |
| RAG eval metrics                     | Ragas                                                   | Apache-2.0                              | Medium (Python)                     | —               | —           | ❓ Research | Bridge via API if we need faithfulness/answer-relevance metrics                                                                                                                                                                                                               |
| Browser automation/e2e               | Playwright                                              | Apache-2.0                              | Perfect (in stack)                  | ✅              | —           | —           | Already adopted                                                                                                                                                                                                                                                               |
| Secrets management                   | Infisical                                               | MIT (core)                              | High (Node SDKs)                    | ✅              | —           | —           | Modern, free core; replaces ad-hoc env handling                                                                                                                                                                                                                               |
| Authorization models                 | Casbin                                                  | Apache-2.0                              | Medium                              | —               | ✅          | —           | Model-based ACL/RBAC/ABAC for portal token scoping; wrap in policy service                                                                                                                                                                                                    |
| Rate limiting                        | rate-limiter-flexible                                   | ISC                                     | High (Redis)                        | —               | ✅          | —           | Redis-backed limits across scaled instances; wrap existing middleware                                                                                                                                                                                                         |
| Identity/IAM                         | (own identity service + jose/Google OAuth)              | —                                       | —                                   | —               | —           | ✅ Build    | Custom identity already implemented; adopt Keycloak/Ory only if IAM needs outgrow it (Research)                                                                                                                                                                               |
| API documentation                    | Scalar + zod-to-openapi                                 | MIT                                     | High                                | ✅              | —           | —           | OpenAPI generated from Zod; modern docs UI                                                                                                                                                                                                                                    |
| API gateway edge                     | Nginx / Traefik                                         | BSD-2 / MIT                             | High                                | ✅ (Nginx)      | —           | —           | Nginx already in infra; Traefik at scale                                                                                                                                                                                                                                      |
| Experiment tracking                  | Langfuse (prompts) / MLflow                             | MIT / Apache-2.0                        | Medium                              | ✅ (Langfuse)   | —           | —           | Langfuse covers prompt experiments; MLflow not needed now                                                                                                                                                                                                                     |
| LLM security red-teaming             | Promptfoo                                               | MIT                                     | High (CI)                           | ✅              | —           | —           | Part of the eval suite                                                                                                                                                                                                                                                        |

## Build-only (differentiators)

| Capability                                | Reason                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Enterprise Intelligence layer (EI)        | The governed, budgeted, quality-scored AI path IS our product                                   |
| Brand-aware content pipeline              | Brand consistency + weighted quality scoring is our competitive edge                            |
| Minimum-context assembly                  | Token economy + quality — configurable per brand/module                                         |
| Client operations & revenue workflows     | Domain workflows (CRM → proposals → invoices → payments) are business logic, not infrastructure |
| Decision intelligence with explainability | Domain value, not commodity                                                                     |

## Adopt-only (commodity infrastructure)

| Capability                                                                                       | Reason                                             |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Queues, vector search, telemetry, browser automation, email, OCR, speech, secrets, rate limiting | Mature OSS; no differentiation value in rebuilding |

## Rejected (with reason)

| Technology                                   | License     | Reason                                                                                                    |
| -------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| n8n                                          | Fair-code   | Not OSI; commercial embedding restriction; JSON-blob workflows                                            |
| Windmill                                     | BSL 1.1     | License restricts commercial hosted use                                                                   |
| Temporal (now)                               | MIT         | Heavy ops; Hatchet covers current needs                                                                   |
| Prefect / Airflow                            | Apache-2.0  | Python-native; batch ETL focus                                                                            |
| Camunda                                      | Apache-2.0  | Java-centric BPMN; heavy                                                                                  |
| Elsa Workflows                               | MIT         | .NET only                                                                                                 |
| AWS Step Functions / Azure Durable Functions | Proprietary | Cloud lock-in                                                                                             |
| Zep                                          | AGPL-3.0    | AGPL + duplicates our Memory service                                                                      |
| Mem0 (now)                                   | Apache-2.0  | Duplicates our Memory service; data fragmentation                                                         |
| TerminusDB                                   | AGPL-3.0    | AGPL                                                                                                      |
| Neo4j Community                              | GPLv3       | GPLv3 copyleft in a commercial product; revisit only with legal review and isolated-service justification |
| LangSmith                                    | Proprietary | Commercial SaaS; lock-in                                                                                  |
| W&B                                          | Proprietary | Commercial; heavy for LLM app workflows                                                                   |
| Postmark                                     | Proprietary | Commercial                                                                                                |
| Nylas                                        | Proprietary | Commercial                                                                                                |
| Doppler                                      | Proprietary | Commercial                                                                                                |
| Puppeteer                                    | Apache-2.0  | Chromium-only; Playwright covers us                                                                       |
| Selenium                                     | Apache-2.0  | Legacy; verbose                                                                                           |
| Kong                                         | Apache-2.0  | Heavy infra; tRPC gateway + middleware suffice                                                            |
| OpenAI Evals                                 | MIT         | Maintenance mode; lacks modern RAG/agent features                                                         |
