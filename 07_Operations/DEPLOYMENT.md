# Deployment

> How VedMoulya is deployed, monitored, and operated in production.
> Owner: Platform Engineering · Updated: 2026-08-03 (DOC-001)

## Purpose

Document the production deployment topology, CI/CD path, configuration governance (fail-fast secrets), and operational references.

## Scope

- Deployment topology (Vercel + Railway, Docker Compose)
- CI/CD pipeline (10 quality gates)
- Configuration and secrets governance
- Rollback and incident references

## Current Status

Active. v1.0.0 deployed and certified 2026-07-31; containerized via `docker-compose.yml`; detailed guides in `../docs/ops/`.

## Architecture

```
GitHub Actions CI (typecheck → lint → tests → build → e2e → a11y → security → performance)
  → deploy: apps on Vercel, services on Railway
Local/prod infra: docker-compose (PostgreSQL, Redis, service containers)
```

## Responsibilities

- Platform Engineering: deploys, rollback, incident response
- Release manager: approvals

## Deliverables

- Deployment topology (this document)
- Ops guides (`../docs/ops/DEPLOYMENT_GUIDE.md`, `ROLLBACK_GUIDE.md`)

## Dependencies

- `.github/workflows/ci.yml`
- `docker-compose.yml`
- `../docs/ops/`

## Future Work

- Staging environment, IaC for cloud resources

## References

- [../05_Docs/RELEASE_PROCESS.md](../05_Docs/RELEASE_PROCESS.md)
- [../docs/ops/DEPLOYMENT_GUIDE.md](../docs/ops/DEPLOYMENT_GUIDE.md)
