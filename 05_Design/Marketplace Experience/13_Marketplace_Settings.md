# Marketplace Settings

> **Document:** DES-009-D13 — Marketplace & Opportunity Ecosystem  
> **Status:** 🔒 **LOCKED** — Part of DES-009 Marketplace Constitution v1.1

---

## Purpose

Marketplace Settings gives users comprehensive control over their marketplace experience — privacy, visibility, availability, notifications, opportunity preferences, and account controls — ensuring the marketplace respects user autonomy at every level.

---

## Vision

Create the most privacy-respecting, user-controlled marketplace settings experience — where every preference is transparent, every default is privacy-protective, and users always feel in control of their marketplace presence and participation.

---

## Design Constitution Compliance

| Property        | Standard                             | Source       |
| --------------- | ------------------------------------ | ------------ |
| Page Background | `#F5F7FA` (Warm Matte Light)         | DES-001 v1.0 |
| Cards           | `#FFFFFF` with border `#E8EDF5`      | DES-001 v1.0 |
| Primary Color   | `#2B5FD9` (Deep Calm Blue)           | DES-001 v1.0 |
| Headings        | Satoshi                              | DES-001 v1.0 |
| Body            | Inter (never below 16px)             | DES-001 v1.0 |
| Card Radius     | 24px                                 | DES-001 v1.0 |
| Input Radius    | 16px                                 | DES-001 v1.0 |
| Motion          | 200-300ms, ease-out                  | DES-001 v1.0 |
| AI Persona      | Wise Mentor (Marketplace Coach mode) | DES-005 v1.0 |

---

## Architecture References

| Reference | Relationship                                              |
| --------- | --------------------------------------------------------- |
| ENG-001   | Domain Model — UserPreferences, PrivacySettings entities  |
| ENG-002   | Implementation Standards — settings patterns, data export |
| ENG-003   | Information Governance — privacy, consent, data deletion  |
| PRD-002   | User DNA — preference defaults                            |

---

## Information Hierarchy

```
P0 — ALWAYS VISIBLE:
  • Settings navigation (categories)
  • Current privacy status summary
  • Quick toggles for key preferences

P1 — SHOWN BY DEFAULT:
  • Privacy & visibility settings
  • Notification preferences
  • Opportunity preferences
  • Availability settings

P2 — CONTEXTUAL:
  • Mentorship preferences
  • Hiring preferences
  • Freelancing preferences
  • Evidence sharing controls

P3 — ON DEMAND:
  • Blocked organizations
  • Data export
  • Account controls
  • Full settings history
```

---

## Specification Consistency

| Standard               | Reference             | Application                                       |
| ---------------------- | --------------------- | ------------------------------------------------- |
| Typography             | DES-001/D04           | Headings: Satoshi, Body: Inter (never below 16px) |
| Spacing                | DES-001/D06           | 4px base unit, space-4 (16px) standard gap        |
| Motion                 | DES-001/D09           | 200-300ms, ease-out, toggle transitions           |
| Accessibility          | DES-001/D10           | WCAG 2.1 AA, all controls have labels             |
| Color Hierarchy        | DES-001/D03           | Toggles use semantic colors                       |
| Component Language     | DES-001/D07           | Inputs at 16px radius, toggles per system         |
| AI Personality         | DES-001/D11 + DES-005 | Wise Mentor — explains setting implications       |
| Interaction Principles | DES-001/D11           | Purposeful, calm, consistent                      |

---

## 1. Privacy & Visibility (Major Experience Section)

Controls over what information is visible to whom — from public profile to specific collaboration visibility.

