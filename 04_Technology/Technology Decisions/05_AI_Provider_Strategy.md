# AI Provider Strategy

**TECH-001 — Document 05/10 — Technology Decision Record**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Technology Officer (CTO)
**Created:** 2026-07-27
**Cross-references:** CMP-001, CMP-002, ARC-001, ARC-005, ENG-002, ENG-004, IMP-001/D02, IMP-001/D06

---

## Purpose

This TDR defines the **AI provider strategy** for VedMoulya — how multiple AI providers are abstracted, selected, routed, and managed. The strategy must uphold Principle #2 (Provider Agnostic) while optimizing for cost, quality, latency, and reliability.

---

## AI Provider Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AI PROVIDER PHILOSOPHY                                    │
│                                                                               │
│  AI PROVIDERS ARE EXECUTION RESOURCES, NOT INTELLIGENCE SOURCES.              │
│                                                                               │
│  VedMoulya OWNS the intelligence:                                             │
│  • Understanding (Context, DNA, Knowledge)                                    │
│  • Decision-making (Decision Engine)                                          │
│  • Planning (Planning Engine)                                                  │
│  • Knowledge (Knowledge Graph)                                                │
│                                                                               │
│  AI Providers EXECUTE tasks:                                                  │
│  • Natural language processing (generate, summarize, analyze)                  │
│  • Knowledge extraction (embed, classify, extract)                            │
│  • Recommendation generation (suggest, rank, personalize)                     │
│  • Decision support (score, evaluate, compare)                                │
│                                                                               │
│  This means:                                                                  │
│  • Replacing an AI provider never loses VedMoulya intelligence               │
│  • All VedMoulya intelligence stays in VedMoulya-controlled systems           │
│  • Providers are interchangeable execution resources                          │
│  • Provider selection optimizes for cost, speed, and quality per task         │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Provider Abstraction

### Abstraction Layer Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AI PROVIDER ABSTRACTION LAYER                               │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  VEDMOULYA INTELLIGENCE LAYER (OWNED)                                │    │
│  │                                                                        │    │
│  │  • Application services call AI Orchestration Service                 │    │
│  │  • They specify capability needed (summarize, analyze, recommend)     │    │
│  │  • They provide context (not raw data)                                │    │
│  │  • They receive structured responses (not raw LLM output)             │    │
│  │  • They never know which provider was used                            │    │
│  │                                                                        │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                          │
│                                    ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  AI ORCHESTRATION SERVICE (OWNED)                                    │    │
│  │                                                                        │    │
│  │  ▸ Capability Routing — Which provider for which task?               │    │
│  │  ▸ Context Assembly — Minimum context, maximum relevance             │    │
│  │  ▸ Provider Selection — Cost/quality/latency optimization            │    │
│  │  ▸ Response Validation — 6 validation gates before delivery          │    │
│  │  ▸ Fallback Management — Automatic failover on failure               │    │
│  │  ▸ Cost Tracking — Per-provider, per-task, per-user cost metrics     │    │
│  │  ▸ Quality Tracking — Per-provider, per-task quality scores          │    │
│  │                                                                        │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                          │
│                                    ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  PROVIDER ABSTRACTION INTERFACE                                      │    │
│  │                                                                        │    │
│  │  ▸ Interface: send(Request) → Response                               │    │
│  │  ▸ Request: Task type, context, constraints (cost, latency, quality)  │    │
│  │  ▸ Response: Generated output, provider metadata, cost, latency      │    │
│  │  ▸ Providers implement this interface — VedMoulya owns the contract  │    │
│  │                                                                        │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│          │              │              │              │                      │
│          ▼              ▼              ▼              ▼                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│  │  OpenAI   │  │ Anthropic │  │ DeepSeek  │  │  Google  │                    │
│  │  Adapter  │  │ Adapter   │  │ Adapter   │  │  Vertex  │                    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                    │
│          │              │              │              │                      │
│          ▼              ▼              ▼              ▼                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│  │  GPT-4o  │  │ Claude   │  │ DeepSeek │  │  Gemini  │                    │
│  │  GPT-4   │  │ Sonnet   │  │  V3      │  │  1.5     │                    │
│  │  GPT-4-mini│  │ Haiku    │  │ DeepSeek │  │          │                    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                    │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  LOCAL AI (FUTURE)                                                   │    │
│  │  ▸ Ollama adapter — local models (Llama, Mistral, Phi)              │    │
│  │  ▸ On-device adapter — mobile/edge models (MLC, MediaPipe)          │    │
│  │  ▸ Same abstraction interface — different execution environment      │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Multi-Provider Strategy

### Provider Selection Criteria

