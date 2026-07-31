# Fallback & Resilience

**ARC-005 — Document 07/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief AI Orchestration Architect
**Created:** 2026-07-24
**Cross-references:** ARC-005/D01, ARC-005/D02, ARC-005/D03, ARC-005/D06, ARC-001

---

## Purpose

Fallback & Resilience defines how VedMoulya **handles failures** in AI provider interactions. Providers fail — that is expected. What matters is that the user never experiences disruption.

---

## Scope

This document covers the conceptual resilience model. It does NOT define specific retry algorithms, timeout values, or circuit breaker implementations.

---

## Dependencies

- **ARC-005/D01** — AI Orchestration (overall system context)
- **ARC-005/D02** — Provider Management (provider health data)
- **ARC-005/D03** — Capability Routing (alternative routing for fallback)
- **ARC-005/D06** — Cost & Performance (fallback providers may have different cost profiles)

---

## Failure Modes

```
                    ┌──────────────────────────────────────┐
                    │         FAILURE MODES                │
                    ├──────────────────────────────────────┤
                    │  Provider Unavailable                │
                    │  Timeout                             │
                    │  Low Confidence Response             │
                    │  Policy Violation                    │
                    │  Rate Limited                        │
                    │  Invalid Response                    │
                    │  Quality Below Threshold             │
                    └──────────────────────────────────────┘
```

### Mode 1: Provider Unavailable

**Description:** The provider server is not reachable (down, network issue, outage).

**Detection:** Health monitoring or request failure.

**Response:**

- Immediate failover to alternative provider
- No retry to the same provider
- Log outage for monitoring

### Mode 2: Timeout

**Description:** The provider did not respond within the expected time.

**Detection:** Timer exceeds threshold.

**Response:**

- Retry once (may be transient)
- If retry fails, failover to alternative provider
- Adjust routing scores for slow provider

### Mode 3: Low Confidence Response

**Description:** The provider returned a response that the Response Validator scored below the confidence threshold.

**Detection:** Response Validation scoring.

**Response:**

- If score is slightly below threshold → retry with modified prompt
- If score is far below threshold → failover to alternative provider
- If all providers return low confidence → return best with low confidence flag

### Mode 4: Policy Violation

**Description:** The provider's response violated VedMoulya policies (safety, ethics, content).

**Detection:** Response Validation policy check.

**Response:**

- Immediate failover (do not retry violating provider)
- Log violation for provider quality assessment
- Reduce routing score for violating provider

### Mode 5: Rate Limited

**Description:** The provider rejected the request due to rate limits.

**Detection:** Provider returns rate limit error.

**Response:**

- Backoff and retry after rate limit window
- If urgent, failover to alternative provider immediately
- Reduce routing score for rate-limited provider

### Mode 6: Invalid Response

**Description:** The provider returned malformed, empty, or unusable response.

**Detection:** Response format validation.

**Response:**

- Retry once (may be transient)
- If repeated, failover to alternative provider

### Mode 7: Quality Below Threshold

**Description:** The provider's response quality is consistently below the expected standard.

**Detection:** Quality scoring over time.

**Response:**

- Reduce routing score
- Route to higher-quality providers
- Flag provider for review

---

## Fallback Hierarchy

```
                    ┌──────────────────────────────────────┐
                    │     PRIMARY PROVIDER                 │
                    │  (Best quality/cost balance)         │
                    └──────────────┬───────────────────────┘
                                   │ Failure
                                   ▼
                    ┌──────────────────────────────────────┐
                    │     SECONDARY PROVIDER               │
                    │  (Next best alternative)              │
                    └──────────────┬───────────────────────┘
                                   │ Failure
                                   ▼
                    ┌──────────────────────────────────────┐
                    │     TERTIARY PROVIDER                │
                    │  (Any available provider)             │
                    └──────────────┬───────────────────────┘
                                   │ All Providers Failed
                                   ▼
                    ┌──────────────────────────────────────┐
                    │     GRACEFUL DEGRADATION             │
                    │  (Fallback response without AI)      │
                    └──────────────────────────────────────┘
```

---

## Resilience Strategies

### Retry Strategy

```
Request Failed
    │
    ├── Is retryable? (transient error?)
    │       │
    │       ├── Yes → Is within retry limit?
    │       │           │
    │       │           ├── Yes → Wait → Retry
    │       │           └── No  → Failover
    │       │
    │       └── No → Failover immediately
    │
    └── Log error for analysis
```

**Retry parameters:**

- Maximum retries: 2
- Retry delay: Exponential backoff (1s, 2s)
- Retry only for transient errors (timeout, rate limit)
- Never retry for policy violations or invalid responses

### Circuit Breaker

If a provider fails repeatedly, the circuit breaker prevents further requests:

```
Closed (normal) → Failure Threshold Exceeded → Open (stop requests)
        ↑                                            │
        │                                            ▼
        └────── Recovery Time Elapsed ←────── Half-Open (test request)
```

| State         | Behavior                             |
| ------------- | ------------------------------------ |
| **Closed**    | Requests flow normally               |
| **Open**      | Requests blocked, immediate fallback |
| **Half-Open** | Test request sent to verify recovery |

### Timeout Management

| Timeout Type           | Duration              | Action                    |
| ---------------------- | --------------------- | ------------------------- |
| **Connection timeout** | 5 seconds             | Retry, then failover      |
| **Response timeout**   | 30 seconds (standard) | Retry, then failover      |
| **Stream timeout**     | 60 seconds            | Partial response handling |
| **Total timeout**      | 120 seconds           | Failover                  |

---

## Graceful Degradation

When ALL providers fail, the system degrades gracefully:

### Degradation Levels

| Level               | User Experience                   | What Works                                  |
| ------------------- | --------------------------------- | ------------------------------------------- |
| **Full service**    | Normal operation                  | Everything                                  |
| **Reduced service** | Slower responses, simpler outputs | Core capabilities                           |
| **Minimal service** | AI-assisted features unavailable  | Knowledge Graph queries, execution tracking |
| **Offline mode**    | No AI features                    | Local data access, previous responses       |

### Degradation Responses

| Scenario                    | Degraded Response                           |
| --------------------------- | ------------------------------------------- |
| Text generation unavailable | Return cached/similar previous response     |
| Code generation unavailable | Return template-based code                  |
| Analysis unavailable        | Return stored analysis from Knowledge Graph |
| Embeddings unavailable      | Use keyword-based search instead            |
| Vision unavailable          | Inform user, offer text-only alternative    |

### User Communication

When degradation occurs, the user is informed:

- What happened (provider issue)
- What is affected (which features are reduced)
- What is available (which features still work)
- When full service is expected to resume

---

## Resilience Testing

| Test                           | Frequency | Purpose                                       |
| ------------------------------ | --------- | --------------------------------------------- |
| **Chaos testing**              | Monthly   | Random provider failures to validate fallback |
| **Latency injection**          | Monthly   | Test behavior under slow conditions           |
| **Provider outage simulation** | Quarterly | Full failover testing                         |
| **Degradation scenario**       | Quarterly | Test graceful degradation paths               |

---

## Future Expansion

- **Predictive failover** — Detect degradation signs and failover before failure
- **Multi-region failover** — Geographic provider redundancy
- **Cross-capability fallback** — Fallback to different capability if primary unavailable
- **User-aware degradation** — Prioritize premium users during partial outages
- **Self-healing** — Automatic recovery and re-routing after outage resolution
