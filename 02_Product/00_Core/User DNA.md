# User DNA

**Version:** 1.0
**Status:** Draft
**Author:** Principal Product Architect
**Created:** 2026-07-24
**Updated:** 2026-07-24
**Dependencies:** Human Journey.md (PRD-001), Human Problems/Problem Categories.md (RSH-001), User DNA Dimensions.md

## Description

User DNA is VedMoulya's foundational framework for understanding each user as a unique individual. It is the single source of truth that drives personalization, recommendations, coaching, and every AI-powered interaction on the platform. Just as biological DNA encodes the blueprint of a living organism, User DNA encodes the blueprint of a user's identity, capabilities, aspirations, and context.

---

## Why User DNA Exists

Every user comes to VedMoulya with a unique combination of:

- Skills they already possess
- Knowledge they've acquired
- Goals they want to achieve
- Ways they learn best
- Constraints they face (time, money, location)
- Personality traits that shape their approach
- Past experiences that inform their perspective
- Problems they need to solve

Generic, one-size-fits-all approaches fail because they ignore this uniqueness. User DNA is the framework that ensures every interaction — every recommendation, every coaching session, every learning path, every opportunity match — is deeply personalized.

## The User DNA Philosophy

### Principle 1: Holistic, Not Fragmented

User DNA captures the whole person, not just isolated data points. A user's career goals, learning style, financial situation, personality, and personal circumstances are interconnected. The DNA model reflects these connections.

### Principle 2: Dynamic, Not Static

User DNA evolves as the user grows. Skills improve, goals change, circumstances shift. The DNA model is designed to capture both current state and trajectory, updating continuously as new data emerges.

### Principle 3: Inferred, Not Just Declared

Some aspects of User DNA are explicitly declared by the user (goals, preferences). Others are inferred by the platform through behavior, assessment results, and AI analysis. Both declared and inferred data are part of the DNA.

### Principle 4: Owned by the User

User DNA belongs to the user. They can view it, edit it, export it, and control how it's used. Transparency and user agency are foundational.

### Principle 5: Actionable, Not Just Descriptive

User DNA is not a passive profile — it actively drives every personalized experience on the platform. Every recommendation, every coaching interaction, every learning path adapts based on the user's DNA.

## The DNA → Journey → Problems Connection

| Framework                    | Role                | Relationship                          |
| ---------------------------- | ------------------- | ------------------------------------- |
| **User DNA** (PRD-002)       | Who the user IS     | The internal model of the user        |
| **Human Journey** (PRD-001)  | Where the user IS   | The stage-based progression framework |
| **Human Problems** (RSH-001) | What the user FACES | The validated problems to solve       |

User DNA answers "who is this user?"
Human Journey answers "where are they in their path?"
Human Problems answers "what challenges do they face?"

Together, these three frameworks form the complete product intelligence foundation for VedMoulya.

## How User DNA Is Structured

User DNA is organized into **dimensions** (defined in User DNA Dimensions.md), each representing a distinct aspect of the user. These dimensions are:

1. **Identity** — Who the user is (demographics, background)
2. **Skills** — What the user can do
3. **Knowledge** — What the user knows
4. **Goals** — What the user wants to achieve
5. **Learning Profile** — How the user learns best
6. **Personality** — How the user thinks and behaves
7. **Context** — The user's situational factors
8. **Progress** — Where the user is on their journey

Each dimension contains multiple attributes, and each attribute has a value, confidence level, and source (declared, inferred, or assessed).

## Data Flow Overview

```
User Actions → Assessment → DNA Update → Personalization → User Experience
     ↑                                                         |
     └───────────────── Feedback Loop ←───────────────────────┘
```

1. User takes actions on the platform (learns, builds, earns, etc.)
2. Assessments and AI inference update the user's DNA
3. The updated DNA drives personalization rules
4. Personalized experiences are delivered to the user
5. User reactions create feedback that refines the DNA

## Privacy and Ethics

- Users can view their complete DNA at any time
- Users can correct or remove DNA attributes
- Sensitive dimensions (personality, context) require explicit consent
- DNA data is never shared without user permission
- Inferred data is always labeled as such
- Users can reset their DNA and start fresh

## Cross-References

- **Human Journey.md (PRD-001)** — User DNA powers journey stage progression and stage-appropriate experiences
- **Human Problems (RSH-001)** — User DNA identifies which validated problems a specific user faces
- **User DNA Dimensions.md** — Detailed specification of each dimension
- **User Assessment.md** — How DNA attributes are measured and inferred
- **Recommendation Engine.md** — How User DNA drives recommendations
- **Personalization Rules.md** — The rules that govern personalization

## Future Expansion

- Cross-platform User DNA portability (user takes their DNA to other platforms)
- DNA comparison for peer matching and mentorship
- Predictive DNA modeling (where the user is headed)
- Multi-user DNA for team and organizational contexts
- DNA-based privacy controls (share specific dimensions with specific services)
- Temporal DNA (how DNA changes over different life phases)
- Federated DNA (aggregate insights without exposing individual data)
