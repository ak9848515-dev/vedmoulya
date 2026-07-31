# User Assessment

**Version:** 1.0
**Status:** Draft
**Author:** Principal Product Architect
**Created:** 2026-07-24
**Updated:** 2026-07-24
**Dependencies:** User DNA.md, User DNA Dimensions.md, Human Journey.md (PRD-001), User Goals.md

## Description

Defines how the VedMoulya platform assesses, measures, and infers the attributes that compose a user's DNA. Assessment is the bridge between raw user activity and a rich, accurate user model.

---

## Assessment Philosophy

### Multi-Source, Not Single Source

No single data point can accurately capture a user's DNA. VedMoulya combines multiple assessment methods to triangulate on the truth:

- **Declared data** — What the user tells us
- **Behavioral data** — What the user does
- **Assessment data** — What the user demonstrates
- **Inferred data** — What AI concludes
- **Outcome data** — What results the user achieves

### Continuous, Not One-Time

Assessment is not a static onboarding event. It is a continuous process that updates as the user interacts with the platform. Every action, every completion, every struggle provides signal.

### Transparent, Not Opaque

Users can see their assessment results, understand how they were derived, and correct inaccuracies. Assessment is done with the user, not to them.

### Progressive, Not Overwhelming

Assessment is spread across the user's journey. Onboarding captures the minimum viable profile; deeper assessments unlock as the user progresses. No one fills a 100-question form on day one.

---

## Assessment Methods

### 1. Explicit Declarations

**What it measures:** Identity, Goals, Context

**How it works:** Users directly provide information through forms, profile setup, and preference settings.

**When used:** Onboarding, profile updates, goal setting

**Confidence:** High (user-stated, but may be aspirational)

**Examples:**

- "My name is [Name]"
- "I want to become a data scientist"
- "I have 10 hours per week to dedicate"

---

### 2. Skill Assessments

**What it measures:** Skills, Knowledge

**How it works:** Structured assessments that test user knowledge and capability across specific domains.

**When used:** Onboarding (baseline), module completion, periodic check-ins

**Confidence:** High (direct measurement)

**Types:**

| Type              | Duration   | Depth                    | When Used              |
| ----------------- | ---------- | ------------------------ | ---------------------- |
| Quick Check       | 2-5 min    | Surface level            | Frequent check-ins     |
| Deep Assessment   | 15-30 min  | Comprehensive            | Onboarding, milestones |
| Practical Project | Hours-days | Real-world application   | Portfolio evaluation   |
| Peer Review       | —          | Collaborative validation | Community assessments  |

---

### 3. Behavioral Inference

**What it measures:** Learning Profile, Personality, Progress

**How it works:** AI analyzes patterns in user behavior — what they click, how long they spend, when they engage, what they skip.

**When used:** Continuously, in the background

**Confidence:** Medium to High (statistical, improves with data volume)

**Inferred signals:**

| Signal                    | What It Reveals                        |
| ------------------------- | -------------------------------------- |
| Time of day engagement    | Energy patterns, optimal scheduling    |
| Session duration          | Attention span, engagement depth       |
| Content format preference | Learning modality                      |
| Completion rate           | Persistence, interest alignment        |
| Speed vs. thoroughness    | Learning pace, conscientiousness       |
| Help-seeking behavior     | Independence, resourcefulness          |
| Social engagement         | Extraversion, collaboration preference |
| Topic switching patterns  | Curiosity, focus, distraction          |

---

### 4. AI Inference

**What it measures:** Skills, Knowledge, Personality, Goals

**How it works:** AI models analyze user interactions, conversations with the AI coach, content consumption, and project outputs to infer DNA attributes.

**When used:** After significant interactions (conversations, project completions)

**Confidence:** Low to Medium (improves with more data and better models)

**Examples:**

- From coaching conversations, AI infers communication skill level
- From project outputs, AI infers technical proficiency
- From goal discussions, AI infers motivation drivers
- From content choices, AI infers interest areas

---

### 5. Outcome-Based Assessment

**What it measures:** Skills, Knowledge, Progress

**How it works:** Actual outcomes (project completions, income earned, clients acquired) are the strongest signal of capability.

**When used:** When outcomes are achieved

**Confidence:** Highest (reality-based)

**Examples:**

- Completed project demonstrates skill application
- Earned income demonstrates market-ready capability
- Client testimonials demonstrate professional competence
- Certification exams demonstrate verified knowledge

---

## Assessment Lifecycle

```
Onboarding (Baseline) → Initial DNA
         ↓
Daily Engagement → Behavioral Signals
         ↓
Weekly Check-ins → Progress Updates
         ↓
Milestone Assessments → Deep Calibration
         ↓
Outcome Recording → Reality Confirmation
         ↓
Quarterly Review → Comprehensive Refresh
```

### Onboarding Assessment

**Purpose:** Establish baseline DNA with minimum viable data.

**Duration:** 10-15 minutes

**Captures:**

- Identity (demographics, background)
- Goals (aspirational and milestone)
- Context (time, constraints, resources)
- Quick skill self-assessment (top 5 skills)
- Learning style preference

**Rule:** Onboarding assessment must respect the user's time. Capture only what's essential for day-one personalization.

---

### Continuous Assessment

**Purpose:** Refine DNA through ongoing interaction.

**Frequency:** Every user session

**Captures:**

- Behavioral signals (session patterns)
- Engagement metrics (completion, duration)
- Content preferences (format, topic)
- Progress indicators (stage advancement)

**Rule:** Continuous assessment runs in the background. Users are not interrupted for assessment purposes during active sessions.

---

### Milestone Assessment

**Purpose:** Deep calibration at key journey points.

**Frequency:** Per journey stage transition

**Captures:**

- Skill re-assessment (proficiency update)
- Knowledge verification (retention check)
- Goal refinement (progress review)
- Learning profile update (modality, pace)

**Rule:** Milestone assessments are positioned as value-adds for the user ("see how much you've grown"), not as interruptions.

---

## Confidence Scoring

Every DNA attribute includes a confidence score (0.0 to 1.0) indicating how reliable the assessment is.

| Confidence | Meaning     | Action                                                     |
| ---------- | ----------- | ---------------------------------------------------------- |
| 0.0 - 0.3  | Speculative | Use with caution; prefer declared data                     |
| 0.3 - 0.6  | Plausible   | Useful for recommendations with low stakes                 |
| 0.6 - 0.8  | Likely      | Confident enough for most personalization                  |
| 0.8 - 0.9  | Strong      | Multiple sources agree; reliable for high-stakes decisions |
| 0.9 - 1.0  | Certain     | Directly measured or confirmed by user                     |

**Confidence decay:** Attributes lose confidence over time if not refreshed. A skill assessed 6 months ago with no recent practice should have reduced confidence.

## Cross-References

- **User DNA.md** — Core concept of the User DNA framework
- **User DNA Dimensions.md** — The attributes being assessed
- **User Profiles.md** — How assessments translate into user profiles
- **Human Journey.md (PRD-001)** — Assessment timing aligned with journey stages
- **Human Problems/Research Methodology.md (RSH-001)** — Assessment design follows research methodology principles

## Future Expansion

- Adaptive assessments that adjust difficulty based on performance
- Gamified assessments for higher engagement
- Peer-based assessment (skill endorsements, peer reviews)
- External credential integration (LinkedIn, Coursera, certifications)
- Proctored assessments for high-stakes certifications
- Assessment marketplace (third-party assessment providers)
- Continuous passive assessment via ambient AI monitoring
