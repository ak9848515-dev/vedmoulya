# Service Observability

**ENG-002 — Document 09/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Enterprise Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005, ENG-002/D01, ENG-002/D07, 03_Architecture/System/Monitoring/README.md, 03_Architecture/System/Logging/README.md

---

## Purpose

This document defines the **observability framework** for all services within the VedMoulya platform. It specifies the logging, metrics, tracing, health indicators, business metrics, operational metrics, audit requirements, and monitoring principles that every service must implement. Observability is not optional — it is a non-negotiable property of every service.

---

## Observability Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                   OBSERVABILITY PHILOSOPHY                               │
│                                                                         │
│  "A service that cannot be observed cannot be operated."                │
│                                                                         │
│  Every service emits:                                                    │
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐     │
│  │  LOGS    │    │ METRICS  │    │  TRACES  │    │   HEALTH     │     │
│  │ (events) │    │(numbers) │    │(requests)│    │  INDICATORS  │     │
│  └──────────┘    └──────────┘    └──────────┘    └──────────────┘     │
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐     │
│  │ BUSINESS │    │OPERATIONAL│   │  AUDIT   │    │  ALERTS      │     │
│  │ METRICS  │    │  METRICS  │   │  RECORDS │    │ (notifications)│    │
│  └──────────┘    └──────────┘    └──────────┘    └──────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Logging

### Logging Principles

1. **Log Everything Significant** — Every state change, every error, every decision boundary is logged
2. **Structured Logging** — Logs are structured (key-value pairs), not free-form text
3. **Log Levels are Meaningful** — Use appropriate levels (DEBUG, INFO, WARN, ERROR, FATAL)
4. **No Sensitive Data in Logs** — Never log credentials, tokens, or PII
5. **Correlation IDs** — Every log entry includes a correlation ID for request tracing

### Log Levels

| Level     | When Used                                                              | Example                                              |
| --------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| **DEBUG** | Detailed diagnostic information — not emitted in production by default | "Processing step 3 of decision algorithm"            |
| **INFO**  | Normal operational events that confirm service is working              | "Request processed successfully in 1.2s"             |
| **WARN**  | Something unexpected happened but service can continue                 | "Dependency response time exceeded threshold"        |
| **ERROR** | A failure occurred that affected a single request                      | "Failed to process request: invalid input format"    |
| **FATAL** | A failure occurred that affects the entire service                     | "Database connection lost — service cannot continue" |

### Required Log Events per Service

| Event Category           | Events to Log                                              | Level                   |
| ------------------------ | ---------------------------------------------------------- | ----------------------- |
| **Request Lifecycle**    | Request received, processing started, processing completed | INFO                    |
| **Request Failure**      | Request failed, validation error, authorization denied     | ERROR                   |
| **Dependency Call**      | Dependency request sent, response received, timeout        | DEBUG (WARN on failure) |
| **State Change**         | Command processed, state modified                          | INFO                    |
| **Event Emission**       | Event published                                            | DEBUG                   |
| **Health Change**        | Health status changed                                      | WARN                    |
| **Scaling Event**        | Scale up/down triggered                                    | INFO                    |
| **Configuration Change** | Configuration updated                                      | INFO                    |
| **Startup/Shutdown**     | Service started, initialized, draining, stopped            | INFO                    |

### Log Entry Structure

```text
Log Entry:
  - Timestamp: When the event occurred (ISO 8601, UTC)
  - Level: DEBUG | INFO | WARN | ERROR | FATAL
  - Service ID: Which service produced this log
  - Correlation ID: Trace identifier linking related events
  - Request ID: Identifier for the specific request (if applicable)
  - Message: Human-readable description
  - Event Type: Structured event identifier (e.g., "request.completed")
  - Metadata: Key-value pairs with additional context
  - Duration: How long the operation took (in milliseconds)
  - Error (if applicable): Error type, code, and details
```

---

## Metrics

### Metrics Principles

