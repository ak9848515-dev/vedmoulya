# System Boundaries

**Mission:** Clearly define what belongs inside the VedMoulya platform versus what belongs outside — and why.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Enterprise Architect
**Dependencies:** Architecture Principles.md, VedMoulya Intelligence.md, Core Components.md
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

Understanding system boundaries is critical to maintaining architectural integrity. This document defines the boundary between VedMoulya-owned capabilities and externally-provided capabilities, with clear rationale for each boundary decision.

---

## Boundary Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     VEDMOULYA PLATFORM (Owns)                        │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │  User    │  │  User    │  │  Human   │  │  Human Progress    │  │
│  │ Identity │  │   DNA    │  │  Journey │  │  Index (HPI)       │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────────┘  │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │  Memory  │  │Knowledge │  │ Decision │  │  Personalization   │  │
│  │          │  │  Graph   │  │  Engine  │  │  Rules             │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────────┘  │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ Planning │  │Execution │  │Reasoning │  │  Recommendation    │  │
│  │  Engine  │  │  Engine  │  │  Engine  │  │  Engine            │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────────┘  │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │  User    │  │  Event   │  │ Security │  │  All Business      │  │
│  │ Profiles │  │   Bus    │  │  Layer   │  │  Logic             │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 AI Orchestrator & Provider Manager             │   │
│  │         (Owns provider abstraction, routing, fallback)         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
        ──────── SYSTEM BOUNDARY ────┼────
                                    │
┌───────────────────────────────────┼─────────────────────────────────┐
│          EXTERNAL (Does NOT Own)  │                                 │
│                                   ▼                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │   LLMs   │  │  Speech  │  │  Image   │  │  Embedding       │   │
│  │ (GPT,    │  │  Models  │  │  Models  │  │  Models          │   │
│  │  Claude) │  │          │  │          │  │  (text2vec)      │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
│                                                                     │
│  ┌──────────┐  ┌────────────────────┐  ┌────────────────────────┐  │
│  │  Cloud   │  │  External          │  │  Third-Party           │  │
│  │Infra     │  │  APIs & Services   │  │  Data Sources          │  │
│  └──────────┘  └────────────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## What VedMoulya Owns (Inside the Boundary)

### 1. User Understanding

**Owns:** All models and data that represent who the user is.

**Includes:**

- User Identity and authentication
- User DNA (all 8 dimensions)
- User Profiles (public, personal, learning, career, coach)
- User journey stage tracking
- Human Progress Index calculation
- Personalization preferences and rules

**Why:** User understanding is VedMoulya's proprietary advantage. It is the foundation of all personalization and cannot be outsourced.

---

### 2. Decision Making

**Owns:** All decision frameworks, evaluation logic, and decision records.

**Includes:**

- Decision Engine (option generation, scoring, selection)
- Reasoning Engine (logical, causal, analogical reasoning)
- Decision frameworks (utility, risk, trade-off)
- Decision audit trail
- Decision confidence scoring

**Why:** Decisions define the platform's intelligence. Outsourcing decisions would mean outsourcing VedMoulya's brain.

---

### 3. Memory

**Owns:** All user memory storage, retrieval, and management.

**Includes:**

- Conversation history storage
- Memory consolidation and summarization
- Contextual recall for AI interactions
- Memory privacy controls (forget, export)
- Memory relevance scoring and decay

**Why:** Memory is deeply integrated with User DNA and decision making. An external memory would create unacceptable latency, privacy risks, and dependency.

---

### 4. Knowledge

**Owns:** The Knowledge Graph, knowledge validation, and relationship mapping.

**Includes:**

- Knowledge Graph structure and content
- Entity extraction and validation
- Relationship mapping and discovery
- Knowledge confidence scoring
- Knowledge gap detection
- Knowledge freshness management

**Why:** Knowledge is the platform's proprietary asset. Building a unique knowledge graph creates competitive moat.

---

### 5. Planning

**Owns:** All plan generation, optimization, and adaptation.

**Includes:**

- Goal decomposition into plans
- Prerequisite and dependency mapping
- Timeline and resource estimation
- Plan validation and feasibility checking
- Plan adaptation and re-planning

**Why:** Planning requires deep integration with User DNA, Knowledge Graph, and personalization rules. It cannot be cleanly separated.

---

### 6. Execution

**Owns:** Task execution, workflow management, and execution tracking.

**Includes:**

- Task queue management
- Workflow execution engine
- Execution state tracking
- Error handling and retry
- Human-in-the-loop workflows

**Why:** Execution coordinates human actions, AI actions, and system actions. Externalizing execution would fragment the user experience and create consistency challenges.

---

### 7. Personalization

**Owns:** All personalization rules, recommendation logic, and user-specific adaptations.

**Includes:**

