# Contributing to VedMoulya

## Quick Start

```bash
# Prerequisites: Node.js >=20, npm >=10, Docker

# 1. Clone the repository
git clone https://github.com/vedmoulya/vedmoulya.git
cd vedmoulya

# 2. Configure environment
cp .env.example .env.local

# 3. Install dependencies
npm install

# 4. Start infrastructure (PostgreSQL, Redis)
docker compose up -d

# 5. Build core packages
npm run build:core

# 6. Start development
npm run dev
```

## Repository Structure

```
vedmoulya/
├── apps/           # Applications (web, mobile)
│   └── web/        # Next.js web application
├── packages/       # Shared packages
│   ├── core/       # Core types, errors, config, DI
│   ├── domain/     # Domain entities
│   ├── services/   # Service contracts
│   ├── ui/         # Shared UI components
│   ├── ai/         # AI SDK wrapper
│   ├── shared/     # Shared utilities
│   ├── testing/    # Test utilities
│   ├── config/     # Configuration
│   └── intelligence/ # Intelligence engine types
├── services/       # Backend services
│   ├── api/        # API gateway
│   ├── identity/   # Identity service
│   ├── knowledge/  # Knowledge Graph service
│   ├── decision/   # Decision Engine
│   ├── execution/  # Execution Engine
│   ├── career/     # Career module
│   ├── learning/   # Learning module
│   └── ...         # Other services
└── docs/           # Documentation
    ├── adr/        # Architecture Decision Records
    └── runbooks/   # Operations runbooks
```

## Development Workflow

### Daily Workflow

1. **Pull latest**: `git pull --rebase`
2. **Create branch**: `git checkout -b feat/my-feature`
3. **Run tests**: `npm test`
4. **Make changes**: Code with AI assistance
5. **Quality checks**: `npm run quality`
6. **Commit**: Follow conventional commits
7. **Push**: `git push -u origin feat/my-feature`
8. **Create PR**: GitHub PR template

### Commit Convention

```
type(scope): description

Types: feat, fix, refactor, test, docs, style, chore, perf, security
Scopes: core, domain, web, identity, career, learning, infra, etc.

Examples:
feat(career): add skill gap analysis endpoint
fix(identity): handle missing session token
refactor(core): extract validation logic
```

### Branch Convention

- `main` — Production-ready, protected
- `develop` — Integration branch, protected
- `feat/*` — Feature branches
- `fix/*` — Bug fix branches
- `docs/*` — Documentation branches
- `refactor/*` — Refactoring branches

## Architecture References

Every change must reference the relevant architecture document:

| Document | Content                 | Required For           |
| -------- | ----------------------- | ---------------------- |
| CMP-001  | Constitutional values   | All changes            |
| ARC-001  | Architecture principles | Architecture decisions |
| ENG-002  | Service contracts       | New services           |
| DES-010A | Experience Bible        | UI changes             |
| BLP-001  | Implementation strategy | Process decisions      |
| BLP-002  | Technology stack        | Technology decisions   |

## Quality Gates

Before submitting a PR, ensure:

1. **✅ TypeScript compiles**: `npm run typecheck`
2. **✅ Linting passes**: `npm run lint`
3. **✅ Tests pass**: `npm test`
4. **✅ Coverage ≥80% on new code**: `npm run test:coverage`
5. **✅ Security audit**: `npm run audit`
6. **✅ Documentation updated**
7. **✅ PR template completed**

## AI-Assisted Development

VedMoulya is built through human-AI partnership. See `.cursor/rules/` for AI coding rules.

### AI Workflow

1. Define the contract first (types, interfaces)
2. AI generates implementation
3. Human reviews and refines
4. Automated gates validate quality
5. Human approves

## Getting Help

- Open an issue for bugs and feature requests
- Reference relevant ARC, ENG, DES documents in issues
- Use conventional commits for traceability
