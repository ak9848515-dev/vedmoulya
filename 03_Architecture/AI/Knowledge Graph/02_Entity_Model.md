# Entity Model

**ARC-003 — Document 02/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Knowledge Architect
**Created:** 2026-07-24
**Cross-references:** ARC-003/D01, PRD-001

---

## Purpose

The Entity Model defines the **conceptual entity types** that exist within the Life Knowledge Graph. Each entity represents a meaningful concept in a person's life journey.

This is NOT a database schema. There are no fields, data types, or storage specifications. Only purpose and responsibility are defined.

---

## Entity Types

### 1. User

**Purpose:** Represents the person whose life journey is being modeled. The User is the root entity — every other entity exists in relation to the User.

**Responsibility:** Anchors the entire graph. All knowledge, goals, skills, and experiences belong to a User.

### 2. Goal

**Purpose:** A desired outcome the User wants to achieve. Goals range from short-term (learn a skill) to long-term (build a business, change careers).

**Responsibility:** Drives motivation, planning, and prioritization. Goals connect to missions, projects, skills, and decisions.

### 3. Skill

**Purpose:** A capability the User possesses or is developing. Skills can be technical (programming, design), professional (management, negotiation), or personal (communication, discipline).

**Responsibility:** Forms the foundation of the User's capability assessment. Skills connect to knowledge, projects, jobs, and achievements.

### 4. Knowledge

**Purpose:** Information the User has learned and understood. Knowledge can be explicit (facts, concepts, procedures) or implicit (intuition, experience, judgment).

**Responsibility:** Represents the User's intellectual capital. Knowledge connects to skills, learning, projects, and decisions.

### 5. Mission

**Purpose:** A significant undertaking that advances one or more goals. Missions are larger than projects and smaller than life purposes.

**Responsibility:** Translates goals into actionable programs. Missions connect to goals, projects, milestones, and achievements.

### 6. Project

**Purpose:** A defined effort with a specific deliverable or outcome. Projects are the building blocks of missions.

**Responsibility:** Captures execution. Projects connect to missions, skills, tasks, documents, and portfolio items.

### 7. Task

**Purpose:** The smallest unit of actionable work. Tasks are specific, measurable, and completable.

**Responsibility:** Drives daily execution. Tasks connect to projects, missions, habits, and time.

### 8. Habit

**Purpose:** A repeated behavior that produces results over time. Habits are the compound engines of growth.

**Responsibility:** Captures behavioral patterns. Habits connect to goals, skills, and progress.

### 9. Learning

**Purpose:** A structured acquisition of knowledge or skills. Learning can be formal (courses, books) or informal (practice, mentorship).

**Responsibility:** Captures the learning journey. Learning connects to knowledge, skills, courses, books, and achievements.

### 10. Course

**Purpose:** A structured educational program with curriculum, content, and assessment.

**Responsibility:** Represents formal learning paths. Courses connect to learning, skills, knowledge, and achievements.

### 11. Book

**Purpose:** A source of knowledge and insight. Books represent deep, structured information consumption.

**Responsibility:** Captures reading and study. Books connect to knowledge, learning, and skills.

### 12. Career

**Purpose:** The User's professional journey over time. Career encompasses roles, growth, transitions, and achievements.

**Responsibility:** Provides professional context. Career connects to jobs, skills, achievements, and portfolio.

### 13. Job

**Purpose:** A specific employment position held by the User at an organization.

**Responsibility:** Captures professional experience. Jobs connect to career, company, skills, income, and achievements.

### 14. Interview

**Purpose:** A career evaluation event that tests the User's fit for a role.

**Responsibility:** Captures career progression attempts. Interviews connect to jobs, skills, decisions, and outcomes.

### 15. Company

**Purpose:** An organization where the User has worked, applied to, or interacted with professionally.

**Responsibility:** Provides organizational context. Companies connect to jobs, clients, business, and network.

### 16. Business

**Purpose:** A commercial entity the User owns, operates, or is building.

**Responsibility:** Captures entrepreneurial activity. Business connects to clients, services, income, expenses, and goals.

### 17. Client

**Purpose:** A person or organization that receives value from the User's business.

**Responsibility:** Captures revenue relationships. Clients connect to business, services, projects, and income.

### 18. Service

**Purpose:** An offering the User provides to clients or customers.

