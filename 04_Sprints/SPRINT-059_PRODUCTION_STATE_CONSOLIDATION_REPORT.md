# SPRINT-059 — Production State Consolidation & Deployment Baseline

**Date:** 2026-08-20
**Status:** 🟢 CLEAN BUILD VERIFIED — HUMAN REVIEW REQUIRED FOR COMMIT BOUNDARY
**Engine created:** 0

---

## 1. Current Product State

The working tree contains **448 files** (149 modified, 17 deleted, 282 untracked) representing accumulated work from SPRINT-022 through SPRINT-058 that is NOT in the current GitHub production commits (815ab2f, 9692277).

### What IS in GitHub (2 commits)

- `9692277` — husky `prepare` fix (`husky || true`)
- `815ab2f` — workspace package resolution in transpilePackages

### What is NOT in GitHub (the working tree)

The entire VedMoulya product: authentication, AI providers, ecosystem/workflow/agent systems, brain, proactive intelligence, voice, world model, control plane, intelligence fabric, command center, onboarding, signup, evidence loop, provider registry, and all documentation from SPRINT-022 through SPRINT-058.

---

## 2. File Classification

### Category A — Required for Current VedMoulya Product (MUST commit)

#### Core Application Code (modified)

| Area                     | Files                | Status                    |
| ------------------------ | -------------------- | ------------------------- |
| Web app pages/components | 22 modified + 18 new | Production UI             |
| Web auth system          | 6 modified           | Authentication            |
| API routers              | 9 modified + 6 new   | Gateway                   |
| API infrastructure       | 7 modified + 7 new   | Persistence/DI            |
| API services             | 1 modified           | App service               |
| Identity service         | 8 modified + 5 new   | Auth + email verification |
| Orchestrator             | 2 modified + 2 new   | AI providers              |
| 6 new packages           | 6 new directories    | Composition layers        |
| 8 modified packages      | 20+ modified files   | Core packages             |

#### New Packages (ALL are composition layers, NOT engines)

| Package                          | Purpose                        | Dependencies                         |
| -------------------------------- | ------------------------------ | ------------------------------------ |
| `@vedmoulya/control-plane`       | Autonomy control plane         | core, intelligence-fabric            |
| `@vedmoulya/ecosystem`           | Workflow/agent execution       | core, ai, providers, capabilities    |
| `@vedmoulya/intelligence-fabric` | Provider-neutral orchestration | (none — leaf)                        |
| `@vedmoulya/proactive`           | Proactive recommendations      | brain, core                          |
| `@vedmoulya/voice`               | Voice interaction seams        | brain, core                          |
| `@vedmoulya/world-model`         | Business operating system      | core, intelligence-fabric, proactive |

#### Configuration (modified)

- `apps/web/next.config.ts` — transpilePackages, ESLint
- `apps/web/package.json` — build script
- `apps/web/Dockerfile` — build fix
- `eslint.config.js` — rule overrides
- `.env.example` — documented vars
- `package.json` — husky fix
- `package-lock.json` — dependency graph

### Category B — Required for Production Deployment (MUST commit)

- `apps/web/scripts/run-next.mjs` — NODE_ENV=production wrapper
- `apps/web/src/app/onboarding/` — first-login profile setup
- `apps/web/src/app/signup/` — registration flow
- `services/identity/src/auth/VerificationEmailSender.ts` — email verification
- `services/identity/src/auth/VerificationToken.ts` — token management
- `services/identity/src/infrastructure/persistence/VerificationTokenStore.ts` — persistence
- `scripts/vm-create-dbs.mjs` — database creation
- `scripts/production-config-check.ts` — production validation
- `tests/vitest.setup.ts` — test infrastructure

### Category C — Documentation Only (SAFE to commit)

- 179 new `04_Sprints/SPRINT-*` markdown files
- `05_Docs/CURRENT_ARCHITECTURE_STATE.md`
- Modified `04_Sprints/MASTER_ROADMAP.md`, `README.md`, `CHANGELOG.md`
- Modified `05_Docs/PROJECT_STATUS.md`

### Category D — Test-Only (SAFE to commit)

