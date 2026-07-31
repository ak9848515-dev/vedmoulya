# AI Development Guidelines

**TECH-002 — Document 08/10 — Engineering Standards Manual**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Engineering Officer (CEngO)
**Created:** 2026-07-27
**Cross-references:** CMP-001, CMP-002, ARC-001, ARC-005, ENG-001, ENG-002, TECH-001/D08, TECH-002/D04, TECH-002/D06, TECH-002/D07, TECH-002/D09, IMP-001/D07

---

## Purpose

This document defines the **AI Development Guidelines** for VedMoulya — how AI coding assistants (Copilot, Cursor, Codebuff, etc.) are used, governed, and reviewed in the engineering process. These guidelines ensure AI accelerates development without compromising quality, security, or architecture.

---

## AI Development Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    AI DEVELOPMENT PHILOSOPHY                              │
│                                                                           │
│  AI IS A PARTNER, NOT A REPLACEMENT                                      │
│                                                                           │
│  AI accelerates:                                                         │
│  • Routine code generation                                               │
│  • Test creation                                                         │
│  • Documentation                                                         │
│  • Boilerplate and scaffolding                                           │
│  • Refactoring                                                           │
│  • Pattern detection                                                     │
│                                                                           │
│  Humans own:                                                             │
│  • Architecture decisions                                                │
│  • Design decisions                                                      │
│  • Code correctness                                                      │
│  • Security review                                                       │
│  • Final approval                                                        │
│  • Domain knowledge                                                      │
│                                                                           │
│  NEVER:                                                                  │
│  • Deploy AI-generated code without review                               │
│  • Use AI to bypass engineering standards                                │
│  • Assume AI-generated code is correct                                   │
│  • Submit AI-generated code you don't understand                        │
│  • Let AI make architecture decisions                                    │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## AI Tool Usage Standards

### Approved AI Tools

| Tool                       | Purpose                                     | Status              | Phase   |
| -------------------------- | ------------------------------------------- | ------------------- | ------- |
| **GitHub Copilot**         | Inline code completions, chat, agent mode   | ✅ Approved         | MVP+    |
| **Cursor**                 | AI-native editing, contextual refactoring   | ✅ Approved         | MVP+    |
| **Codebuff**               | Strategic coding assistance (this tool)     | ✅ Approved         | MVP+    |
| **Claude Code**            | Complex multi-file reasoning                | ⚡ Pending review   | Growth+ |
| **ChatGPT / Claude (web)** | Research, learning, architecture discussion | ✅ Allowed (manual) | MVP+    |

### Tool Restrictions

| Restriction                           | Rationale                | Enforcement                                 |
| ------------------------------------- | ------------------------ | ------------------------------------------- |
| No AI tool may commit to repository   | Avoids unreviewed code   | Git hooks prevent AI-auto-commit            |
| No AI tool may deploy to production   | Ensure human oversight   | Deployment pipeline requires human approval |
| No AI tool may access production data | Data privacy             | Tool access restricted to non-production    |
| No AI tool may modify CI/CD config    | Infrastructure integrity | CI/CD changes require explicit PR           |

---

## AI-Generated Code Standards

### Quality Requirements

AI-generated code must meet the same quality standards as human-written code (TECH-002/D04). Additionally:

| Requirement       | Standard                                                  | Enforcement                |
| ----------------- | --------------------------------------------------------- | -------------------------- |
| **Correctness**   | Code must compile and pass tests                          | CI pipeline                |
| **Consistency**   | Must follow project conventions (naming, patterns)        | Linting + review           |
| **Reviewability** | Code must be readable and reviewable by an engineer       | PR review                  |
| **Documentation** | Public APIs must have JSDoc; complex logic needs comments | PR review                  |
| **Testability**   | Code must be testable in isolation                        | PR review                  |
| **Security**      | Must pass security review                                 | Automated + manual scan    |
| **License**       | Generated code must not violate licenses                  | AI tool license compliance |

### Prompt Engineering Standards

Engineers writing prompts for AI coding tools should follow these guidelines:

```text
PROMPT ENGINEERING GUIDELINES
══════════════════════════════

BE SPECIFIC:
  ✅ "Create a UserService class with create, update, delete methods that
     uses the UserRepository interface and validates emails using Zod schema"
  ❌ "Create a user service"

PROVIDE CONTEXT:
  ✅ "Following the Clean Architecture pattern in Project Structure (D02),
     create a domain entity for User with email value object..."
  ❌ "Create a User entity"

SPECIFY CONSTRAINTS:
  ✅ "...using Zod for validation, Vitest for testing, and following the
     naming conventions in D03"
  ❌ "...using best practices"

REQUEST TESTS:
  ✅ "...also generate unit tests with edge case coverage and integration tests"
  ❌ "...with tests if needed"
```

