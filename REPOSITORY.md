# VedMoulya Repository Rules

## Mission

VedMoulya is the **Execution Operating System** — empowering determined individuals to build sustainable livelihoods through knowledge, execution, and intelligent technology.

## Repository Governance

### Branch Protection

| Branch    | Protected | Requires PR | Requires Approval |
| --------- | --------- | ----------- | ----------------- |
| `main`    | ✅ Yes    | ✅ Yes      | ✅ At least 1     |
| `develop` | ✅ Yes    | ✅ Yes      | ✅ At least 1     |

### Commit Rules

- **Conventional Commits** required (enforced by commitlint)
- Format: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `perf`, `security`
- Max header length: 100 characters
- Scope is required (warn if missing)

### PR Rules

- All PRs require passing CI checks
- All PRs require at least one approval
- PR descriptions must use the PR template
- Architecture decisions require ADR

## Architecture Compliance

Every code change must respect:

1. **Clean Architecture** — Dependencies point inward. Domain has zero infrastructure dependencies.
2. **DDD** — Bounded contexts own their data. Cross-context via events.
3. **Provider-Agnostic AI** — AI features abstract providers. No provider lock-in.
4. **Security by Default** — All endpoints authenticated. Data encrypted. Access audited.
5. **Accessibility by Default** — WCAG AA minimum. Semantic HTML. Keyboard navigation.

## Documentation Requirements

| Change Type           | Documentation                        |
| --------------------- | ------------------------------------ |
| New feature           | README update + inline docs          |
| Architecture decision | ADR in `docs/adr/`                   |
| API change            | OpenAPI spec update                  |
| Breaking change       | Migration guide + deprecation notice |
| Infrastructure change | Runbook update                       |

## Quality Standards

- TypeScript strict mode (already configured)
- Coverage ≥80% on new code
- Zero eslint errors
- No `any` types (forbidden by config)
- No `!` non-null assertions (forbidden by config)
- No `console.log` in production code (warn, only `console.warn`/`console.error` allowed)

## Technology Stack (BLP-002)

| Layer         | Technology                            |
| ------------- | ------------------------------------- |
| Frontend      | Next.js 15 + Tailwind CSS + shadcn/ui |
| Backend       | Hono + Drizzle ORM + Zod              |
| Database      | PostgreSQL 16+ (pgvector)             |
| Cache/Queue   | Redis 7+ (BullMQ)                     |
| AI            | Vercel AI SDK (multi-provider)        |
| CI/CD         | GitHub Actions                        |
| Cloud         | Vercel + Railway                      |
| Testing       | Vitest + Playwright                   |
| Observability | OpenTelemetry + Grafana               |

## Resources

- [Architecture Documentation](03_Architecture/)
- [Design Documentation](05_Design/)
- [Implementation Plan](06_Implementation/)
- [Experience Bible](05_Design/Experience%20Bible/00_Experience_Bible.md)
- [Contributing Guide](CONTRIBUTING.md)
