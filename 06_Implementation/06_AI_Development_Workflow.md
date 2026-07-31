# AI Development Workflow

**BLP-001 — Document 06/15 — Implementation Strategy & Delivery Blueprint**
**Version:** 1.0
**Status:** LOCKED
**Owner:** AI Engineering Lead
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines the **AI development workflow** for VedMoulya — how AI coding agents are used, how they are prompted, how their output is reviewed, and how quality is maintained. This is the definitive guide for every AI-assisted development activity.

---

## AI Coding Standards

### General Principles

| Principle                                   | Description                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| **AI writes the first pass**                | Every code change starts with AI generating the initial implementation   |
| **Human validates the output**              | Every AI-generated change is reviewed by at least one human              |
| **AI follows the same standards**           | AI-generated code must pass the same quality gates as human-written code |
| **AI does not make architecture decisions** | Architecture decisions require human judgment                            |
| **AI does not deploy to production**        | Deployment requires human approval                                       |
| **AI outputs are traceable**                | Every AI-generated change is tagged and traceable                        |

### AI Capability Boundaries

| Capability               | AI Role                     | Human Oversight                       |
| ------------------------ | --------------------------- | ------------------------------------- |
| Code generation          | First pass                  | Full code review                      |
| Test generation          | First pass                  | Coverage validation, edge case review |
| Documentation            | First draft                 | Accuracy review                       |
| Refactoring              | Suggestion + execution      | Functional equivalence validation     |
| Bug fixing               | Diagnosis + fix suggestion  | Fix validation, regression testing    |
| Code review              | Surface issues, suggestions | Final approval                        |
| Migration scripts        | Generation                  | Data integrity validation             |
| Performance optimization | Identification + suggestion | Benchmark validation                  |
| Security analysis        | Surface vulnerabilities     | Vulnerability validation              |
| Architecture analysis    | Document current state      | Architecture decisions                |

---

## Prompt Lifecycle

### Prompt Definition Process

```text
Requirement → Context Assembly → Prompt Construction → AI Generation →
Output Validation → Feedback → Prompt Refinement

1. REQUIREMENT: Clear, concise statement of what to build
2. CONTEXT: Relevant files, contracts, architecture docs, coding standards
3. PROMPT: Structured prompt following prompt templates
4. GENERATION: AI produces initial implementation
5. VALIDATION: Automated checks (lint, typecheck, test)
6. FEEDBACK: Issues are fed back to AI for refinement
7. REFINEMENT: Prompt updated based on what worked/didn't work
```

### Prompt Structure

Every prompt MUST follow this structure:

```
ROLE: [Specific role the AI should adopt]
CONTEXT: [Relevant files, architecture, constraints]
TASK: [Clear, atomic task description]
CONSTRAINTS: [Standards, patterns, conventions to follow]
OUTPUT: [Expected output format]
EXAMPLES: [Positive/negative examples if helpful]
```

### Prompt Templates

| Template                   | Use Case                  | Key Elements                                                            |
| -------------------------- | ------------------------- | ----------------------------------------------------------------------- |
| **Service Implementation** | Building a new service    | Contract, entity model, dependency list, test requirements              |
| **UI Component**           | Building a UI component   | Design spec, Experience Bible rules, accessibility requirements, states |
| **Integration Test**       | Writing integration tests | Service contracts, expected behaviors, error cases                      |
| **Refactoring**            | Refactoring existing code | Current code, target pattern, behavioral equivalence requirements       |
| **Bug Fix**                | Fixing a defect           | Bug report, reproduction steps, expected behavior, fix constraints      |

### Prompt Quality Criteria

| Criteria        | Description                                                |
| --------------- | ---------------------------------------------------------- |
| **Atomic**      | One prompt = one task. No compound prompts.                |
| **Specific**    | Specify exact output, not general instructions             |
| **Constrained** | Include all constraints (standards, patterns, conventions) |
| **Contextual**  | Include sufficient context for accurate generation         |
| **Verifiable**  | Output can be verified against acceptance criteria         |

---

## Context Management

### Context Assembly Rules

| Rule                      | Description                                                      |
| ------------------------- | ---------------------------------------------------------------- |
| **Minimum context**       | Include only the files directly relevant to the task             |
| **Contract first**        | Always include the service contract being implemented            |
| **Architecture relevant** | Include architecture decisions that constrain the implementation |
| **Standard references**   | Reference but don't include full standards documents             |
| **Dependency awareness**  | Include interfaces/types from direct dependencies                |

### Context Sources

