# Cloud & Deployment

**TECH-001 — Document 07/10 — Technology Decision Record**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Technology Officer (CTO)
**Created:** 2026-07-27
**Cross-references:** CMP-001, CMP-002, ARC-001, ENG-004/D08, IMP-001/D02, IMP-001/D06

---

## Purpose

This TDR defines the **cloud and deployment strategy** for VedMoulya — how the platform is hosted, scaled, and operated from MVP through enterprise, while remaining provider-agnostic and avoiding lock-in.

---

## Deployment Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT PHILOSOPHY                                       │
│                                                                               │
│  1. CLOUD-FIRST, NOT CLOUD-ONLY — Cloud is the primary deployment for MVP.   │
│     On-premise and offline modes are additive, not alternative.               │
│                                                                               │
│  2. STANDARD INFRASTRUCTURE — Use standard services (compute, storage,       │
│     network). Avoid provider-specific managed services unless abstractable.   │
│                                                                               │
│  3. INFRASTRUCTURE AS CODE — Every environment is defined in code.            │
│     No manual infrastructure changes.                                         │
│                                                                               │
│  4. CONTAINERS EVERYWHERE — Applications run in containers.                   │
│     Environments are container orchestrators, not snowflakes.                 │
│                                                                               │
│  5. PORTABLE INFRASTRUCTURE — Kubernetes (or similar) abstracts              │
│     cloud provider differences. Workloads can move between providers.         │
│                                                                               │
│  6. OBSERVABLE BY DEFAULT — Every service exposes health, metrics, and       │
│     traces. Observability is a deployment requirement, not an afterthought.   │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cloud Provider Evaluation

### Evaluation Criteria

| Criterion                    | Weight | AWS       | GCP       | Azure     | Multi-Cloud |
| ---------------------------- | ------ | --------- | --------- | --------- | ----------- |
| **Architecture Alignment**   | 20%    | +1        | +2        | 0         | +2          |
| **AI Provider Integration**  | 20%    | +1        | +2        | +1        | +2          |
| **Managed Services Quality** | 15%    | +2        | +2        | +1        | +1          |
| **Portability (No Lock-in)** | 15%    | -1        | 0         | -1        | +2          |
| **Global Reach**             | 10%    | +2        | +2        | +1        | +2          |
| **Community/Talent**         | 10%    | +2        | +1        | +1        | 0           |
| **Cost Predictability**      | 10%    | +1        | +1        | +1        | 0           |
| **Weighted Score**           |        | **+1.10** | **+1.45** | **+0.55** | **+1.55**   |

### Option 1: AWS

| Aspect             | Assessment                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **Pros**           | Largest ecosystem, most talent, broadest service catalog, mature Kubernetes (EKS)            |
| **Cons**           | Complex pricing, many services create lock-in temptation, some services less mature than GCP |
| **AI Integration** | Bedrock for AI providers. Good but less native than GCP's Vertex AI.                         |
| **Verdict**        | Strong choice. Excels at operational maturity. AI integration is good but not best-in-class. |

### Option 2: Google Cloud Platform (GCP) — Recommended

| Aspect             | Assessment                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| **Pros**           | Best AI/ML services (Vertex AI, AI Platform). Strong Kubernetes (GKE). Competitive pricing.        |
| **Cons**           | Smaller ecosystem than AWS. Less enterprise adoption. Fewer managed services outside of AI/data.   |
| **AI Integration** | Vertex AI provides native access to Gemini, Claude, GPT models. Best-in-class AI infrastructure.   |
| **Verdict**        | **RECOMMENDED.** Best AI provider integration. Strong Kubernetes. Standard services avoid lock-in. |

### Option 3: Azure

| Aspect             | Assessment                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **Pros**           | Strong enterprise integration (Active Directory, Office 365). OpenAI partnership.            |
| **Cons**           | Weaker AI provider diversity. Less developer-friendly. Smaller community.                    |
| **AI Integration** | OpenAI via Azure (strong). Other providers (Anthropic, DeepSeek) require custom integration. |
| **Verdict**        | Not recommended for MVP. Consider for enterprise customers requiring Azure AD integration.   |

