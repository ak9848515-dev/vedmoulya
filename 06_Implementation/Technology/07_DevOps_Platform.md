# DevOps Platform

**BLP-002 — Document 07/15 — Technology Stack & Platform Decisions**
**Version:** 1.0
**Status:** LOCKED
**Owner:** DevOps Lead
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines the **DevOps technology stack** for VedMoulya — CI/CD, infrastructure, containers, secrets management, and deployment strategy.

---

## Decision Summary

| Decision               | Choice                                                 | Status     |
| ---------------------- | ------------------------------------------------------ | ---------- |
| CI/CD                  | **GitHub Actions**                                     | ✅ DECIDED |
| Container Runtime      | **Docker**                                             | ✅ DECIDED |
| Container Registry     | **GitHub Container Registry (ghcr.io)**                | ✅ DECIDED |
| Secrets Management     | **Doppler** (MVP) → **HashiCorp Vault** (Enterprise)   | ✅ DECIDED |
| Infrastructure as Code | **Terraform** / **OpenTofu**                           | ✅ DECIDED |
| Cloud Provider (MVP)   | **Vercel** (frontend) + **Railway** (backend/services) | ✅ DECIDED |
| Cloud Provider (Scale) | **AWS** (post-MVP)                                     | 📝 PLANNED |
| Deployment Strategy    | **Blue-green** (zero-downtime per release)             | ✅ DECIDED |
| Feature Flags          | **OpenFeature** (standard) + **Flagd** (provider)      | ✅ DECIDED |

---

## CI/CD: GitHub Actions

### Decision

| Aspect      | Detail                                                 |
| ----------- | ------------------------------------------------------ |
| **Choice**  | GitHub Actions for CI/CD pipeline                      |
| **Purpose** | Automated build, test, lint, security scan, and deploy |

### Workflow Architecture

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  quality-gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test -- --coverage
      - run: npm run build
      # Gate 6: Security scan
      - run: npm audit
      # Gate 4: Accessibility
      - run: npm run test:a11y

  deploy:
    needs: quality-gates
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: npm run deploy # Railway + Vercel CLI
```

### Pipeline Stages

| Stage                       | Time (est.) | Parallel? |
| --------------------------- | ----------- | --------- |
| TypeScript compilation      | 30s         | —         |
| Linting (ESLint + Prettier) | 15s         | ✅ Yes    |
| Unit tests + coverage       | 45s         | ✅ Yes    |
| Integration tests           | 60s         | ✅ Yes    |
| Security scan               | 20s         | ✅ Yes    |
| Build                       | 30s         | ✅ Yes    |
| **Total (parallel)**        | **~2 min**  | —         |

---

## Containers: Docker

### Decision

| Aspect      | Detail                                             |
| ----------- | -------------------------------------------------- |
| **Choice**  | Docker for service containerization                |
| **Purpose** | Consistent development and production environments |

### Base Image

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

FROM base AS build
COPY . .
RUN npm run build

FROM base AS production
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

## Cloud Infrastructure

### MVP: Vercel + Railway

| Service         | Platform                  | Rationale                                       |
| --------------- | ------------------------- | ----------------------------------------------- |
| Web application | **Vercel**                | Best Next.js hosting, Edge network, free tier   |
| API services    | **Railway**               | Simple deployment, PostgreSQL, Redis, free tier |
| PostgreSQL      | **Railway** (managed PG)  | Built-in, backups, monitoring                   |
| Redis           | **Upstash** (via Railway) | Serverless Redis, free tier                     |

### Scale: AWS (Post-MVP)

| Trigger                                  | Migration                          |
| ---------------------------------------- | ---------------------------------- |
| Monthly infrastructure cost exceeds $500 | Evaluate AWS for cost optimization |
| Need for multi-region deployment         | AWS global infrastructure          |
| Enterprise compliance requirements       | AWS compliance certifications      |

---

## Secrets Management

### MVP: Doppler

| Aspect     | Detail                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| **Choice** | Doppler — cloud-native secrets management                                |
| **Why**    | Simple CLI, environment-based secrets, team collaboration, audit logging |

### Enterprise: HashiCorp Vault

| Aspect        | Detail                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| **Trigger**   | Enterprise deployment with compliance requirements                                      |
| **Migration** | Secrets are abstracted behind environment variables — migration is configuration change |

---

## Feature Flags: OpenFeature + Flagd

### Decision

| Aspect      | Detail                                                   |
| ----------- | -------------------------------------------------------- |
| **Choice**  | OpenFeature standard + Flagd provider                    |
| **Purpose** | Standardized feature flag management across all services |

### Why OpenFeature

| Reason            | Detail                                                             |
| ----------------- | ------------------------------------------------------------------ |
| Standard          | CNCF incubating project, vendor-neutral API                        |
| Provider-agnostic | Can switch between Flagd, LaunchDarkly, Split without code changes |
| TypeScript SDK    | First-class TypeScript support                                     |

---

## Architecture References

| Reference     | Relationship                                                                     |
| ------------- | -------------------------------------------------------------------------------- |
| ARC-001       | Architecture Principle #6 (Secure) — secrets management, CI/CD security scanning |
| BLP-001 / D10 | Release Strategy — blue-green deployments, feature flags, rollback               |

---

## Cross-References

| Reference     | Relationship                                              |
| ------------- | --------------------------------------------------------- |
| BLP-002 / D08 | Security scanning integrated into CI/CD pipeline          |
| BLP-002 / D09 | Observability infrastructure deployed via CI/CD           |
| BLP-002 / D12 | Decision Record — TDR-007 (DevOps Platform Decision)      |
| BLP-001 / D10 | Release Strategy defines the deployment cadence           |
| BLP-001 / D09 | Testing Strategy defines test types integrated into CI/CD |

---

## Quality Review

| Dimension              | Assessment                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| **Why**                | DevOps decisions determine deployment velocity, infrastructure cost, and operational reliability. |
| **Business Impact**    | GitHub Actions + Vercel/Railway provides 2-minute CI/CD pipeline — deploy 20+ times per day.      |
| **Engineering Impact** | Docker containers ensure environment consistency. Doppler simplifies secrets management.          |
| **Operational Impact** | Serverless (Vercel + Railway) eliminates server management. Zero ops team needed for MVP.         |
| **Security Impact**    | GitHub Actions OIDC for cloud access. SAST scanning on every commit. Secrets never in code.       |
| **Performance Impact** | Vercel Edge Network provides global CDN. Blue-green deployments enable zero-downtime releases.    |
| **Cost Impact**        | Vercel free tier (100GB bandwidth). Railway $5-20/month. Doppler free tier (5 projects).          |
| **Future Scalability** | AWS migration path is clear. Terraform infrastructure is cloud-agnostic.                          |

---

## Design Freeze Status

| Status    | Date       | Notes                                                      |
| --------- | ---------- | ---------------------------------------------------------- |
| ✅ LOCKED | 2026-07-27 | DevOps Platform v1.0 frozen. Changes require CTO approval. |
