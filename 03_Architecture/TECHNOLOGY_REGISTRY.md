# Technology Registry

> The official open-source technology strategy for VedMoulya: every capability assessed as ADOPT / WRAP / BUILD.
> Owner: Chief Technology Research Architect · Updated: 2026-08-03 (OSR-001 / EPIC-004)

## Purpose

Record the enterprise technology research of Sprint OSR-001: the evaluation of every major capability required by VedMoulya and the decision — ADOPT, WRAP, or BUILD — for each. This registry is the single source of truth for technology adoption and replacement strategy.

## Scope

- 12 research areas: agent orchestration, workflow/graph execution, context intelligence, AI provider routing, RAG, memory, knowledge, evaluation, observability, automation, AI development, security
- Standard evaluation for each technology
- Registry table (category, license, decision, status, adapter, replacement, priority)
- License posture: prefer MIT / Apache-2.0 / BSD; GPL/AGPL only with compelling, documented reasons; no paid services where a free alternative exists

## Current Status

🟢 **Research complete** (2026-08-03). 60+ technologies evaluated across 12 categories. Approvals are strategic recommendations pending EI-001 build confirmation; nothing here is marked implemented unless it already exists in the repository.

## Architecture

Research → standard evaluation → registry entry → decision (Adopt/Wrap/Build) → status (Adopted/Planned/Research/Rejected/Backlog) → adapter & replacement strategy → priority. Every adoption is wrapped behind a VedMoulya interface per the Constitution.

## Responsibilities

- Chief Technology Research Architect: maintain this registry
- Architecture Council: ratify adoption decisions (ADRs)
- Platform Engineering: execute adoptions via the integration framework (OSR-003)

## Deliverables

- Standard evaluations (below)
- Registry table (below)
- Build-vs-adopt matrix (`BUILD_VS_ADOPT_MATRIX.md`)
- AI provider matrix (`AI_PROVIDER_MATRIX.md`)

## Dependencies

- [OPEN_SOURCE_POLICY.md](./OPEN_SOURCE_POLICY.md)
- [04_Sprints/OPEN_SOURCE/OSR-001_Open_Source_Research.md](../04_Sprints/OPEN_SOURCE/OSR-001_Open_Source_Research.md)
- `docs/DEPENDENCY_POLICY.md`

## Future Work

- EI-001 capability registry sync (technologies → capabilities)
- Quarterly registry refresh (stars, maintenance, license changes)

## References

- [BUILD_VS_ADOPT_MATRIX.md](./BUILD_VS_ADOPT_MATRIX.md)
- [AI_PROVIDER_MATRIX.md](./AI_PROVIDER_MATRIX.md)
- [04_Sprints/OPEN_SOURCE/OSR-002_Technology_Catalog.md](../04_Sprints/OPEN_SOURCE/OSR-002_Technology_Catalog.md)

---

## Methodology & Caveats

- **Stars** are approximate GitHub star counts from web research performed 2026-08-03. They are directional signals of community size, not KPIs. Verify before any adoption decision.
- **Maintenance / last active** reflects research findings at that date. Licenses can change (e.g., Cal.com → AGPL/commercial); re-check before adoption.
- **Recommendation is stack-aware:** VedMoulya is a TypeScript/Node.js monorepo (Next.js, Hono, tRPC, Zod, PostgreSQL 16 + pgvector, Redis 7 + BullMQ, Vercel AI SDK, OpenTelemetry + Grafana, Playwright).
- **Evaluation depth:** Full 16-field standard evaluations are provided for every **recommended / priority** technology (Adopt, Wrap, or high-value Research). Non-recommended and low-priority candidates receive compact table evaluations (category, license, stars, verdict, reason) — sufficient for rejection/backlog tracking without bloating the registry.
- **Decision semantics:**
  - **ADOPT** — use as-is, integrated into the platform (possibly via its own adapter).
  - **WRAP** — adopt behind a VedMoulya interface; modules never touch it directly.
  - **BUILD** — implement in-house because it differentiates VedMoulya or no suitable free option exists.
- **Status semantics:** `Adopted` = already in the repository today. `Planned` = approved to build/wrap. `Research` = promising, needs deeper evaluation or POC. `Backlog` = noted for later. `Rejected` = decided against, with reason.

---

## 1. Agent Orchestration & Workflow / Graph Execution

### LangGraph (LangChain.js)

| Field                 | Value                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Name                  | LangGraph                                                                                                            |
| Category              | Agent orchestration / state graph engine                                                                             |
| Purpose               | Multi-agent loops, cyclic graphs, human-in-the-loop checkpoints for AI workflows                                     |
| License               | MIT                                                                                                                  |
| Stars                 | ~23k (ecosystem)                                                                                                     |
| Maintenance           | Highly active (2025–2026, stable v1 cycle)                                                                           |
| Last active           | Continuous weekly/monthly releases                                                                                   |
| Enterprise readiness  | High (Uber, LinkedIn, GitLab; Postgres/Redis checkpointers)                                                          |
| Learning curve        | Moderate–steep (graph state machines, reducers)                                                                      |
| Community             | Large; first-class TypeScript SDK                                                                                    |
| Advantages            | State-of-the-art agent graphs; persistence to Postgres; TypeScript-native                                            |
| Disadvantages         | Ecosystem lock-in; low-level config (checkpointers, concurrency)                                                     |
| When to use           | Complex multi-agent content pipelines (research → draft → edit → human review)                                       |
| When NOT to use       | Simple single-call generation; simple job queues                                                                     |
| How it fits VedMoulya | EI-006 Task Planner + multi-pass content generation under the orchestrator                                           |
| Recommended action    | **WRAP** — adopt behind the EI layer; planner output runs as LangGraph graphs, surfaced via the existing AI services |