- ~40 new test files across packages, services, and web app
- Modified test files (20+)
- `apps/web/e2e-cert-043e.spec.ts`

### Category E — Temporary/Generated Artifacts (EXCLUDE from commit)

| File               | Reason                      |
| ------------------ | --------------------------- |
| `test-job-id.txt`  | CI artifact                 |
| `tsc-job-id.txt`   | CI artifact                 |
| `inspect_recs.py`  | One-off inspection script   |
| `dev/`             | Local development directory |
| `task_progress.md` | Session progress tracking   |

### Category F — Obsolete/Deprecated (SAFE to exclude)

| File                                                        | Reason                 |
| ----------------------------------------------------------- | ---------------------- |
| `09_Documents/SPRINT-022_*` (3 files)                       | Moved to 04_Sprints    |
| `09_Documents/SPRINT-024_*` (3 files)                       | Moved to 04_Sprints    |
| `09_Documents/SPRINT-025_*` (3 files)                       | Moved to 04_Sprints    |
| `apps/web/src/app/sections/WelcomeHero.tsx`                 | Replaced by new layout |
| `packages/domain/src/identity/events/IdentityEventTypes.ts` | Replaced               |
| `services/notifications/*` (6 files)                        | Removed service        |

### Category G — Requires Founder Decision

| Item                              | Question                             |
| --------------------------------- | ------------------------------------ |
| `scripts/s56-secret-scan.ps1`     | PowerShell script — include in repo? |
| `scripts/_gen-prod-env.mjs`       | Production env generator — include?  |
| `scripts/_local-cert-env.mjs`     | Local cert env — include?            |
| `scripts/audit-internal-deps.mjs` | Audit tool — include?                |
| `scripts/audit-tables.mjs`        | Audit tool — include?                |
| `scripts/audit-unused.mjs`        | Audit tool — include?                |

---

## 3. Production Dependency Graph

```
apps/web
├── @vedmoulya/api (services/api) [transpilePackages]
│   ├── @vedmoulya/core [serverExternalPackages]
│   ├── @vedmoulya/identity
│   ├── @vedmoulya/memory
│   ├── @vedmoulya/decision
│   ├── @vedmoulya/execution
│   ├── @vedmoulya/knowledge
│   ├── @vedmoulya/content-agency
│   ├── @vedmoulya/services
│   ├── @vedmoulya/brain
│   │   ├── @vedmoulya/capability-marketplace
│   │   ├── @vedmoulya/execution-bridge
│   │   └── @vedmoulya/loop-engine
│   ├── @vedmoulya/ecosystem-intelligence
│   ├── @vedmoulya/ai-world-scheduler ★ FIXED in SPRINT-058
│   ├── @vedmoulya/live-intelligence-bridge ★ FIXED in SPRINT-058
│   ├── @vedmoulya/context-fabric ★ FIXED in SPRINT-058
│   ├── @vedmoulya/control-plane ★ NEEDS declaration
│   ├── @vedmoulya/intelligence-fabric ★ NEEDS declaration
│   ├── @vedmoulya/proactive ★ NEEDS declaration
│   ├── @vedmoulya/world-model ★ NEEDS declaration
│   ├── @vedmoulya/loop-engine (transitive via brain)
│   ├── @vedmoulya/requirements (transitive via experience)
│   ├── @vedmoulya/voice
│   ├── @vedmoulya/ecosystem
│   ├── @vedmoulya/providers
│   ├── @vedmoulya/capabilities
│   ├── @vedmoulya/context
│   ├── @vedmoulya/execution-strategy
│   ├── @vedmoulya/execution-orchestrator
│   ├── @vedmoulya/goals
│   ├── @vedmoulya/intelligence
│   ├── @vedmoulya/learning-intelligence
│   ├── @vedmoulya/enterprise-brain
│   ├── @vedmoulya/knowledge-intelligence
│   ├── @vedmoulya/memory-intelligence
│   ├── @vedmoulya/os-intelligence
│   ├── @vedmoulya/rag
│   ├── @vedmoulya/app-factory
│   ├── @vedmoulya/experience
│   ├── @vedmoulya/domain
│   └── @vedmoulya/orchestrator
├── @vedmoulya/ui
├── @vedmoulya/shared
└── Next.js / React / tRPC / TanStack Query
```

