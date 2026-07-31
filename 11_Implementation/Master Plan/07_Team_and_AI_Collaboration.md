# Team and AI Collaboration

**IMP-001 — Document 07/10 — Implementation Master Plan**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Program Architect
**Created:** 2026-07-27
**Cross-references:** CMP-001, ARC-001, ARC-005, ENG-004

---

## Purpose

This document defines **how humans and AI collaborate** in the VedMoulya implementation. It establishes responsibilities for founders, AI assistants, and future engineers, and defines the collaboration model that makes AI-native development productive, safe, and high-quality.

---

## Collaboration Model

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HUMAN-AI COLLABORATION MODEL                                │
│                                                                               │
│  RESPONSIBILITY         │  FOUNDER    │  AI ASSISTANT  │  FUTURE ENGINEER    │
│ ────────────────────────┼─────────────┼────────────────┼─────────────────── │
│  Vision & Direction     │  PRIMARY     │  None          │  Input only         │
│  Architecture Decisions │  PRIMARY     │  Research      │  Input only         │
│  Code Generation        │  Review      │  PRIMARY       │  PRIMARY            │
│  Code Review            │  APPROVE     │  Pre-review    │  APPROVE            │
│  Test Generation        │  Review      │  PRIMARY       │  PRIMARY            │
│  Test Validation        │  PRIMARY     │  Execute       │  PRIMARY            │
│  Deployment             │  Approve     │  Execute       │  PRIMARY            │
│  Monitoring             │  Review      │  Execute       │  PRIMARY            │
│  Documentation          │  Review      │  PRIMARY       │  PRIMARY            │
│  Security Review        │  APPROVE     │  Scan          │  APPROVE            │
│  Architecture Fidelity  │  APPROVE     │  Check         │  APPROVE            │
│  User Feedback          │  PRIMARY     │  Analyze       │  Input              │
│  Bug Fixing             │  Review      │  PRIMARY       │  PRIMARY            │
│  Refactoring            │  Review      │  PRIMARY       │  PRIMARY            │
│  Performance Tuning     │  Review      │  Analyze       │  PRIMARY            │
│                                                                               │
│  KEY: PRIMARY = Does the work    Review = Reviews the work                    │
│       APPROVE = Has final authority        Input = Provides input             │
│       Execute = Runs the task              Analyze = Analyzes data            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Founder Responsibilities

### Role Definition

The **Founder** is the product visionary, architecture authority, and final decision-maker. In the early phases (1-3), the Founder acts as the primary human collaborator with AI. In later phases, the Founder transitions to oversight as engineers join the team.

### Responsibilities

| Area                    | Responsibility                                                                        | Time Commitment (Phase 1-2) | Time Commitment (Phase 3+) |
| ----------------------- | ------------------------------------------------------------------------------------- | --------------------------- | -------------------------- |
| **Vision**              | Define product direction, prioritize features, validate user value                    | 20%                         | 10%                        |
| **Architecture**        | Make architecture decisions, approve contract changes, resolve architectural disputes | 20%                         | 10%                        |
| **Code Review**         | Review AI-generated code, validate correctness, enforce standards                     | 25%                         | 10%                        |
| **Quality**             | Review tests, validate edge cases, approve releases                                   | 15%                         | 10%                        |
| **Collaboration**       | Pair with AI, provide context, clarify requirements                                   | 15%                         | 5%                         |
| **Engineering Culture** | Set standards, mentor future engineers, establish practices                           | 5%                          | 5%                         |

### Founder Daily Ritual

| Time        | Activity                                                           | Duration |
| ----------- | ------------------------------------------------------------------ | -------- |
| 9:00-9:15   | Standup with AI — review yesterday's work, plan today's priorities | 15 min   |
| 9:15-10:00  | Review AI-generated code from overnight batch processing           | 45 min   |
| 10:00-12:00 | Focused pair programming with AI — complex features                | 2 hours  |
| 12:00-13:00 | Lunch + AI batch processing (AI works autonomously)                | 1 hour   |
| 13:00-15:00 | Deep work — architecture, design, code review                      | 2 hours  |
| 15:00-16:00 | AI pairing — review AI output, provide feedback, iterate           | 1 hour   |
| 16:00-17:00 | Review, documentation, planning for next day                       | 1 hour   |

### Founder as AI Partner

| Principle                | Practice                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Clear context**        | Always provide complete context before asking AI to generate code. Include requirements, constraints, and examples. |
| **Specify the contract** | Define the interface before asking for implementation. Contract-first applies to AI generation too.                 |
| **Review everything**    | Never merge AI-generated code without human review. AI hallucinates, misses edge cases, and ignores context.        |
| **Teach by example**     | Show AI your preferred patterns, naming conventions, and code structure. AI learns from examples.                   |
| **Build iteratively**    | Start with a prototype, review, refine. Don't expect perfect code on the first generation.                          |
| **Test the output**      | Always run tests on AI-generated code. AI test generation = double the validation needed.                           |

---

## AI Assistant Responsibilities

### Role Definition

The **AI Assistant** is the primary code generator, test writer, documentation author, and refactoring engine. AI works under human direction, generating proposals that humans review, refine, and approve.

