# scripts/

**Purpose:** Automation for build, CI, deployment, development, load testing,
and quality gates. Organized by concern so engineers can run the same
operations locally that CI/CD performs.

## Layout

| Directory    | Purpose                                                              |
| ------------ | -------------------------------------------------------------------- |
| `build/`     | Build helpers (`core.sh`, `all.sh`, `web.sh`)                        |
| `ci/`        | Local mirror of CI quality gates (`run.sh`)                          |
| `deploy/`    | Deployment + smoke-test orchestration (`deploy.sh`, `smoke-test.sh`) |
| `dev/`       | Local dev setup / startup (`setup.sh`, `start.sh`)                   |
| `load/`      | k6 load-test scenarios                                               |
| (root files) | Gate scripts, coverage gate, analysis tools, bundle checks           |

## Usage

```bash
# Build
bash scripts/build/core.sh          # core packages only
bash scripts/build/all.sh           # every workspace
bash scripts/build/web.sh           # web app (Life OS + gateway)

# CI gates (mirrors .github/workflows/ci.yml)
bash scripts/ci/run.sh              # lint + format + typecheck + coverage + audit + build

# Deploy (self-hosted target)
bash scripts/deploy/deploy.sh --host example.com
bash scripts/deploy/smoke-test.sh https://example.com

# Local development
bash scripts/dev/setup.sh            # install + build core + .env.local
bash scripts/dev/start.sh            # Postgres + Redis + Next.js dev server

# Load testing
node scripts/load-test.mjs --scenario health
```

## Production scripts

- `scripts/startup.sh` — production startup (env fail-fast validation, dev/prod modes)
- `scripts/shutdown.sh` — graceful shutdown (SIGTERM → drain → SIGKILL)
- `scripts/backup.sh` — per-service `pg_dump` database backups

## Ownership

**Owner:** Engineering Team

## Future Expansion

- Per-service build helpers (`scripts/build/<service>.sh`)
- k6 CI integration for continuous load regression
- Deploy-to-Vercel / Railway helpers wired to the release pipeline