### Option 4: Multi-Cloud (Abstracted)

| Aspect      | Assessment                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| **Pros**    | No single provider dependency. Best negotiation leverage. Best disaster recovery.                                |
| **Cons**    | Highest operational complexity. Requires significant infrastructure expertise. Higher cost.                      |
| **Verdict** | Not recommended for MVP. Consider for enterprise Phase 7+ when avoiding single-provider risk justifies the cost. |

---

## Decision: GCP (Primary) with Kubernetes Abstraction

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUD & DEPLOYMENT DECISION                            │
│                                                                               │
│  PRIMARY CLOUD: Google Cloud Platform (GCP)                                  │
│  ORCHESTRATION: Kubernetes (GKE on GCP)                                      │
│  INFRA CODE: Terraform + Helm charts                                         │
│  CONTAINERS: Docker                                                          │
│  CI/CD: GitHub Actions or Cloud Build                                        │
│  OBSERVABILITY: OpenTelemetry + Grafana + Prometheus + Loki                   │
│                                                                               │
│  RATIONALE:                                                                   │
│  • Best AI provider integration — Vertex AI provides unified access          │
│  • Best Kubernetes — GKE is the gold standard for managed K8s                │
│  • Standard infrastructure — Compute Engine, Cloud Storage, Cloud SQL        │
│    are all portable, standard services                        │
│  • Kubernetes abstraction means workloads can move to AWS (EKS)              │
│    or Azure (AKS) with minimal changes                                      │
│  • Strong data/AI tooling reduces development time for AI features            │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Infrastructure Architecture

### MVP Infrastructure (Phase 1-4)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MVP INFRASTRUCTURE (Minimal, Cost-Effective)                │
│                                                                               │
│  GCP                                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  COMPUTE                                                                  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │  │ GKE      │  │ Cloud    │  │ Cloud    │  │ Cloud    │               │
│  │  │ (1 node) │  │ Run      │  │ Functions │  │ CDN      │               │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘               │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  DATA                                                                     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │  │ Cloud    │  │ Cloud    │  │ Memory-  │  │ Cloud    │               │
│  │  │ SQL      │  │ Storage  │  │ store    │  │ Tasks    │               │
│  │  │(Postgres)│  │ (S3-comp)│  │ (Redis)  │  │(Queue)   │               │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘               │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  AI & OBSERVABILITY                                                       │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │  │ Vertex   │  │ Grafana  │  │ Prometh. │  │ Cloud    │               │
│  │  │ AI       │  │ (managed)│  │ (managed)│  │ Logging  │               │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘               │
│  └──────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Containerization Strategy

| Aspect                  | MVP (Phase 1-4)                 | Growth (Phase 5-6)                    | Enterprise (Phase 7+)            |
| ----------------------- | ------------------------------- | ------------------------------------- | -------------------------------- |
| **Container Runtime**   | Docker                          | Docker                                | Docker                           |
| **Orchestration**       | GKE (1-3 nodes)                 | GKE (multi-node, cluster autoscaling) | GKE + EKS (multi-region)         |
| **Service Mesh**        | None (simplified)               | Istio or Linkerd                      | Istio + mTLS                     |
| **Image Registry**      | Artifact Registry               | Artifact Registry                     | Artifact Registry + multi-region |
| **Deployment Strategy** | Single replica → rolling update | Rolling update → blue-green           | Blue-green + canary              |

---

## Environment Strategy

| Environment    | Purpose                | Configuration       | Infrastructure                |
| -------------- | ---------------------- | ------------------- | ----------------------------- |
| **Local**      | Development            | Docker Compose      | Local machine                 |
| **Dev**        | Integration testing    | GKE (small)         | Shared cluster, TTL 7 days    |
| **Staging**    | Pre-release validation | GKE (1:1 with prod) | Production-like, no real data |
| **Production** | Live system            | GKE (HA)            | Multi-zone, backup, DR        |

