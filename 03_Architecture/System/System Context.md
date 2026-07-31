# System Context

**Mission:** Define all major actors interacting with the VedMoulya Intelligence Platform and their responsibilities.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Enterprise Architect
**Dependencies:** VedMoulya Intelligence.md, Core Components.md, System Boundaries.md
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

VedMoulya operates within a rich ecosystem of actors — humans, external services, and internal systems. This document defines each actor, their role, their responsibilities, and their relationship to the platform.

---

## System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    VEDMOULYA PLATFORM                        │   │
│  │                                                              │   │
│  │  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐│   │
│  │  │  User      │ │  Admin   │ │  Coach   │ │  Analytics   ││   │
│  │  │  (Human)   │ │  (Human) │ │  (Human) │ │  (Internal)  ││   │
│  │  └─────┬──────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘│   │
│  │        │              │            │               │         │   │
│  │  ┌─────▼──────────────▼────────────▼───────────────▼──────┐ │   │
│  │  │              VEDMOULYA INTELLIGENCE CORE                │ │   │
│  │  │         (DNA, Journey, Memory, Knowledge,               │ │   │
│  │  │          Decisions, Planning, Execution)                │ │   │
│  │  └───────────────────────┬────────────────────────────────┘ │   │
│  │                          │                                   │   │
│  └──────────────────────────┼───────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────┼───────────────────────────────────┐   │
│  │           EXTERNAL ACTORS                                      │   │
│  │                          │                                     │   │
│  │  ┌───────────────────────▼────────────────────────────────┐  │   │
│  │  │                 AI PROVIDERS                            │  │   │
│  │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐ ┌──────────┐   │  │   │
│  │  │  │ GPT  │ │Gemini│ │Claude│ │DeepSeek│ │ Ollama   │   │  │   │
│  │  │  └──────┘ └──────┘ └──────┘ └────────┘ └──────────┘   │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  │                                                               │   │
│  │  ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌───────────┐  │   │
│  │  │ Knowledge  │ │Market-   │ │  External  │ │  Payment  │  │   │
│  │  │ Sources    │ │ place    │ │    APIs    │ │ Providers │  │   │
│  │  └────────────┘ └──────────┘ └────────────┘ └───────────┘  │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Actor Definitions

### 1. User (Human)

**Role:** The primary beneficiary of the VedMoulya platform.

**Responsibilities:**

- Declare identity, goals, preferences, and constraints
- Engage with learning, building, earning, and growth activities
- Provide feedback on recommendations and experiences
- Control privacy settings and personalization levels
- Own and manage their User DNA
- Interact with the AI Coach for guidance

**Interfaces with:** User Identity, User DNA, Coach Engine, Recommendation Engine, Execution Engine

---

### 2. Admin (Human)

**Role:** Platform administrator responsible for system health, configuration, and governance.

**Responsibilities:**

- Monitor platform health and performance
- Manage AI provider configurations and credentials
- Review system logs and audit trails
- Configure platform-wide settings and policies
- Manage user escalations and support
- Oversee compliance and data governance

**Interfaces with:** Security Layer, Audit Layer, Analytics Engine, Provider Manager

---

### 3. Coach (Human)

**Role:** A human mentor or coach optionally assigned to a user for high-touch guidance.

**Responsibilities:**

- Review AI Coach recommendations and add human insight
- Provide personalized guidance beyond AI capabilities
- Intervene when users need human empathy
- Collaborate with AI Coach on user progress
- Document insights that improve the Knowledge Engine

**Interfaces with:** Coach Engine, Knowledge Engine, User DNA, Memory Engine

**Note:** The AI Coach handles 95%+ of coaching interactions. Human coaches are reserved for high-value, sensitive, or complex scenarios.

---

### 4. AI Providers (External Systems)

**Role:** External intelligence providers that supply raw AI capabilities (language understanding, generation, reasoning, code, images, etc.).

**Providers:**

| Provider           | Capabilities                             | When Used                    |
| ------------------ | ---------------------------------------- | ---------------------------- |
| OpenAI (GPT)       | Text generation, reasoning, code, vision | General intelligence         |
| Google (Gemini)    | Multimodal, reasoning, large context     | Complex reasoning            |
| Anthropic (Claude) | Safety, analysis, long documents         | Analysis tasks               |
| DeepSeek           | Code, reasoning, cost-effective          | Coding, cost-sensitive tasks |
| Ollama / Local     | On-device, privacy, offline              | Sensitive data, offline      |
| OpenRouter         | Aggregation, routing                     | Multi-provider routing       |

