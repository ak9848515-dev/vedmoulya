# Domain Glossary

**ENG-001 — Document 08/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Domain Architect
**Created:** 2026-07-25
**Cross-references:** CMP-001, PRD-001, PRD-002, RSH-001, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005

---

## Purpose

This glossary defines every important business term in the VedMoulya domain. It is written in plain, accessible language that any team member — architect, engineer, product manager, coach, or business stakeholder — can understand. This becomes the company's shared vocabulary.

---

## A

### Achievement

A significant outcome that the user has accomplished. Achievements become Portfolio items. They may be skill-based, project-based, or milestone-based.

### Active Income

Income earned through direct effort (client work, services, projects). Distinguished from Passive Income.

### Adaptive Planning

The ability to adjust execution plans automatically when circumstances change. Life happens — plans adapt.

### Aggregate

A cluster of domain objects treated as a single unit for data changes. Each aggregate has a root entity. See 03_Aggregates.md.

### AI Orchestrator

The system component that routes AI requests to the best provider. VedMoulya's intelligent switchboard for AI capabilities. See ARC-005.

### Assessment

A measurement of the user's capabilities, knowledge, or personality. Assessments can be formal (tests) or informal (AI inference).

---

## B

### Bounded Context

A boundary within which a particular domain model applies. Each bounded context has its own ubiquitous language. See 02_Bounded_Contexts.md.

### Burnout

A state of physical and mental exhaustion caused by excessive or prolonged stress. VedMoulya actively monitors and prevents burnout through hard policies. See ARC-004.

### Business

A commercial entity or practice the user operates. Can be freelance, agency, product company, or service practice.

---

## C

### Capability

A type of task an AI provider can perform (Coding, Reasoning, Vision, etc.). The AI Orchestrator routes requests based on capability requirements. See ARC-005.

### Career

The user's professional journey — roles, industries, skills, and progression over time.

### Client

A person or organization that pays for the user's services. Clients are tracked in the Business domain.

### Coach

The intelligent guidance system that provides encouragement, challenge, and accountability. Can be AI-driven or human-assisted.

### Confidence

A measure of certainty (0.0-1.0). Used for DNA attributes, decisions, and knowledge quality. Higher confidence = more reliable.

### Context

The user's current situational factors — time availability, location, energy, responsibilities. Context changes frequently and affects all recommendations.

### Core Domain

A domain that provides competitive advantage and must be built in-house. VedMoulya's core domains: Identity, Knowledge, Execution, Career.

---

## D

### Decision

A choice between multiple options. VedMoulya supports 10 decision types (Career, Learning, Business, Financial, etc.). Each decision is recorded with context, options, and outcome.

### Decomposition

The process of breaking high-level goals into detailed, actionable sub-goals. Follows an 8-level hierarchy from Vision to Micro Actions.

### DNA

See User DNA.

### Domain Event

A record of a significant business occurrence, named in past tense (GoalCreated, MissionCompleted). Events drive reactive workflows. See 06_Domain_Events.md.

### Domain Service

A stateless business operation that coordinates across multiple entities. The verbs of the domain. See 07_Domain_Services.md.

### Duration

A length of time (e.g., 45 minutes, 2 weeks). Used for task estimation and planning.

---

## E

### Entity

An object with continuous identity that exists over time. Distinguished from Value Objects, which are defined by their attributes. See 04_Entities.md.

### Execution

The act of transforming intention into outcome. VedMoulya's core capability and competitive advantage. See ARC-004.

### Execution Engine

The system component that manages the execution lifecycle — planning, scheduling, executing, tracking, and adapting. See ARC-004.

### Execution Plan

A structured, time-bound sequence of actions designed to achieve goals. Plans are living structures that adapt to reality.

---

## F

### Feedback Loop

The cycle of action → outcome → learning → improvement. Every execution generates feedback that improves future execution.

### Financial Goal

A target related to income, savings, investment, or financial independence.

### Freelance

Self-employed work where the user offers services to multiple clients. A common path on VedMoulya's Earn journey.

---

## G

### Goal

A desired outcome the user wants to achieve. Goals exist at 8 levels of decomposition, from Life Vision to Micro Actions.

### Goal Decomposition

The 8-level hierarchy that connects abstract visions to concrete actions. See ARC-004.

### Growth

The user's rate of improvement across skills, income, knowledge, and capabilities.

### Growth Rate

The rate of change of a metric over time. Used to track progress momentum.

---

## H

### Hard Policy

A rule that cannot be overridden, even by AI recommendations. Examples: No Burnout, Human First, Safety. See ARC-004.

### Health Score

An overall measure (0.0-10.0) of the user's livelihood ecosystem health. Combines financial, skills, career, learning, energy, and satisfaction dimensions.

### HPI

See Human Progress Index.

### Human Journey

The lifecycle of a user's growth — 12 stages from Survive through Legacy. Each stage has different needs, capabilities, and platform behaviors. See PRD-001.

### Human Problems

Validated challenges that real people face in building sustainable livelihoods. The foundation of VedMoulya's product decisions. See RSH-001.

### Human Progress Index (HPI)

A composite score measuring the user's overall progress toward a sustainable livelihood. Combines multiple dimensions: skills, income, knowledge, health, etc. See PRD-001.

---

## I

### Identity

The user's core identity — demographic information, background, and authentication credentials.

### Income

Money earned from work, investments, or passive sources. Tracked per source for diversification analysis.

### Invoice

A billing record sent to a client for services rendered. Part of the Business domain.