| Source                 | When to Include                   | Example                                       |
| ---------------------- | --------------------------------- | --------------------------------------------- |
| Service contract       | Always for service code           | `services/career/contract.ts`                 |
| Entity model           | For data-related code             | `packages/domain/entities/career.ts`          |
| Interface definitions  | For implementing interfaces       | `packages/domain/contracts/career-service.ts` |
| Related implementation | For extending existing code       | `services/career/src/career-service.ts`       |
| Test patterns          | For test generation               | `services/career/test/__snapshots__/`         |
| Architecture decisions | For architecture-constrained code | `docs/adr/012-ai-provider-abstraction.md`     |

### Context Budget

| Model    | Max Context | Recommended             |
| -------- | ----------- | ----------------------- |
| GPT-4    | 128K tokens | 40K-80K tokens optimal  |
| DeepSeek | 128K tokens | 40K-80K tokens optimal  |
| Claude   | 200K tokens | 60K-100K tokens optimal |

---

## Code Review Workflow

### AI-to-Human Review Flow

```text
AI generates code ──→ AI self-review ──→ Automated gates ──→ Human review ──→ Merge
                          │                    │                    │
                          │                    ▼                    │
                          │              Fail → AI refinement      │
                          │                                        │
                          ▼                                        │
                    Issues found → AI refinement ──────────────────→│
                                                                    ▼
                                                              Approve → Merge
```

### AI Self-Review Checklist

Before presenting code for human review, AI MUST verify:

| #   | Check                          | Verification         |
| --- | ------------------------------ | -------------------- |
| 1   | Code compiles                  | Build passes         |
| 2   | Tests pass                     | All tests green      |
| 3   | Linting passes                 | No lint errors       |
| 4   | No exposed secrets             | Secrets detected?    |
| 5   | No security anti-patterns      | OWASP checks passed  |
| 6   | Follows engineering principles | Principles checklist |
| 7   | Documentation updated          | Doc changes included |
| 8   | No dead code/comments          | Clean code verified  |

### Human Review Requirements

| Review Type         | Required For                    | Reviewer            |
| ------------------- | ------------------------------- | ------------------- |
| Full code review    | All production code             | At least 1 engineer |
| Architecture review | New services, major changes     | Software Architect  |
| Security review     | Auth, encryption, data handling | Security Engineer   |
| Design review       | UI components, screens          | Design Lead         |
| AI quality review   | AI prompt changes, model config | AI Engineering Lead |

---

## Human Approval Checkpoints

### Mandatory Checkpoints

| Checkpoint              | When                  | Who Approves           | What's Checked                      |
| ----------------------- | --------------------- | ---------------------- | ----------------------------------- |
| **Sprint Planning**     | Monday                | Tech Lead              | Task scope, estimates, dependencies |
| **Contract Review**     | Before implementation | Architect              | Contract correctness, completeness  |
| **Architecture Review** | New services          | Software Architect     | Architecture compliance             |
| **Code Review**         | Every PR              | At least 1 engineer    | Code quality, standards compliance  |
| **Security Review**     | Every release         | Security Engineer      | Security vulnerabilities            |
| **Design Review**       | UI changes            | Design Lead            | Experience Bible compliance         |
| **Release Approval**    | Every release         | Engineering Governance | Release DoD completeness            |

### Emergency Override

In emergency situations (security vulnerability, production outage):

```text
Emergency → Direct Fix → Post-facto Review → Documentation
```

Emergency fixes require:

1. Immediate fix with known-good pattern
2. Post-facto review within 24 hours
3. Documentation of what happened and why

---

## Architecture Validation

### Automated Architecture Validation

| Check                 | Tool                    | When                     |
| --------------------- | ----------------------- | ------------------------ |
| Dependency direction  | Architecture test suite | CI (every commit)        |
| Layer boundaries      | Architecture test suite | CI (every commit)        |
| Circular dependencies | Dependency cruiser      | CI (every commit)        |
| Contract compliance   | Contract test suite     | CI (every commit)        |
| API versioning        | API diff tool           | CI (on release branches) |

### Architecture Review Triggers

| Trigger                          | Action                       | Reviewer            |
| -------------------------------- | ---------------------------- | ------------------- |
| New service creation             | Architecture review required | Software Architect  |
| New external dependency          | Architecture review required | Software Architect  |
| Contract change (breaking)       | Architecture review required | Software Architect  |
| Data model change (non-additive) | Architecture review required | Data Engineer       |
| AI model/provider change         | Architecture review required | AI Engineering Lead |

---

## Regression Strategy

### Regression Prevention

| Layer                  | Strategy                               | Implementation            |
| ---------------------- | -------------------------------------- | ------------------------- |
| Unit tests             | All PRs require new tests for new code | CI enforces coverage      |
| Integration tests      | All integration flows tested per PR    | CI runs integration suite |
| Contract tests         | All API contracts validated per change | CI runs contract tests    |
| Visual regression      | UI screenshots compared per PR         | CI runs visual diff       |
| Performance regression | Performance benchmarks compared        | CI runs perf tests        |