### Temporal

| Field                 | Value                                                                            |
| --------------------- | -------------------------------------------------------------------------------- |
| Name                  | Temporal                                                                         |
| Category              | Distributed durable execution                                                    |
| Purpose               | Long-running, fault-tolerant workflows spanning days/months                      |
| License               | MIT (server + SDKs)                                                              |
| Stars                 | ~11k                                                                             |
| Maintenance           | Extremely active (enterprise-backed)                                             |
| Last active           | Continuous major releases                                                        |
| Enterprise readiness  | Maximum (Netflix, Stripe, Datadog)                                               |
| Learning curve        | Steep (separate Go server; deterministic workflow rules)                         |
| Community             | Strong; mature TypeScript SDK                                                    |
| Advantages            | Unmatched durability for long-running processes                                  |
| Disadvantages         | Heavy ops footprint; overkill for simple queues; rigid determinism rules         |
| When to use           | Multi-month business processes with strict durability                            |
| When NOT to use       | Content generation pipelines and short-lived jobs                                |
| How it fits VedMoulya | Not needed now — BullMQ + Hatchet cover current scheduling needs                 |
| Recommended action    | **Rejected (now)** — revisit at EPIC-007 scale; document in replacement strategy |

### Hatchet

| Field                 | Value                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Name                  | Hatchet                                                                                                                 |
| Category              | Durable workflow / task orchestration                                                                                   |
| Purpose               | Durable task pipelines, fan-out DAGs, rate-limited LLM calling, multi-tenant scheduling                                 |
| License               | Apache-2.0                                                                                                              |
| Stars                 | ~3.5k                                                                                                                   |
| Maintenance           | Very active (2025–2026)                                                                                                 |
| Last active           | Frequent releases                                                                                                       |
| Enterprise readiness  | Moderate–high (10k+ tasks/sec; Postgres-native durability)                                                              |
| Learning curve        | Moderate                                                                                                                |
| Community             | Smaller than Temporal/BullMQ but growing                                                                                |
| Advantages            | Postgres as durability layer (matches our stack); TypeScript; built-in rate limiting for LLM APIs; OpenTelemetry-native |
| Disadvantages         | Smaller ecosystem; younger than BullMQ                                                                                  |
| When to use           | Durable multi-step AI pipelines, rate-limited provider fan-out (EI-007)                                                 |
| When NOT to use       | Fire-and-forget utility jobs (BullMQ is sufficient)                                                                     |
| How it fits VedMoulya | EI-007 Execution Scheduler generalization over the existing execution service                                           |
| Recommended action    | **WRAP** (Planned) — as the durable workflow engine for EI-007, wrapped behind the Execution Engine interface           |

### BullMQ

| Field                 | Value                                                       |
| --------------------- | ----------------------------------------------------------- |
| Name                  | BullMQ                                                      |
| Category              | Background job queue                                        |
| Purpose               | High-throughput async jobs (notifications, cache, webhooks) |
| License               | MIT                                                         |
| Stars                 | ~14k                                                        |
| Maintenance           | Active                                                      |
| Last active           | Continuous                                                  |
| Enterprise readiness  | High (Redis-backed, battle-tested)                          |
| Learning curve        | Low                                                         |
| Community             | Very large                                                  |
| Advantages            | Already adopted; simple, reliable, Redis-backed             |
| Disadvantages         | No durable long-running workflow semantics                  |
| When to use           | Simple async jobs; keep as-is                               |
| When NOT to use       | Multi-step durable workflows (use Hatchet)                  |
| How it fits VedMoulya | Already the utility queue; remains in stack                 |
| Recommended action    | **ADOPT** (Adopted) — no change                             |

### n8n

| Field                 | Value                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| Name                  | n8n                                                                                                |
| Category              | Visual workflow automation                                                                         |
| Purpose               | Low-code workflow canvas with 400+ integrations                                                    |
| License               | Fair-code (Sustainable Use License — NOT OSI; restricted for commercial embedding)                 |
| Stars                 | ~45k                                                                                               |
| Maintenance           | Very active                                                                                        |
| Last active           | Continuous                                                                                         |
| Enterprise readiness  | High for internal automation                                                                       |
| Learning curve        | Low                                                                                                |
| Community             | Very large                                                                                         |
| Advantages            | Huge integration library; visual AI agent builder                                                  |
| Disadvantages         | License restriction for commercial embedding; JSON-blob workflows (not code-first in our monorepo) |
| When to use           | Internal ops automation outside the product                                                        |
| When NOT to use       | Embedding workflow execution inside the VedMoulya product                                          |
| How it fits VedMoulya | Optional internal tooling only; not part of the product architecture                               |
| Recommended action    | **Rejected** (product embedding) — license + code-first conflict; note as internal-ops option      |

### Other candidates evaluated