**Responsibilities:**

- Process prompts from AI Orchestrator
- Return generated responses
- Respect rate limits and usage policies
- Secure API key handling

**Interfaces with:** AI Orchestrator, Provider Manager

---

### 5. Knowledge Sources (External Systems)

**Role:** External repositories of information that VedMoulya ingests to build its Knowledge Graph.

**Examples:**

- Academic databases and journals
- Industry reports and market research
- Online course catalogs (Coursera, Udemy)
- Professional networks (LinkedIn)
- Public knowledge bases (Wikipedia, Wikidata)
- Publisher APIs (O'Reilly, Packt)
- Government labor statistics

**Responsibilities:**

- Provide structured and unstructured data
- Allow querying for relevant information
- Respect access controls and licensing

**Interfaces with:** Knowledge Engine, Knowledge Graph

---

### 6. Marketplace (External / Internal)

**Role:** The platform where users offer services, find clients, and transact value.

**Components:**

- Service listing catalog
- Client discovery and matching
- Transaction and escrow system
- Rating and review system
- Dispute resolution

**Responsibilities:**

- Enable service discovery
- Facilitate secure transactions
- Maintain trust and safety
- Generate earning opportunities

**Interfaces with:** Opportunity Engine, Recommendation Engine, Execution Engine

---

### 7. External APIs (External Systems)

**Role:** Third-party services that extend VedMoulya's capabilities.

**Examples:**

- Google Calendar (scheduling)
- Gmail (communication)
- LinkedIn (professional profile)
- GitHub (code portfolio)
- WhatsApp / Slack (messaging)
- Stripe / Razorpay (payments)

**Responsibilities:**

- Provide authenticated access to user data
- Enable cross-platform workflows
- Respect rate limits and usage policies

**Interfaces with:** Integration Points (system-wide)

---

### 8. Payment Providers (External Systems)

**Role:** Process financial transactions on the platform.

**Providers:** Stripe, Razorpay, and future providers.

**Responsibilities:**

- Process payments securely
- Handle subscriptions and recurring billing
- Manage payouts to users
- Provide transaction records
- Maintain PCI compliance

**Interfaces with:** Marketplace Engine, Earnings Engine, Audit Layer

---

### 9. Future Integrations

**Role:** Planned external systems for expansion.

**Candidates:**

- Calendar systems (scheduling integration)
- Email platforms (communication integration)
- Social platforms (network integration)
- Learning platforms (content integration)
- HR systems (enterprise integration)
- Banking APIs (financial integration)

**Interfaces with:** Integration Points, API Gateway

---

## Actor Interaction Matrix

| Actor             | Provides                    | Consumes                           | Bidirectional |
| ----------------- | --------------------------- | ---------------------------------- | ------------- |
| User              | Goals, feedback, activity   | Recommendations, guidance, content | Yes           |
| Admin             | Configuration, oversight    | Analytics, logs, alerts            | Yes           |
| Coach             | Human insight, empathy      | AI recommendations, user data      | Yes           |
| AI Providers      | Intelligence, generation    | Context, prompts                   | No            |
| Knowledge Sources | Information, data           | Queries                            | No            |
| Marketplace       | Opportunities, transactions | Listings, matches                  | Yes           |
| External APIs     | Data, services              | Requests, auth                     | Yes           |
| Payment Providers | Payment processing          | Payment requests                   | No            |

---

## Cross-References

- **VedMoulya Intelligence.md** — The intelligence layer that all actors interact with
- **Core Components.md** — The internal components that serve these actors
- **System Boundaries.md** — What is inside vs. outside the platform
- **Integration Points.md** — Detailed integration specifications
- **PRD-002 (User DNA)** — The user model that represents the User actor
- **PRD-001 (Human Journey)** — Journey stages contextualize which actors are relevant at each stage
- **RSH-001 (Human Problems)** — Validated problems define what actors need to solve
- **CMP-001** — Business context for marketplace and payment actors

### Future Expansion

- Autonomous AI agents as actors (non-human users)
- Enterprise tenants as actor groups
- Regulatory bodies as monitoring actors
- Developer ecosystem as actor (third-party developers building on VedMoulya)
- IoT and wearable device actors
- Voice assistant actors (Alexa, Google Home)
