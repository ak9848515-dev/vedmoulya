# Repository Governance

**Version:** 1.0
**Status:** Active
**Owner:** Chief Technology Officer
**Created:** 2026-07-24
**Updated:** 2026-07-24
**Dependencies:** 09_Documents/Architecture Standards, 09_Documents/Coding Standards

## Description

Define the governance rules, standards, and conventions that ensure consistency, clarity, and maintainability of the VedMoulya repository.

---

## Official Folder Structure

The VedMoulya repository follows a numbered top-level domain structure:

```
00_Foundation        — Company mission, values, constitution
01_Research          — User research, market analysis
02_Product           — Product architecture (see module breakdown below)
03_Architecture      — Technical architecture (AI, Backend, Frontend, etc.)
04_Technology        — Technology stack decisions and evaluations
05_Design            — Visual design, design system, brand
06_Business          — Business model, revenue, operations
07_Marketing         — Marketing strategy, campaigns, content
08_Legal             — Legal agreements, compliance, licenses
09_Documents         — Cross-cutting documentation
10_Sprints           — Sprint planning and tracking
apps                 — Application code (frontend, mobile)
packages             — Shared packages and libraries
services             — Backend services
```

### Product Module Structure (02_Product)

The official product architecture uses **Model A**:

```
02_Product/
    00_Core          — Human journey, personas, principles, HPI
    01_Discover      — Opportunity and skill discovery
    02_Learn         — Learning paths, content, assessments
    03_Build         — Projects, portfolios, creation
    04_Earn          — Monetization, payments, income
    05_Grow          — Personal growth, leadership, networking
    06_Manage        — Business operations, CRM, analytics
    07_Community     — Groups, forums, events, collaboration
    08_AI            — AI features, assistants, coaching
    09_Platform      — Settings, security, administration
    Roadmaps         — Product roadmap documentation
```

---

## Folder Ownership

| Folder          | Owner                    |
| --------------- | ------------------------ |
| 00_Foundation   | Chief Executive Officer  |
| 01_Research     | Chief Product Officer    |
| 02_Product      | Chief Product Officer    |
| 03_Architecture | Chief Technology Officer |
| 04_Technology   | Chief Technology Officer |
| 05_Design       | Chief Design Officer     |
| 06_Business     | Chief Executive Officer  |
| 07_Marketing    | Chief Marketing Officer  |
| 08_Legal        | Chief Legal Officer      |
| 09_Documents    | Chief Technology Officer |
| 10_Sprints      | Chief Technology Officer |

---

## Naming Convention

- **Top-level folders:** Numbered prefix + descriptive name (`00_Foundation`, `01_Research`)
- **Sub-folders:** Descriptive PascalCase or Title Case (`Human Journey`, `Decision Engine`, `Seed Data`)
- **Document files:** PascalCase with `.md` extension (`Repository Governance.md`, `Product Principles.md`)
- **Code directories:** Lowercase with hyphens as needed (`user-profile-service`, `api-gateway`)
- **No spaces in code paths** — spaces are allowed only in documentation folders

---

## Documentation Rules

1. Every directory must contain a `README.md` describing its contents (Purpose, Scope, Responsibilities, Dependencies, Future Expansion).
2. Every document must start with a standardized header (Name, Version, Status, Owner, Created, Updated, Dependencies, Description).
3. Only add missing documentation — never overwrite existing user-created documents.
4. When duplicates exist, compare and preserve the richer version.
5. Documentation is version-controlled alongside code.

---

## Mission Rules

1. All work must align with VedMoulya's mission: _Empower every determined individual to build a sustainable livelihood through knowledge, execution, and intelligent technology._
2. Product decisions must serve the Human Execution Operating System vision.
3. Repository changes must preserve and improve, never destroy or overwrite.

---

## Repository Standards

1. **No generated code** — Do not commit generated code without review.
2. **No secrets** — API keys, passwords, and tokens must never be committed.
3. **No large files** — Keep binary files out of the repository; use external storage.
4. **Documentation-first** — Architecture and product decisions must be documented before implementation.
5. **PR reviews** — All changes require review before merge.
6. **Clean history** — Use meaningful commit messages; squash when appropriate.

---

## Future Expansion Rules

1. New top-level folders require CTO approval.
2. New product modules (under 02_Product) must fit the `XX_Name` numbering pattern.
3. New architecture domains (under 03_Architecture) should align with the existing AI, Backend, Database, Frontend, System taxonomy.
4. New document types in 09_Documents require a clear purpose and owner.
5. Sprint types (10_Sprints) can be extended with new categories as needed, each with a README.
6. All expansions must be documented in this governance document before creation.

---

_This document is the source of truth for repository structure and governance. Violations should be reported and corrected._
