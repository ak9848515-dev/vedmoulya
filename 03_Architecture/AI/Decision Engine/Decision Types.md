# Decision Types

**Mission:** Define the 10 decision types that the VedMoulya Decision Intelligence Engine supports, including their triggers, inputs, and expected outputs.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Decision Intelligence Architect
**Dependencies:** Decision Intelligence.md, Decision Lifecycle.md, Decision Context.md, Decision Scoring.md
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

The Decision Intelligence Engine supports 10 distinct decision types, each optimized for a specific domain of user need. Each type has unique triggers, inputs, scoring dimensions, and output formats.

---

## Decision Type Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                     DECISION TYPE LANDSCAPE                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    LIVELIHOOD DECISIONS                          ││
│  │                                                                  ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   ││
│  │  │  Career  │  │ Learning │  │ Business │  │  Freelancing  │   ││
│  │  │          │  │          │  │          │  │               │   ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                     OPERATIONAL DECISIONS                        ││
│  │                                                                  ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   ││
│  │  │ Financial │  │  Health  │  │  Daily   │  │ Opportunity  │   ││
│  │  │          │  │(Product.)│  │ Planning  │  │   Matching   │   ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                     STRATEGIC DECISIONS                          ││
│  │                                                                  ││
│  │  ┌────────────────┐  ┌──────────────────────┐                   ││
│  │  │  Risk          │  │   Goal               │                   ││
│  │  │  Management    │  │   Prioritization     │                   ││
│  │  └────────────────┘  └──────────────────────┘                   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Type 1: Career Decisions

**Purpose:** Help users make career-related choices — paths, transitions, skill development, job moves.

**Triggers:**

- User declares a career goal
- User reaches a career milestone
- User expresses career dissatisfaction
- Career stage change detected
- Scheduled career review

**Key DNA Dimensions Used:** Identity, Skills, Knowledge, Goals, Context, Progress
**Primary Journey Stages:** 01_Discover, 05_Grow

**Inputs:**

- Current role and experience
- Career goals and aspirations
- Skill inventory with proficiency
- Market demand data
- Industry trends

**Scoring Factors:**

- Goal alignment (high weight)
- Skill gap closure (high weight)
- Market demand (medium weight)
- Time to achieve (medium weight)
- Income potential (medium weight)
- Personal satisfaction (low weight — inferred)

**Output:** Career path recommendation with timeline, required skills, and expected outcomes

**Example:** "Based on your goal to become a Senior Data Scientist, we recommend focusing on ML Engineering skills next. This path typically takes 6-9 months with 10 hrs/week commitment."

---

## Type 2: Learning Decisions

**Purpose:** Recommend what, when, and how the user should learn next.

**Triggers:**

- Learning path completion
- Skill assessment result
- Knowledge gap detected
- Career decision outcome
- Scheduled learning review

**Key DNA Dimensions Used:** Skills, Knowledge, Goals, Learning Profile, Context, Progress
**Primary Journey Stages:** 02_Learn

**Inputs:**

- Current skill levels
- Knowledge graph position
- Learning history
- Learning profile (modality, pace)
- Available time

**Scoring Factors:**

- Skill gap impact (high weight)
- Prerequisite readiness (high weight)
- Learning style match (medium weight)
- Time availability fit (medium weight)
- Engagement likelihood (medium weight)
- Career impact (high weight)

**Output:** Learning path or course recommendation with estimated duration

**Example:** "Your Python skills are strong (8/10) but you haven't started ML libraries yet. We recommend starting with our 'ML with Python' path — 4 courses, estimated 40 hours."

---

## Type 3: Business Decisions

**Purpose:** Guide users in starting, running, and growing their businesses.

**Triggers:**

- User registers a business
- Business milestone reached
- Revenue change detected
- Scheduled business review
- User requests business advice

**Key DNA Dimensions Used:** Identity, Skills, Goals, Context, Progress
**Primary Journey Stages:** 03_Build, 06_Manage

**Inputs:**

- Business type and stage
- Revenue and expenses
- Client pipeline
- Market conditions
- User's business skills

**Scoring Factors:**

- Business impact (high weight)
- Implementation feasibility (high weight)
- Revenue potential (high weight)
- Risk level (medium weight)
- Time required (medium weight)
- Skill requirement match (medium weight)

**Output:** Business action recommendation with priority