- Recommendation Engine scoring
- Personalization Rules engine
- Content and opportunity matching
- Diversity and freshness enforcement
- Personalization level management

**Why:** Personalization is the primary user-facing value of the intelligence layer. It must be tightly coupled with User DNA and decision making.

---

### 8. Business Logic

**Owns:** All platform business logic, workflows, and rules.

**Includes:**

- Marketplace business rules
- Earning and payment logic
- Journey stage progression rules
- Achievement and gamification logic
- Community moderation rules
- All product-specific workflows

**Why:** Business logic defines how VedMoulya operates. It is the implementation of the product vision and must be fully controlled.

---

### 9. AI Orchestration

**Owns:** Provider abstraction, routing, context assembly, and fallback logic.

**Includes:**

- AI Provider abstraction layer
- Provider selection and routing
- Context assembly for AI requests
- Prompt management and structured outputs
- Provider fallback and circuit breaking
- Cost and quality tracking

**Why:** The AI Orchestrator is the gateway that makes providers interchangeable. It is critical infrastructure that must be owned.

---

## What VedMoulya Does NOT Own (Outside the Boundary)

### 1. LLMs (Large Language Models)

**Does not own:** The actual language model weights, training, or inference infrastructure.

**Examples:** GPT-4o, Gemini 2.0, Claude 3.5, DeepSeek V3, Ollama local models

**Why:** LLMs are a rapidly commoditizing layer. Building proprietary LLMs would be prohibitively expensive and distract from VedMoulya's core value: user understanding and intelligence orchestration.

**Relationship:** VedMoulya is a customer and integrator of LLMs, not a builder.

---

### 2. Speech Models

**Does not own:** Speech-to-text, text-to-speech, or voice recognition models.

**Why:** Speech technology is mature and commoditized. Specialized providers (Whisper, ElevenLabs, Google Speech) offer superior quality.

**Relationship:** Integrated through the AI Orchestrator when voice features are needed.

---

### 3. Image Models

**Does not own:** Image generation, image recognition, or computer vision models.

**Why:** Rapidly advancing field with specialized leaders (DALL-E, Midjourney, Stable Diffusion). Building in-house would not compete.

**Relationship:** Integrated through the AI Orchestrator for portfolio image generation, content creation, etc.

---

### 4. Embedding Models

**Does not own:** Text embedding models for vector search and semantic similarity.

**Why:** Embeddings are a well-solved problem with excellent open-source (text2vec, BGE) and commercial (OpenAI, Cohere) options.

**Relationship:** Used internally for memory and knowledge retrieval, but the models are pluggable.

---

### 5. Cloud Infrastructure

**Does not own:** Physical servers, data centers, or cloud platforms.

**Why:** Infrastructure is best left to specialists (AWS, GCP, Azure). Building data centers provides no competitive advantage.

**Relationship:** VedMoulya runs on cloud infrastructure managed by the Infrastructure team.

---

## Boundary Policy

### Adding Inside the Boundary

A capability should be inside the boundary if:

1. It creates proprietary competitive advantage
2. It requires deep integration with other inside capabilities
3. It involves sensitive user data that should not leave the platform
4. It defines the core user experience
5. External alternatives would create unacceptable latency or dependency

### Moving Outside the Boundary

A capability should be moved outside if:

1. It is a well-solved commodity
2. Specialized external providers offer significantly better quality
3. Building in-house distracts from core value creation
4. External providers can offer better scale or reliability
5. The capability does not involve proprietary data or logic

---

## Boundary Change Process

1. **Proposal** — Document the proposed boundary change with rationale
2. **Impact Analysis** — Assess impact on all 12 architecture principles
3. **Review** — Enterprise Architecture review and approval
4. **Migration Plan** — Plan for transitioning the capability across the boundary
5. **Implementation** — Execute with monitoring
6. **Documentation** — Update all affected architecture documents

## Cross-References

- **Architecture Principles.md** — Principles that guide boundary decisions (especially 2: Provider Agnostic)
- **VedMoulya Intelligence.md** — The intelligence philosophy that defines what's core
- **Core Components.md** — Components inside the boundary
- **Integration Points.md** — External systems across the boundary
- **System Context.md** — Actors outside the boundary
- **PRD-002** — User DNA (inside) vs. AI models (outside)
- **CMP-001** — Business strategy for make-vs-buy decisions

### Future Expansion

- **On-device intelligence** — Parts of User DNA and Memory may move to user devices for privacy
- **Federated learning** — Some analytics may move outside via federated computation
- **Knowledge sharing** — Knowledge Graph may have external partner connections
- **Plugin ecosystem** — Third-party intelligence plugins may operate inside sandboxed boundaries
- **Compliance boundaries** — Regional data residency may create sub-boundaries