**Responsibility:** Defines the User's value proposition. Services connect to business, projects, skills, and income.

### 19. Income

**Purpose:** Financial inflow from any source — salary, business, investments, services.

**Responsibility:** Captures financial health. Income connects to jobs, business, clients, services, and goals.

### 20. Expense

**Purpose:** Financial outflow for any purpose — personal, business, investment, learning.

**Responsibility:** Captures financial management. Expenses connect to business, learning, and goals.

### 21. Decision

**Purpose:** A choice the User made with significant consequences. Decisions are the turning points in the life journey.

**Responsibility:** Captures the decision-making history. Decisions connect to problems, opportunities, outcomes, goals, and lessons.

### 22. Problem

**Purpose:** A challenge, obstacle, or issue the User faced or is facing.

**Responsibility:** Contextualizes decisions and learning. Problems connect to decisions, solutions, skills, and knowledge.

### 23. Opportunity

**Purpose:** A favorable circumstance the User can act upon to advance their goals.

**Responsibility:** Captures potential value. Opportunities connect to decisions, goals, skills, and outcomes.

### 24. Achievement

**Purpose:** A significant positive outcome the User has accomplished.

**Responsibility:** Marks progress and success. Achievements connect to goals, missions, projects, skills, and portfolio.

### 25. Milestone

**Purpose:** A significant marker of progress along a journey, mission, or goal.

**Responsibility:** Tracks progression. Milestones connect to missions, goals, projects, and timeline.

### 26. Portfolio

**Purpose:** A curated collection of the User's best work, achievements, and capabilities.

**Responsibility:** Represents professional credibility. Portfolio connects to projects, achievements, skills, and career.

### 27. Document

**Purpose:** Any recorded information — notes, files, articles, code, designs, plans.

**Responsibility:** Captures created work. Documents connect to projects, learning, knowledge, and portfolio.

### 28. Conversation

**Purpose:** An interaction between the User and another entity (person, AI, group).

**Responsibility:** Captures knowledge exchange. Conversations connect to knowledge, decisions, relationships, and learning.

### 29. Memory

**Purpose:** A recorded experience or event from the User's life.

**Responsibility:** Preserves temporal context. Memories connect to timeline, decisions, learning, and relationships.

### 30. Relationship

**Purpose:** A connection between the User and another person or entity.

**Responsibility:** Captures the User's network. Relationships connect to career, business, mentors, and opportunities.

### 31. Timeline Event

**Purpose:** Any significant point in time on the User's life journey.

**Responsibility:** Provides temporal structure. Timeline events connect to all other entities — when things happened, in what order.

---

## Entity Classification

Entities can be classified across multiple dimensions:

| Dimension      | Categories                                                                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nature**     | Identity (User), Aspiration (Goal, Mission), Capability (Skill, Knowledge), Execution (Project, Task), Experience (Job, Achievement), Resource (Income, Client), Event (Decision, Interview) |
| **Scope**      | Life-level (Career, Business), Year-level (Mission, Goal), Month-level (Project, Learning), Week-level (Task, Habit), Day-level (Task)                                                       |
| **State**      | Active, Completed, Archived, Draft, Abandoned                                                                                                                                                |
| **Visibility** | Private (User only), Shared (with mentor/coach), Public (portfolio)                                                                                                                          |

---

## Entity Lifecycle States

Every entity passes through a lifecycle:

```
Draft → Active → Completed → Archived
         ↓
      Paused
         ↓
      Active (resumed)
```

- **Draft** — Created but not yet meaningful
- **Active** — Currently relevant and in use
- **Paused** — Temporarily not being worked on
- **Completed** — Achieved its purpose
- **Archived** — Historical record, no longer active

---

## Entity Identity

Each entity in the Knowledge Graph must be uniquely identifiable across the entire life of the User. The identity must be:

- **Immutable** — Once created, the identity never changes
- **Universal** — Unique across all entities, not just within its type
- **Temporal** — Can be referenced at any point in time
- **Independent** — Not derived from any external system

---

## Future Expansion

- **Custom Entity Types** — Users can define their own entity types
- **Compound Entities** — Entities composed of other entities
- **Temporal Entities** — Entities that only exist within a time window
- **Virtual Entities** — Entities derived from computation rather than direct capture
- **Collective Entities** — Entities representing groups, teams, or communities