---

## 4. Phantom Dependency Findings

### services/api — Missing Direct Declarations

| Package                          | Value Imports | Transitive Via     | Risk     |
| -------------------------------- | :-----------: | ------------------ | -------- |
| `@vedmoulya/ai`                  | 0 (type-only) | —                  | LOW      |
| `@vedmoulya/control-plane`       |       3       | **NONE**           | **HIGH** |
| `@vedmoulya/intelligence-fabric` |       2       | **NONE**           | **HIGH** |
| `@vedmoulya/proactive`           |       3       | **NONE**           | **HIGH** |
| `@vedmoulya/world-model`         |       5       | **NONE**           | **HIGH** |
| `@vedmoulya/loop-engine`         |       8       | brain, app-factory | MEDIUM   |
| `@vedmoulya/requirements`        |       3       | experience         | MEDIUM   |

**4 packages have NO transitive path** from declared dependencies and MUST be added to `services/api/package.json`:

- `@vedmoulya/control-plane`
- `@vedmoulya/intelligence-fabric`
- `@vedmoulya/proactive`
- `@vedmoulya/world-model`

**2 packages** (`loop-engine`, `requirements`) resolve transitively but should still be declared for correctness.

**1 package** (`ai`) is type-only — no declaration needed.

---

## 5. Deployment Blockers

| #   | Blocker                                               | Severity | Fix                                                |
| --- | ----------------------------------------------------- | -------- | -------------------------------------------------- |
| 1   | 7 phantom deps in services/api                        | HIGH     | Add to package.json dependencies                   |
| 2   | Vercel module resolution for transitive imports       | HIGH     | Phantom dep fix (above) resolves this              |
| 3   | `NODE_ENV=development` injected into production build | MEDIUM   | `run-next.mjs` wrapper (already exists)            |
| 4   | Pre-existing ESLint errors blocking build             | MEDIUM   | `ignoreDuringBuilds: false` + fixes (already done) |
| 5   | services/notifications deleted but still referenced   | LOW      | Verify no runtime references                       |

---

## 6. Environment Variables Required

### Production (REQUIRED)

| Variable                | Purpose                                    |
| ----------------------- | ------------------------------------------ |
| `IDENTITY_DATABASE_URL` | Postgres connection (non-loopback in prod) |
| `AUTH_JWT_SECRET`       | JWT signing secret (≥32 chars)             |
| `NODE_ENV`              | Set to `production` by run-next.mjs        |

### Production (RECOMMENDED)

| Variable                      | Purpose                    |
| ----------------------------- | -------------------------- |
| `REDIS_URL`                   | Rate limiting backend      |
| `KNOWLEDGE_DATABASE_URL`      | Knowledge persistence      |
| `DECISION_DATABASE_URL`       | Decision persistence       |
| `EXECUTION_DATABASE_URL`      | Execution persistence      |
| `MEMORY_DATABASE_URL`         | Memory persistence         |
| `CONTENT_AGENCY_DATABASE_URL` | Content agency persistence |
| `APP_URL`                     | Public base URL            |

### Production (OPTIONAL — AI)

| Variable               | Purpose                       |
| ---------------------- | ----------------------------- |
| `AI_DEFAULT_PROVIDER`  | Default AI provider           |
| `AI_OPENAI_API_KEY`    | OpenAI API key                |
| `AI_ANTHROPIC_API_KEY` | Anthropic API key             |
| `AI_GOOGLE_API_KEY`    | Google AI Studio key          |
| `AI_DEEPSEEK_API_KEY`  | DeepSeek API key              |
| `AI_ENABLE_MOCK`       | Must be `false` in production |

### Production (OPTIONAL — Email)

| Variable              | Purpose         |
| --------------------- | --------------- |
| `EMAIL_DELIVERY_MODE` | `log` or `smtp` |
| `SMTP_HOST`           | SMTP server     |
| `EMAIL_FROM`          | Sender address  |

---

## 7. Clean Build Results

