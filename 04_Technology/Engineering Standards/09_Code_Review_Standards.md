# Code Review Standards

**TECH-002 — Document 09/10 — Engineering Standards Manual**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Engineering Officer (CEngO)
**Created:** 2026-07-27
**Cross-references:** CMP-001, ARC-001, ENG-001, ENG-002, TECH-001/D08, TECH-002/D04, TECH-002/D05, TECH-002/D06, TECH-002/D07, TECH-002/D08, IMP-001/D08

---

## Purpose

This document defines the **mandatory code review standards** for VedMoulya. Every change to the codebase must go through a defined review process. Code review is a quality gate, a knowledge-sharing mechanism, and an accountability practice.

---

## Code Review Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    CODE REVIEW PHILOSOPHY                                 │
│                                                                           │
│  1. REVIEW THE CODE, NOT THE AUTHOR                                       │
│     Feedback is about the code, not the person who wrote it.              │
│     Be constructive, specific, and respectful.                            │
│                                                                           │
│  2. EVERY CHANGE IS REVIEWED                                             │
│     No exceptions. Even the CTO's hotfix goes through review.            │
│     Post-hoc review is acceptable for emergencies, but retrospective.     │
│                                                                           │
│  3. AUTOMATION FIRST, HUMANS SECOND                                      │
│     Linting, formatting, type checking, and security scanning             │
│     are automated. Humans focus on logic, design, and correctness.        │
│                                                                           │
│  4. KNOWLEDGE SHARING IS A GOAL                                          │
│     Code review is how we share context, teach patterns,                 │
│     and build collective code ownership.                                 │
│                                                                           │
│  5. REVIEWERS ARE GATEKEEPERS, NOT GATEBLOCKERS                         │
│     The goal is to maintain quality while enabling velocity.             │
│     Perfect is the enemy of good enough.                                 │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Review Types and Requirements

### Standard Review (Every PR)

| Requirement                    | Standard                                 |
| ------------------------------ | ---------------------------------------- |
| **Minimum reviewers**          | 1 human reviewer                         |
| **Review before merge**        | ✅ Required                              |
| **Automated checks must pass** | ✅ Required                              |
| **AI pre-review**              | ✅ Recommended (AI reviews before human) |
| **Turnaround target**          | < 4 hours during working hours           |

### Enhanced Review (Security/Compliance Critical)

| Requirement           | Standard                                                   |
| --------------------- | ---------------------------------------------------------- |
| **Minimum reviewers** | 2 human reviewers                                          |
| **Required when**     | Security changes, auth changes, payment code, PII handling |
| **Required when**     | Architecture rule Level 1 and 2 changes                    |
| **Required when**     | Database migration changes                                 |
| **Required when**     | CI/CD pipeline changes                                     |
| **Required when**     | Dependency changes with significant impact                 |

### Post-Mortem Review (Emergency Changes)

| Requirement         | Standard                                                    |
| ------------------- | ----------------------------------------------------------- |
| **When used**       | Production hotfix, security patch under active attack       |
| **Process**         | Changes merged immediately, reviewed within 24 hours        |
| **Post-hoc review** | Required. If issues found, revert or remediate immediately. |

---

## PR Standards

### PR Size Limits

| Aspect            | Limit                                      | Rationale                               |
| ----------------- | ------------------------------------------ | --------------------------------------- |
| **Lines changed** | ≤400 lines (preferred)                     | Readability; >1000 requires explanation |
| **Files changed** | ≤15 files (preferred)                      | Focus; >25 requires explanation         |
| **Commits**       | Squash to 1 meaningful commit before merge | Clean history                           |

### PR Template

Every PR description must include:

```markdown
## Summary

Brief description of what this change does and why.

## Changes

- List of specific changes made
- Include file paths for significant changes

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass (if applicable)
- [ ] Manual testing performed (describe)

## Documentation

- [ ] README updated (if applicable)
- [ ] API docs updated (if applicable)
- [ ] ADR created (if architecture-impacting)

## AI Attribution

- [ ] Code partially generated by AI (describe which parts)
- [ ] All AI-generated code reviewed and understood

## Quality Gates

- [ ] Lint passes
- [ ] Type check passes
- [ ] Security scan passes
- [ ] Coverage meets thresholds
- [ ] No new vulnerabilities introduced

## Cross-References

Closes #ISSUE_NUMBER
Related #ISSUE_NUMBER
```

---

## Review Checklist

### Reviewer's Checklist

#### Correctness