---

## J

### Journey Stage

The user's current position in the 12-stage Human Journey. Determines which domain features are most relevant.

---

## K

### Knowledge

What the user knows — skills, concepts, facts, experiences, and insights. Stored in the Knowledge Graph.

### Knowledge Graph

A permanent, evolving, connected model of everything the user knows and has done. The user's second brain. See ARC-003.

### Knowledge Node

A single unit of knowledge — a skill, concept, fact, experience, or insight. Nodes are connected through typed relationships.

---

## L

### Learning

The process of acquiring knowledge and skills. VedMoulya recommends learning paths, tracks progress, and celebrates improvement.

### Learning Path

A structured sequence of courses, resources, and activities designed to achieve a specific skill level.

### Learning Style

How the user learns best — visual, auditory, reading, kinesthetic, or mixed. Used to personalize learning recommendations.

### Livelihood

A sustainable means of living — the combination of career, business, skills, and income that supports the user's life.

---

## M

### Marketplace

The platform where users exchange value — find opportunities, offer services, and transact with clients.

### Milestone

A significant checkpoint within a project, mission, or goal. Milestones mark progress and trigger celebrations.

### Mission

A time-bound, structured endeavor that operationalizes a goal. Missions have scope, tasks, and measurable outcomes.

### Money

A monetary amount in a specific currency. Always handled as Amount + Currency (e.g., Money(100, "USD")).

---

## N

### No Burnout Policy

A hard policy that prevents the system from recommending unsustainable workloads. Human well-being comes before productivity. See ARC-004.

### Notification

A message delivered to the user across any channel (in-app, email, push). Used for alerts, reminders, and celebrations.

---

## O

### Opportunity

An external match for the user — job, gig, project, client, or collaboration. Found by the Opportunity Engine and matched to the user's DNA.

### Opportunity Engine

The system component that identifies, scores, and surfaces matching opportunities.

### Outcome

The result of an execution, decision, or action. Outcomes feed the Knowledge Graph and improve future decisions.

---

## P

### Passive Income

Income earned without active work (investments, royalties, automated products). Distinguished from Active Income.

### Personality

The user's psychological traits relevant to execution — structure preference, risk tolerance, social orientation, etc.

### Planning

The process of converting goals into actionable, time-bound execution plans.

### Portfolio

A curated collection of what the user has built and achieved — their proof of work.

### Priority

The importance or urgency of a goal, task, or action. Levels 1 (Critical) through 5 (Optional).

### Progress

A measurement of completion — percentage from 0% (not started) to 100% (complete).

### Project

A substantial outcome-oriented body of work that produces something of value.

### Provider

An external AI service that executes tasks on behalf of VedMoulya. Providers are interchangeable.

---

## R

### Recommendation

A personalized suggestion for what the user should do, learn, or pursue — with explanation.

### Risk

A potential negative outcome that could affect the user's livelihood. Risks are identified, assessed, and mitigated.

---

## S

### Service

A specific offering the user provides to clients. Services have scope, pricing, and quality standards.

### Skill

A learned ability to perform a task. Skills are stored as Knowledge Nodes with proficiency levels (1-10).

### Skill Level

A user's proficiency in a specific skill, measured on a 1-10 scale (Beginner → Expert).

### Sustainable Livelihood

The ultimate goal — a way of living that meets needs without depleting resources or causing burnout.

---

## T

### Task

An atomic unit of work. The smallest meaningful action in the execution hierarchy.

### Time Block

A scheduled period of time for an activity. Basic unit of scheduling.

---

## U

### Ubiquitous Language

A shared language that all team members use consistently. Ensures that business concepts are expressed the same way in conversations, code, and documentation.

### User

The person using VedMoulya. The central entity around which everything revolves.

### User DNA

VedMoulya's proprietary framework for understanding each user as a unique individual across 8 dimensions. See PRD-002.

---

## V

### Value Object

An immutable object defined by its attributes, not its identity. Two value objects with the same attributes are equal. See 05_Value_Objects.md.

### Vision

The user's highest-level aspiration — their life purpose. Level 1 in the goal decomposition hierarchy.

---

## W

### Work

The application of skills and knowledge to create value. Work can be for clients, for a business, or for personal projects.

---

## Z

### Zone

The user's optimal state for productive work. Determined by energy patterns, time of day, and context.

---

## Glossary Usage Guidelines

1. **Use these terms consistently** in all product, design, engineering, and business communications.
2. **When adding a new term**, add it to this glossary with a clear, plain-language definition.
3. **When a term has multiple interpretations**, note the context in which each interpretation applies.
4. **When in doubt**, consult this glossary. If the term isn't here, define it before using it.

---

## Cross-References

| Reference | Relationship                                                      |
| --------- | ----------------------------------------------------------------- |
| CMP-001   | Constitutional terms (Mission, Vision, Values) are the foundation |
| PRD-001   | Journey-related terms (Stage, HPI, Transition)                    |
| PRD-002   | DNA-related terms (Dimension, Confidence, Inference)              |
| RSH-001   | Problem-related terms (Problem, Solution, Validation)             |
| ARC-001   | System terms (Component, Layer, Engine, Context)                  |
| ARC-002   | Decision terms (Decision Type, Score, Criteria)                   |
| ARC-003   | Knowledge terms (Node, Edge, Graph, Quality)                      |
| ARC-004   | Execution terms (Lifecycle, Goal, Plan, Task, Policy)             |
| ARC-005   | Orchestration terms (Provider, Capability, Routing)               |