### Regression Detection

```text
Commit → CI Pipeline:
  1. TypeScript compilation
  2. Linting (ESLint + Prettier)
  3. SAST security scan
  4. Unit tests with coverage
  5. Integration tests
  6. Contract tests
  7. Visual regression tests (UI changes)
  8. Performance benchmarks (perf-critical changes)
  9. Build packaging
```

---

## Documentation Updates

### Documentation Triggers

| Change Type           | Documentation Required               | Format       |
| --------------------- | ------------------------------------ | ------------ |
| New API endpoint      | API doc update                       | OpenAPI spec |
| New service           | Service README + architecture doc    | Markdown     |
| Architecture decision | ADR                                  | ADR template |
| Configuration change  | Configuration doc update             | Markdown     |
| Workflow change       | Workflow doc update                  | Markdown     |
| API breaking change   | Migration guide + deprecation notice | Markdown     |

### AI Documentation Role

| Documentation Task | AI Role                          | Human Role                  |
| ------------------ | -------------------------------- | --------------------------- |
| API docs from spec | Generate from OpenAPI spec       | Review for accuracy         |
| README updates     | Draft updates                    | Review for completeness     |
| Inline code docs   | Generate JSDoc/TSDoc             | Review for correctness      |
| Migration guides   | Draft migration steps            | Validate technical accuracy |
| Runbook generation | Generate from deployment scripts | Review and test             |

---

## Traceability

### Traceability Requirements

| Artifact      | Traced To  | Trace Method                            |
| ------------- | ---------- | --------------------------------------- |
| Code change   | Task/issue | Branch name + commit message convention |
| PR            | Task/issue | PR title/description links to issue     |
| Commit        | PR         | Commit message references PR number     |
| Test          | Code       | Test file mirrors source file structure |
| Documentation | Feature    | Doc references feature ID               |
| Deployment    | Release    | Release tag references commit SHA       |

### Commit Message Convention

```
type(scope): brief description

- type: feat, fix, refactor, test, docs, style, chore, perf, security
- scope: service/package name (career, learning, knowledge-graph, etc.)
- description: imperative mood, lowercase, no period
- Body: optional details, references issue/PR number

Example:
feat(career): add skill gap analysis endpoint

Implements the /career/skills/gap endpoint that compares
current skills against target role requirements.
Refs: #142
```

### PR Convention

```
Title: [type(scope)] Brief description

Description:
- What this PR does
- Why this change is needed
- How it was tested
- Screenshots (UI changes)
- Breaking changes (if any)

Checklist:
- [ ] Code compiles
- [ ] Tests pass
- [ ] Linting passes
- [ ] Documentation updated
- [ ] Security reviewed
- [ ] Accessibility verified (UI changes)
```

---

## Architecture References

| Reference      | Relationship                                                   |
| -------------- | -------------------------------------------------------------- |
| ARC-005        | AI Orchestrator abstraction enables provider-agnostic workflow |
| ENG-002        | Service contracts define the input for AI code generation      |
| DES-010A / D04 | AI Experience Language governs AI communication patterns       |

---

## Cross-References

| Reference      | Relationship                                                  |
| -------------- | ------------------------------------------------------------- |
| BLP-001 / D01  | AI-powered development implements the Implementation Strategy |
| BLP-001 / D02  | Engineering Principles govern AI-generated code quality       |
| BLP-001 / D07  | Human-AI Collaboration defines who does what                  |
| BLP-001 / D08  | Quality Gates validate AI-generated output                    |
| DES-010A / D00 | Experience Bible governs all UI generated by AI               |

---

## Quality Review

| Dimension                         | Assessment                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Why**                           | AI development without defined workflows produces inconsistent, unverifiable code.                    |
| **Engineering Reasoning**         | Structured prompts, self-review, and human checkpoints maximize AI benefit while maintaining quality. |
| **Psychology Reasoning**          | Clear AI/human role boundaries reduce anxiety about AI replacing human judgment.                      |
| **Accessibility Impact**          | AI-generated UI must pass accessibility gates just like human-written code.                           |
| **Trust Impact**                  | Every AI output is human-verified, maintaining trust in the development process.                      |
| **Consistency with DES Missions** | AI behavior follows DES-010A AI Experience Language guidelines.                                       |
| **Implementation Complexity**     | LOW — Process definition is simple; adherence requires discipline.                                    |
| **Future Scalability**            | The workflow scales to any number of AI agents — the human review loop is the constant.               |

---

## Design Freeze Status

| Status    | Date       | Notes                                                                                       |
| --------- | ---------- | ------------------------------------------------------------------------------------------- |
| ✅ LOCKED | 2026-07-27 | AI Development Workflow v1.0 frozen. Changes require Engineering Governance Board approval. |