| Criterion            | Weight | Description                                                                                         |
| -------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| **Task Suitability** | 35%    | How well does this provider perform this specific task type? (based on benchmark + historical data) |
| **Cost**             | 25%    | Per-token cost for the task's expected input/output size                                            |
| **Latency**          | 20%    | P50/P95/P99 response time for the task                                                              |
| **Reliability**      | 10%    | Uptime, error rate, rate limit history                                                              |
| **Quality**          | 10%    | Output quality scores from user feedback and automated evaluation                                   |

### Provider Selection Algorithm

```text
For each request R (task type T, context C, constraints X):
  1. Filter providers to those capable of task T
  2. Filter providers meeting latency constraint (if specified)
  3. Filter providers meeting cost constraint (if specified)
  4. Score remaining providers: Score(P) = Σ(criterion_score × weight)
  5. Select highest-scoring provider with:
     - 80% probability (primary selection)
     - 20% probability to explore alternatives (learning)
  6. Execute request
  7. Record outcome (success/failure, latency, cost, quality score)
  8. Update provider scores for future requests

Learning over time:
  - Providers that consistently deliver quality for a task type gain preference
  - Providers that fail or degrade lose preference
  - New providers start with neutral scores and earn preference through performance
```

### Provider Portfolio Strategy

```text
PRIMARY     │ OpenAI GPT-4o       │ General intelligence, broadest capability
SECONDARY   │ Anthropic Claude    │ Safety-critical tasks, long context
            │ Sonnet 4            │
TERTIARY    │ Google Gemini       │ Multimodal tasks, Google ecosystem
            │ DeepSeek V3         │ Cost-sensitive tasks
FALLBACK    │ Multiple (any above)│ Automatic failover on provider outage
LOCAL       │ Ollama (Llama/Mistral) │ Privacy-sensitive tasks, offline mode
              (Phase 7+)
```

### Provider Allocation by Task

| Task Type                | Primary        | Secondary     | Fallback     | Rationale                                         |
| ------------------------ | -------------- | ------------- | ------------ | ------------------------------------------------- |
| **Knowledge Extraction** | GPT-4o         | Claude Sonnet | Gemini       | Accuracy is critical for knowledge quality        |
| **Decision Scoring**     | GPT-4o         | DeepSeek      | Claude       | Cost/quality balance for high-frequency decisions |
| **Planning Generation**  | Claude Sonnet  | GPT-4o        | Gemini       | Safety considerations for plans                   |
| **Recommendation**       | DeepSeek       | GPT-4o-mini   | Claude Haiku | Cost-sensitive, high-volume                       |
| **Content Generation**   | GPT-4o         | Claude Sonnet | DeepSeek     | Quality matters for user-facing content           |
| **Summarization**        | GPT-4o-mini    | DeepSeek      | Claude Haiku | Cost vs. quality sweet spot                       |
| **Embeddings**           | OpenAI ada-003 | Google        | N/A          | Embedding quality consistency                     |
| **Chat/Conversation**    | GPT-4o         | Claude Sonnet | DeepSeek     | Latency and quality critical                      |
| **Safety Moderation**    | Claude         | GPT-4o        | N/A          | Safety-first, Claude excels                       |

---

## Fallback Strategy

### Failure Escalation

```text
Level 0: Primary Provider
   │  Success → return response
   │  Failure → escalate
   ▼
Level 1: Secondary Provider (same tier)
   │  Success → return response, flag primary for review
   │  Failure → escalate
   ▼
Level 2: Tertiary Provider (any available)
   │  Success → return response, alert operations
   │  Failure → escalate
   ▼
Level 3: Graceful Degradation
   │  Return cached response (if available)
   │  Return simplified response (rule-based fallback)
   │  Return error with explanation to user
   ▼
Level 4: Circuit Break
   │  Temporarily disable AI-dependent features
   │  Alert users of reduced capability
   │  Notify operations of critical provider outage
```

### Caching Strategy

| Cache Type         | TTL                     | Use Case                                                        |
| ------------------ | ----------------------- | --------------------------------------------------------------- |
| **Response Cache** | 1 hour                  | Identical requests (same context, same task)                    |
| **Pattern Cache**  | 24 hours                | Similar patterns (knowledge extraction for well-known entities) |
| **Fallback Cache** | Until provider restores | Cached responses used during provider outage                    |

---

## Cost Optimization

### Cost Management Strategy