```
┌────────────────────────────────────────────────────────┐
│  Privacy & Visibility                                   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Profile Visibility                              │   │
│  │  [●] Public — Anyone can see my profile          │   │
│  │  [○] Marketplace only — Only marketplace users   │   │
│  │  [○] Private — Only collaborators can see        │   │
│  │                                                   │   │
│  │  Evidence Sharing                                 │   │
│  │  [●] Share verified skills (public)               │   │
│  │  [●] Share project outcomes (public)              │   │
│  │  [○] Share learning achievements (marketplace)    │   │
│  │                                                   │   │
│  │  Activity Visibility                              │   │
│  │  [○] Show when I'm online                        │   │
│  │  [○] Show collaboration history                  │   │
│  │  [●] Show trust score                            │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Quality Review

| Dimension                     | Assessment                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Why**                       | Privacy is a human right — users must have granular, understandable control over their marketplace presence                    |
| **Marketplace Reasoning**     | Privacy-respecting platforms build long-term trust; granular controls differentiate from platforms with all-or-nothing privacy |
| **Psychological Reasoning**   | Reactance — users resist when control is taken away; autonomy — control over visibility increases comfort participating        |
| **Accessibility Impact**      | All controls have clear text labels and operate independently of color; screen reader announcements on change                  |
| **Trust Impact**              | This is a core trust feature — must be transparent, reliable, and respect user choices absolutely                              |
| **Implementation Complexity** | Medium — requires access control system, visibility enforcement, and privacy-preserving defaults                               |
| **Future Scalability**        | Can add incognito browsing, temporary invisibility, AI-suggested privacy settings                                              |

---

## 2. Availability & Preferences (Major Experience Section)

Controls over marketplace availability, opportunity preferences, and notification timing.

### Quality Review

| Dimension                     | Assessment                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Why**                       | Availability control prevents overcommitment and ensures users only receive relevant opportunities            |
| **Marketplace Reasoning**     | Accurate availability data increases match quality; preference controls reduce irrelevant notifications       |
| **Psychological Reasoning**   | Scarcity — limited availability can signal quality; control — setting boundaries increases perceived autonomy |
| **Accessibility Impact**      | Time controls are keyboard accessible with clear labels; no time pressure on settings changes                 |
| **Trust Impact**              | Respecting user availability preferences builds trust; never override user-set limits                         |
| **Implementation Complexity** | Low-Medium — requires availability storage, preference-based filtering, and notification scheduling           |
| **Future Scalability**        | Can add smart availability (AI-learned patterns), temporary pauses, vacation mode                             |

---

## 3. Opportunity & Experience-Specific Preferences (Major Experience Section)

Granular controls for each marketplace experience area — mentorship, hiring, freelancing, partnerships.

| Preference Area   | Settings                                                               | Default                 |
| ----------------- | ---------------------------------------------------------------------- | ----------------------- |
| **Mentorship**    | Accepting mentees? Areas of expertise? Max mentees? Session frequency? | Off (opt-in)            |
| **Hiring**        | Actively looking? Open to offers? Job types? Locations? Salary range?  | Off (opt-in)            |
| **Freelancing**   | Available for projects? Rate range? Project types? Max hours/week?     | On (if freelancer)      |
| **Partnerships**  | Open to partnerships? Partner types? Collaboration scope?              | Off (opt-in)            |
| **Notifications** | Daily digest? Weekly review? Instant alerts? Quiet hours?              | Weekly digest (default) |

### Quality Review

| Dimension                     | Assessment                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | Different marketplace experiences require different preference controls — one-size-fits-all doesn't work                |
| **Marketplace Reasoning**     | Granular preferences increase match quality and reduce irrelevant engagement                                            |
| **Psychological Reasoning**   | Categorization — organizing preferences by experience area reduces cognitive load; customization increases satisfaction |
| **Accessibility Impact**      | Settings are organized by category with clear labels and consistent interaction patterns                                |
| **Trust Impact**              | Transparent defaults and clear explanations of each setting build trust; no dark pattern defaults                       |
| **Implementation Complexity** | Medium — requires preference storage, cross-service integration, and default management                                 |
| **Future Scalability**        | Can add AI-suggested preferences, experience-based defaults, preference templates                                       |

---

## 4. Bookmarks & Saved Items (Previously Uncovered Item)

Users can bookmark opportunities, profiles, services, and collaborations — organized into custom folders with notification options.

### Quality Review

| Dimension                     | Assessment                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | Bookmarks enable users to track items of interest without immediate action — reducing FOMO and enabling thoughtful decisions |
| **Marketplace Reasoning**     | Bookmarked items drive return visits; organized bookmarks increase engagement depth                                          |
| **Psychological Reasoning**   | Keeping options open — bookmarks reduce anxiety about missing opportunities; mental offloading — saves cognitive resources   |
| **Accessibility Impact**      | Bookmarks are screen reader accessible with keyboard navigation; folder organization supports scanning                       |
| **Trust Impact**              | Bookmarks are private to the user — respecting this privacy builds trust                                                     |
| **Implementation Complexity** | Low — requires bookmark storage, categorization, and notification integration                                                |
| **Future Scalability**        | Can add shared bookmarks (for team collaboration), bookmark-based recommendations, expiry alerts                             |

---

## 5. Blocked Organizations & Users (Major Experience Section)

Users can block specific organizations or individuals from viewing their profile, contacting them, or matching with opportunities.

### Quality Review

| Dimension                     | Assessment                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Why**                       | Blocking is a safety feature — users must be able to control who can interact with them                            |
| **Marketplace Reasoning**     | Safety features increase user confidence; lack of blocking drives users away                                       |
| **Psychological Reasoning**   | Safety — control over unwanted interactions reduces anxiety; autonomy — blocking power increases perceived control |
| **Accessibility Impact**      | Blocking interface is simple, clear, and screen reader accessible; confirmation step prevents accidents            |
| **Trust Impact**              | Blocking must be absolute and invisible to blocked parties — partial blocking would destroy trust                  |
| **Implementation Complexity** | Low-Medium — requires block list enforcement, access control integration, and privacy preservation                 |
| **Future Scalability**        | Can add anonymous reporting workflow, escalated blocking for harassment, trusted user whitelist                    |

---

## 6. Data Export & Account Controls (Major Experience Section)

Users can export their marketplace data, delete their account, or manage data retention preferences.

### Quality Review

| Dimension                     | Assessment                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Why**                       | Data portability is a legal right (GDPR Art. 20) and a trust signal — users must control their data                  |
| **Marketplace Reasoning**     | Data export capability builds trust; easy account deletion reduces switching costs concerns                          |
| **Psychological Reasoning**   | Endowment effect — users value data more when they can export it; control — easy deletion reduces lock-in anxiety    |
| **Accessibility Impact**      | Export and deletion flows are fully keyboard accessible with clear confirmation steps                                |
| **Trust Impact**              | This is the ultimate trust feature — if users can easily leave with their data, it proves the platform respects them |
| **Implementation Complexity** | Medium — requires data aggregation service, export generation, and secure deletion workflow                          |
| **Future Scalability**        | Can add selective export (by category), scheduled automatic exports, third-party data portability                    |

---

## Personalization

| Dimension      | Application to Marketplace Settings                    |
| -------------- | ------------------------------------------------------ |
| User DNA       | Default settings align with user's privacy preferences |
| Career Goals   | Opportunity preferences default based on career stage  |
| Risk Tolerance | Privacy default levels adjusted to risk tolerance      |

---

## Accessibility

| Requirement         | Standard                     | Application                    |
| ------------------- | ---------------------------- | ------------------------------ |
| WCAG 2.1 AA         | Minimum for all screens      | All settings screens           |
| Body text minimum   | 16px (never below)           | All settings content           |
| Touch targets       | 44×44px minimum              | Toggles, buttons, sliders      |
| Keyboard navigation | 100% of interactions         | All settings controls          |
| Screen reader       | All settings announced       | Labels, states, changes        |
| Reduced motion      | All animations disabled      | Respect prefers-reduced-motion |
| Color alone         | Never solely conveys meaning | All settings use text + icon   |

---

## Motion

| Animation                | Duration      | Easing   | Notes                            |
| ------------------------ | ------------- | -------- | -------------------------------- |
| Toggle switch            | 200ms         | ease-out | Track + thumb transition         |
| Settings expand/collapse | 250ms         | ease-out | Smooth height transition         |
| Save confirmation        | 200ms         | ease-out | Brief success indicator          |
| Data export progress     | Indeterminate | —        | Progress bar while generating    |
| Reduced motion           | All 0ms       | —        | prefers-reduced-motion respected |

---

## Cross-References

| Reference     | Relationship                                                                      |
| ------------- | --------------------------------------------------------------------------------- |
| DES-001 v1.0  | Design Constitution — visual foundation                                           |
| DES-001A v1.0 | Design System Consistency — form patterns                                         |
| DES-002A v1.0 | Onboarding Refinement — settings introduced                                       |
| DES-003A v1.1 | Dashboard Refinement — settings access                                            |
| DES-009/D00   | Marketplace Constitution — personalization governance                             |
| DES-009/D02   | Marketplace Dashboard — settings from dashboard                                   |
| DES-009/D06   | Mentorship — mentorship-specific preferences                                      |
| DES-009/D07   | Hiring — hiring-specific preferences                                              |
| DES-009/D08   | Freelancing — freelancing-specific preferences                                    |
| DES-009/D11   | Trust and Reputation — evidence sharing preferences                               |
| PRD-002       | User DNA — preference defaults                                                    |
| ARC-001       | System Architecture — settings service, user preferences                          |
| ARC-002       | Information Architecture — settings data flow                                     |
| ARC-003       | Knowledge Graph — preference-based personalization                                |
| ARC-004       | Execution Intelligence — activity-based preference suggestions                    |
| ARC-005       | AI Orchestration — AI-suggested preference settings                               |
| ENG-001       | Domain Model — UserPreferences, PrivacySettings, BlockList entities               |
| ENG-002       | Implementation Standards — settings patterns, toggle components, data export      |
| ENG-003       | Information Governance — privacy, consent, data deletion, evidence classification |
| ENG-004       | Testing Standards — settings functionality validation                             |
| RSH-001       | Research — marketplace settings user preferences, privacy behavior                |
| CMP-001       | Competition — settings UX differentiation                                         |

### Relationship Summary

| Reference   | How D13 Depends On It                                                         |
| ----------- | ----------------------------------------------------------------------------- |
| DES-001     | All visual properties applied to settings screens and controls                |
| DES-001A    | Component patterns for toggles, forms, selects, and data export               |
| DES-002     | Onboarding establishes initial user preferences                               |
| DES-002A    | Refined onboarding introduces settings during setup                           |
| DES-003     | Dashboard provides settings access                                            |
| DES-003A    | Refined dashboard includes settings quick-access                              |
| DES-004     | Memory & Knowledge data visibility controlled by settings                     |
| DES-005     | AI Mentor explains setting implications to users                              |
| DES-009/D00 | Constitution personalization governance defines settings requirements         |
| DES-009/D02 | Settings accessible from marketplace dashboard                                |
| DES-009/D03 | Opportunity preferences filter discovery feed                                 |
| DES-009/D06 | Mentorship-specific preferences in mentorship settings                        |
| DES-009/D07 | Hiring-specific preferences in hiring settings                                |
| DES-009/D08 | Freelancing-specific preferences in freelancing settings                      |
| DES-009/D09 | Partnership-specific preferences in partner settings                          |
| DES-009/D10 | Coach respects user-set preferences                                           |
| DES-009/D11 | Evidence sharing controls integrated into privacy settings                    |
| PRD-001     | Product vision defines user-controlled marketplace                            |
| PRD-002     | User DNA provides preference defaults and recommendations                     |
| ARC-001     | Architecture enables settings service and user preference storage             |
| ARC-002     | Data flow design supports preference-based filtering                          |
| ARC-003     | Knowledge Graph personalization uses preference data                          |
| ARC-004     | Execution intelligence respects availability settings                         |
| ARC-005     | AI pipeline powers AI-suggested settings                                      |
| ENG-001     | Domain entities define UserPreferences, PrivacySettings, BlockList            |
| ENG-002     | Implementation patterns define settings UI and data export standards          |
| ENG-003     | Information governance ensures privacy, consent, and data deletion compliance |
| ENG-004     | Testing validates settings functionality and data safety                      |
| RSH-001     | Research informs privacy preferences and UX patterns                          |
| CMP-001     | Competitive analysis differentiates settings experience                       |

---

## Future Scalability

| Capability                  | Horizon   | Impact                             |
| --------------------------- | --------- | ---------------------------------- |
| AI-suggested preferences    | 3 months  | Smart defaults based on behavior   |
| Preference templates        | 6 months  | Quick setup for common patterns    |
| Cross-device settings sync  | 3 months  | Consistent experience everywhere   |
| Granular data categories    | 6 months  | Per-category export/delete         |
| Enterprise account controls | 12 months | Admin-managed marketplace policies |

---

## Implementation Complexity

| Component                       | Complexity | Key Dependencies                       |
| ------------------------------- | ---------- | -------------------------------------- |
| Privacy & Visibility            | Medium     | Access control, visibility enforcement |
| Availability & Preferences      | Low-Medium | Preference storage, filtering          |
| Experience-Specific Preferences | Medium     | Cross-service integration              |
| Bookmarks                       | Low        | Bookmark service, categorization       |
| Blocked Organizations           | Low-Medium | Block list, access control             |
| Data Export & Account Controls  | Medium     | Data aggregation, secure deletion      |

---

## Design Freeze Status

**DES-009-D13: Marketplace Settings — LOCKED effective July 27, 2026.**

All marketplace settings design decisions are finalized. No further changes without formal Design Review.
