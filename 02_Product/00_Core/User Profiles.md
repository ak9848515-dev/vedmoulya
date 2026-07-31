# User Profiles

**Version:** 1.0
**Status:** Draft
**Author:** Principal Product Architect
**Created:** 2026-07-24
**Updated:** 2026-07-24
**Dependencies:** User DNA.md, User DNA Dimensions.md, User Assessment.md, User Personas.md, Human Journey.md (PRD-001)

## Description

Defines how User DNA is composed into meaningful user profiles that drive personalization, segmentation, and platform experiences. While DNA is the raw data, profiles are the aggregated, interpreted representations that the platform and its users interact with.

---

## Profile Philosophy

### DNA as Source, Profile as Expression

User DNA is the raw data layer — the facts and inferences about a user. A profile is a curated expression of that DNA for a specific purpose. A user may have multiple profile expressions (learning profile, career profile, coaching profile) all derived from the same underlying DNA.

### Dynamic, Not Fixed

Profiles evolve with the user. A user's profile today may look different in a month as their DNA updates. Profiles are snapshots at a point in time, not permanent labels.

### User-Visible, User-Editable

Users can see their profile at any time. They can understand why certain attributes are present and correct anything that's wrong. Profiles are tools for the user, not just for the platform.

---

## Profile Types

### 1. Public Profile

**Purpose:** What the user shows to others (community, mentors, clients).

**Sources:** Identity, Skills, Goals (user-selected visibility)

**Contents:**

- Name and headline
- Top skills (user-curated)
- Professional background
- Portfolio highlights
- Goals statement
- Badges and achievements

**Visibility:** Public (configurable per element)

**User control:** Full control over what appears and how

---

### 2. Personal Profile

**Purpose:** The user's private view of themselves on the platform.

**Sources:** All DNA dimensions

**Contents:**

- Complete identity information
- Full skill inventory with proficiency levels
- Knowledge map with mastery scores
- All goals with progress tracking
- Learning profile details
- Personality insights
- Context and constraints
- Complete progress history

**Visibility:** Private (user only, unless shared)

**User control:** Full visibility, ability to correct and update

---

### 3. Learning Profile

**Purpose:** Optimizes how learning content is delivered to the user.

**Sources:** Learning Profile, Personality, Context (from DNA)

**Contents:**

- Preferred learning modalities
- Optimal session length and timing
- Pace preference
- Engagement pattern
- Content format preferences
- Assessment style preference

**Visibility:** Used by the platform; optionally visible to the user

---

### 4. Career Profile

**Purpose:** Represents the user's professional identity for career matching and opportunity discovery.

**Sources:** Identity, Skills, Knowledge, Goals, Progress

**Contents:**

- Current and desired roles
- Skill inventory with proficiency
- Experience and background
- Career goals and trajectory
- Certifications and credentials
- Portfolio and work samples
- Salary/rate expectations

**Visibility:** Public for opportunity matching; user controls which elements are searchable

---

### 5. Coach Profile

**Purpose:** Enables the AI coach to personalize every interaction.

**Sources:** All DNA dimensions (especially Goals, Personality, Learning Profile, Context)

**Contents:**

- Communication style preference
- Motivation drivers
- Challenge history and patterns
- Goal progress and blockers
- Personality insights for rapport
- Feedback style preference

**Visibility:** Used by AI coach; optionally visible to user for transparency

---

## Profile Construction

### From DNA to Profile

```
User DNA (Raw Data)              Profile (Curated View)
─────────────────────           ─────────────────────
Identity          ──────────→  Public Profile
Skills            ──────────→  Career Profile
Knowledge         ──┬───────→  Learning Profile
Goals             ──┼───────→  Coach Profile
Learning Profile  ──┼───────→  Personal Profile
Personality       ──┘
Context
Progress
```

### Profile Assembly Rules

1. **Freshness wins** — The most recent DNA data takes precedence
2. **Confidence threshold** — Attributes below 0.5 confidence are marked as speculative
3. **User override** — Explicit user declarations override inferred data
4. **Context-awareness** — Profile expression adapts to the current context (e.g., learning vs. career browsing)
5. **Temporal decay** — Stale data has reduced influence until refreshed

---

## Profile Segmentation

Profiles enable meaningful user segmentation for product decisions:

| Segment Type       | Basis              | Example              | Use                         |
| ------------------ | ------------------ | -------------------- | --------------------------- |
| Journey Stage      | Progress dimension | "Stuck in 02_Learn"  | Stage-appropriate content   |
| Skill Level        | Skills dimension   | "Advanced Python"    | Skill-level filtering       |
| Goal Category      | Goals dimension    | "Career changers"    | Targeted recommendations    |
| Learning Style     | Learning Profile   | "Visual, self-paced" | Content format optimization |
| Time Availability  | Context dimension  | "5-10 hrs/week"      | Realistic pacing            |
| Engagement Pattern | Learning Profile   | "Weekend binger"     | Scheduling optimization     |

---

## The Persona Connection

User Profiles (individual, data-driven) are the **real-world instantiation** of User Personas (archetypal, research-driven).

| Aspect    | User Personas (00_Core) | User Profiles (this document) |
| --------- | ----------------------- | ----------------------------- |
| Nature    | Archetypal              | Individual                    |
| Source    | User research           | User DNA                      |
| Quantity  | 5-10 personas           | Millions of profiles          |
| Stability | Stable over time        | Continuously evolving         |
| Use case  | Design guidance         | Personalization engine        |

Every user profile maps to one or more personas based on similarity. This mapping enables:

- Persona-driven design validation ("does this work for our Samantha persona?")
- Profile-to-persona comparison ("you're similar to the Career Changer persona")
- Aggregate persona analytics ("how many users match each persona?")

---

## Cross-References

- **User DNA.md** — The source data for all profiles
- **User DNA Dimensions.md** — The attributes that compose profiles
- **User Assessment.md** — How attributes are measured
- **User Personas.md (PRD-001)** — Archetypal user models that profiles instantiate
- **Human Journey.md (PRD-001)** — Journey stage determines relevant profile expression
- **Recommendation Engine.md** — How profiles drive recommendations
- **Personalization Rules.md** — Rules for profile-based personalization

## Future Expansion

- Dynamic profile generation for temporary contexts (event-based profiles)
- Collaborative profiles (team, organization, community)
- Predictive profiles (where the user is likely headed based on similar profiles)
- Privacy-preserving profile sharing (selective attribute sharing)
- Profile versioning and rollback (user can revert to earlier profile)
- Cross-platform profile importing/exporting (open profile standard)
- Profile benchmarking (compare against anonymized aggregate profiles)