1. **RED Method** — Every service tracks Rate, Errors, and Duration for every contract type
2. **USE Method** — Every service tracks Utilization, Saturation, and Errors for resources
3. **Request-Level Metrics** — Metrics are tagged by contract type, status, and consumer
4. **Business-Level Metrics** — Metrics reflect business outcomes, not just technical performance
5. **Real-Time and Historical** — Metrics are available in real-time and stored for historical analysis

### Standard Service Metrics

Every service must emit the following metrics:

#### RED Metrics (Request Level)

| Metric                 | Description                             | Tags                                        |
| ---------------------- | --------------------------------------- | ------------------------------------------- |
| `requests.total`       | Total number of requests received       | contract_type, consumer_service             |
| `requests.success`     | Number of successful requests           | contract_type, consumer_service             |
| `requests.error`       | Number of failed requests               | contract_type, consumer_service, error_type |
| `requests.duration_ms` | Request processing time in milliseconds | contract_type, consumer_service, status     |
| `requests.latency_p50` | 50th percentile latency                 | contract_type, consumer_service             |
| `requests.latency_p95` | 95th percentile latency                 | contract_type, consumer_service             |
| `requests.latency_p99` | 99th percentile latency                 | contract_type, consumer_service             |

#### USE Metrics (Resource Level)

| Metric                         | Description                   | Tags            |
| ------------------------------ | ----------------------------- | --------------- |
| `resources.cpu.utilization`    | CPU utilization percentage    | resource_type   |
| `resources.memory.utilization` | Memory utilization percentage | resource_type   |
| `resources.memory.used_bytes`  | Memory used in bytes          | resource_type   |
| `resources.connections.active` | Number of active connections  | connection_type |
| `resources.connections.idle`   | Number of idle connections    | connection_type |
| `resources.connections.errors` | Connection error count        | connection_type |
| `resources.queue.depth`        | Current request queue depth   | priority        |
| `resources.queue.duration_ms`  | Time requests spend in queue  | priority        |

#### Dependency Metrics

| Metric                             | Description                                   | Tags                                    |
| ---------------------------------- | --------------------------------------------- | --------------------------------------- |
| `dependency.requests.total`        | Total requests to dependency                  | dependency_service, dependency_contract |
| `dependency.requests.success`      | Successful requests to dependency             | dependency_service                      |
| `dependency.requests.error`        | Failed requests to dependency                 | dependency_service, error_type          |
| `dependency.requests.duration_ms`  | Dependency response time                      | dependency_service                      |
| `dependency.circuit_breaker.state` | Circuit breaker state (closed/open/half-open) | dependency_service                      |

### Business Metrics by Service

| Service          | Key Business Metrics                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Identity         | `users.registered`, `users.active`, `users.authenticated`, `auth.failures`               |
| DNA              | `dna.dimensions.updated`, `dna.assessments.completed`, `dna.confidence.avg`              |
| Knowledge        | `knowledge.entities.added`, `knowledge.queries.results`, `knowledge.quality.avg`         |
| Memory           | `memory.records.stored`, `memory.recalls.successful`, `memory.consolidations.completed`  |
| Context          | `context.snapshots.created`, `context.dimensions.changed`                                |
| Decision         | `decisions.made`, `decisions.accepted`, `decisions.rejected`, `decisions.confidence.avg` |
| Planning         | `goals.created`, `plans.generated`, `plans.adapted`, `goals.completed`                   |
| Execution        | `tasks.completed`, `tasks.blocked`, `execution.completion_rate`, `execution.velocity`    |
| Recommendation   | `recommendations.served`, `recommendations.clicked`, `recommendations.feedback.score`    |
| Career           | `career.paths.explored`, `career.goals.set`, `career.transitions.started`                |
| Learning         | `learning.paths.started`, `learning.modules.completed`, `learning.skills.improved`       |
| Business         | `businesses.registered`, `clients.acquired`, `business.milestones.reached`               |
| Finance          | `income.recorded`, `expenses.recorded`, `financial.goals.met`                            |
| Health           | `health.checks.completed`, `burnout.alerts.sent`, `wellness.scores.avg`                  |
| Marketplace      | `listings.created`, `transactions.completed`, `disputes.filed`                           |
| Progress         | `hpi.scores.updated`, `plateaus.detected`, `progress.trends.changed`                     |
| Notification     | `notifications.sent`, `notifications.delivered`, `notifications.clicked`                 |
| Analytics        | `events.processed`, `reports.generated`, `anomalies.detected`                            |
| AI Orchestration | `ai.requests.total`, `ai.requests.success`, `ai.cost.total`, `ai.latency.avg`            |
| Security         | `auth.attempts`, `auth.failures`, `threats.detected`, `keys.rotated`                     |
| Audit            | `audit.records.created`, `audit.queries.processed`, `compliance.checks.passed`           |