---

## AI Code Review Process

### AI-Generated Code: Human Review Checklist

Before approving AI-generated code, the reviewer must verify:

```markdown
### AI Code Review Checklist

- [ ] I understand every line of code
- [ ] Code follows project naming conventions (TECH-002/D03)
- [ ] Code follows coding standards (TECH-002/D04)
- [ ] Code architecture rules are not violated (TECH-002/D05)
- [ ] Tests actually test the right behavior
- [ ] No security vulnerabilities introduced
- [ ] No PII or secrets exposed
- [ ] No unnecessary dependencies added
- [ ] Error handling is correct and complete
- [ ] Edge cases are handled
- [ ] AI-generated code does not bypass privacy controls
- [ ] Code is understandable by another engineer
```

### When to Reject AI-Generated Code

```text
IMMEDIATE REJECTION IF:
  • Code contains security vulnerabilities (SQL injection, XSS, hardcoded secrets)
  • Code violates architecture rules (Level 1 or 2)
  • Code introduces license-incompatible dependencies
  • Code uses deprecated or prohibited patterns
  • Tests are missing or incomplete
  • Code is not understood by the submitting engineer

REJECTION WITH EXPLANATION IF:
  • Code is inconsistent with existing patterns
  • Code is overly complex or unreadable
  • Error handling is missing or incorrect
  • Performance concerns (N+1 queries, memory leaks)
  • Documentation is incomplete or incorrect
```

---

## AI Training and Compliance

### Data Privacy

| Rule                     | Standard                                     |
| ------------------------ | -------------------------------------------- |
| **No PII in AI prompts** | Never include personal data in AI prompts    |
| **No production data**   | Never send production data to AI tools       |
| **No secrets**           | Never include API keys, passwords, or tokens |
| **Anonymize test data**  | Use synthetic data for AI-assisted testing   |

### AI Provider Compliance

Per ARC-005 and CMP-002:

- AI providers must have contractual guarantee not to train on user data
- Context sent to providers must be the minimum necessary (ARC-005)
- Sensitive operations (career advice, financial guidance) must be flagged for human review
- AI-generated content must be labeled as such (EU AI Act compliance)

**Cross-Reference:** ARC-005 (AI Orchestrator - Minimum Context Principle), CMP-002 (AI Governance)

---

## AI in the Development Workflow

### AI-Assisted Development Flow

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    AI-ASSISTED DEVELOPMENT FLOW                           │
│                                                                           │
│  PHASE 1: UNDERSTAND (Human-Led)                                        │
│  ──────────────────────────────────                                    │
│  • Human reviews requirements, architecture, and design                 │
│  • Human writes high-level implementation plan                         │
│  • AI may be used to explore alternatives, research patterns            │
│                                                                           │
│  PHASE 2: GENERATE (AI-Led)                                            │
│  ────────────────────────────────                                      │
│  • AI generates initial code, tests, and documentation                  │
│  • AI follows project standards based on context from existing code     │
│  • Human reviews AI output for correctness and completeness             │
│  • Human fills gaps AI cannot handle                                    │
│                                                                           │
│  PHASE 3: REFINE (Human + AI)                                          │
│  ─────────────────────────────────────                                 │
│  • Human requests AI refactoring for patterns, edge cases               │
│  • AI assists with test expansion and documentation updates             │
│  • Both iterate until quality standards are met                        │
│                                                                           │
│  PHASE 4: REVIEW (Human-Led)                                           │
│  ──────────────────────────────────                                    │
│  • Human reviews final code, tests, and documentation                   │
│  • Human validates against requirements and architecture                │
│  • Human approves or requests changes                                  │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### AI Collaboration Roles

| Activity            | AI Role                                    | Human Role                           |
| ------------------- | ------------------------------------------ | ------------------------------------ |
| Architecture design | Suggest alternatives, surface implications | Make final decision                  |
| Code generation     | Generate code from specifications          | Review, edit, approve                |
| Test generation     | Generate comprehensive test cases          | Validate correctness, add edge cases |
| Debugging           | Analyze stack traces, suggest fixes        | Root cause analysis                  |
| Refactoring         | Execute refactoring patterns               | Define scope, verify behavior        |
| Documentation       | Generate README, JSDoc, API docs           | Review for accuracy, fill context    |
| Code review         | Pre-review for style, patterns, issues     | Final review, approval               |
| Dependency updates  | Identify updates, suggest changes          | Review changelog, test impact        |

