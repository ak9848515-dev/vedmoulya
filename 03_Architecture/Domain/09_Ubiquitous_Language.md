# Ubiquitous Language

**ENG-001 — Document 09/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Domain Architect
**Created:** 2026-07-25
**Cross-references:** CMP-001, PRD-001, PRD-002, ARC-001, ARC-002, ARC-003, ARC-004, ARC-005

---

## Purpose

This document establishes the **ubiquitous language** of VedMoulya — the consistent, unambiguous terminology that every team member uses in conversations, documentation, code, APIs, and user interfaces. This ensures that a Goal means the same thing to a product manager, a backend engineer, a frontend developer, an AI provider, and a user.

---

## Naming Standards

### Standard 1: Entity Names = Singular Noun

| ✅ Correct     | ❌ Incorrect           |
| -------------- | ---------------------- |
| User           | Users                  |
| Goal           | Goals / GoalItem       |
| Mission        | Missions / TaskList    |
| KnowledgeNode  | Knowledge / Knowledges |
| DecisionRecord | DecisionMaker          |
| ExecutionPlan  | PlanOfAction           |
| Portfolio      | Portfolios             |
| Business       | BusinessEntity         |
| Opportunity    | OpportunityListing     |
| Service        | ServicesList           |
| Client         | ClientRecord           |

### Standard 2: Value Object Names = Descriptive Noun

| ✅ Correct   | ❌ Incorrect    |
| ------------ | --------------- |
| Money        | PriceValue      |
| Duration     | TimeFrame       |
| Priority     | ImportanceLevel |
| Confidence   | CertaintyScore  |
| SkillLevel   | Level           |
| Location     | Place           |
| Progress     | PercentComplete |
| Status       | State           |
| HealthScore  | Score           |
| JourneyStage | Stage           |

### Standard 3: Domain Event Names = Past Tense Verb + Entity

| ✅ Correct          | ❌ Incorrect      |
| ------------------- | ----------------- |
| GoalCreated         | CreateGoal        |
| MissionCompleted    | CompleteMission   |
| SkillImproved       | ImproveSkill      |
| ClientAcquired      | AcquireClient     |
| IncomeEarned        | EarnIncome        |
| DecisionApproved    | ApproveDecision   |
| PlanAdapted         | AdaptPlan         |
| BurnoutRiskDetected | DetectBurnoutRisk |

### Standard 4: Domain Service Names = Action + "Service"

| ✅ Correct            | ❌ Incorrect                                       |
| --------------------- | -------------------------------------------------- |
| DecisionService       | DecisionEngine (keep Engine for system components) |
| PlanningService       | PlanMaker                                          |
| KnowledgeService      | KnowledgeFinder                                    |
| ExecutionService      | TaskRunner                                         |
| RecommendationService | SuggestService                                     |
| ProgressService       | ProgressTracker                                    |
| CoachService          | GuidanceService                                    |

### Standard 5: Aggregate Root Names = Business Concept (Noun)

| ✅ Correct    | ❌ Incorrect        |
| ------------- | ------------------- |
| Goal          | GoalTreeEntity      |
| Mission       | MissionAggregate    |
| Project       | ProjectRecord       |
| KnowledgeNode | KnowledgeGraphNode  |
| Decision      | DecisionDocument    |
| ExecutionPlan | PlanOfExecution     |
| Portfolio     | PortfolioCollection |
| Business      | BusinessRecord      |
| Opportunity   | OpportunityMatch    |

---

## Terminology Map

```
                    USER CONCEPT (Domain)           SYSTEM CONCEPT (Technical)
                    ─────────────────────           ─────────────────────────
Person           =  The real-world individual    =  UserAccount entity
Goal             =  What user wants to achieve  =  GoalTree aggregate
Mission          =  Time-bound endeavor          =  MissionInstance entity
Project          =  Outcome-oriented work        =  Project entity
Knowledge        =  What user knows              =  KnowledgeNode + Relations
Decision         =  Choice with rationale        =  DecisionRecord + Options
ExecutionPlan    =  Structured actions           =  Plan with ScheduledTasks
Portfolio        =  Proof of work                =  Collection of PortfolioItems
Business         =  Commercial practice          =  Business + Services + Clients
Opportunity      =  External match               =  Opportunity + MatchScore
Service          =  User's offering              =  Service entity
Client           =  Buyer of services            =  Client entity
Task             =  Atomic unit of work          =  ScheduledTask entity
Milestone        =  Significant checkpoint       =  Milestone entity
DNA              =  User's attributes            =  UserDNA value object cluster
Journey          =  User's growth path           =  JourneyStage value object
HPI              =  Composite progress score     =  HealthScore value object
```

