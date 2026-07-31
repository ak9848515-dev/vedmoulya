# Integration Points

**Mission:** Document every current and planned external integration for the VedMoulya Intelligence Platform.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Enterprise Architect
**Dependencies:** System Boundaries.md, Core Components.md, System Context.md
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

VedMoulya integrates with a rich ecosystem of external services. This document defines each integration point, its purpose, the data exchanged, the integration pattern, and the priority. No integration implementation is provided — only specifications.

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      VEDMOULYA PLATFORM                              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    API GATEWAY                                 │  │
│  │  (Authentication, Rate Limiting, Routing, Transformation)     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                    │              │              │                  │
│     ┌──────────────┼──────────────┼──────────────┼──────┐          │
│     ▼              ▼              ▼              ▼      ▼          │
│  ┌──────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐            │
│  │ AI   │   │ External │   │ Payment  │   │ Calendar │   ...more  │
│  │ APIs │   │ APIs     │   │ APIs     │   │ APIs     │            │
│  └──────┘   └──────────┘   └──────────┘   └──────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Integration Categories

### Category 1: AI Providers

These are the external intelligence providers that plug into the AI Orchestrator.

| Provider               | Purpose                                                        | Authentication | Priority | Status  |
| ---------------------- | -------------------------------------------------------------- | -------------- | -------- | ------- |
| **OpenAI (GPT)**       | General intelligence, text generation, reasoning, code, vision | API Key        | P0       | Planned |
| **Google (Gemini)**    | Multimodal AI, reasoning, large context                        | API Key        | P0       | Planned |
| **Anthropic (Claude)** | Analysis, safety-focused tasks, long documents                 | API Key        | P1       | Planned |
| **DeepSeek**           | Code generation, reasoning, cost-effective inference           | API Key        | P1       | Planned |
| **OpenRouter**         | Provider aggregation, routing, fallback management             | API Key        | P1       | Planned |
| **Ollama**             | Local/on-device AI, privacy-sensitive tasks, offline           | Local API      | P2       | Planned |

**Integration Pattern:** Async request-response via AI Orchestrator

**Data Exchanged:**

- **In:** Context bundles (user DNA, memory, knowledge, prompt)
- **Out:** Generated text, structured data, reasoning traces

**Error Handling:**

- Provider failure → Automatic fallback to next provider
- Rate limiting → Queue and retry with backoff
- Timeout → Circuit breaker, alert admin

**Security:**

- API keys stored in secrets manager (never in code)
- All communication over HTTPS
- Request/response logged for audit (content optionally excluded)

---

### Category 2: Backend / Infrastructure

| Service                  | Purpose                                                     | Authentication  | Data                       | Priority |
| ------------------------ | ----------------------------------------------------------- | --------------- | -------------------------- | -------- |
| **Firebase**             | Authentication, push notifications, real-time data sync     | Service Account | User accounts, auth tokens | P0       |
| **Supabase**             | PostgreSQL database, auth, storage, real-time subscriptions | Service Account | User data, DNA, profiles   | P0       |
| **Google Cloud Storage** | File and media storage                                      | Service Account | Portfolio files, images    | P1       |

**Integration Pattern:** SDK-based direct integration

---

### Category 3: Professional & Social Platforms

| Platform            | Purpose                                                                  | Auth      | Data Exchanged                             | Priority |
| ------------------- | ------------------------------------------------------------------------ | --------- | ------------------------------------------ | -------- |
| **LinkedIn**        | Profile import, job discovery, professional network connection           | OAuth 2.0 | Skills, experience, education, connections | P1       |
| **GitHub**          | Portfolio import, code skill assessment                                  | OAuth 2.0 | Repositories, languages, contributions     | P2       |
| **Google Calendar** | Schedule management, time blocking                                       | OAuth 2.0 | Events, availability, reminders            | P2       |
| **Gmail**           | Email-based workflow integration (invoice sending, client communication) | OAuth 2.0 | Email metadata (with consent)              | P2       |

**Integration Pattern:** OAuth 2.0 delegated access

**Data Exchanged:**

- Read user profile data with explicit consent
- Write events, messages on user's behalf with explicit permission

**Security:**

- OAuth tokens stored encrypted
- Scope-limited permissions (least privilege)
- User revocable at any time

---

### Category 4: Communication Platforms

| Platform     | Purpose                                   | Auth      | Priority |
| ------------ | ----------------------------------------- | --------- | -------- |
| **WhatsApp** | Conversational AI access, notifications   | API Key   | P2       |
| **Slack**    | Team collaboration, workflow integrations | OAuth 2.0 | P2       |
| **Telegram** | Bot-based AI access                       | Bot Token | P3       |

**Integration Pattern:** Webhook + REST API

**Use cases:**

- Send daily progress summaries
- Receive voice/text queries via preferred channel
- Notify on milestone completions

---

### Category 5: Payment Providers

