# Personalization Rules

**Version:** 1.0
**Status:** Draft
**Author:** Principal Product Architect
**Created:** 2026-07-24
**Updated:** 2026-07-24
**Dependencies:** User DNA.md, User DNA Dimensions.md, User Profiles.md, Recommendation Engine.md, Product Principles.md, Human Journey.md (PRD-001)

## Description

Defines the rules, policies, and boundaries that govern how User DNA drives personalization across the VedMoulya platform. These rules ensure personalization is helpful, respectful, transparent, and aligned with VedMoulya's product principles.

---

## Personalization Philosophy

### Personalization as Service, Not Surveillance

Personalization serves the user. It should feel like a helpful assistant who knows you well, not like a tracking system that knows everything about you. The line between helpful and creepy is defined by these rules.

### The User Is in Control

Every personalization feature must have an off switch. Users can dial personalization up or down, limit which DNA dimensions are used, and override any personalized decision.

### Personalization Must Be Earned

The platform earns the right to personalize through demonstrated value. Before using a DNA dimension for personalization, the platform must show the user how that dimension improves their experience.

---

## Rule Categories

### 1. Consent Rules

| Rule                      | Description                                                         | Enforcement                    |
| ------------------------- | ------------------------------------------------------------------- | ------------------------------ |
| Explicit consent required | Sensitive dimensions (Personality, Context) require explicit opt-in | Platform feature gate          |
| Opt-out always available  | Users can disable personalization at any level                      | Global + per-dimension toggles |
| Purpose limitation        | DNA data used only for stated personalization purposes              | Technical enforcement          |
| Consent revocation        | Withdrawing consent stops all downstream use                        | Immediate effect               |
| Informed consent          | Users must understand what they're consenting to                    | Clear language in UI           |

### 2. Transparency Rules

| Rule                           | Description                                      | Enforcement         |
| ------------------------------ | ------------------------------------------------ | ------------------- |
| Explain every recommendation   | Every recommendation must include a "why"        | Product requirement |
| Show DNA sources               | Users can see where each DNA attribute came from | Profile UI          |
| Declared vs. inferred labeling | Inferred attributes are clearly labeled          | Data tagging        |
| Personalization audit          | Users can see all rules applied to them          | Audit log           |
| Algorithm transparency         | Personalization logic is documented publicly     | Documentation       |

### 3. Fairness Rules

| Rule                   | Description                                                              | Enforcement                  |
| ---------------------- | ------------------------------------------------------------------------ | ---------------------------- |
| No discrimination      | Personalization must not discriminate based on protected characteristics | Audit + testing              |
| Equal opportunity      | Similar users receive similar quality of recommendations                 | Quality monitoring           |
| Bias monitoring        | Regular audits for algorithmic bias                                      | Quarterly review             |
| Diversity enforcement  | Recommendations must include diverse options                             | Diversity penalty in scoring |
| Accessibility priority | Users with accessibility needs receive adapted experiences               | Detection + override         |

### 4. User Control Rules

| Rule                     | Description                                                          | Enforcement      |
| ------------------------ | -------------------------------------------------------------------- | ---------------- |
| Full profile visibility  | Users can see their entire profile                                   | Profile UI       |
| Edit and correct         | Users can edit any DNA attribute                                     | Edit UI          |
| Override recommendations | Users can override any recommendation decision                       | Override UI      |
| Personalization level    | Users can set personalization intensity: None, Light, Balanced, Deep | Global setting   |
| Reset profile            | Users can reset their DNA and start fresh                            | Account settings |
| Export profile           | Users can export their complete DNA                                  | Data export      |

### 5. Data Freshness Rules

| Rule                   | Description                                      | Enforcement       |
| ---------------------- | ------------------------------------------------ | ----------------- |
| Recency weighting      | Recent data weighted more heavily than old data  | Scoring algorithm |
| Confidence decay       | Unrefreshed attributes lose confidence over time | Time-based decay  |
| Re-assessment triggers | Significant life events trigger re-assessment    | Event detection   |
| Stale data flagging    | Data older than threshold is marked as stale     | Data tagging      |
| Automatic refresh      | Periodically prompt for profile updates          | Quarterly         |

### 6. Context Sensitivity Rules

| Rule                 | Description                                       | Enforcement       |
| -------------------- | ------------------------------------------------- | ----------------- |
| Time awareness       | Recommendations adapt to time of day, day of week | Temporal context  |
| Device awareness     | Experience adapts to device capability and screen | Device detection  |
| Location sensitivity | Location used only with explicit consent          | Consent gate      |
| Energy awareness     | Adapt to user's stated energy level               | Context dimension |
| Constraint respect   | Never recommend beyond user's stated constraints  | Hard filter       |

