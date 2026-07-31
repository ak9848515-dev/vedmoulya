# Documentation Standards

**BLP-001 — Document 13/15 — Implementation Strategy & Delivery Blueprint**
**Version:** 1.0
**Status:** LOCKED
**Owner:** Delivery Excellence Lead
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines the **documentation standards** for VedMoulya — what documentation is required, its format, where it lives, and how it's maintained.

---

## Documentation Types

### 1. Architecture Decision Records (ADRs)

**Purpose:** Capture architectural decisions and their rationale.

**Location:** `docs/adr/`

**Naming:** `{NNNN}-{decision-title-in-kebab-case}.md`

**Template:**

```markdown
# ADR-{NNNN}: {Title}

**Status:** [Proposed | Accepted | Deprecated | Superseded]
**Date:** {YYYY-MM-DD}
**Author:** {Name}
**Supersedes:** {ADR-NNNN (if applicable)}

## Context

{What is the issue motivating this decision?}

## Decision

{What is the change being proposed?}

## Consequences

{What becomes easier or more difficult?}

## Alternatives Considered

{What other options were evaluated and why were they rejected?}

## Compliance

{How will compliance with this decision be verified?}
```

### 2. Service README

**Purpose:** Document service purpose, setup, and usage.

**Location:** `services/{service-name}/README.md`

**Required Sections:**

| Section         | Required | Description                                         |
| --------------- | -------- | --------------------------------------------------- |
| Title + Badges  | ✅       | Service name, build status, coverage                |
| Purpose         | ✅       | One-paragraph description of service responsibility |
| Architecture    | ✅       | Architecture diagram and key patterns used          |
| Dependencies    | ✅       | List of dependent services                          |
| Setup           | ✅       | Local development setup steps                       |
| Configuration   | ✅       | Environment variables, feature flags                |
| API             | ✅       | Key endpoints (or reference to OpenAPI spec)        |
| Testing         | ✅       | How to run tests, test patterns                     |
| Deployment      | ✅       | Deployment process, health endpoints                |
| Troubleshooting | ✅       | Common issues and solutions                         |

### 3. Package README

**Purpose:** Document shared package purpose and usage.

**Location:** `packages/{package-name}/README.md`

**Required Sections:**

| Section        | Required | Description                |
| -------------- | -------- | -------------------------- |
| Title + Badges | ✅       | Package name, build status |
| Purpose        | ✅       | One-paragraph description  |
| Installation   | ✅       | How to install/import      |
| Usage          | ✅       | Code examples              |
| API            | ✅       | Exported functions/classes |
| Development    | ✅       | How to build and test      |

### 4. Inline Code Documentation

**Standard:** JSDoc / TSDoc

**Required For:**

| Element            | Required                | Example                                   |
| ------------------ | ----------------------- | ----------------------------------------- |
| Public API exports | ✅ All                  | `/** Creates a new career goal */`        |
| Complex functions  | ✅ >10 lines            | Describe parameters, return, exceptions   |
| Non-obvious logic  | ✅ Always               | Explain WHY, not WHAT                     |
| Type definitions   | ✅ All interfaces/types | Document each property                    |
| Deprecated APIs    | ✅ Always               | Include `@deprecated` with migration path |

**Format:**

```typescript
/**
 * Creates a new career goal for the user.
 *
 * @param userId - The unique identifier of the user
 * @param goal - The career goal data
 * @returns The created career goal entity
 * @throws {ValidationError} If goal data is invalid
 * @throws {NotFoundError} If user does not exist
 */
export async function createCareerGoal(
  userId: string,
  goal: CreateCareerGoalInput
): Promise<CareerGoal> {
```

### 5. API Documentation

**Standard:** OpenAPI 3.1

**Location:** Generated from contract definitions

**Requirements:**

| Element              | Required | Description                                 |
| -------------------- | -------- | ------------------------------------------- |
| Endpoint description | ✅       | Brief description of what the endpoint does |
| Request parameters   | ✅       | All parameters with types and descriptions  |
| Request body         | ✅       | Schema for request body                     |
| Response schemas     | ✅       | Success and error response schemas          |
| Authentication       | ✅       | How to authenticate                         |
| Rate limits          | ✅       | Rate limit information                      |
| Error codes          | ✅       | All possible error codes and meanings       |
| Examples             | ✅       | Request/response examples                   |

### 6. Architecture Documentation

**Location:** `docs/architecture/`

**Required Documents:**

| Document                | Purpose                                            | Update Cadence |
| ----------------------- | -------------------------------------------------- | -------------- |
| System Architecture     | High-level system diagram and module overview      | Per phase      |
| Data Model              | Entity relationship diagrams                       | Per new entity |
| Technology Stack        | Current technology choices and rationale           | Per change     |
| Deployment Architecture | Infrastructure diagram and deployment flow         | Per phase      |
| Security Architecture   | Authentication, authorization, encryption approach | Per change     |

### 7. Runbooks

**Location:** `docs/runbooks/`

**Required Runbooks:**