---

## Tracing

### Tracing Principles

1. **Distributed Tracing Across Services** — Every request that crosses service boundaries is traced
2. **Trace IDs Propagate** — Trace IDs are propagated across all service calls
3. **Span Hierarchies** — Each service call creates a span within the trace
4. **Metadata Annotations** — Spans carry relevant metadata (decision ID, entity ID, user ID anonymized)
5. **Sampling Strategy** — 100% of errors are traced; 10% of successful requests are sampled

### Trace Structure

```text
Trace: correlation-id-abc-123
  ├── Span: User Interface → Recommendation Service (2.1s)
  │     ├── Metadata: user_id(anonymized), page_context
  │     │
  │     ├── Span: Recommendation Service → DNA Service (0.3s)
  │     │     └── Metadata: dna_dimensions_requested
  │     │
  │     ├── Span: Recommendation Service → Knowledge Service (0.5s)
  │     │     └── Metadata: query_terms, num_results
  │     │
  │     ├── Span: Recommendation Service → Decision Service (0.8s)
  │     │     ├── Metadata: decision_type, num_options
  │     │     └── Span: Decision Service → AI Orchestration (0.4s)
  │     │           └── Metadata: provider, tokens_used
  │     │
  │     └── Span: Recommendation Service → Memory Service (0.1s)
  │           └── Metadata: memory_dimensions
  │
  └── Total: 2.1s (user-perceived latency)
```

### Sampling Strategy

| Request Type              | Trace Sampling Rate   | Rationale                         |
| ------------------------- | --------------------- | --------------------------------- |
| Successful requests       | 10%                   | Enough for performance analysis   |
| Failed requests           | 100%                  | Must be fully debuggable          |
| Error-generating requests | 100%                  | Must understand root cause        |
| High-priority requests    | 100%                  | Always trace important operations |
| New contract versions     | 100% (initial period) | Validate new contract behavior    |

---

## Health Indicators

### Service Health Dimensions

| Dimension             | What It Measures                | Healthy Threshold    | Degraded               | Unhealthy               |
| --------------------- | ------------------------------- | -------------------- | ---------------------- | ----------------------- |
| **Availability**      | Service is accessible           | Health check passes  | 1/3 health checks fail | 2/3 health checks fail  |
| **Responsiveness**    | Service responds in time        | p95 < 500ms          | p95 between 500ms-2s   | p95 > 2s                |
| **Correctness**       | Service returns correct results | Error rate < 1%      | Error rate 1-5%        | Error rate > 5%         |
| **Capacity**          | Service has headroom            | CPU < 70%, Mem < 70% | CPU 70-85%, Mem 70-85% | CPU > 85%, Mem > 85%    |
| **Dependency Health** | Dependencies are available      | All healthy          | 1 dependency degraded  | 1+ dependency unhealthy |

### Health Score

Each service computes a **health score** (0-100) based on its dimensions:

```text
Health Score = Σ(dimension_score × dimension_weight) / Σ(dimension_weights)

Weights:
  - Availability: 30%
  - Responsiveness: 20%
  - Correctness: 25%
  - Capacity: 15%
  - Dependency Health: 10%

Status:
  - Healthy:      Score >= 80
  - Degraded:     Score >= 50 and < 80
  - Unhealthy:    Score < 50
```