---

## Forbidden Terms

These terms should be avoided because they are ambiguous, technical, or inconsistent:

| ❌ Avoid         | ✅ Use Instead                | Why                                                     |
| ---------------- | ----------------------------- | ------------------------------------------------------- |
| CRUD             | Create                        | CRUD is an implementation pattern, not a domain concept |
| Entity (generic) | User, Goal, etc.              | Name the specific entity                                |
| Object           | Node, Record, Value           | "Object" is too generic                                 |
| Data             | Knowledge, Information        | Data is technical; Knowledge is business                |
| Model            | Framework, DNA, Profile       | Model is overused and ambiguous                         |
| Module           | Context, Domain, Capability   | Module is a code concept                                |
| Component        | Service, Engine, Layer        | Component is too generic                                |
| Item             | Task, Service, Product        | Name the specific thing                                 |
| Manager (domain) | Service, Engine, Orchestrator | Manager is vague                                        |
| Helper           | Service, Utility              | Helper is not a domain concept                          |
| Utils            | Not used                      | Utility functions are not domain concepts               |

---

## Standard Verb Usage

| Action    | Domain Meaning                | Used With                                                       |
| --------- | ----------------------------- | --------------------------------------------------------------- |
| Create    | Bring into existence          | Goal, Mission, Project, KnowledgeNode, Decision, Plan, Business |
| Complete  | Finish successfully           | Goal, Mission, Project, Task, Plan                              |
| Abandon   | Stop without completion       | Goal, Mission, Project, Plan                                    |
| Approve   | Confirm and proceed           | Decision, Plan                                                  |
| Execute   | Carry out                     | Decision, Plan, Task                                            |
| Assess    | Measure current level         | Skill, Knowledge, DNA                                           |
| Recommend | Suggest with rationale        | Course, Opportunity, Action, Decision                           |
| Match     | Find compatible fit           | Opportunity, User, Service                                      |
| Connect   | Create relationship           | KnowledgeNode to KnowledgeNode                                  |
| Improve   | Increase in quality           | Skill, Knowledge, Capability                                    |
| Adapt     | Change in response to context | Plan, Schedule, Priority                                        |
| Track     | Monitor over time             | Progress, Execution, Income                                     |
| Celebrate | Acknowledge achievement       | Milestone, Goal, Mission, Income                                |

---

## Bounded Context Language Mapping

Each bounded context has specific terminology that belongs to it:

### Identity Context

User, UserAccount, UserDNA, Identity, Profile, Preferences, DNASource, Confidence, Authentication, Authorization

### Knowledge Context

KnowledgeNode, Skill, Capability, Concept, Fact, Experience, Insight, Relation, Quality, Provenance, Gap

### Execution Context

Goal, GoalTree, Mission, Project, ExecutionPlan, ScheduledTask, Milestone, Priority, Progress, Status, PlanPhase, Adaptation, Feedback

### Career Context

CareerPath, CareerStage, JobRole, Industry, ProfessionalNetwork, RoleTransition

### Learning Context

LearningPath, Course, Module, Assessment, LearningResource, SkillAssessment

### Business Context

Business, Service, Client, Invoice, Contract, Proposal, Pricing

### Finance Context

Income, Expense, Revenue, FinancialGoal, Transaction, Diversification

### Portfolio Context

Portfolio, PortfolioItem, Achievement, Credential, Asset

### Marketplace Context

Opportunity, Listing, Match, Proposal, Review, Rating

### Notifications Context

Notification, Alert, Reminder, Message, Channel, Template

### AI Context

AIRequest, AIResponse, Capability, Provider, ContextSlice

### Settings Context

Preference, FeatureFlag, PrivacySetting, Configuration

---

## Standard Prefixes and Suffixes

