# Documentation Standards

**TECH-002 — Document 07/10 — Engineering Standards Manual**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Engineering Officer (CEngO)
**Created:** 2026-07-27
**Cross-references:** CMP-001, ARC-001, ENG-001, ENG-002, ENG-003, ENG-004, TECH-001/D08, TECH-002/D02, TECH-002/D04, 09_Documents/Repository Governance.md, 09_Documents/Coding Standards.md

---

## Purpose

This document defines the **mandatory documentation standards** for all VedMoulya code, architecture, and operations. Documentation is a first-class deliverable, not an afterthought.

These standards operationalize the **Document First** principle (ARC-001, Principle #12).

---

## Documentation Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    DOCUMENTATION PHILOSOPHY                               │
│                                                                           │
│  1. DOCUMENTATION IS A DELIVERABLE                                        │
│     Documentation is created, reviewed, and version-controlled            │
│     alongside code. It is not written after the fact.                    │
│                                                                           │
│  2. PROXIMITY OVER PORTAL                                                │
│     Documentation lives close to the code it describes.                  │
│     READMEs in directories, JSDoc in code, ADRs in repository.           │
│                                                                           │
│  3. ENOUGH IS BETTER THAN PERFECT                                       │
│     "Just enough" documentation is better than no documentation.         │
│     Perfect documentation that never gets written is useless.            │
│                                                                           │
│  4. READERS ARE DEVELOPERS                                              │
│     Documentation is written for engineers (including future you).       │
│     Assume technical competence, not domain knowledge.                   │
│                                                                           │
│  5. CODE IS TRUTH, DOCS ARE MAPS                                        │
│     Code is the source of truth. Documentation maps the territory.       │
│     When code and docs disagree, code wins — but that's a doc bug.       │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Documentation Hierarchy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    DOCUMENTATION HIERARCHY                                │
│                                                                           │
│  LEVEL 1: README (Required for every directory)                         │
│  ──────────────────────────────────────────────                         │
│  • Every directory has a README.md                                       │
│  • Explains purpose, contents, and how to use                           │
│  • Short: 1-3 paragraphs for code dirs, up to 1 page for service dirs   │
│                                                                           │
│  LEVEL 2: CODE DOCUMENTATION (Required for public APIs)                 │
│  ────────────────────────────────────────────────────────               │
│  • JSDoc/Typedoc for all public functions, classes, interfaces           │
│  • Inline comments for complex logic (explain WHY, not WHAT)             │
│  • README for each package/service                                      │
│                                                                           │
│  LEVEL 3: ARCHITECTURE DOCS (ADRs + Specs)                              │
│  ────────────────────────────────────────────────────                   │
│  • ADRs for significant decisions                                       │
│  • API contracts (OpenAPI) for service interfaces                        │
│  • Data models (ERDs) for database schemas                              │
│  • Sequence diagrams for complex flows                                  │
│                                                                           │
│  LEVEL 4: OPERATIONAL DOCS (Runbooks + Guides)                          │
│  ─────────────────────────────────────────────────────                 │
│  • Deployment guides                                                    │
│  • Monitoring and alerting runbooks                                     │
│  • Disaster recovery procedures                                         │
│  • On-call guides                                                       │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## README Standards

### Every README Must Include

| Section              | Required?      | Description                                   |
| -------------------- | -------------- | --------------------------------------------- |
| **Name**             | ✅ Required    | Full name of the component/package/service    |
| **Version**          | ✅ Required    | Semantic version (for services/packages)      |
| **Status**           | ✅ Required    | Active, Deprecated, Experimental              |
| **Owner**            | ✅ Required    | Team or individual responsible                |
| **Purpose**          | ✅ Required    | One-paragraph description of what it does     |
| **Scope**            | ✅ Required    | What is included, what is explicitly excluded |
| **Dependencies**     | ✅ Required    | External + internal dependencies              |
| **Quick Start**      | ✅ Required    | How to run/test in < 5 minutes                |
| **Configuration**    | ⚡ Recommended | Environment variables, feature flags          |
| **API**              | ⚡ Recommended | Key endpoints/interfaces                      |
| **Testing**          | ⚡ Recommended | How to run tests                              |
| **Future Expansion** | ⚡ Recommended | Planned additions                             |
| **Cross-References** | ⚡ Recommended | Related documentation                         |

### README Template

````markdown
# Component Name

**Version:** 1.0.0
**Status:** Active
**Owner:** Team Name
**Created:** YYYY-MM-DD
**Updated:** YYYY-MM-DD

## Purpose

One to three paragraphs describing what this component does,
why it exists, and how it fits into the broader system.

## Scope

**In scope:**

- Specific responsibilities
- Capabilities

**Out of scope:**

- What this component explicitly does NOT handle

## Dependencies

| Dependency          | Purpose                           | Type     |
| ------------------- | --------------------------------- | -------- |
| `@vedmoulya/domain` | Domain entities and value objects | Internal |
| PostgreSQL          | Primary data store                | External |

## Quick Start

```bash
npm install
npm run dev
```
````

## Configuration

| Variable       | Default | Description                  |
| -------------- | ------- | ---------------------------- |
| `DATABASE_URL` | —       | PostgreSQL connection string |

## API

### `POST /api/v1/resource`

[Link to OpenAPI spec]

## Testing

```bash
npm test        # Unit tests
npm run test:int # Integration tests
```

## Future Expansion

- Item 1
- Item 2

## Cross-References

- [Architecture Decision: ADR-012](docs/adr/adr-012-execution-lifecycle.md)

````

---

## Code Documentation Standards

### JSDoc Requirements

| Element | Documentation Required | Example |
|---------|----------------------|---------|
| Public functions | ✅ Required | `/** Creates a new user */` |
| Public classes | ✅ Required | `/** Service for managing user profiles */` |
| Interfaces | ✅ Required | `/** Repository interface for User entities */` |
| Types | ⚡ Recommended | Major types only |
| Private functions | ❌ Not required | Unless complex logic |
| Internal functions | ⚡ Recommended | When not obvious |

### JSDoc Content Rules

```typescript
/**
 * ONE-LINE SUMMARY (imperative verb: Creates, Validates, Fetches)
 *
 * Optional extended description when behavior is non-obvious.
 * Explain WHY this exists, not WHAT it does (the code shows WHAT).
 *
 * @param paramName - Description of the parameter
 * @returns Description of the return value
 * @throws ErrorTypeName - When/why this error is thrown
 *
 * @example
 * const result = myFunction({ key: 'value' })
 * // result === expectedValue
 */
````

### Inline Comments

```typescript
// ✅ GOOD: Explains WHY (the business reason)
// Goals must be fully loaded before we calculate progress
// because the progress formula requires the complete goal tree
const progress = await calculateProgress(userId);

// ❌ BAD: Restates WHAT the code does
// Get the user by ID
const user = await getUserById(id);

// ❌ BAD: Commented-out code
// const oldMethod = await getOldData()
```

---

## API Documentation Standards

### OpenAPI Specification

| Aspect         | Standard                                                        |
| -------------- | --------------------------------------------------------------- |
| **Format**     | OpenAPI 3.0 or 3.1                                              |
| **Location**   | `docs/api/{service-name}.yaml` or inline in code via decorators |
| **Required**   | All public API endpoints                                        |
| **Review**     | API contract review before implementation                       |
| **Generation** | Generated from code (decorators) for server, consumed by client |

### OpenAPI Minimum Requirements

```yaml
openapi: 3.0.3
info:
  title: User Profile Service
  version: 1.0.0
  description: Manages user profiles and preferences
paths:
  /users/{userId}:
    get:
      summary: Get user profile by ID
      parameters:
        - name: userId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: User profile
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserProfile'
        '404':
          description: User not found
```

---

## Architecture Decision Records

### ADR Standards

| Aspect           | Standard                                           |
| ---------------- | -------------------------------------------------- |
| **Location**     | `docs/adr/adr-NNN-title.md`                        |
| **Numbering**    | Sequential (ADR-001, ADR-002...)                   |
| **Statuses**     | Proposed → Accepted → Deprecated → Superseded      |
| **Required For** | All Level 2+ architecture decisions (TECH-002/D05) |

**Cross-Reference:** ARC-001 (Principle #12), 09_Documents/Decision Log.md

---

## Documentation as Code

### What Belongs in the Repository

| Document Type        | Location                       | Format           |
| -------------------- | ------------------------------ | ---------------- |
| Architecture docs    | `03_Architecture/`             | Markdown (`.md`) |
| Domain docs          | `03_Architecture/Domain/`      | Markdown         |
| Technology decisions | `04_Technology/`               | Markdown         |
| API specs            | `docs/api/`                    | YAML (OpenAPI)   |
| ADRs                 | `docs/adr/`                    | Markdown         |
| READMEs              | Every directory                | Markdown         |
| Runbooks             | `docs/ops/`                    | Markdown         |
| Design docs          | `docs/design/`                 | Markdown         |
| Decision Log         | `09_Documents/Decision Log.md` | Markdown         |

### What Belongs in External Systems

| Document Type           | System                     | Rationale                            |
| ----------------------- | -------------------------- | ------------------------------------ |
| Product requirements    | GitHub Projects / PRD docs | Living documents, collaborative      |
| Sprint tracking         | GitHub Projects            | Fast-moving, needs real-time updates |
| User research artifacts | Research repository        | Large files, raw data                |
| Meeting notes           | Shared drive / Notion      | Transient, collaborative             |
| Design mockups          | Figma                      | Visual design tooling                |

---

## Markdown Standards

### Document Header

Every documentation file must start with:

```markdown
# Title

**Mission/Project:** Document identifier
**Version:** 1.0
**Status:** [Draft | Final | Active | Deprecated]
**Owner:** [Name / Role]
**Created:** YYYY-MM-DD
**Updated:** YYYY-MM-DD
**Cross-references:** [list of related document paths]

---

## Purpose

One paragraph describing what this document covers and who it is for.
```

### Document Structure Guidelines

| Element              | Convention                              | Example                             |
| -------------------- | --------------------------------------- | ----------------------------------- |
| **Heading 1**        | One per document — title                | `# Architecture Rules`              |
| **Heading 2**        | Major sections                          | `## Purpose`, `## Standards`        |
| **Heading 3**        | Subsections                             | `### Unit Tests`                    |
| **Heading 4**        | Minor subsections                       | `#### Coverage Targets`             |
| **Code blocks**      | Use language tag                        | ````typescript`                     |
| **Tables**           | Use standard Markdown                   | `\| Header \| Header \|`            |
| **Lists**            | Use `-` for unordered, `1.` for ordered |                                     |
| **Bold**             | For emphasis                            | `**Required**`                      |
| **Code inline**      | For references                          | `` `UserService` ``                 |
| **ASCII diagrams**   | For architecture flows                  | See examples in this document       |
| **Cross-references** | Relative paths (no absolute URLs)       | `[ARC-001](../03_Architecture/...)` |

---

## Documentation Review Process

### When Documentation Is Required in PRs

```text
DOCUMENTATION REQUIRED IF PR INCLUDES:
  • New service, package, or module
  • New API endpoint or contract change
  • Architecture decision affecting cross-cutting concerns
  • Database schema change
  • Configuration or environment change
  • Breaking change

DOCUMENTATION RECOMMENDED IF PR INCLUDES:
  • Complex business logic
  • Non-obvious algorithm or pattern
  • Workaround or technical debt
```

### Documentation Review Checklist

- [ ] README updated for changed component
- [ ] API docs updated (OpenAPI) for changed endpoints
- [ ] ADR created for architecture decisions
- [ ] JSDoc added/updated for public APIs
- [ ] Inline comments added for complex logic
- [ ] Cross-references updated (if links changed)
- [ ] Document header is complete (version, date, status)
- [ ] Spelling and grammar checked

---

## Cross-Reference Summary

| Reference                                 | Relationship to Documentation Standards                                   |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| **09_Documents/Repository Governance.md** | Defines top-level documentation rules; this document operationalizes them |
| **ARC-001 (Principle #12)**               | Document First — the principle this standard enforces                     |
| **TECH-002/D02**                          | Project Structure — defines where documentation lives                     |
| **TECH-002/D04**                          | Coding Standards — JSDoc and inline comment rules                         |
| **ENG-001**                               | Domain documentation in 03_Architecture/Domain/                           |
| **TECH-001/D08**                          | Developer Tooling — documentation platform choices                        |

---

## Document Governance

| Aspect                     | Standard                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| **Version**                | 1.0                                                                                           |
| **Status**                 | Final                                                                                         |
| **Owner**                  | Chief Engineering Officer (CEngO)                                                             |
| **Review Cadence**         | Annually                                                                                      |
| **Approval Required**      | CEngO                                                                                         |
| **Violation Consequences** | PR reviewer requests documentation updates; CI checks for README existence in new directories |