| Provider     | Purpose                                                       | Auth              | Priority |
| ------------ | ------------------------------------------------------------- | ----------------- | -------- |
| **Stripe**   | Global payment processing, subscriptions, marketplace payouts | API Key + Webhook | P1       |
| **Razorpay** | India-focused payment processing (UPI, net banking, cards)    | API Key + Webhook | P1       |

**Integration Pattern:** REST API + Webhook events

**Data Exchanged:**

- **In:** Payment requests, customer data
- **Out:** Payment confirmations, refunds, disputes
- **Webhooks:** Payment success, failure, refund, dispute

**Security:**

- PCI DSS compliance handled by provider (tokenization)
- No raw credit card data stored on VedMoulya
- Webhook signatures verified
- All transactions logged for audit

---

### Category 6: Knowledge & Content Sources

| Source                    | Purpose                                            | Auth       | Priority |
| ------------------------- | -------------------------------------------------- | ---------- | -------- |
| **Coursera**              | Course catalog import for learning recommendations | API Key    | P2       |
| **Udemy**                 | Course catalog import                              | API Key    | P2       |
| **Wikipedia / Wikidata**  | Knowledge graph enrichment                         | Public API | P1       |
| **Industry report APIs**  | Market data, trends, salary data                   | Various    | P2       |
| **Government labor APIs** | Job market statistics, skills demand               | Public API | P2       |

**Integration Pattern:** REST API, scheduled sync

**Data Exchanged:**

- Course metadata, skill mapping, pricing
- Entity definitions, relationship data
- Market statistics, salary ranges

---

### Category 7: Developer Ecosystem (Future)

| Integration              | Purpose                                                      | Priority |
| ------------------------ | ------------------------------------------------------------ | -------- |
| **VedMoulya Public API** | Expose platform capabilities to third-party developers       | P3       |
| **Webhook System**       | Allow external services to subscribe to events               | P3       |
| **Plugin SDK**           | Allow third-party plugins for recommendation, coaching, etc. | P4       |

**Integration Pattern:** REST + Webhook + SDK

---

## Integration Priority Matrix

| Priority | Definition              | Example                                      | Timeline |
| -------- | ----------------------- | -------------------------------------------- | -------- |
| **P0**   | Required for MVP        | Firebase, Supabase, GPT, Gemini              | Launch   |
| **P1**   | Required for v1.0       | Claude, DeepSeek, Stripe, Razorpay, LinkedIn | v1.0     |
| **P2**   | Post-launch enhancement | GitHub, Calendar, WhatsApp, Slack, Gmail     | v1.1+    |
| **P3**   | Future roadmap          | Public API, Webhook system, Telegram         | v2.0+    |
| **P4**   | Long-term vision        | Plugin SDK, custom integrations              | v3.0+    |

---

## Integration Design Standards

### Authentication

| Method            | When to Use                                   |
| ----------------- | --------------------------------------------- |
| API Key           | Server-to-server, single-tenant integrations  |
| OAuth 2.0         | User-delegated access to third-party services |
| Service Account   | Google Cloud / Firebase integrations          |
| JWT               | Internal service-to-service communication     |
| Webhook Signature | Verifying incoming webhook authenticity       |

### Error Handling

All integrations must implement:

1. **Retry with exponential backoff** — Transient failures
2. **Circuit breaker** — Repeated failures trigger cool-down
3. **Fallback** — Alternative provider or graceful degradation
4. **Alerting** — Integration failures alert operations team
5. **Audit logging** — All integration requests and responses logged

### Rate Limiting

- Respect provider rate limits at all times
- Queue requests when approaching limits
- Alert when consistently hitting rate limits
- Consider provider health in routing decisions

---

## Integration Configuration

Each integration requires:

1. **Provider registration** in Provider Manager (for AI providers) or Integration Registry
2. **Credential management** via secrets manager
3. **Health monitoring** with regular ping/health check
4. **Usage tracking** for cost allocation and capacity planning
5. **Documentation** link to external provider's API docs

## Cross-References

- **System Boundaries.md** — What's inside vs. outside (integrations cross the boundary)
- **Core Components.md** — Components that use these integrations
- **System Context.md** — Actors that these integrations connect to
- **Architecture Principles.md** — Principles governing integration design
- **VedMoulya Intelligence.md** — Provider agnosticism philosophy
- **PRD-002 (User DNA)** — User data from integrations enriches DNA dimensions
- **PRD-001 (Human Journey)** — Integrations enable journey stage-appropriate functionality
- **RSH-001 (Human Problems)** — Integrations provide data to validate and solve human problems
- **CMP-001** — Business context for integration priorities

### Future Expansion

- **Integration marketplace** — Third-party developers can publish integrations
- **Custom webhook builder** — Users can define their own integration triggers
- **Low-code integration builder** — Visual integration configuration
- **Integration health dashboard** — Real-time status of all integrations
- **API monetization** — Charge for API access
- **Partner integration program** — Certified integration partners