| Prefix/Suffix | Meaning              | Examples                                 |
| ------------- | -------------------- | ---------------------------------------- |
| `has*`        | Relationship         | hasGoal, hasSkill, hasKnowledge          |
| `is*`         | State check          | isComplete, isActive, isOverdue          |
| `can*`        | Capability check     | canExecute, canDecide, canRecommend      |
| `*Level`      | Proficiency          | SkillLevel, GoalLevel, PriorityLevel     |
| `*Score`      | Quantitative measure | MatchScore, HealthScore, ConfidenceScore |
| `*Type`       | Categorization       | DecisionType, KnowledgeType, EventType   |
| `*Status`     | Lifecycle state      | GoalStatus, TaskStatus, PlanStatus       |
| `*Id`         | Identity reference   | UserId, GoalId, PlanId                   |

---

## Consistent Language Across Layers

```
Domain Concept        API Endpoint           UI Label          Database Concept
──────────────        ────────────           ───────           ────────────────
User                  /users                 User              users
Goal                  /goals                 Goal              goals
Mission               /missions              Mission           missions
KnowledgeNode         /knowledge             Knowledge         knowledge_nodes
DecisionRecord        /decisions             Decision          decisions
ExecutionPlan         /plans                 Plan              execution_plans
Portfolio             /portfolio             Portfolio         portfolios
Business              /businesses            Business          businesses
Opportunity           /opportunities         Opportunity       opportunities
Service               /services              Service           services
Client                /clients               Client            clients

UserDNA               /dna                   DNA               user_dna
SkillLevel            /skills                Skill Level       skill_levels
JourneyStage          /journey               Journey Stage     journey_stages
HealthScore           /hpi                   HPI               health_scores
```

---

## Language Evolution Rules

1. **Propose changes** to this document when a term proves ambiguous or a better term is found.
2. **Discuss changes** with the architecture team and affected teams.
3. **Update all documents** that use the old term, including this document.
4. **Notify all teams** about the change.
5. **Deprecate old term** with a transition period before removal.
6. **Update the glossary** (08_Domain_Glossary.md) with both old and new terms during transition.

---

## Language Anti-Patterns

### Anti-Pattern 1: Technical Language in Business Concepts

| ❌ Avoid                                                   | ✅ Use Instead                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| "This endpoint returns a user profile payload"             | "The user can view their profile"                                  |
| "We need to persist the goal aggregate"                    | "We need to save the user's goal"                                  |
| "The orchestrator calls the provider API with the context" | "The system asks the AI to help with what it knows about the user" |

### Anti-Pattern 2: Different Names for the Same Concept

| ❌ Avoid                               | ✅ Standardize On               |
| -------------------------------------- | ------------------------------- |
| Skill Level / Proficiency / Competency | SkillLevel                      |
| Goal / Objective / Target              | Goal (Objective for sub-levels) |
| Plan / Schedule / Agenda               | ExecutionPlan (Plan)            |
| Task / Action / Item                   | Task (Action for micro level)   |
| Notification / Alert / Message         | Notification (Alert for urgent) |

### Anti-Pattern 3: Same Name for Different Concepts

| ❌ Avoid                                                       | Clarify                                                                       |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| "Mission" = Military operation vs. "Mission" = Product feature | Use "Mission" only for the execution concept                                  |
| "Project" = Code project vs. "Project" = Work project          | Use "Project" consistently for work outcomes                                  |
| "Service" = Microservice vs. "Service" = User offering         | Use "Service" only for user offerings; use "Component" for technical services |

---

## Cross-References

| Reference | Relationship                                                                             |
| --------- | ---------------------------------------------------------------------------------------- |
| CMP-001   | Constitutional language (Mission, Vision, Values) must be reflected in domain terms      |
| PRD-001   | Product language (Journey, Stage, HPI) maps to domain value objects                      |
| PRD-002   | DNA language (Dimensions, Skills, Profile) maps to User aggregate                        |
| ARC-001   | System architecture language (Component, Engine, Layer) is distinct from domain language |
| ARC-002   | Decision language (Type, Score, Criteria, Confidence) maps to Decision aggregate         |
| ARC-003   | Knowledge language (Node, Graph, Quality, Evolution) maps to Knowledge aggregate         |
| ARC-004   | Execution language (Lifecycle, Goal, Plan, Task, Policy) maps to Execution aggregates    |
| ARC-005   | Orchestration language (Provider, Capability, Routing) is infrastructure, not domain     |
