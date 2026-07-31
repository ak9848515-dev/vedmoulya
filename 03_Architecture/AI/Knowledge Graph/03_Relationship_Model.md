# Relationship Model

**ARC-003 — Document 03/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Knowledge Architect
**Created:** 2026-07-24
**Cross-references:** ARC-003/D01, ARC-003/D02, ARC-001

---

## Purpose

The Relationship Model defines the **conceptual connection types** that link entities within the Life Knowledge Graph. Relationships are what transform isolated facts into an intelligent, connected understanding of a person's life journey.

This is NOT a database schema. There are no edge types, indexes, or traversal specifications. Only meaning and purpose are defined.

---

## Relationship Philosophy

A relationship in the Life Knowledge Graph must answer three questions:

1. **What** is the connection? (type)
2. **Why** does it exist? (purpose)
3. **When** was it valid? (temporal context)

Every relationship has a direction, a meaning, and a time range.

---

## Relationship Categories

Relationships are grouped into categories based on their semantic role:

| Category        | Purpose                         | Example                      |
| --------------- | ------------------------------- | ---------------------------- |
| **Ownership**   | Who an entity belongs to        | User HAS_GOAL                |
| **Progression** | How entities advance each other | Skill IMPROVES Goal          |
| **Dependency**  | What depends on what            | Task DEPENDS_ON Skill        |
| **Causality**   | What caused what                | Decision RESULTED_IN Outcome |
| **Composition** | What something is made of       | Mission CONTAINS Project     |
| **Association** | General relatedness             | Knowledge RELATED_TO Skill   |
| **Temporal**    | When things happen              | Milestone OCCURRED_AT Time   |

---

## Relationship Definitions

### 1. HAS_GOAL

**Category:** Ownership
**Direction:** User → Goal
**Meaning:** The User has defined a goal they want to achieve.
**Importance:** Foundational — goals drive everything else.
**Example:** User HAS_GOAL "Build a sustainable freelancing business"

### 2. HAS_SKILL

**Category:** Ownership
**Direction:** User → Skill
**Meaning:** The User possesses or is developing this skill.
**Importance:** Defines capability baseline.
**Example:** User HAS_SKILL "Python Programming"

### 3. HAS_KNOWLEDGE

**Category:** Ownership
**Direction:** User → Knowledge
**Meaning:** The User has learned and understands this knowledge.
**Importance:** Captures intellectual capital.
**Example:** User HAS_KNOWLEDGE "Machine Learning Fundamentals"

### 4. LEARNED

**Category:** Progression
**Direction:** Learning → Skill / Learning → Knowledge
**Meaning:** A learning activity resulted in acquiring a skill or knowledge.
**Importance:** Tracks how skills and knowledge were obtained.
**Example:** Course "Flutter Development" LEARNED Skill "Mobile App Development"

### 5. IMPROVES

**Category:** Progression
**Direction:** Skill → Goal / Knowledge → Skill
**Meaning:** Having this skill or knowledge advances progress toward a goal or improves another skill.
**Importance:** Enables capability-based reasoning for recommendations.
**Example:** Skill "Public Speaking" IMPROVES Goal "Become a Thought Leader"

### 6. WORKS_ON

**Category:** Ownership
**Direction:** User → Project / User → Mission
**Meaning:** The User is actively engaged in this project or mission.
**Importance:** Tracks current focus and execution.
**Example:** User WORKS_ON Project "Build Portfolio Website"

### 7. PART_OF

**Category:** Composition
**Direction:** Project → Mission / Task → Project / Module → Course
**Meaning:** One entity is a component of another.
**Importance:** Establishes hierarchy and structure.
**Example:** Project "Build Portfolio Website" PART_OF Mission "Establish Online Presence"

### 8. DEPENDS_ON

**Category:** Dependency
**Direction:** Entity → Entity (any)
**Meaning:** Progress on the source entity requires the target entity to be completed or acquired first.
**Importance:** Enables dependency-aware planning and sequencing.
**Example:** Task "Deploy Application" DEPENDS_ON Task "Write Deployment Script"

### 9. COMPLETED

**Category:** Progression
**Direction:** User → Entity (Achievement, Milestone, Project, Task)
**Meaning:** The User has finished this entity.
**Importance:** Marks accomplishment and progress.
**Example:** User COMPLETED Milestone "Launched First Product"

### 10. BLOCKED_BY

**Category:** Dependency
**Direction:** Entity → Problem / Entity → Missing Skill
**Meaning:** Progress on this entity is blocked by a problem or missing capability.
**Importance:** Identifies obstacles that need resolution.
**Example:** Project "Mobile App Launch" BLOCKED_BY Problem "App Store Rejection"

### 11. RESULTED_IN

**Category:** Causality
**Direction:** Decision → Outcome / Action → Result
**Meaning:** A decision or action produced a specific outcome.
**Importance:** Creates the feedback loop for learning from decisions.
**Example:** Decision "Switch to Freelancing" RESULTED_IN Outcome "Income Increased by 40%"

### 12. CAUSED

**Category:** Causality
**Direction:** Problem → Decision / Problem → Learning
**Meaning:** A problem triggered a decision or learning activity.
**Importance:** Shows the chain from challenges to actions.
**Example:** Problem "Low Client Retention" CAUSED Learning "Customer Success Strategies"

### 13. EARNED_FROM

**Category:** Association
**Direction:** Income → Client / Income → Service / Income → Project
**Meaning:** This income was generated from this source.
**Importance:** Tracks financial因果关系.
**Example:** Income "$5,000" EARNED_FROM Client "Acme Corp"

### 14. SPENT_ON