| Technology              | License                      | Verdict  | Reason                                  |
| ----------------------- | ---------------------------- | -------- | --------------------------------------- |
| Inngest                 | MIT SDK / proprietary server | Research | Cloud-oriented; self-host less mature   |
| Trigger.dev v3          | MIT core / freemium cloud    | Research | Excellent DX but managed-cloud-leaning  |
| Restate                 | MIT / BUSL components        | Research | Fast durable execution; young ecosystem |
| Windmill                | BSL 1.1                      | Rejected | License restricts commercial hosted use |
| Prefect                 | Apache-2.0                   | Rejected | Python-native; batch-oriented           |
| Apache Airflow          | Apache-2.0                   | Rejected | Python-native; ETL-focused              |
| Camunda                 | Apache-2.0 (community)       | Rejected | Java-centric BPMN; heavy for our stack  |
| Elsa Workflows          | MIT                          | Rejected | .NET only                               |
| AWS Step Functions      | Proprietary                  | Rejected | Lock-in                                 |
| Azure Durable Functions | Proprietary                  | Rejected | Azure lock-in                           |

---

## 2. Context Intelligence

### Native prompt caching (Anthropic / OpenAI)

| Field                 | Value                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Name                  | Provider prompt caching                                                                                             |
| Category              | Context intelligence — caching                                                                                      |
| Purpose               | Cache static prompt blocks (system prompts, brand docs) server-side; 50–90% input cost reduction; 2–4× TTFT speedup |
| License               | N/A (provider feature)                                                                                              |
| Stars                 | N/A                                                                                                                 |
| Maintenance           | Provider-managed                                                                                                    |
| Last active           | Active                                                                                                              |
| Enterprise readiness  | High (Anthropic cache_control; OpenAI automatic/prefix caching)                                                     |
| Learning curve        | Low                                                                                                                 |
| Community             | N/A                                                                                                                 |
| Advantages            | No infra; big cost/latency win; our orchestrator already has a request cache to complement                          |
| Disadvantages         | Cache-key management; TTL nuances per provider                                                                      |
| When to use           | Any repeated system/brand context across calls                                                                      |
| When NOT to use       | Highly dynamic prompts                                                                                              |
| How it fits VedMoulya | Orchestrator wraps provider cache headers as part of EI-004/EI-005                                                  |
| Recommended action    | **ADOPT** (Planned) — implemented in the orchestrator adapters                                                      |

### LLMLingua (and variants)