---

## Scalability Strategy

| Dimension        | How We Scale                                                 | Phase      |
| ---------------- | ------------------------------------------------------------ | ---------- |
| **Compute**      | Kubernetes horizontal pod autoscaling (CPU + custom metrics) | MVP        |
| **Database**     | Read replicas → connection pooling → sharding                | Growth     |
| **Cache**        | Redis Cluster scaling → read replicas                        | Growth     |
| **Event Bus**    | Partitioned topics → stream processing                       | Growth     |
| **File Storage** | CDN → multi-region object storage                            | Growth     |
| **AI Provider**  | Provider routing + rate limiting + queue                     | MVP        |
| **Global Reach** | Multi-region deployment → CDN → edge computing               | Enterprise |

---

## Disaster Recovery

| Aspect               | MVP            | Growth                      | Enterprise                   |
| -------------------- | -------------- | --------------------------- | ---------------------------- |
| **Backup Frequency** | Daily          | Hourly                      | Continuous                   |
| **Backup Retention** | 7 days         | 30 days                     | 90 days                      |
| **RPO**              | 24 hours       | 1 hour                      | 5 minutes                    |
| **RTO**              | 24 hours       | 4 hours                     | 15 minutes                   |
| **DR Strategy**      | Backup/restore | Active-passive (multi-zone) | Active-active (multi-region) |
| **DR Testing**       | Never          | Quarterly                   | Monthly                      |

---

## Pros & Cons

| Pros                                                       | Cons                                                                         |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| GCP has best AI/ML infrastructure — Vertex AI is unmatched | GCP has smaller enterprise ecosystem than AWS                                |
| Kubernetes provides portability — not locked to GCP        | K8s learning curve for the team                                              |
| Standard services (PostgreSQL on Cloud SQL are standard)   | Managed Postgres on Cloud SQL is not exactly the same as on-premise Postgres |
| Terraform + Helm = infrastructure as code, repeatable      | Terraform state management requires care                                     |
| OpenTelemetry = vendor-neutral observability               | Observability stack requires setup and maintenance                           |

### Trade-offs Accepted

| Trade-off                    | Why Acceptable                                                       |
| ---------------------------- | -------------------------------------------------------------------- |
| GCP over AWS for AI          | Vertex AI's native multi-provider access saves months of development |
| Single cloud for MVP         | Multi-cloud complexity doesn't justify benefits for MVP phase        |
| K8s complexity in MVP        | GKE Autopilot reduces operational burden. 1-node cluster is simple.  |
| Managed services (Cloud SQL) | PostgreSQL is standard — not locked to GCP (can run anywhere)        |

### Migration Strategy

| Scenario                   | Migration Path                                                                                    | Cost                     |
| -------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------ |
| GCP → AWS                  | Workloads already on Kubernetes (GKE → EKS). Databases: Cloud SQL → RDS PostgreSQL (same schema). | Medium (quarter)         |
| GCP → Azure                | Similar migration path. Kubernetes (AKS). Postgres (Azure Database).                              | Medium (quarter)         |
| Cloud → On-premise         | Containerized workloads can run anywhere. Data migration is the challenge.                        | High (multiple quarters) |
| Single cloud → Multi-cloud | Deploy K8s workloads to additional provider. Replicate data. Traffic splitting.                   | Very High (quarters)     |

---

## Cross-References

| Reference   | Relationship                                                                    |
| ----------- | ------------------------------------------------------------------------------- |
| CMP-001     | "Human-first" — cloud deployment optimized for user latency (CDN, multi-region) |
| CMP-002     | Data residency requirements affect deployment region selection                  |
| ARC-001     | Principle #7 (Scalable) — Kubernetes autoscaling enables scalability            |
| ENG-004/D08 | Deployment View defines conceptual deployment architecture                      |
| IMP-001/D02 | Cloud infrastructure provisioned in Phase 1 (Week 1-2)                          |