**Example:** "Your client pipeline is strong but your pricing may be below market. We recommend reviewing your pricing strategy — our data shows a 20% increase is feasible given your experience level."

---

## Type 4: Freelancing Decisions

**Purpose:** Help freelancers manage their independent work — pricing, clients, proposals, and growth.

**Triggers:**

- Freelance profile created
- New project opportunity
- Income fluctuation detected
- Client acquisition or loss
- Scheduled freelancing review

**Key DNA Dimensions Used:** Skills, Goals, Context, Progress
**Primary Journey Stages:** 04_Earn

**Inputs:**

- Service offerings
- Current project load
- Income history
- Client ratings
- Market rates

**Scoring Factors:**

- Income stability impact (high weight)
- Skill alignment (high weight)
- Time availability (high weight)
- Client quality (medium weight)
- Growth potential (medium weight)
- Risk diversification (low weight)

**Output:** Freelancing action recommendation (pricing, proposals, specialization)

**Example:** "You have 3 active projects and capacity for 1 more. We recommend pursuing the Web Development project over the Data Entry project — it better aligns with your career goals and offers 40% higher pay."

---

## Type 5: Financial Decisions

**Purpose:** Guide users on financial matters related to their livelihood — pricing, saving, investing, budgeting.

**Triggers:**

- Income change detected
- Expense change detected
- Financial goal set
- Scheduled financial review
- User requests financial guidance

**Key DNA Dimensions Used:** Goals, Context, Progress
**Primary Journey Stages:** 04_Earn, 06_Manage

**Inputs:**

- Current income and expenses
- Financial goals
- Risk tolerance
- Time horizon
- Market conditions (general)

**Scoring Factors:**

- Financial impact (high weight)
- Risk alignment (high weight)
- Goal alignment (high weight)
- Time horizon fit (medium weight)
- Complexity (low weight)
- Urgency (medium weight)

**Output:** Financial action recommendation

**Example:** "Your income has stabilized at ₹80K/month. We recommend allocating 20% to an emergency fund before increasing investment contributions. This aligns with your goal of financial security."

---

## Type 6: Health & Productivity Decisions

**Purpose:** Optimize the user's energy, focus, and well-being for maximum sustainable productivity.

**Triggers:**

- Productivity decline detected
- Burnout risk identified
- User requests productivity advice
- Scheduled well-being check-in
- Pattern of late-night work detected

**Key DNA Dimensions Used:** Learning Profile, Personality, Context, Progress
**Primary Journey Stages:** All stages

**Inputs:**

- Work patterns (time of day, duration)
- Break frequency
- Completion rates
- Energy self-reports
- Sleep and activity data (if provided)

**Scoring Factors:**

- Productivity impact (high weight)
- Sustainability (high weight)
- Energy alignment (high weight)
- Implementation ease (medium weight)
- Health impact (high weight)

**Output:** Productivity recommendation

**Example:** "Your most productive hours are 9 AM-12 PM, but you're scheduling deep work at 3 PM. We recommend moving your highest-priority task to morning. Also, your average session is 2 hours — a 5-minute break every 45 minutes could improve focus."

---

## Type 7: Daily Planning Decisions

**Purpose:** Help users plan their day effectively based on priorities, energy, and constraints.

**Triggers:**

- Start of day
- Schedule change
- Priority change
- User requests daily plan

**Key DNA Dimensions Used:** Goals, Context, Progress, Learning Profile
**Primary Journey Stages:** All stages

**Inputs:**

- Today's goals and priorities
- Available time blocks
- Energy pattern
- Scheduled commitments
- Task dependencies

**Scoring Factors:**

- Priority alignment (high weight)
- Energy match (high weight)
- Time block fit (high weight)
- Dependency order (medium weight)
- Deadline urgency (high weight)

**Output:** Daily plan — ordered task list with time blocks

**Example:** "Good morning! Here's your optimal plan: 9-11 AM: Deep work on ML project (your peak energy). 11-11:30 AM: Client follow-ups. 2-4 PM: Course work. 4-5 PM: Planning tomorrow."

---

## Type 8: Opportunity Matching Decisions

**Purpose:** Match users to relevant opportunities — jobs, gigs, projects, clients, collaborations.

**Triggers:**

- New opportunity available
- User profile updated
- User searches for opportunities
- Scheduled opportunity check