### 7. Ethical Boundaries

| Rule                     | Description                                                    | Enforcement            |
| ------------------------ | -------------------------------------------------------------- | ---------------------- |
| No manipulation          | Personalization must not exploit psychological vulnerabilities | Ethics review          |
| No dark patterns         | Never use personalization to trick or coerce                   | Product principle      |
| Vulnerability protection | Users in vulnerable states receive extra care                  | Detection + adaptation |
| Minor protection         | Enhanced privacy for underage users                            | Age detection          |
| Health boundaries        | Health data not used for personalization                       | Data classification    |

---

## Personalization Levels

Users can choose their personalization intensity:

| Level        | Description                                                  | Dimensions Used                                     | Inference Use   |
| ------------ | ------------------------------------------------------------ | --------------------------------------------------- | --------------- |
| **None**     | No personalization; default content only                     | None                                                | None            |
| **Light**    | Basic personalization based on declared goals                | Identity, Goals                                     | None            |
| **Balanced** | Moderate personalization with declared + behavioral data     | Identity, Goals, Skills, Progress, Learning Profile | Behavioral only |
| **Deep**     | Full personalization using all dimensions including inferred | All dimensions                                      | All methods     |

**Default:** Balanced (users can change at any time)

---

## Personalization Decision Framework

When deciding whether to personalize a specific experience:

```
1. Is consent obtained for the required dimensions?
   ├── No → Use default experience
   └── Yes → Continue
2. Does the personalization serve the user's goals?
   ├── No → Reconsider; document rationale
   └── Yes → Continue
3. Is the personalization explainable?
   ├── No → Simplify until explainable
   └── Yes → Continue
4. Is the personalization reversible?
   ├── No → Reconsider; add override capability
   └── Yes → Implement
5. Is the personalization within ethical boundaries?
   ├── No → Do not implement
   └── Yes → Implement with monitoring
```

---

## Personalization by Journey Stage

| Journey Stage        | Personalization Focus          | Intensity        | Key Rules                               |
| -------------------- | ------------------------------ | ---------------- | --------------------------------------- |
| 00_Core (Onboarding) | Help user discover their goals | Light → Balanced | Consent collection, baseline assessment |
| 01_Discover          | Surface relevant opportunities | Balanced         | Freshness, diversity                    |
| 02_Learn             | Optimize learning experience   | Balanced → Deep  | Learning profile, context sensitivity   |
| 03_Build             | Support project execution      | Balanced         | Goal alignment, skill gap focus         |
| 04_Earn              | Maximize earning potential     | Deep             | Career profile, market data             |
| 05_Grow              | Enable long-term growth        | Deep             | All dimensions, ethical boundaries      |
| 06_Manage            | Streamline operations          | Balanced         | Context, constraints                    |
| 07_Community         | Foster connections             | Light → Balanced | Consent, personality sensitivity        |
| 08_AI                | Power AI interactions          | Deep             | Full DNA, transparency                  |
| 09_Platform          | Configure experience           | User-controlled  | User control rules                      |

---

## Personalization Rules Violations

| Violation                        | Severity | Response                                     |
| -------------------------------- | -------- | -------------------------------------------- |
| Personalizing without consent    | Critical | Immediate stop; notify user; audit           |
| Using data beyond stated purpose | Critical | Immediate stop; data purge; notify user      |
| Discriminatory personalization   | Critical | Stop feature; audit all users; fix algorithm |
| Opaque recommendation            | Medium   | Add explanation; improve transparency        |
| Stale data in use                | Low      | Flag data; trigger refresh                   |
| Diversity violation              | Low      | Adjust scoring; add diversity enforcement    |

---

## Cross-References

- **User DNA.md** — The data subject to these rules
- **User DNA Dimensions.md** — Which dimensions are governed by which rules
- **User Profiles.md** — How profiles are personalized according to rules
- **Recommendation Engine.md** — How recommendations are constrained by rules
- **Product Principles.md** — Foundational principles that inform these rules
- **Human Journey.md (PRD-001)** — Journey-stage-specific personalization rules
- **Human Problems/Research Methodology.md (RSH-001)** — Ethical research practices that inform personalization ethics

## Future Expansion

- **Personalization marketplace** — Users can choose third-party personalization engines
- **Cross-platform personalization rules** — Consistent rules across all platforms (web, mobile, API)
- **Regulatory compliance** — GDPR, CCPA, and emerging AI regulation compliance
- **Personalization contracts** — User-defined personalization agreements
- **Collaborative personalization** — Team-based personalization with consent rules
- **Context-aware rule switching** — Rules that adapt to context (work vs. personal)
- **Personalization health dashboard** — Metrics on personalization quality, fairness, and user satisfaction