| Field                 | Value                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Name                  | LLMLingua / LongLLMLingua / LLMLingua-2                                                       |
| Category              | Context intelligence — compression                                                            |
| Purpose               | Compress prompt context 5–20× using a small encoder model; mitigates lost-in-the-middle       |
| License               | MIT (Microsoft)                                                                               |
| Stars                 | ~15k                                                                                          |
| Maintenance           | Active                                                                                        |
| Last active           | 2025–2026 releases                                                                            |
| Enterprise readiness  | Medium (Python library)                                                                       |
| Learning curve        | Moderate                                                                                      |
| Community             | Good                                                                                          |
| Advantages            | Large token savings; open source                                                              |
| Disadvantages         | Python; extra model dependency; risk of information loss on critical context                  |
| When to use           | Very long reference documents where precision loss is acceptable                              |
| When NOT to use       | Brand-critical instructions (prune, don't compress)                                           |
| How it fits VedMoulya | Optional microservice behind Context Intelligence (EI-004)                                    |
| Recommended action    | **Research** — evaluate a containerized worker; default is selection/pruning, not compression |

### Semantic caching (GPTCache / Upstash)

| Field                 | Value                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Name                  | GPTCache (and Upstash Semantic Cache)                                                                 |
| Category              | Context intelligence — semantic cache                                                                 |
| Purpose               | Serve semantically-equivalent queries from a vector cache, bypassing the LLM (near-zero latency/cost) |
| License               | Apache-2.0 (GPTCache)                                                                                 |
| Stars                 | ~6.5k                                                                                                 |
| Maintenance           | Active                                                                                                |
| Last active           | Continuous                                                                                            |
| Enterprise readiness  | Medium                                                                                                |
| Learning curve        | Moderate                                                                                              |
| Community             | Growing                                                                                               |
| Advantages            | Big cost/latency win for repeated semantic queries                                                    |
| Disadvantages         | Cache-staleness risk; embedding cost; needs vector store (we have pgvector)                           |
| When to use           | FAQ-style, repeated analytical questions                                                              |
| When NOT to use       | Highly personalized or time-sensitive content                                                         |
| How it fits VedMoulya | Extension of the orchestrator's existing exact-key cache (EI-005 token optimization)                  |
| Recommended action    | **WRAP** (Planned) — semantic layer over the existing request cache using pgvector                    |

---

## 3. AI Provider Routing

### LiteLLM (Proxy Gateway)

| Field                 | Value                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Name                  | LiteLLM                                                                                                                                 |
| Category              | AI provider gateway / routing                                                                                                           |
| Purpose               | 100+ LLM APIs behind one OpenAI-compatible interface; fallback, retries, load balancing, virtual keys, budgets, RBAC, audit             |
| License               | MIT                                                                                                                                     |
| Stars                 | ~54k                                                                                                                                    |
| Maintenance           | Very active (weekly releases; Rust core option)                                                                                         |
| Last active           | 2025–2026 continuous                                                                                                                    |
| Enterprise readiness  | High (SSO, spend enforcement, guardrails, Terraform modules)                                                                            |
| Learning curve        | Moderate–steep (config-heavy)                                                                                                           |
| Community             | Very large                                                                                                                              |
| Advantages            | Mature fallback/load-balancing; built-in budgets and keys; saves months of gateway engineering                                          |
| Disadvantages         | Large surface; Python server; needs Postgres/Redis for production state                                                                 |
| When to use           | Cross-provider translation, fallback, load balancing, multi-tenant spend control                                                        |
| When NOT to use       | Simple single-provider apps (our orchestrator already covers capability routing)                                                        |
| How it fits VedMoulya | Runs as the **infrastructure gateway** behind our AI Orchestrator; orchestrator keeps prompt assembly, context, scoring (EI-005 tie-in) |
| Recommended action    | **WRAP** (Planned) — EI-005 economy & routing infrastructure; our adapters remain the domain layer                                      |

### OpenRouter

| Field                 | Value                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------ |
| Name                  | OpenRouter                                                                                 |
| Category              | Provider router (managed)                                                                  |
| Purpose               | Access hundreds of models via one API key; automatic fallback across hosters               |
| License               | Proprietary (managed SaaS)                                                                 |
| Stars                 | N/A (client wrappers only)                                                                 |
| Maintenance           | Active commercial service                                                                  |
| Last active           | Continuous                                                                                 |
| Enterprise readiness  | Moderate–high (no self-host option)                                                        |
| Learning curve        | Low                                                                                        |
| Community             | Large                                                                                      |
| Advantages            | Instant multi-model access; fallback across open-model hosters                             |
| Disadvantages         | Not self-hostable; third-party data transit; billing lock-in                               |
| When to use           | Model breadth experiments, open-model routing                                              |
| When NOT to use       | Regulated data or zero-third-party requirements                                            |
| How it fits VedMoulya | Already a `ProviderFamily` in `packages/ai` — remains an **adapter target**, not a gateway |
| Recommended action    | **ADOPT** (Adopted as provider family) — keep as one of several provider adapters          |

### Vercel AI SDK

| Field                 | Value                                                                     |
| --------------------- | ------------------------------------------------------------------------- |
| Name                  | Vercel AI SDK                                                             |
| Category              | Application-tier AI SDK                                                   |
| Purpose               | Type-safe streaming, unified provider API, React/Next.js primitives       |
| License               | Apache-2.0                                                                |
| Stars                 | ~24k                                                                      |
| Maintenance           | Extremely active                                                          |
| Last active           | Continuous                                                                |
| Enterprise readiness  | High (industry standard for TS/Next.js)                                   |
| Learning curve        | Low                                                                       |
| Community             | Very large                                                                |
| Advantages            | Streaming, tool-calling, provider unification, framework integration      |
| Disadvantages         | TS-only; doesn't provide backend gateway/load-balancing policies          |
| When to use           | UI streaming and app-level model calls                                    |
| When NOT to use       | Provider gateway responsibilities                                         |
| How it fits VedMoulya | Already in stack; keep at the app layer; orchestrator remains the gateway |
| Recommended action    | **ADOPT** (Adopted) — no change                                           |

### Portkey Gateway / Helicone / other candidates

| Technology      | License        | Verdict  | Reason                                                   |
| --------------- | -------------- | -------- | -------------------------------------------------------- |
| Portkey Gateway | MIT (2.0 core) | Research | Good lightweight alternative to LiteLLM; evaluate in POC |
| Helicone        | Apache-2.0     | Research | Observability-first gateway; overlaps Langfuse (see §6)  |

---

## 4. RAG & Vector Search

### pgvector

| Field                 | Value                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| Name                  | pgvector                                                                                                        |
| Category              | Vector search (PostgreSQL extension)                                                                            |
| Purpose               | Embeddings, hybrid retrieval, semantic search inside Postgres                                                   |
| License               | PostgreSQL License (permissive)                                                                                 |
| Stars                 | ~10k                                                                                                            |
| Maintenance           | Active (v0.8.x: HNSW, binary quantization, sparsevec, iterative scans)                                          |
| Last active           | 2025–2026 releases                                                                                              |
| Enterprise readiness  | High (ACID, replication, single-database simplicity)                                                            |
| Learning curve        | Low                                                                                                             |
| Community             | Large                                                                                                           |
| Advantages            | Zero extra infrastructure; transactional consistency; joins vectors with relational data; HNSW/IVFFlat indexing |
| Disadvantages         | Dimension limits (<2k native vector); contention if oversized                                                   |
| When to use           | Our scale (sub-10M vectors) with relational data colocated                                                      |
| When NOT to use       | Billions of vectors or dedicated GPU indexing                                                                   |
| How it fits VedMoulya | Already the vector layer for Knowledge and Memory; RAG retrieval (EI-004)                                       |
| Recommended action    | **ADOPT** (Adopted) — keep; revisit dedicated vector DB only at EPIC-007 scale                                  |

### Qdrant / Weaviate / Milvus / Chroma / LanceDB / OpenSearch / Meilisearch

| Technology  | License                       | Stars   | Verdict        | Reason                                                                           |
| ----------- | ----------------------------- | ------- | -------------- | -------------------------------------------------------------------------------- |
| Qdrant      | Apache-2.0                    | ~25k    | Research       | Best dedicated vector DB if we outgrow pgvector; native TS client; hybrid search |
| Weaviate    | BSD-3-Clause                  | ~14k    | Research       | Hybrid BM25+vector; multi-tenancy; extra service to operate                      |
| Milvus      | Apache-2.0                    | ~44k    | Backlog        | Billion-scale; heavy ops; overkill today                                         |
| Chroma      | Apache-2.0                    | ~20–24k | Rejected (now) | Prototyping-grade; less mature at scale                                          |
| LanceDB     | Apache-2.0                    | ~12k    | Research       | Embedded/multimodal; object-storage based                                        |
| OpenSearch  | Apache-2.0                    | ~11k    | Backlog        | Full-text+vector at scale; JVM-heavy                                             |
| Meilisearch | MIT (core) / BSL (enterprise) | ~49k    | Research       | Instant search UX for marketplace; vector support maturing                       |

### RAG orchestration

| Technology                  | License    | Verdict              | Reason                                                                                                                                         |
| --------------------------- | ---------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| LangChain / LlamaIndex (TS) | MIT        | Research (selective) | Reuse `@langchain/core` primitives only where needed; avoid full framework lock-in over our brand-aware custom services                        |
| Unstructured                | MIT        | **WRAP (Planned)**   | Best-in-class document partitioning/chunking (PDF, DOCX, tables) for the Document Management module — run as a containerized ingestion service |
| txtai                       | Apache-2.0 | Rejected             | Python-centric; overlaps our stack                                                                                                             |

---

## 5. Memory & Knowledge

### Memory — retain our own service

| Technology     | License    | Verdict        | Reason                                                           |
| -------------- | ---------- | -------------- | ---------------------------------------------------------------- |
| Mem0           | Apache-2.0 | Rejected (now) | Would duplicate our Memory service; data-ownership fragmentation |
| Zep            | AGPL-3.0   | Rejected       | AGPL; duplicate of our Memory service                            |
| Letta (MemGPT) | Apache-2.0 | Research       | Agent-memory OS concept; heavy runtime; revisit for EI-009       |
| LangMem        | MIT        | Research       | Agent memory compilation; LangChain-ecosystem                    |

**Direction:** ENHANCE our `services/memory` with entity extraction, temporal tagging, and hybrid search on pgvector (BUILD, part of EI-004/009).

### Provider Intelligence Platform

| Field                 | Value                                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name                  | Provider Registry (`@vedmoulya/providers`)                                                                                                                                  |
| Category              | AI provider intelligence — metadata, models, costs, health, capability matrices, benchmark dataset definitions                                                              |
| Purpose               | Enterprise registry of every AI provider, model, capability, cost, health metric, latency, and benchmark definition — the intelligence layer before any routing decisions   |
| License               | Proprietary (Build)                                                                                                                                                         |
| Stars                 | N/A (in-house)                                                                                                                                                              |
| Maintenance           | Internal — EI-002 active                                                                                                                                                    |
| Last active           | 2026-08-03                                                                                                                                                                  |
| Enterprise readiness  | Maximum (seeded with 7 real provider families, 15 models, 60 matrix entries, 12 benchmark dataset definitions)                                                              |
| Learning curve        | Low (mirrors EI-001 capability registry layering)                                                                                                                           |
| Community             | N/A                                                                                                                                                                         |
| Advantages            | Complete provider knowledge without any execution; shared by all routing/economy sprints; model registry, health, capability matrix, benchmark definitions all in one place |
| Disadvantages         | In-memory repository (Postgres planned); benchmark definitions are seed-only (EI-003 executes and scores)                                                                   |
| When to use           | Every AI decision — the registry is the single source of truth for provider intelligence                                                                                    |
| When NOT to use       | Provider selection, routing, or economy decisions (those are later sprints)                                                                                                 |
| How it fits VedMoulya | EI-002 provider intelligence layer; consumed by EI-003 routing, EI-005 economy, and every downstream AI workflow                                                            |
| Recommended action    | **BUILD** (Adopted) — EI-002 implementation complete; see `packages/providers`                                                                                              |

### Provider Benchmark Datasets

| Field                 | Value                                                                                                                                                                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name                  | Benchmark Dataset Definitions (`@vedmoulya/providers` — `ProviderBenchmarkDefinition`)                                                                                                                                                                                                  |
| Category              | AI provider evaluation — benchmark dataset definitions                                                                                                                                                                                                                                  |
| Purpose               | Seed dataset definitions covering 11 categories (general_knowledge, reasoning, coding, mathematics, long_context, instruction_following, multimodal, translation, summarization, creative_writing, tool_use) at 4 difficulty levels, with expected quality/cost/latency/token envelopes |
| License               | Proprietary (Build)                                                                                                                                                                                                                                                                     |
| Stars                 | N/A (in-house)                                                                                                                                                                                                                                                                          |
| Maintenance           | Internal — EI-002 active                                                                                                                                                                                                                                                                |
| Last active           | 2026-08-03                                                                                                                                                                                                                                                                              |
| Enterprise readiness  | High (12 curated definitions, descriptive, ready for EI-003 execution)                                                                                                                                                                                                                  |
| Learning curve        | Low                                                                                                                                                                                                                                                                                     |
| Community             | N/A                                                                                                                                                                                                                                                                                     |
| Advantages            | Defines HOW providers are evaluated — no benchmark run in this sprint; definitions are registry-estimate envelopes that measured results are compared against                                                                                                                           |
| Disadvantages         | 12 seed datasets; EI-003 will add more enterprise-specific scenarios                                                                                                                                                                                                                    |
| When to use           | Provider capability evaluation, benchmark orchestration (EI-003)                                                                                                                                                                                                                        |
| When NOT to use       | Provider selection (EI-003 routing)                                                                                                                                                                                                                                                     |
| How it fits VedMoulya | EI-002 benchmark definitions feed the EI-003 Provider Benchmark Engine; measured scores write back into the provider capability matrix                                                                                                                                                  |
| Recommended action    | **BUILD** (Adopted) — EI-002 benchmark dataset definitions seeded; EI-003 executes them                                                                                                                                                                                                 |

### Knowledge graphs

| Technology      | License      | Stars | Verdict                                                                                                                                                                                                                                                                                              | Reason                                                                                  |
| --------------- | ------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Neo4j Community | GPLv3        | ~13k  | **Rejected** — GPLv3 copyleft conflicts with our commercial product unless we keep it as an isolated, non-modified service with clean interfaces; revisit only with legal review and clear justification (compelling reason would be: industry-standard graph analytics we cannot match by building) |
| Apache AGE      | Apache-2.0   | ~5.5k | Research                                                                                                                                                                                                                                                                                             | Postgres extension adding Cypher; aligns with our single-DB posture; maintenance slower |
| Kùzu            | MIT          | ~4.5k | Research                                                                                                                                                                                                                                                                                             | Embedded property graph with vector + full-text; lightweight; TypeScript bindings       |
| TerminusDB      | AGPL-3.0     | ~9k   | Rejected                                                                                                                                                                                                                                                                                             | AGPL                                                                                    |
| RDFLib          | BSD-3-Clause | ~3.5k | Rejected                                                                                                                                                                                                                                                                                             | Python; not a fit                                                                       |

---

## 6. Evaluation, Observability & AI Development

### Langfuse

| Field                 | Value                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Name                  | Langfuse                                                                                                                          |
| Category              | LLM observability, evals, prompt management                                                                                       |
| Purpose               | Tracing, prompt versioning/management, dataset evals, LLM-as-judge scoring, sessions                                              |
| License               | MIT (core)                                                                                                                        |
| Stars                 | ~16–28k                                                                                                                           |
| Maintenance           | Very active (ClickHouse-backed; 2025–2026)                                                                                        |
| Last active           | Continuous                                                                                                                        |
| Enterprise readiness  | High (SOC2; self-host via Docker/Helm)                                                                                            |
| Learning curve        | Low–moderate                                                                                                                      |
| Community             | #1 OSS LLM platform; TypeScript SDKs                                                                                              |
| Advantages            | One platform for tracing + evals + prompt management; native Node SDK; fills the gap Grafana cannot (prompt engineering workflow) |
| Disadvantages         | Adds Postgres + ClickHouse to operate; own ingestion model (not pure OTel)                                                        |
| When to use           | AI tracing, prompt versioning, evaluation pipelines (EI-001/005/010)                                                              |
| When NOT to use       | If you want pure OTel-native pipeline only (Grafana covers quantitative telemetry)                                                |
| How it fits VedMoulya | The AI observability + eval plane alongside OTel/Grafana                                                                          |
| Recommended action    | **ADOPT** (Planned) — self-hosted; orchestrator emits traces + eval results                                                       |

### Promptfoo

| Field                 | Value                                                                            |
| --------------------- | -------------------------------------------------------------------------------- |
| Name                  | Promptfoo                                                                        |
| Category              | LLM evaluation & regression testing                                              |
| Purpose               | Declarative prompt/assertion tests, red-teaming, CI/CD regression gates          |
| License               | MIT                                                                              |
| Stars                 | ~8–10k                                                                           |
| Maintenance           | Active                                                                           |
| Last active           | Continuous                                                                       |
| Enterprise readiness  | High (CI/CD-first; used widely)                                                  |
| Learning curve        | Low                                                                              |
| Community             | Good                                                                             |
| Advantages            | Local-first; language-agnostic; assertions + security red-teaming; GitHub Action |
| Disadvantages         | Not a production tracer                                                          |
| When to use           | Pre-merge prompt regression tests (Quality Engine)                               |
| When NOT to use       | Production tracing (use Langfuse)                                                |
| How it fits VedMoulya | CI gate for prompt/quality regressions (EI-010)                                  |
| Recommended action    | **ADOPT** (Planned) — CI eval suite                                              |

### Other evaluation / observability candidates

| Technology    | License                 | Verdict  | Reason                                                     |
| ------------- | ----------------------- | -------- | ---------------------------------------------------------- |
| Ragas         | Apache-2.0              | Research | RAG eval metrics; Python-heavy — evaluate via API bridge   |
| DeepEval      | Apache-2.0              | Research | Unit-test style LLM evals; Python-centric                  |
| OpenAI Evals  | MIT                     | Rejected | Maintenance-mode; lacks modern RAG/agent features          |
| TruLens       | MIT                     | Research | Faithfulness/groundedness feedback functions               |
| LangSmith     | Proprietary             | Rejected | Commercial SaaS; lock-in                                   |
| Arize Phoenix | ELv2 (source-available) | Research | Native OTel eval alternative to Langfuse                   |
| OpenLLMetry   | Apache-2.0              | Research | OTel semantic-convention wrapper; overlaps our custom OTel |
| W&B           | Proprietary             | Rejected | Commercial; heavy for LLM app workflows                    |
| MLflow        | Apache-2.0              | Research | General MLOps; not LLM-tailored                            |
| DVC           | Apache-2.0              | Backlog  | Data versioning; not needed now                            |

---

## 7. Automation

### Browser automation

| Technology | License    | Verdict             | Reason                                             |
| ---------- | ---------- | ------------------- | -------------------------------------------------- |
| Playwright | Apache-2.0 | **ADOPT** (Adopted) | Already in stack (e2e + a11y); keep                |
| Puppeteer  | Apache-2.0 | Rejected            | Chromium-only; Playwright covers us                |
| Selenium   | Apache-2.0 | Rejected            | Legacy; verbose; Playwright superior for our needs |

### Document processing & OCR

| Technology   | License    | Verdict             | Reason                                                    |
| ------------ | ---------- | ------------------- | --------------------------------------------------------- |
| Tesseract.js | Apache-2.0 | **ADOPT** (Planned) | In-Node OCR for document management (scanned PDFs/images) |
| PaddleOCR    | Apache-2.0 | Research            | Superior multilingual accuracy; Python worker needed      |
| OCRmyPDF     | MPL-2.0    | Research            | Searchable-PDF layer; external system deps                |
| Unstructured | MIT        | **WRAP** (Planned)  | Document partitioning/chunking service (see §4)           |

### Speech

| Technology               | License    | Verdict             | Reason                                                                                  |
| ------------------------ | ---------- | ------------------- | --------------------------------------------------------------------------------------- |
| Whisper / faster-whisper | MIT        | **ADOPT** (Planned) | `speech` capability exists in `packages/ai`; run faster-whisper as containerized worker |
| Whisper.cpp              | MIT        | Research            | Ultra-light CPU inference; binary/container integration                                 |
| Vosk                     | Apache-2.0 | Research            | Offline; Node bindings; lower accuracy on complex audio                                 |

### Email & calendar

| Technology        | License                    | Verdict                      | Reason                                                                                                                          |
| ----------------- | -------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Resend            | MIT (SDK) / SaaS free tier | **WRAP** (Planned)           | Transactional email behind the notifications service; free tier is practical; Nodemailer (MIT) remains the self-hosted fallback |
| Nodemailer        | MIT                        | **ADOPT** (Adopted fallback) | Self-hosted SMTP; already conventional in Node                                                                                  |
| Postmark          | Proprietary                | Rejected                     | Commercial-only                                                                                                                 |
| Cal.com / cal.diy | MIT (cal.diy fork)         | Research                     | Self-hosted scheduling (Next.js-native); AGPL removed in fork; evaluate for meeting-scheduling features                         |
| Nylas             | Proprietary                | Rejected                     | Commercial                                                                                                                      |

---

## 8. Security

### Secrets management

| Technology      | License     | Verdict             | Reason                                                                     |
| --------------- | ----------- | ------------------- | -------------------------------------------------------------------------- |
| Infisical       | MIT (core)  | **ADOPT** (Planned) | Modern secrets platform; Node SDKs, .env sync, K8s operator; free core     |
| SOPS            | MPL-2.0     | Research            | Git-encrypted secrets; file-based; no dynamic rotation                     |
| HashiCorp Vault | BUSL-1.1    | Backlog             | Enterprise standard but heavy ops; revisit with dedicated DevOps headcount |
| Doppler         | Proprietary | Rejected            | Commercial                                                                 |

### Authentication & authorization

| Technology         | License    | Verdict            | Reason                                                                                                                  |
| ------------------ | ---------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Keycloak           | Apache-2.0 | Research           | Full IAM but heavy Java; we already have a custom identity service (jose + Google OAuth) — only if IAM needs outgrow it |
| Ory (Kratos/Hydra) | Apache-2.0 | Research           | Headless identity; steep ops                                                                                            |
| Casbin             | Apache-2.0 | **WRAP** (Planned) | Model-based authorization (ACL/RBAC/ABAC) for portal token scoping and multi-tenant access                              |
| OPA / OPAL         | Apache-2.0 | Backlog            | Policy engine; overkill for current CRUD scale                                                                          |
| Auth.js (NextAuth) | ISC/MIT    | Research           | Native Next.js; our identity service already covers auth                                                                |

### API gateway & rate limiting

| Technology            | License           | Verdict             | Reason                                                                                              |
| --------------------- | ----------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| Kong                  | Apache-2.0 (core) | Rejected            | Heavy infra; our tRPC gateway + middleware suffice                                                  |
| Traefik               | MIT               | Research            | Cloud-native edge proxy; candidate at EPIC-007 scale                                                |
| Nginx                 | BSD-2-Clause      | **ADOPT** (Adopted) | Standard reverse proxy layer (existing infra)                                                       |
| rate-limiter-flexible | ISC               | **WRAP** (Planned)  | Redis-backed rate limiting across horizontally scaled Next.js instances (replaces in-memory limits) |
| express-rate-limit    | MIT               | Research            | Simpler alternative; in-memory store limits scale                                                   |

---

## 9. AI Development & API Docs

| Technology                 | License     | Verdict             | Reason                                                                         |
| -------------------------- | ----------- | ------------------- | ------------------------------------------------------------------------------ |
| Scalar                     | MIT         | **ADOPT** (Planned) | Modern interactive OpenAPI UI for the developer portal                         |
| zod-to-openapi             | MIT         | **ADOPT** (Planned) | Generate OpenAPI from our Zod schemas (already the validation source of truth) |
| Redocly                    | MIT (CLI)   | Research            | Alternative rendering                                                          |
| Stoplight                  | Proprietary | Rejected            | Commercial core                                                                |
| Langfuse prompt management | MIT         | (covered §6)        | Prompt versioning within Langfuse                                              |
| PromptLayer                | MIT core    | Research            | Prompt analytics; overlaps Langfuse                                            |

---

## Registry Summary Table

| Category            | Technology              | License            | Purpose                    | Decision | Status           | Adapter Needed             | Replacement Strategy  | Priority |
| ------------------- | ----------------------- | ------------------ | -------------------------- | -------- | ---------------- | -------------------------- | --------------------- | -------- |
| Workflow            | BullMQ                  | MIT                | Async jobs                 | Adopt    | Adopted          | No (in use)                | Hatchet at scale      | —        |
| Workflow            | Hatchet                 | Apache-2.0         | Durable workflows          | Wrap     | Planned          | Execution Engine interface | Temporal (scale)      | P1       |
| Agent Orchestration | LangGraph               | MIT                | Multi-agent graphs         | Wrap     | Planned          | EI planner interface       | In-house planner      | P1       |
| Agent Orchestration | Temporal                | MIT                | Durable long-running       | Reject   | Rejected         | —                          | Revisit EPIC-007      | —        |
| Provider Routing    | LiteLLM                 | MIT                | Gateway, fallback, budgets | Wrap     | Planned          | Orchestrator adapter       | In-house gateway      | P1       |
| Provider Routing    | OpenRouter              | Proprietary        | Multi-model access         | Adopt    | Adopted (family) | Existing adapter           | —                     | —        |
| Context             | Provider prompt caching | N/A                | Cache static context       | Adopt    | Planned          | Orchestrator               | —                     | P1       |
| Context             | GPTCache                | Apache-2.0         | Semantic cache             | Wrap     | Planned          | Orchestrator cache         | In-house              | P2       |
| Context             | LLMLingua               | MIT                | Compression                | Research | Research         | Worker                     | —                     | P3       |
| RAG                 | pgvector                | PostgreSQL license | Vector search              | Adopt    | Adopted          | No                         | Qdrant at scale       | —        |
| RAG                 | Unstructured            | MIT                | Document partitioning      | Wrap     | Planned          | Ingestion service          | PaddleOCR/OCR         | P1       |
| RAG                 | Qdrant                  | Apache-2.0         | Dedicated vector DB        | Research | Research         | —                          | —                     | P3       |
| Memory              | (own Memory service)    | —                  | User memory                | Build    | Adopted          | —                          | —                     | —        |
| Knowledge           | Apache AGE              | Apache-2.0         | Graph in Postgres          | Research | Research         | —                          | Kùzu                  | P3       |
| Knowledge           | Kùzu                    | MIT                | Embedded graph             | Research | Research         | —                          | Apache AGE            | P3       |
| Evaluation          | Langfuse                | MIT                | Tracing + evals + prompts  | Adopt    | Planned          | Orchestrator emission      | Phoenix               | P1       |
| Evaluation          | Promptfoo               | MIT                | CI prompt regression       | Adopt    | Planned          | CI gate                    | DeepEval              | P1       |
| Observability       | OpenTelemetry           | Apache-2.0         | Telemetry                  | Adopt    | Adopted          | No                         | —                     | —        |
| Observability       | Grafana                 | AGPL-3.0           | Dashboards                 | Adopt    | Adopted          | No                         | —                     | —        |
| Automation          | Playwright              | Apache-2.0         | Browser e2e                | Adopt    | Adopted          | No                         | —                     | —        |
| Automation          | Tesseract.js            | Apache-2.0         | OCR                        | Adopt    | Planned          | Document service           | PaddleOCR             | P2       |
| Automation          | faster-whisper          | MIT                | Speech-to-text             | Adopt    | Planned          | Speech worker              | whisper.cpp           | P2       |
| Automation          | Resend                  | MIT SDK/SaaS       | Email                      | Wrap     | Planned          | Notifications adapter      | Nodemailer            | P2       |
| Automation          | Nodemailer              | MIT                | SMTP email                 | Adopt    | Adopted fallback | No                         | Resend                | —        |
| Security            | Infisical               | MIT core           | Secrets                    | Adopt    | Planned          | Config/DI                  | SOPS/Vault            | P1       |
| Security            | Casbin                  | Apache-2.0         | Authorization models       | Wrap     | Planned          | Policy service             | OPA                   | P2       |
| Security            | rate-limiter-flexible   | ISC                | Redis rate limiting        | Wrap     | Planned          | Gateway middleware         | —                     | P1       |
| Security            | express-rate-limit      | MIT                | Simple Node rate limiting  | Research | Research         | —                          | rate-limiter-flexible | P3       |
| Provider Routing    | Portkey Gateway         | MIT (2.0 core)     | Lightweight gateway        | Research | Research         | —                          | LiteLLM               | P3       |
| Security            | Keycloak                | Apache-2.0         | Full IAM                   | Research | Research         | —                          | —                     | P3       |
| Security            | Vault                   | BUSL-1.1           | Secrets at scale           | Backlog  | Backlog          | —                          | Infisical             | P4       |
| AI Dev              | Scalar                  | MIT                | API docs UI                | Adopt    | Planned          | Web route                  | Redocly               | P2       |
| AI Dev              | zod-to-openapi          | MIT                | OpenAPI from Zod           | Adopt    | Planned          | Docs pipeline              | —                     | P2       |