**Key DNA Dimensions Used:** Skills, Knowledge, Goals, Context, Progress
**Primary Journey Stages:** 01_Discover, 04_Earn

**Inputs:**

- User's skill profile
- Career goals
- Current engagement
- Opportunity requirements
- Market data

**Scoring Factors:**

- Skill match (high weight)
- Goal alignment (high weight)
- Financial fit (high weight)
- Time commitment match (medium weight)
- Growth potential (medium weight)
- Location/remote fit (medium weight)

**Output:** Ranked opportunity list with match scores and rationales

**Example:** "We found 5 opportunities matching your profile. Top match: Senior Python Developer at TechCorp — 85% match. Your Python skills (9/10) and ML experience (7/10) strongly align. Estimated salary: ₹18-25 LPA."

---

## Type 9: Risk Management Decisions

**Purpose:** Identify, assess, and mitigate risks in the user's livelihood journey.

**Triggers:**

- Risk factor detected
- Scheduled risk review
- Major life change detected
- Market change detected

**Key DNA Dimensions Used:** Context, Goals, Progress, Personality
**Primary Journey Stages:** All stages

**Inputs:**

- Current risk exposure
- Risk tolerance (from DNA)
- Market conditions
- Income stability
- Skill diversification

**Scoring Factors:**

- Risk severity (high weight)
- Risk probability (high weight)
- Mitigation feasibility (high weight)
- Impact on goals (high weight)
- User's risk tolerance (medium weight)
- Time sensitivity (medium weight)

**Output:** Risk assessment with mitigation recommendations

**Example:** "Your income is 80% dependent on one client. We recommend diversifying — our data shows freelancers with 3+ clients have 60% more income stability. Would you like us to find matching opportunities?"

---

## Type 10: Goal Prioritization Decisions

**Purpose:** Help users decide which goals to prioritize when they have competing objectives.

**Triggers:**

- New goal declared alongside existing goals
- Progress stagnation on high-priority goal
- Scheduled priority review
- User requests prioritization help

**Key DNA Dimensions Used:** Goals, Context, Progress, Personality
**Primary Journey Stages:** All stages

**Inputs:**

- All active goals with metadata
- Current progress per goal
- Time available
- Energy and motivation levels
- Deadline and urgency per goal

**Scoring Factors:**

- Goal impact (high weight)
- Progress momentum (high weight)
- Deadline urgency (high weight)
- Resource availability (medium weight)
- Dependency order (medium weight)
- User motivation (low weight)

**Output:** Prioritized goal list with rationale

**Example:** "Of your 5 active goals, we recommend prioritizing 'Complete AWS Certification' this month. It's blocking your next career move and you're 70% complete. Your other goals can shift by 2-3 weeks without significant impact."

---

## Decision Type Prioritization Matrix

When multiple decision types trigger simultaneously, prioritize by:

| Priority | Decision Type              | Rationale                        |
| -------- | -------------------------- | -------------------------------- |
| Highest  | Risk Management            | Prevents harm or loss            |
| High     | Goal Prioritization        | Determines all other decisions   |
| High     | Daily Planning             | Time-sensitive, immediate impact |
| Medium   | Career, Learning, Business | Strategic, longer time horizon   |
| Medium   | Opportunity Matching       | Time-sensitive opportunities     |
| Low      | Financial, Productivity    | Long-term, lower urgency         |
| Lowest   | Freelancing (advisory)     | Dependent on other decisions     |

## Cross-References

- **Decision Lifecycle.md** — How each decision type flows through the lifecycle
- **Decision Scoring.md** — The scoring framework applied to each type
- **Decision Context.md** — Context inputs specific to each type
- **Decision Confidence.md** — Confidence levels by decision type
- **Decision Policies.md** — Policies that constrain each type
- **ARC-001 (Core Components)** — How decision types map to platform components
- **PRD-002 (User DNA)** — DNA dimensions used by each type
- **PRD-001 (Human Journey)** — Journey stages relevant to each type
- **RSH-001 (Human Problems)** — Problems addressed by each type
- **CMP-001** — Business-aligned priorities for each type

### Future Expansion

- **Health & Wellness Decisions** — Physical and mental health recommendations
- **Relationship Decisions** — Professional relationship and network recommendations
- **Location Decisions** — Relocation and geography-based recommendations
- **Education Decisions** — Formal education vs. self-learning trade-offs
- **Retirement Decisions** — Long-term financial and lifestyle planning
