# Observability Platform

**BLP-002 — Document 09/15 — Technology Stack & Platform Decisions**
**Version:** 1.0
**Status:** LOCKED
**Owner:** DevOps Lead
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines the **observability technology stack** for VedMoulya — monitoring, logging, tracing, alerting, and dashboard infrastructure.

---

## Decision Summary

| Decision         | Choice                                                  | Status     |
| ---------------- | ------------------------------------------------------- | ---------- |
| Monitoring       | **Grafana Cloud** (free tier) + **Better Stack Uptime** | ✅ DECIDED |
| Logging          | **Structured JSON logging** → **Grafana Loki**          | ✅ DECIDED |
| Tracing          | **OpenTelemetry** → **Grafana Tempo**                   | ✅ DECIDED |
| Metrics          | **OpenTelemetry** → **Grafana Mimir** / **Prometheus**  | ✅ DECIDED |
| Dashboards       | **Grafana**                                             | ✅ DECIDED |
| Alerting         | **Grafana OnCall** / **PagerDuty** (future)             | ✅ DECIDED |
| Health Checks    | **Hono health endpoint** (standardized)                 | ✅ DECIDED |
| AI Observability | **Langfuse** (LLM observability)                        | ✅ DECIDED |

---

## Observability Stack

### Architecture

```text
Application → OpenTelemetry SDK → OpenTelemetry Collector → Grafana Cloud
                    │                        │
                    ├── Traces → Tempo        ├── Traces
                    ├── Metrics → Prometheus  ├── Metrics
                    └── Logs → Loki           └── Logs
```

### Standard Observability Interface

Every service exposes the following at minimum:

```text
GET /health           — Service health (OK/DEGRADED/DOWN)
GET /metrics          — Prometheus metrics
GET /ready            — Readiness check (dependencies available)
Logs to stdout        — Structured JSON with correlation ID
```

---

## Decision Summary

### Monitoring: Grafana Cloud

| Aspect      | Detail                                                                             |
| ----------- | ---------------------------------------------------------------------------------- |
| **Choice**  | Grafana Cloud free tier (dashboards + alerts) + Better Stack for uptime monitoring |
| **Purpose** | Service health monitoring, dashboard visualization, alerting                       |

### Logging: Structured JSON → Loki

| Aspect       | Detail                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------- |
| **Approach** | All services log structured JSON to stdout. OpenTelemetry collector forwards to Loki.         |
| **Format**   | `{"timestamp":"...","level":"info","service":"career","correlationId":"...","message":"..."}` |

### Tracing: OpenTelemetry → Tempo

| Aspect       | Detail                                                                             |
| ------------ | ---------------------------------------------------------------------------------- |
| **Approach** | OpenTelemetry SDK instruments all services. Traces sent to Grafana Tempo via OTLP. |
| **Sampling** | 100% for errors, 10% for successful requests (head-based sampling)                 |

---

## Architecture References

| Reference     | Relationship                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| BLP-001 / D02 | Engineering Principle #9 (Observability) — every service exposes health, metrics, traces from day one |

---

## Cross-References

| Reference     | Relationship                                                |
| ------------- | ----------------------------------------------------------- |
| BLP-002 / D07 | Observability infrastructure deployed via CI/CD             |
| BLP-002 / D12 | Decision Record — TDR-009 (Observability Platform Decision) |
| BLP-001 / D08 | Quality Gate #5 (Performance) uses observability data       |

---

## Quality Review

| Dimension              | Assessment                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Why**                | Observability is essential for debugging, performance optimization, and incident response in a distributed system. |
| **Business Impact**    | Grafana dashboards provide real-time visibility into system health and user experience.                            |
| **Engineering Impact** | OpenTelemetry standard means single instrumentation for metrics, traces, and logs.                                 |
| **Operational Impact** | Grafana Cloud free tier covers MVP. Zero self-hosted infrastructure.                                               |
| **Security Impact**    | Audit events are logged with correlation IDs for complete traceability.                                            |
| **Performance Impact** | OpenTelemetry overhead is <5%. Head-based sampling controls trace volume.                                          |
| **Cost Impact**        | Grafana Cloud free tier (3 users, 10k series, 14 day retention).                                                   |
| **Future Scalability** | OpenTelemetry is vendor-neutral. Can self-host Grafana stack at scale.                                             |

---

## Design Freeze Status

| Status    | Date       | Notes                                                             |
| --------- | ---------- | ----------------------------------------------------------------- |
| ✅ LOCKED | 2026-07-27 | Observability Platform v1.0 frozen. Changes require CTO approval. |