| Strategy                 | Impact                                                      | Phase                                 |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------- |
| **Model Size Selection** | Use smallest capable model per task (GPT-4o-mini vs GPT-4o) | 30-50% cost reduction                 | MVP        |
| **Context Minimization** | Send minimum context (Principle #7 — Minimum Context)       | 40-60% cost reduction                 | MVP        |
| **Provider Routing**     | Route to cheapest capable provider per task                 | 20-40% cost reduction                 | MVP        |
| **Response Caching**     | Cache identical/similar responses                           | 10-30% request reduction              | MVP        |
| **Batching**             | Batch non-urgent requests                                   | 15-25% cost reduction                 | Growth     |
| **Local AI**             | Run simple tasks on local models                            | 50-80% cost reduction for those tasks | Enterprise |

### Cost Monitoring

| Metric                  | Alert Threshold         | Action                       |
| ----------------------- | ----------------------- | ---------------------------- |
| Cost per user per month | > $5                    | Investigate usage patterns   |
| Cost per task type      | > 10% above baseline    | Re-evaluate provider routing |
| Provider cost variance  | > 20% between providers | Rebalance routing weights    |
| Cache hit rate          | < 20%                   | Review caching strategy      |
| Context size growth     | > 10% week-over-week    | Context minimization review  |

---

## Model Evaluation

### Evaluation Framework

| Dimension       | Method                                                 | Frequency    |
| --------------- | ------------------------------------------------------ | ------------ |
| **Accuracy**    | Automated test suite with known-correct answers        | Continuous   |
| **Quality**     | User feedback ratings (1-5 on each AI output)          | Per response |
| **Safety**      | Automated safety scan (toxicity, bias, hallucination)  | Per response |
| **Cost**        | Cost per task, cost per user, cost per outcome         | Daily        |
| **Latency**     | P50/P95/P99 response time per provider per task        | Continuous   |
| **Reliability** | Error rate, timeout rate, rate limit hits per provider | Continuous   |

### Provider Onboarding Process

```text
1. IDENTIFY NEED
   └─ New provider offers capability, cost, or quality improvement

2. EVALUATE
   └─ Run standardized test suite across all task types
   └─ Compare against current providers on accuracy, cost, latency, reliability
   └─ Security and compliance review (data handling, certifications)

3. PROTOTYPE (1 sprint)
   └─ Build provider adapter implementing the abstraction interface
   └─ Run parallel evaluation with shadow traffic (no user impact)
   └─ Measure: quality scores, cost comparison, latency profile

4. ROLLOUT (phased)
   └─ 5% traffic → 25% → 50% → 100% over 2-4 weeks
   └─ Monitor quality, cost, and user feedback at each stage
   └─ Rollback if any metric degrades beyond threshold

5. DEPLOY
   └─ Full routing eligibility with appropriate weights
   └─ Provider added to portfolio with performance baseline
```

---

## Pros & Cons

| Pros                                                               | Cons                                                           |
| ------------------------------------------------------------------ | -------------------------------------------------------------- |
| No provider lock-in — each provider is a replaceable adapter       | Provider abstraction adds development and maintenance overhead |
| Cost-optimized routing — cheapest capable provider per task        | Quality varies between providers — must monitor continuously   |
| Automatic fallback — no single provider outage blocks the platform | Provider API changes require adapter updates                   |
| Learning over time — routing improves with usage                   | Shadow evaluation requires careful implementation              |
| Local AI path available for privacy/cost                           | Each provider has unique pricing and rate limit models         |

### Trade-offs Accepted

| Trade-off                                         | Why Acceptable                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Provider abstraction layer complexity             | Cost of adding a provider = one adapter. Cost of provider lock-in = entire platform. |
| Not using a single "best" provider for everything | Different providers excel at different tasks. Specialization beats generalization.   |
| Not building custom model fine-tuning (MVP)       | Not a core differentiator. Fine-tuning adds value after platform-market fit.         |

### Migration Strategy

| Scenario                                    | Migration Path                                                   | Cost                       |
| ------------------------------------------- | ---------------------------------------------------------------- | -------------------------- |
| Provider goes out of business               | Remove adapter, redistribute traffic to remaining providers      | Low (hours)                |
| Provider raises prices 5x                   | Reduce routing weight to zero, redistribute to cheaper providers | Low (configuration change) |
| Provider quality degrades                   | Reduce routing weight, increase alternative provider weight      | Low (configuration change) |
| New provider offers breakthrough capability | Build adapter → Shadow evaluate → Phase rollout                  | Medium (sprint)            |
| Need for fine-tuned models arises           | Add fine-tuning adapter alongside API adapters                   | Medium (2 sprints)         |

---

## Cross-References

| Reference   | Relationship                                                                           |
| ----------- | -------------------------------------------------------------------------------------- |
| CMP-001     | "Truth before hype" — providers evaluated on objective criteria, not marketing         |
| CMP-002     | Provider data handling must comply with data classification (no PII to providers)      |
| ARC-001     | Principle #2 (Provider Agnostic) is the foundation of this strategy                    |
| ARC-005     | AI Orchestrator (D02-D08) defines the provider abstraction contracts and routing logic |
| ENG-002     | AI Orchestration Service contract defines how services request AI capabilities         |
| ENG-004/D09 | Principle #2 and #10 (AI Native) — this strategy operationalizes both                  |
| IMP-001/D02 | Provider abstraction built in Phase 1 (Week 6). Multi-provider routing in Phase 2.     |