---

## Business Metrics

### Business Metrics Philosophy

Business metrics measure **what matters to the organization**, not what matters to the operations team. They answer questions like:

- "How many users are making progress on their goals?"
- "What is the recommendation acceptance rate?"
- "How many transactions are happening on the platform?"
- "What is the cost per AI request?"

### Business Metric Reporting

| Reporting Cadence | Description                                                      | Audience            |
| ----------------- | ---------------------------------------------------------------- | ------------------- |
| **Real-time**     | Key business metrics available on dashboards with < 1 minute lag | Product, Operations |
| **Daily**         | Daily snapshots of key business metrics                          | Product, Management |
| **Weekly**        | Trend analysis and week-over-week comparisons                    | Product, Management |
| **Monthly**       | Monthly business review and KPI tracking                         | Executive, Board    |

---

## Operational Metrics

### Operational Metrics Categories

| Category           | What It Measures                          | Examples                                                |
| ------------------ | ----------------------------------------- | ------------------------------------------------------- |
| **Service Health** | How healthy is each service?              | Health score, availability %, degraded time             |
| **Capacity**       | How much headroom does each service have? | CPU %, memory %, connection pool %, queue depth         |
| **Throughput**     | How much work is each service doing?      | Requests/sec, events/sec, tasks completed/sec           |
| **Performance**    | How fast is each service?                 | Latency p50/p95/p99, processing time                    |
| **Reliability**    | How reliable is each service?             | Error rate, uptime %, recovery time                     |
| **Cost**           | How much does each service cost to run?   | Infrastructure cost, AI provider cost, per-request cost |

### Operational Metric Dashboard

Every service must have an operational dashboard that shows:

```text
OPERATIONAL DASHBOARD — [Service Name]
═══════════════════════════════════════

CURRENT STATUS: Healthy  |  UPTIME: 99.97% (30d)  |  VERSION: 2.3.1

┌─────────────────────┬────────────┬──────────┬──────────┐
│ Metric              │ Current    │ 1h ago   │ 24h ago  │
├─────────────────────┼────────────┼──────────┼──────────┤
│ Requests/sec        │ 245        │ 220      │ 198      │
│ Error rate          │ 0.3%       │ 0.5%     │ 0.8%     │
│ p95 latency         │ 180ms      │ 210ms    │ 195ms    │
│ CPU utilization     │ 45%        │ 42%      │ 38%      │
│ Memory utilization  │ 62%        │ 60%      │ 55%      │
└─────────────────────┴────────────┴──────────┴──────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ TOP ERRORS (last 24h)                                                │
│                                                                     │
│ 1. Validation errors: 142 (52%)                                     │
│ 2. Dependency timeouts: 68 (25%)                                    │
│ 3. Authorization denials: 45 (16%)                                  │
│ 4. Internal errors: 18 (7%)                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Audit

### Audit Principles

1. **Immutable** — Audit records cannot be modified or deleted
2. **Complete** — All significant state changes are recorded
3. **Traceable** — Each audit record links to the request that caused it
4. **Retained** — Audit records are retained according to regulatory requirements
5. **Queryable** — Audit records can be searched and analyzed

### Audit Events

| Event Category        | Events to Audit                                              | Audit Detail                                    |
| --------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| **Identity**          | User registered, authenticated, deleted, permissions changed | Identity ID, timestamp, action, IP address      |
| **DNA**               | DNA dimension updated, assessment completed                  | User ID (anonymized), dimension, source         |
| **Data Modification** | Knowledge added, goals created, plans modified               | Entity ID, change type, previous state hash     |
| **Decision**          | Decision made, decision overridden                           | Decision ID, type, selected option, confidence  |
| **Financial**         | Transaction recorded, payment processed                      | Transaction ID, amount, status                  |
| **Security**          | Authorization denied, threat detected, key rotated           | Actor, action, resource, reason                 |
| **Configuration**     | Service configuration changed, provider updated              | Service ID, changed parameter, previous value   |
| **Contract**          | Contract version changed, consumer registered                | Contract ID, old version, new version, consumer |

### Audit Record Structure

```text
Audit Record:
  - Audit ID: Unique identifier for this record
  - Timestamp: When the event occurred (ISO 8601, UTC)
  - Event Type: Category + action (e.g., "dna.dimension.updated")
  - Actor: Who performed the action (user ID, service ID, or system)
  - Target: What was affected (entity ID, service name)
  - Action: What was done (created, updated, deleted, accessed)
  - Change Summary: Description of what changed
  - Previous State Hash: Cryptographic hash of previous state (for integrity)
  - New State Hash: Cryptographic hash of new state
  - Correlation ID: Link to the request trace
  - Reason: Why the action was taken (if available)
  - Metadata: Additional context (version, location, etc.)