- [ ] Code does what the PR description says
- [ ] Edge cases are handled (null, empty, invalid, boundary values)
- [ ] Error handling is correct and complete
- [ ] Concurrency/race conditions considered
- [ ] No obvious logic errors

#### Architecture & Design

- [ ] Follows architecture rules (TECH-002/D05)
- [ ] Follows DDD patterns (ENG-001)
- [ ] Clean separation of concerns (domain, application, infrastructure)
- [ ] No unnecessary coupling or dependencies
- [ ] Follows SOLID principles

#### Style & Conventions

- [ ] Follows naming conventions (TECH-002/D03)
- [ ] Follows coding standards (TECH-002/D04)
- [ ] Code is readable and maintainable
- [ ] No dead code, commented-out code, or TODO without context
- [ ] No excessive complexity (prefer simple over clever)

#### Performance

- [ ] No N+1 queries or unnecessary database calls
- [ ] No synchronous blocking in async code
- [ ] No memory leaks (unbounded caches, listeners not cleaned up)
- [ ] No obvious performance bottlenecks

#### Security

- [ ] Input validation is correct and complete
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities (frontend)
- [ ] No hardcoded secrets or tokens
- [ ] Authentication and authorization enforced correctly
- [ ] No PII leakage in logs or error messages

#### Testing

- [ ] Tests exist for the change
- [ ] Tests actually verify the right behavior
- [ ] Edge cases are tested
- [ ] Tests are not flaky (deterministic)
- [ ] Coverage meets thresholds

#### Documentation

- [ ] README updated if service/package changed
- [ ] JSDoc added/updated for public APIs
- [ ] Inline comments explain non-obvious logic
- [ ] ADR created for architecture decisions
- [ ] API docs updated (OpenAPI)

### AI-Specific Checklist

For AI-generated code, additionally verify:

- [ ] Code is well-understood by both author and reviewer
- [ ] AI did not hallucinate APIs or patterns
- [ ] AI did not introduce unnecessary dependencies
- [ ] AI-generated code follows project conventions consistently
- [ ] AI did not generate code that bypasses security/privacy

---

## Review Workflow

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    PR REVIEW WORKFLOW                                     │
│                                                                           │
│  AUTHOR CREATES PR                                                      │
│    │                                                                      │
│    ▼                                                                      │
│  AUTOMATED CHECKS (CI Pipeline)                                         │
│    ├── Lint (ESLint + Prettier)                                         │
│    ├── Type check (TypeScript)                                           │
│    ├── Unit tests (Vitest)                                               │
│    ├── Coverage check                                                    │
│    ├── Security scan (Semgrep + Snyk)                                   │
│    ├── Dependency scan                                                   │
│    └── AI pre-review (automated)                                        │
│    │                                                                      │
│    ▼ (if checks fail)                                                    │
│  AUTHOR FIXES + UPDATES PR                                              │
│    │                                                                      │
│    ▼ (if checks pass)                                                    │
│  AI PRE-REVIEW FEEDBACK                                                │
│    ├── AI reviews code for style, patterns, common issues               │
│    ├── AI-generated code flagged for enhanced human review              │
│    └── AI suggestions surfaced to both author and reviewer              │
│    │                                                                      │
│    ▼                                                                      │
│  ASSIGN HUMAN REVIEWER                                                  │
│    │                                                                      │
│    ▼                                                                      │
│  HUMAN REVIEW                                                           │
│    ├── Reviewer checks code                                              │
│    ├── Reviewer leaves comments                                          │
│    └── Reviewer approves or requests changes                             │
│    │                                                                      │
│    ▼ (if changes requested)                                              │
│  AUTHOR ADDRESSES FEEDBACK                                              │
│    │                                                                      │
│    ▼ (if approved)                                                       │
│  SQUASH MERGE TO MAIN                                                   │
│    │                                                                      │
│    ▼                                                                      │
│  CLEANUP: DELETE BRANCH                                                 │
│    │                                                                      │
│    ▼                                                                      │
│  DEPLOYMENT PIPELINE TRIGGERED                                          │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Review Guidelines

### For Reviewers

```text
DO:
  ✓ Review within 4 hours during working hours
  ✓ Be specific: "Line 42: What happens if user is null?"
  ✓ Provide alternatives: "Consider using Result type instead of throwing"
  ✓ Distinguish blockers from suggestions
  ✓ Approve when ready — don't request changes for preferences
  ✓ Praise good code: "Nice use of discriminated unions here"

DON'T:
  ✗ Nitpick style (automation handles this)
  ✗ Review when tired or distracted
  ✗ Rewrite code in comments (suggest, don't rewrite)
  ✗ Approve without understanding the code
  ✗ Leave vague comments: "This doesn't look right"
  ✗ Gate on personal preferences not in standards
```