**Category:** Association
**Direction:** Expense → Learning / Expense → Tool / Expense → Business
**Meaning:** This expense was used for this purpose.
**Importance:** Tracks investment and spending patterns.
**Example:** Expense "$200" SPENT_ON Course "Advanced React"

### 15. CONNECTED_TO

**Category:** Association
**Direction:** Entity ↔ Entity (general)
**Meaning:** Two entities are related in a meaningful but non-specific way.
**Importance:** Provides a generic association for relationships that don't fit other types.
**Example:** Skill "UI Design" CONNECTED_TO Skill "User Research"

### 16. RELATED_TO

**Category:** Association
**Direction:** Entity ↔ Entity (weaker than CONNECTED_TO)
**Meaning:** Two entities share some common ground or context.
**Importance:** Enables broad relationship discovery.
**Example:** Book "Atomic Habits" RELATED_TO Goal "Build Better Routines"

### 17. SUPPORTS

**Category:** Progression
**Direction:** Entity → Entity
**Meaning:** One entity supports or enables progress on another.
**Importance:** Broader than IMPROVES — includes indirect support.
**Example:** Relationship "Mentor John" SUPPORTS Career "Software Engineering"

### 18. CREATED

**Category:** Ownership
**Direction:** User → Document / User → Portfolio Item / User → Content
**Meaning:** The User authored or created this entity.
**Importance:** Captures the User's creative output.
**Example:** User CREATED Document "Project Architecture Design"

### 19. RECOMMENDED_BY

**Category:** Association
**Direction:** Entity → Entity
**Meaning:** One entity was recommended based on another.
**Importance:** Tracks the recommendation chain for explainability.
**Example:** Course "Data Science" RECOMMENDED_BY Skill "Statistics"

### 20. INFLUENCED

**Category:** Causality
**Direction:** Entity → Decision
**Meaning:** This entity played a role in a decision the User made.
**Importance:** Enables decision explainability.
**Example:** Book "Zero to One" INFLUENCED Decision "Start a Tech Company"

### 21. APPLIED_FOR

**Category:** Association
**Direction:** User → Job / User → Opportunity
**Meaning:** The User applied for this job or opportunity.
**Importance:** Tracks career pursuit activity.
**Example:** User APPLIED_FOR Job "Senior Developer at Google"

### 22. OFFERED

**Category:** Association
**Direction:** Company → Job / Client → Opportunity
**Meaning:** An organization offered a position or opportunity.
**Importance:** Captures incoming opportunities.
**Example:** Company "StartupX" OFFERED Job "CTO Position"

### 23. MENTORED_BY

**Category:** Association
**Direction:** User → Person
**Meaning:** The User receives guidance from this person.
**Importance:** Captures growth relationships.
**Example:** User MENTORED_BY Person "Sarah Chen"

### 24. ATTENDED

**Category:** Temporal
**Direction:** User → Event / User → Interview
**Meaning:** The User participated in this event.
**Importance:** Tracks temporal participation.
**Example:** User ATTENDED Interview "Google On-site"

### 25. OCCURRED_AT

**Category:** Temporal
**Direction:** Entity → Timeline Event
**Meaning:** This entity happened at or during this time.
**Importance:** Anchors all entities in time.
**Example:** Achievement "Launched Product" OCCURRED_AT Timeline "Q1 2026"

---

## Relationship Properties

Every relationship carries conceptual metadata:

| Property           | Purpose                                            | Example                                |
| ------------------ | -------------------------------------------------- | -------------------------------------- |
| **Direction**      | Which entity is the source and which is the target | User → Goal                            |
| **Strength**       | How strong the connection is (conceptual)          | Strong, Medium, Weak                   |
| **Confidence**     | How certain we are this relationship exists        | High, Medium, Low                      |
| **Temporal Range** | When this relationship was valid                   | 2024-01 to Present                     |
| **Source**         | Who or what created this relationship              | User, AI, System                       |
| **Evidence**       | What supports this relationship                    | Conversation, Document, Explicit input |
| **Weight**         | Relative importance in the graph                   | 0.0 to 1.0                             |

---

## Relationship Patterns

### Chain Pattern

```
Goal → Mission → Project → Task
```

A goal decomposes into missions, which decompose into projects, which decompose into tasks.

### Capability Pattern

```
Learning → Skill → Project → Achievement → Portfolio
```

A learning activity produces a skill, which enables a project, which creates an achievement, which goes into the portfolio.

### Decision Pattern

```
Problem → Decision → Outcome → Learning → Knowledge
```

A problem triggers a decision, which produces an outcome, which generates a learning, which becomes knowledge.

### Financial Pattern

```
Service → Client → Income
Expense → Business → Income
```

Services generate income from clients. Expenses support business activities that generate income.

### Progression Pattern

```
Skill → Goal → Mission → Milestone → Achievement
```

Skills support goals, goals drive missions, missions track milestones, milestones mark achievements.

---

## Relationship Evolution

Relationships are not static. They evolve over time:

| State           | Meaning                                          |
| --------------- | ------------------------------------------------ |
| **Proposed**    | The system suspects a relationship exists        |
| **Confirmed**   | The User or a reliable source confirmed it       |
| **Active**      | The relationship is currently meaningful         |
| **Weak**        | The relationship exists but is not strong        |
| **Archived**    | The relationship is historical, no longer active |
| **Invalidated** | The relationship was found to be incorrect       |

---

## Future Expansion

- **Dynamic Relationships** — Relationships that change strength over time
- **Conditional Relationships** — Relationships that only exist under certain conditions
- **Probabilistic Relationships** — Relationships with a probability rather than certainty
- **Inferred Relationships** — Relationships derived through reasoning rather than direct capture
- **Negative Relationships** — Explicit not-related, conflicting, or incompatible relationships