| Runbook             | Purpose                                      | Focus      |
| ------------------- | -------------------------------------------- | ---------- |
| Deployment          | How to deploy each service                   | Operations |
| Rollback            | How to rollback a failed deployment          | Operations |
| Incident Response   | How to respond to different incident types   | All        |
| Backup and Recovery | How to backup and restore data               | Operations |
| Monitoring          | What to monitor and how to respond to alerts | Operations |
| On-call             | On-call rotation and escalation procedures   | Operations |

### 8. User Documentation

**Location:** `docs/user/`

**Required Documents:**

| Document         | Audience  | Purpose                        |
| ---------------- | --------- | ------------------------------ |
| Getting Started  | New users | How to start using VedMoulya   |
| User Guide       | All users | Complete feature documentation |
| FAQ              | All users | Frequently asked questions     |
| Privacy Policy   | All users | How user data is handled       |
| Terms of Service | All users | Terms of service               |

---

## Documentation Standards

### Format

- All documentation in Markdown (`.md`)
- Use GitHub-flavored Markdown
- Use Mermaid for diagrams (architecture, flows, state machines)

### Structure

- **Headings:** ATX-style (`# H1`, `## H2`, `### H3`)
- **Bold:** **Important terms** (double asterisks)
- **Code:** `inline code` or fenced code blocks with language specified
- **Lists:** Use `-` for unordered, `1.` for ordered
- **Tables:** Use GFM table syntax with alignment

### Quality Standards

| Standard     | Requirement                                        |
| ------------ | -------------------------------------------------- |
| Spelling     | No spelling errors                                 |
| Grammar      | Proper grammar and punctuation                     |
| Clarity      | Reader should understand without prior context     |
| Completeness | All required sections present                      |
| Accuracy     | All information is current and verified            |
| Links        | All links are valid and point to current locations |

### Review Requirements

| Document Type     | Required Review           | Frequency           |
| ----------------- | ------------------------- | ------------------- |
| ADR               | Architecture Review Board | Per decision        |
| Service README    | Tech Lead                 | Per release         |
| Inline docs       | Code review               | Per PR              |
| API docs          | Code review               | Per endpoint change |
| Architecture docs | Architecture Review Board | Per phase           |
| Runbooks          | DevOps + Tech Lead        | Per release         |
| User docs         | Product Lead              | Per release         |

---

## Documentation Maintenance

### Ownership

| Document          | Owner              | Review Cadence |
| ----------------- | ------------------ | -------------- |
| ADRs              | Author + ARB       | Monthly        |
| Service READMEs   | Service owner      | Per release    |
| Package READMEs   | Package owner      | Per release    |
| Architecture docs | Software Architect | Per phase      |
| Runbooks          | DevOps Engineer    | Quarterly      |
| User docs         | Product Lead       | Per release    |

### Deprecation

| Action          | Process                                                |
| --------------- | ------------------------------------------------------ |
| Outdated doc    | Mark with `⚠️ DEPRECATED` header + link to replacement |
| Superseded ADR  | Update status to `Superseded` + link to new ADR        |
| Deleted feature | Remove docs or mark clearly                            |

---

## Architecture References

| Reference      | Relationship                                                             |
| -------------- | ------------------------------------------------------------------------ |
| ENG-001        | Domain entity documentation follows ENG-001 definitions                  |
| DES-010A / D12 | Content & Copywriting standards follow Experience Bible voice guidelines |

---

## Cross-References

| Reference     | Relationship                                                             |
| ------------- | ------------------------------------------------------------------------ |
| BLP-001 / D01 | DoD includes documentation completion criteria                           |
| BLP-001 / D06 | AI generates documentation drafts; documentation standards govern output |
| BLP-001 / D08 | Documentation quality gate (Gate 8) validates doc completeness           |

---

## Quality Review

| Dimension                         | Assessment                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Why**                           | Without documentation standards, docs are inconsistent, incomplete, and quickly outdated.                      |
| **Engineering Reasoning**         | Standardized documentation reduces onboarding time, improves debugging speed, and ensures maintainability.     |
| **Psychology Reasoning**          | Clear documentation reduces frustration. New team members can onboard independently.                           |
| **Accessibility Impact**          | Documentation follows accessibility best practices — readable fonts, semantic structure, alt text on diagrams. |
| **Trust Impact**                  | Complete, accurate documentation builds trust with users (user docs) and developers (technical docs).          |
| **Consistency with DES Missions** | Documentation follows copywriting standards from the Experience Bible (DES-010A/D12).                          |
| **Implementation Complexity**     | LOW — Standards are simple to define. Maintaining them requires discipline.                                    |
| **Future Scalability**            | Documentation standards scale with the project. New docs follow the same patterns.                             |

---

## Design Freeze Status

| Status    | Date       | Notes                                                              |
| --------- | ---------- | ------------------------------------------------------------------ |
| ✅ LOCKED | 2026-07-27 | Documentation Standards v1.0 frozen. Changes require ERB approval. |