### AI Capabilities by Category

| Category            | AI Capability                                                    | Human Oversight Required                   |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| **Code Generation** | Write complete functions, classes, services from specifications  | Full code review                           |
| **Test Generation** | Write unit tests, integration tests, edge cases                  | Coverage validation, assertion correctness |
| **Documentation**   | Write technical docs, API docs, READMEs, ADRs                    | Accuracy validation                        |
| **Refactoring**     | Identify code improvements, rename, restructure, extract         | Functional equivalence validation          |
| **Bug Detection**   | Scan code for bugs, security vulnerabilities, performance issues | False positive triage                      |
| **Code Review**     | Pre-review PRs for style, common issues, missing tests           | Final human approval                       |
| **Research**        | Investigate libraries, patterns, best practices                  | Recommendation validation                  |
| **Data Analysis**   | Analyze logs, metrics, user feedback patterns                    | Insight interpretation                     |
| **Migration**       | Generate schema migrations, data transformation scripts          | Data integrity validation                  |
| **Configuration**   | Generate CI/CD config, Dockerfiles, deployment configs           | Security review                            |

### AI Prompting Guidelines

| Guideline                | Good Example                                                                                       | Poor Example                  |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Specify the contract** | "Write a function that takes userId and goalId and returns a list of sub-goals sorted by priority" | "Write a function for goals"  |
| **Provide context**      | "This is a Flask REST API endpoint. The User entity has id, name, email, and createdAt fields."    | "Implement the user endpoint" |
| **Define constraints**   | "Must handle empty list, invalid userId, and database timeout gracefully"                          | "Handle errors"               |
| **Show examples**        | "Input: {userId: '123', type: 'career'}. Output: [{id: '456', title: 'Learn Python'}]"             | N/A                           |
| **Set quality bar**      | "Generate unit tests with 90% coverage. Include edge cases for null, empty, and invalid inputs."   | "Write tests"                 |
| **Specify style**        | "Follow the project's existing patterns. Use type hints. Use snake_case for variables."            | N/A                           |

### AI Code Generation Workflow

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AI CODE GENERATION WORKFLOW                                │
│                                                                               │
│  STEP 1: SPECIFICATION                                                        │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ Human defines: What to build, contract interface, constraints │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                          │                                                   │
│                          ▼                                                   │
│  STEP 2: AI GENERATION                                                       │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ AI generates: Complete implementation with tests, docs        │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                          │                                                   │
│                          ▼                                                   │
│  STEP 3: AI SELF-REVIEW                                                      │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ AI reviews its own output: Correctness, style, edge cases     │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                          │                                                   │
│                          ▼                                                   │
│  STEP 4: HUMAN REVIEW                                                        │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ Human reviews: Functional correctness, security, architecture │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                          │                                                   │
│              ┌───────────┴───────────┐                                       │
│              │                       │                                       │
│              ▼                       ▼                                       │
│  STEP 5a: APPROVE              STEP 5b: REVISE                                │
│  ┌──────────────────────┐     ┌─────────────────────────────────┐           │
│  │ Merge to main branch │     │ Human provides feedback → AI   │           │
│  └──────────────────────┘     │ revises → Go to Step 3         │           │
│                               └─────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Future Engineer Responsibilities

### Role Definition

**Future Engineers** join the team in Phases 2-4. They take over day-to-day implementation from the Founder and build the team's engineering capacity.

### Engineer Roles

| Role                  | Phase Joins        | Focus                                                      |
| --------------------- | ------------------ | ---------------------------------------------------------- |
| **Backend Engineer**  | Phase 2 (Week 9)   | Service implementation, API development, data layer        |
| **AI Engineer**       | Phase 2 (Week 9)   | AI orchestration, provider integration, prompt engineering |
| **Frontend Engineer** | Phase 3 (Week 21)  | UI implementation, component development, user experience  |
| **DevOps Engineer**   | Phase 1 or Phase 2 | CI/CD, infrastructure, deployment, monitoring              |
| **QA Engineer**       | Phase 2 (Week 13)  | Test automation, performance testing, quality processes    |
| **Security Engineer** | Phase 2 (Week 17)  | Security implementation, reviews, compliance               |

### Engineer Responsibilities

| Responsibility                         | Phase 2-3 | Phase 4+ |
| -------------------------------------- | --------- | -------- |
| Implement features from specifications | PRIMARY   | PRIMARY  |
| Write tests for all implementations    | PRIMARY   | PRIMARY  |
| Review AI-generated code               | PRIMARY   | PRIMARY  |
| Review peer code                       | Review    | PRIMARY  |
| Participate in architecture reviews    | Input     | Input    |
| Maintain documentation                 | PRIMARY   | PRIMARY  |
| Fix bugs                               | PRIMARY   | PRIMARY  |
| Participate in on-call rotation        | N/A       | PRIMARY  |
| Mentor new engineers                   | N/A       | PRIMARY  |

### Engineer Role Transition

