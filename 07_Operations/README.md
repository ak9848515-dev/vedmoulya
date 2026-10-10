# 07_Operations — Production Operations, Reliability & Environments

**Version:** 1.0  
**Status:** Certified & Active  
**Owner:** Infrastructure & Site Reliability Engineering (SRE)  
**Created:** 2026-07-24  
**Updated:** 2026-08-16

---

## Overview

The `07_Operations` directory provides the operational manuals, deployment playbooks, backup/recovery procedures, and runtime environment specifications necessary to operate VedMoulya reliably in both development and production settings.

```
07_Operations/
├── BACKUP.md          # Database backup, snapshot policies, and disaster recovery runbooks
├── DEPLOYMENT.md      # Container deployment runbooks, Docker Compose, and CI/CD pipelines
├── ENVIRONMENT_V1.md  # Comprehensive 16KB+ Environment Specification (Dev vs. Staging vs. Prod)
├── LOCAL_SETUP.md     # Developer onboarding, local environment provisioning, and doctor CLI
├── SECURITY.md        # Security incident response, secret management, and vulnerability reporting
└── README.md          # Operations navigation hub and quick start guide
```

---

## Quick Operational References

### Startup Preflight & Diagnostics

The platform provides deterministic startup diagnostic tools that test runtime requirements before launching services:

```bash
npm run doctor         # One-shot diagnostic inspection (Node, TS runtime, Docker, DB, Redis, Ports)
npm run preflight      # Fast startup preflight check
npm run preflight:prod # Strict production preflight (fails on missing secrets or localhost URLs)
npm run check-port     # Verify required ports (3000, 3001, etc.) and detect conflicts
```

### Infrastructure Topology

- **Local Development:** In-memory SQLite/Postgres mocks, local mock AI provider, minimal external dependencies.
- **Production Container Stack (`docker-compose.yml`):**
  - PostgreSQL 16 (Owner-scoped schemas, connection pooling)
  - Redis 7 (Async rate limiting, session cache, job queues)
  - Next.js Web App (`apps/web`) containerized or edge-deployed
  - S3-compatible Blob Storage (Artifact archives and document proofs)

### Backup & Disaster Recovery

The repository includes an on-demand `scripts/backup.sh` helper that writes compressed PostgreSQL dumps for configured service databases. The helper does not schedule backups, upload or retain off-site copies, calculate checksums, or perform restore validation. Production scheduling, storage/retention, and restore drills must be configured and verified by the operator; this repository contains no evidence that a point-in-time restore has been exercised.