| Check                             | Result                         |
| --------------------------------- | ------------------------------ |
| `npm ci`                          | ✅ Clean install from lockfile |
| `npm run typecheck`               | ✅ 0 errors                    |
| `vitest run` (apps/web)           | ✅ 365/365 pass                |
| `node scripts/run-next.mjs build` | ✅ 60/60 pages                 |
| ESLint during build               | ✅ Ran, 0 errors               |

---

## 8. Recommended Commit Boundary

### Commit 1: Core Platform Foundation

**Include:** All production-required code (Category A + B)

- All modified application code
- 6 new packages (control-plane, ecosystem, intelligence-fabric, proactive, voice, world-model)
- New API routers and infrastructure
- Authentication changes (identity service)
- Provider implementations (orchestrator)
- Configuration changes (next.config, eslint, package.json)
- `run-next.mjs` build wrapper
- Database creation scripts
- Test infrastructure updates

**Message:** `feat(platform): consolidate VedMoulya production state — core platform, auth, ecosystem, persistence`

### Commit 2: Tests & Benchmarks

**Include:** All test files (Category D)

- New test files across packages, services, web
- Modified test configurations
- Benchmark scripts

**Message:** `test: add comprehensive test coverage for consolidated platform`

### Commit 3: Documentation

**Include:** All documentation (Category C)

- Sprint reports (179 files)
- Architecture documentation
- Changelog, roadmap, README updates

**Message:** `docs: consolidate sprint documentation through SPRINT-058`

### Commit 4: Cleanup (optional, with founder approval)

**Include:** Remove obsolete files (Category F)

- Delete 09_Documents moved files
- Delete WelcomeHero.tsx
- Delete services/notifications
- Delete IdentityEventTypes.ts

**Message:** `chore: remove obsolete files replaced by consolidated platform`

---

## 9. Recommended Deployment Architecture

```
Vercel
├── Root Directory: / (monorepo root)
├── Build Command: npm run build (or vercel auto-detect)
├── Output Directory: .next
├── Install Command: npm install (workspace-aware)
└── Framework: Next.js 15.5.22

Runtime
├── Node.js ≥20
├── PostgreSQL (identity + per-service databases)
├── Redis (rate limiting, optional)
└── SMTP (email verification, optional)
```

---

## 10. Files That Should Be Staged

### MUST Stage (149 modified + ~200 new production files)

All files in Categories A, B, C, D — approximately 350 files.

### MUST NOT Stage (Category E — 5 files)

- `test-job-id.txt`
- `tsc-job-id.txt`
- `inspect_recs.py`
- `dev/`
- `task_progress.md`

### Requires Decision (Category G — 6 files)

- `scripts/s56-secret-scan.ps1`
- `scripts/_gen-prod-env.mjs`
- `scripts/_local-cert-env.mjs`
- `scripts/audit-internal-deps.mjs`
- `scripts/audit-tables.mjs`
- `scripts/audit-unused.mjs`

### Safe to Exclude (Category F — 16 files)

- `09_Documents/SPRINT-022_*` (3 files)
- `09_Documents/SPRINT-024_*` (3 files)
- `09_Documents/SPRINT-025_*` (3 files)
- `apps/web/src/app/sections/WelcomeHero.tsx`
- `packages/domain/src/identity/events/IdentityEventTypes.ts`
- `services/notifications/*` (6 files)

---

## PRODUCTION BASELINE STATUS: HUMAN REVIEW REQUIRED

The codebase builds cleanly (60/60 pages, ESLint clean, types clean). The production state is consolidated and verified. However, 7 phantom dependencies in `services/api/package.json` MUST be declared before Vercel deployment will succeed. The recommended commit boundary requires founder approval for the temporary/generated files (Category G) and the obsolete file deletions (Category F).

### Immediate Action Required

1. **Add 6 missing dependencies to `services/api/package.json`** (control-plane, intelligence-fabric, proactive, world-model, loop-engine, requirements)
2. **Decide commit boundary** (single vs. multi-commit)
3. **Decide Category G files** (scripts to include/exclude)
4. **Decide Category F deletions** (obsolete file cleanup)

### NEW ENGINES CREATED: 0