```text
PHASE 1: FOUNDER + AI
┌─────────────────────────────────────────────────────────────────┐
│ Founder pairs with AI. No human engineers. AI writes most code. │
│ Founder reviews all AI output. Code quality is Founder's job.   │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
PHASE 2-3: FOUNDER + AI + ENGINEERS
┌─────────────────────────────────────────────────────────────────┐
│ Engineers join and take over daily implementation.              │
│ AI still generates primary code. Engineers review and refine.   │
│ Founder transitions from code review to architecture oversight. │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
PHASE 4+: AI + ENGINEERS + FOUNDER (Oversight)
┌─────────────────────────────────────────────────────────────────┐
│ Engineers lead implementation. AI supports all engineers.       │
│ Founder focuses on product strategy and architecture decisions. │
│ Engineering culture is established and self-sustaining.         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Collaboration Principles

### Core Principles

| #   | Principle                                     | Why It Matters                                                                                                                             |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Humans decide, AI executes**                | AI makes suggestions, humans make decisions. AI never has authority over architecture, security, or user experience.                       |
| 2   | **Review everything AI produces**             | AI is powerful but fallible. Every line of AI-generated code is reviewed by at least one human before merging.                             |
| 3   | **AI amplifies, not replaces**                | AI amplifies human capability — the Founder + AI can match 3-5 engineers in early phases. AI does not replace the need for human judgment. |
| 4   | **Context is king**                           | AI output quality is directly proportional to input context quality. Invest time in specification.                                         |
| 5   | **Teach AI your standards**                   | AI learns from examples and feedback. Invest early in showing AI your preferred patterns.                                                  |
| 6   | **AI writes first draft, human writes final** | AI generates the first version. Human refines, extends, and validates. The final version is always human-approved.                         |
| 7   | **Security is never delegated to AI**         | AI can scan for vulnerabilities, but security decisions (what's safe, what's acceptable risk) are human-only.                              |
| 8   | **Architecture is never delegated to AI**     | AI can research options and suggest patterns, but architecture decisions are human-made and documented in ADRs.                            |

### Anti-Patterns

| Anti-Pattern                                   | Why It Fails                                        | Correct Approach                                           |
| ---------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| **"AI, build the whole system"**               | Loss of control, architecture drift, security holes | Break into small tasks, review each one                    |
| **"AI, fix this bug" without context**         | Wrong fix, new bugs introduced                      | Provide reproduction steps, expected behavior, constraints |
| **"AI, generate the tests" without reviewing** | Tests that test the wrong thing                     | Review test logic, not just that they pass                 |
| **"AI, refactor this" without tests**          | Behavior changes, regression                        | Ensure test coverage before AI refactoring                 |
| **"AI, write the docs" without review**        | Incorrect or misleading documentation               | Verify every technical claim in AI-generated docs          |

---

## Communication Model

### Human-AI Communication

| Channel           | Frequency                       | Purpose                                                  |
| ----------------- | ------------------------------- | -------------------------------------------------------- |
| **Direct prompt** | Continuous                      | Task specification, code generation requests             |
| **AI summary**    | Hourly (during coding sessions) | Progress update, issues found, suggestions               |
| **AI review**     | Per PR                          | Code review comments, issues detected                    |
| **AI analysis**   | On demand                       | Root cause analysis, performance analysis, security scan |

### Human-Human Communication (After Engineers Join)

| Ceremony            | Frequency | Participants             | Purpose                 |
| ------------------- | --------- | ------------------------ | ----------------------- |
| Daily standup       | Daily     | Full team                | Synchronize, unblock    |
| Sprint planning     | Weekly    | Full team                | Plan sprint work        |
| Sprint review       | Weekly    | Full team + stakeholders | Demo completed work     |
| Retrospective       | Weekly    | Full team                | Process improvement     |
| Architecture review | Bi-weekly | Architects + Tech Leads  | Architecture alignment  |
| Security review     | Monthly   | Security + Engineering   | Security posture        |
| 1:1 with Founder    | Weekly    | Each engineer            | Career growth, feedback |

---

## Collaboration Tools

| Tool                       | Purpose                          | AI Integration                                     |
| -------------------------- | -------------------------------- | -------------------------------------------------- |
| **GitHub/GitLab**          | Version control, code review     | AI generates PRs, reviews code, suggests changes   |
| **CI/CD Pipeline**         | Automated build, test, deploy    | AI generates pipeline config, analyzes failures    |
| **Project Board**          | Task tracking, sprint management | AI updates tasks, generates reports                |
| **Documentation Platform** | Knowledge base, ADRs, runbooks   | AI generates and maintains docs                    |
| **Monitoring Dashboard**   | System health, performance       | AI analyzes metrics, detects anomalies             |
| **Communication Platform** | Team chat, standups, alerts      | AI summarizes conversations, surfaces action items |

---

## Cross-References

| Reference | Relationship                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------------- |
| CMP-001   | "Open collaboration" — AI is a collaborator, not a replacement. Human judgment always prevails.      |
| ARC-001   | Architecture decisions are never delegated to AI. ADRs document human-made decisions.                |
| ARC-005   | AI Orchestrator patterns in the product mirror the AI collaboration patterns in development          |
| ENG-004   | The Founder + AI collaboration model enables a small team to implement the entire Solution Blueprint |