```

---

## Monitoring Principles

### Principle 1: Monitor Everything That Matters

Every dimension of every service is monitored. If it can be measured, it should be monitored. If it cannot be measured, it cannot be managed.

### Principle 2: Alert on Symptoms, Not Causes

Alerts should notify operators about user-facing symptoms (errors, latency), not internal causes (CPU high). Causes are discovered through investigation, not alerting.

### Principle 3: Alert Fatigue is Dangerous

Every alert must be actionable. If an alert does not require human action, it should be a log entry, not an alert. Alert fatigue causes operators to miss critical alerts.

### Principle 4: Dashboards for Diagnosis, Alerts for Action

Dashboards help operators understand the current state. Alerts tell operators when they need to act. They serve different purposes and should be designed accordingly.

### Principle 5: Every Alert Has a Runbook

Every alert must link to a runbook that tells the operator:

1. What does this alert mean?
2. How do I investigate?
3. How do I fix it?
4. How do I verify the fix?
5. Who do I escalate to?

### Alert Severity Levels

| Level        | Response Time | Example                                | Action Required                        |
| ------------ | ------------- | -------------------------------------- | -------------------------------------- |
| **CRITICAL** | < 5 minutes   | Service unavailable, data loss         | Immediate investigation                |
| **MAJOR**    | < 15 minutes  | Error rate > 5%, p99 latency > 2s      | Priority investigation                 |
| **WARNING**  | < 1 hour      | Error rate > 1%, CPU > 80%             | Investigation before next business day |
| **INFO**     | < 1 day       | Health score degraded, dependency slow | Investigation when convenient          |

### Monitoring Stack Components

| Component               | Purpose                                       | Responsible Owner   |
| ----------------------- | --------------------------------------------- | ------------------- |
| **Metrics Collection**  | Collect and store time-series metrics         | Infrastructure Team |
| **Log Aggregation**     | Collect, store, and search logs               | Infrastructure Team |
| **Distributed Tracing** | Collect and visualize traces                  | Infrastructure Team |
| **Alerting**            | Evaluate alert rules and notify operators     | Operations Team     |
| **Dashboards**          | Service-specific and cross-service dashboards | Service Teams       |
| **Health Checks**       | Service health endpoints                      | Service Teams       |
| **SLA Monitoring**      | Track SLA compliance                          | Operations Team     |

---

## Cross-References

| Reference                                   | Relationship                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| ARC-001                                     | Architecture Principle #10 (Observable) — observability is a core principle       |
| ARC-002                                     | Decision Service observability includes decision outcome tracking                 |
| ARC-003                                     | Knowledge Service observability includes knowledge quality metrics                |
| ARC-004                                     | Execution Service observability includes execution progress metrics               |
| ARC-005                                     | AI Orchestration Service observability includes provider cost and quality metrics |
| ENG-002/D07                                 | Service lifecycle transitions are observable — this document defines how          |
| 03_Architecture/System/Monitoring/README.md | Infrastructure-level monitoring platform                                          |
| 03_Architecture/System/Logging/README.md    | Infrastructure-level logging platform                                             |
| CMP-001                                     | "Systems before shortcuts" — observability must be systematic, not ad-hoc         |