---

## Guardrails and Limitations

### What AI Should NOT Do

```text
❌ AI MUST NOT:
  • Make architecture decisions (service boundaries, module structure)
  • Choose technology stacks or libraries
  • Modify CI/CD pipeline configuration
  • Access or process production data
  • Generate code that bypasses security or privacy controls
  • Write code in languages/frameworks not yet approved
  • Commit directly to main/protected branches
  • Deploy to any environment without human approval
  • Generate code with unknown license implications
  • Create user-facing content (copy, messaging) without human review

✅ AI SHOULD:
  • Follow established patterns and conventions
  • Generate tests and documentation
  • Assist with refactoring and optimization
  • Help understand existing codebases
  • Research and summarize technical topics
  • Generate boilerplate and scaffolding
  • Identify potential issues in code
```

### AI Content Labeling

Per CMP-002 and EU AI Act requirements:

```text
AI-GENERATED CONTENT LABELING
═════════════════════════════

For user-facing AI content (coaching, recommendations, analysis):
  • Clearly label: "AI-generated" or "Powered by AI"
  • Include confidence score where applicable
  • Provide explanation of how the content was generated
  • Offer human expert referral option

For engineering AI-generated code:
  • Mark as AI-generated in PR description
  • AI-generated flag in commit message: `(ai-generated)`
  • Review checklist must be completed
```

---

## Team Training and Competency

### AI Literacy Standards

| Level            | Requirement                                                | When    |
| ---------------- | ---------------------------------------------------------- | ------- |
| **Basic**        | All engineers can use Copilot for code completion          | Day 1   |
| **Intermediate** | Engineers can effectively prompt AI for complex generation | Week 1  |
| **Advanced**     | Engineers can review AI-generated code critically          | Ongoing |
| **Expert**       | Engineers can train AI on project-specific patterns        | Ongoing |

### AI Competency Checklist

Every engineer working with AI tools must demonstrate:

```markdown
- [ ] Can effectively prompt AI for code generation
- [ ] Can identify AI-generated code hallucinations and errors
- [ ] Can review AI-generated code for security issues
- [ ] Understands project standards and ensures AI follows them
- [ ] Knows when NOT to use AI (architecture decisions, security-sensitive code)
- [ ] Can modify and improve AI-generated code
- [ ] Writes clear, specific prompts with constraints and context
```

---

## Measuring AI Effectiveness

### Metrics

| Metric                    | Target                          | Measurement              |
| ------------------------- | ------------------------------- | ------------------------ |
| **Code acceptance rate**  | ≥60% AI-generated code accepted | PR statistics            |
| **Rework ratio**          | ≤20% AI code reverted/modified  | PR statistics            |
| **Quality parity**        | No higher bug rate in AI code   | Bug tracking             |
| **Engineer satisfaction** | ≥4/5 satisfaction with AI tools | Quarterly survey         |
| **Velocity improvement**  | ≥20% measurable improvement     | Sprint velocity tracking |

---

## Cross-Reference Summary

| Reference        | Relationship to AI Development Guidelines                                             |
| ---------------- | ------------------------------------------------------------------------------------- |
| **CMP-002**      | AI Governance and Compliance requirements                                             |
| **ARC-005**      | AI Orchestrator — how the platform uses AI (separate from how engineers use AI tools) |
| **TECH-001/D08** | Developer Tooling — AI tool selection and configuration                               |
| **TECH-002/D04** | Coding Standards — AI code must meet same standards                                   |
| **TECH-002/D06** | Testing Standards — AI-generated tests must be validated                              |
| **TECH-002/D09** | Code Review Standards — AI-generated code needs enhanced review                       |
| **IMP-001/D07**  | Team & AI Collaboration — how the Founder + AI model works                            |

---

## Document Governance

| Aspect                     | Standard                                       |
| -------------------------- | ---------------------------------------------- |
| **Version**                | 1.0                                            |
| **Status**                 | Final                                          |
| **Owner**                  | Chief Engineering Officer (CEngO)              |
| **Review Cadence**         | Quarterly (AI tools evolve rapidly)            |
| **Approval Required**      | CEngO + CTO                                    |
| **Violation Consequences** | AI tool access revoked for repeated violations |