### For Authors

```text
DO:
  ✓ Keep PRs small and focused (one concern per PR)
  ✓ Write clear PR descriptions
  ✓ Self-review before requesting review
  ✓ Respond to all comments
  ✓ Explain your reasoning when declining suggestions
  ✓ Thank reviewers for thorough feedback

DON'T:
  ✗ Take feedback personally
  ✗ Merge without addressing all blocking comments
  ✗ Force-push after reviewer has started reviewing
  ✗ Request review before CI passes
  ✗ Submit intentionally incomplete code for "early feedback"
```

---

## Review Response Time SLA

| Priority                                        | Response Time | Author Response              |
| ----------------------------------------------- | ------------- | ---------------------------- |
| **P0 - Critical** (production issue fix)        | < 1 hour      | < 1 hour to address feedback |
| **P1 - High** (blocking feature, security fix)  | < 4 hours     | < 4 hours                    |
| **P2 - Normal** (standard feature, bug fix)     | < 24 hours    | < 24 hours                   |
| **P3 - Low** (refactoring, docs, small changes) | < 48 hours    | < 48 hours                   |

---

## Merge Standards

### Merge Rules

| Rule                  | Standard                                           |
| --------------------- | -------------------------------------------------- |
| **Branch protection** | Main branch is protected                           |
| **Required checks**   | All CI checks must pass                            |
| **Required reviews**  | At least 1 approval (2 for enhanced review)        |
| **Up-to-date branch** | Branch must be up-to-date with main                |
| **Squash merge**      | Always squash merge                                |
| **Merge message**     | Follow conventional commit format                  |
| **Linear history**    | No merge commits on main (linear history enforced) |

### Definition of Done (Merge Criteria)

```markdown
A PR is ready to merge when:

- [ ] All CI checks pass (lint, type check, tests, security, coverage)
- [ ] At least 1 human approval (2 for enhanced review)
- [ ] All reviewer comments addressed (resolved or acknowledged)
- [ ] No Level 1 or Level 2 architecture rule violations without documented exception
- [ ] Branch is up-to-date with main
- [ ] PR description is complete
- [ ] Tests cover the change
- [ ] Documentation is updated
```

---

## Technical Debt Review

### Debt Acknowledgment

When a PR introduces technical debt (intentionally or unavoidably):

```text
TECHNICAL DEBT ACKNOWLEDGMENT
══════════════════════════════

If a PR merges with known technical debt:
  • Document the debt in the PR description
  • Create a follow-up issue to address the debt
  • Assign priority and owner
  • Reference the issue in code: `// TODO(#123): Address performance issue`
  • Debt must be resolved within 2 sprints (for P1-P2) or tracked quarterly (for P3)
```

### Debt Categories

| Category               | Example                                  | Resolution Target           |
| ---------------------- | ---------------------------------------- | --------------------------- |
| **P1 - Critical debt** | Security vulnerability, data loss risk   | Within 1 sprint             |
| **P2 - High debt**     | Performance bottleneck, missing tests    | Within 2 sprints            |
| **P3 - Medium debt**   | Code duplication, missing documentation  | Within 1 quarter            |
| **P4 - Low debt**      | Style inconsistencies, minor refactoring | When area is being modified |

---

## Cross-Reference Summary

| Reference        | Relationship to Code Review Standards                       |
| ---------------- | ----------------------------------------------------------- |
| **TECH-001/D08** | Developer Tooling — CI pipeline, GitHub PR protection rules |
| **TECH-002/D04** | Coding Standards — reviewer checks code against these       |
| **TECH-002/D05** | Architecture Rules — reviewer verifies rule compliance      |
| **TECH-002/D06** | Testing Standards — reviewer validates test quality         |
| **TECH-002/D07** | Documentation Standards — reviewer checks doc updates       |
| **TECH-002/D08** | AI Development Guidelines — enhanced review for AI code     |
| **IMP-001/D08**  | Quality Assurance — review is a quality gate                |

---

## Document Governance

| Aspect                     | Standard                                                                    |
| -------------------------- | --------------------------------------------------------------------------- |
| **Version**                | 1.0                                                                         |
| **Status**                 | Final                                                                       |
| **Owner**                  | Chief Engineering Officer (CEngO)                                           |
| **Review Cadence**         | Semi-annually                                                               |
| **Approval Required**      | CEngO                                                                       |
| **Violation Consequences** | Unreviewed merges escalate to CEngO; PRs blocked by missing checklist items |
