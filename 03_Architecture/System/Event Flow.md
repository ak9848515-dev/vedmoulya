# Event Flow

**Mission:** Define the event-driven architecture of the VedMoulya Intelligence Platform — the key events, their triggers, their effects, and how they propagate through the system.

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Enterprise Architect
**Dependencies:** Core Components.md, Data Flow.md, Decision Flow.md
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Description

VedMoulya is an event-driven platform. Events are the primary mechanism for communication between components, triggering updates to User DNA, Memory, Knowledge, and HPI. This document defines the event taxonomy, lifecycle, and effects.

---

## Event Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  PRODUCERS   │────▶│   EVENT BUS  │────▶│ CONSUMERS    │
│              │     │              │     │              │
│ User Action  │     │  Async,      │     │ DNA Updater  │
│ AI Response  │     │  Durable,    │     │ Memory Engine│
│ System Event │     │  Ordered     │     │ Knowledge     │
│ Scheduled    │     │              │     │ Analytics    │
│ External     │     │              │     │ Notification │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Key properties:**

- **Asynchronous** — Producers don't wait for consumers
- **Durable** — Events persist until consumed or expired
- **Ordered per source** — Events from the same source maintain order
- **At-least-once delivery** — Consumers handle duplicates idempotently
- **Schema-versioned** — Events evolve with backward compatibility

---

## Event Taxonomy

### User Lifecycle Events

| Event                   | Trigger               | Effects                                                      |
| ----------------------- | --------------------- | ------------------------------------------------------------ |
| `user.registered`       | Account creation      | Create DNA record, initialize HPI, emit onboarding event     |
| `user.onboarded`        | Onboarding completion | Set journey stage to 01_Discover, schedule first assessment  |
| `user.profile.updated`  | Profile change        | Update DNA Identity dimension, recheck personalization rules |
| `user.deleted`          | Account deletion      | Archive DNA, anonymize analytics, emit cleanup event         |
| `user.settings.changed` | Settings update       | Update preferences, adjust personalization level             |

### Journey Events

| Event                       | Trigger                     | Effects                                                    |
| --------------------------- | --------------------------- | ---------------------------------------------------------- |
| `journey.stage.changed`     | User advances to next stage | Update DNA Progress, recalculate HPI, emit recommendations |
| `journey.goal_set`          | User declares a new goal    | Update DNA Goals dimension, generate learning path         |
| `journey.goal.updated`      | Goal changes                | Re-plan, update recommendations                            |
| `journey.goal.completed`    | Goal achieved               | Update DNA Progress, emit achievement, update HPI          |
| `journey.milestone.reached` | Milestone completed         | Same as goal completed, plus notification                  |

### Learning Events

| Event                        | Trigger                     | Effects                                              |
| ---------------------------- | --------------------------- | ---------------------------------------------------- |
| `learning.path.started`      | User begins learning path   | Update DNA Skills/Knowledge, schedule check-ins      |
| `learning.lesson.completed`  | Lesson finished             | Update DNA Knowledge, recalculate mastery score      |
| `learning.assessment.passed` | Assessment completed        | Update DNA Knowledge confidence, check certification |
| `learning.assessment.failed` | Assessment failed           | Update DNA with gap, adjust learning path            |
| `learning.course.completed`  | Full course finished        | Update DNA Skills, update HPI, check career impact   |
| `learning.skill.verified`    | Skill confirmed via project | Update DNA Skills proficiency, boost confidence      |

### Execution Events

| Event                 | Trigger             | Effects                                            |
| --------------------- | ------------------- | -------------------------------------------------- |
| `plan.generated`      | New plan created    | Store in execution store, notify user              |
| `plan.started`        | User begins plan    | Track engagement, update DNA Progress              |
| `plan.step.completed` | Step finished       | Check next step dependencies, suggest continuation |
| `plan.completed`      | Full plan done      | Update DNA Progress, HPI, recommend next plan      |
| `plan.abandoned`      | User stops          | Log reason (if provided), adjust future planning   |
| `task.due`            | Scheduled task time | Send notification, execute if automated            |

### Earning Events

| Event                       | Trigger                 | Effects                                     |
| --------------------------- | ----------------------- | ------------------------------------------- |
| `earning.service_listed`    | User lists service      | Update Marketplace, check completeness      |
| `earning.client_acquired`   | New client secured      | Update DNA Earnings, emit business event    |
| `earning.project_started`   | Client project begins   | Update execution state                      |
| `earning.project_completed` | Client project done     | Update earnings, trigger review request     |
| `earning.income_received`   | Payment received        | Update DNA Finance, recalculate HPI         |
| `earning.milestone.met`     | Income milestone        | Emit achievement, check journey stage       |
| `earning.business_started`  | User registers business | Update DNA Career, unlock business features |

### Skill & Growth Events

| Event                      | Trigger                     | Effects                                           |
| -------------------------- | --------------------------- | ------------------------------------------------- |
| `skill.assessed`           | Formal skill assessment     | Update DNA Skills dimension, confidence score     |
| `skill.improved`           | Skill proficiency increases | Update DNA Skills, check career path alignment    |
| `skill.endorsed`           | Peer/mentor endorsement     | Boost skill confidence, social proof              |
| `skill.gap.identified`     | Gap analysis detection      | Add to DNA knowledge gap list, recommend learning |
| `growth.milestone.reached` | Growth metric achieved      | Update HPI, evaluate journey stage transition     |

### AI Interaction Events

| Event                        | Trigger                     | Effects                                         |
| ---------------------------- | --------------------------- | ----------------------------------------------- |
| `ai.conversation.started`    | User starts AI chat         | Load context into AI Orchestrator               |
| `ai.conversation.message`    | Message in conversation     | Update Memory, check for action triggers        |
| `ai.conversation.finished`   | Conversation ends           | Consolidate memory, update AI learning signals  |
| `ai.recommendation.accepted` | User accepts recommendation | Positive signal, strengthen recommendation path |
| `ai.recommendation.rejected` | User rejects recommendation | Negative signal, adjust scoring                 |
| `ai.feedback.provided`       | Explicit feedback given     | Direct learning signal for AI models            |
| `ai.provider.changed`        | Provider switch             | Log for cost/latency analysis, check quality    |

### Portfolio & Social Events

| Event                       | Trigger                     | Effects                                         |
| --------------------------- | --------------------------- | ----------------------------------------------- |
| `portfolio.created`         | User creates portfolio      | Update DNA Profile, notify career opportunities |
| `portfolio.updated`         | Portfolio changes           | Re-evaluate opportunity matching                |
| `portfolio.shared`          | Portfolio viewed externally | Track engagement, attribution                   |
| `network.connection_made`   | User connects with peer     | Update social graph, suggest collaborations     |
| `network.endorsement_given` | Peer endorsement            | Update skill confidence                         |
| `community.post_created`    | Forum post                  | Moderate, categorize, index in Knowledge Graph  |

### System Events

| Event                             | Trigger                   | Effects                                       |
| --------------------------------- | ------------------------- | --------------------------------------------- |
| `system.provider.health_changed`  | AI provider status change | Update Provider Manager routing               |
| `system.provider.rate_limited`    | Provider rate limit hit   | Reroute to fallback, alert admin              |
| `system.cost.threshold_exceeded`  | AI cost passes threshold  | Alert admin, review provider selection        |
| `system.error.critical`           | Critical system error     | Page on-call, begin incident response         |
| `system.security.threat_detected` | Security event            | Block request, alert security team, log audit |
| `system.backup.completed`         | Scheduled backup          | Verify backup integrity                       |
| `system.deployment.started`       | New deployment            | Route traffic, monitor health                 |
| `system.deployment.completed`     | Deployment successful     | Confirm health, complete rollout              |

### Schedule Events

| Event                     | Trigger                     | Effects                                       |
| ------------------------- | --------------------------- | --------------------------------------------- |
| `schedule.daily.digest`   | Daily at user's time        | Send daily summary, check-in prompt           |
| `schedule.weekly.review`  | Weekly schedule             | Weekly progress report, re-evaluate goals     |
| `schedule.assessment.due` | Assessment interval reached | Prompt user for re-assessment                 |
| `schedule.plan.review`    | Plan age threshold          | Review plan progress, suggest adjustments     |
| `schedule.data.freshness` | Data staleness check        | Identify stale DNA/knowledge, request refresh |

---

## Event Effects Matrix

Every event potentially updates three core structures:

```
Event → Update User DNA → Update Memory → Update HPI
```

| Event                 | DNA Update                | Memory Update       | HPI Update             |
| --------------------- | ------------------------- | ------------------- | ---------------------- |
| lesson.completed      | Knowledge dimension       | Learning history    | Learning sub-score     |
| client_acquired       | Earnings dimension        | Business history    | Earnings sub-score     |
| skill.improved        | Skills dimension          | Growth history      | Skills sub-score       |
| goal.completed        | Progress dimension        | Achievement memory  | All applicable         |
| conversation.finished | All dimensions (inferred) | Conversation memory | Engagement sub-score   |
| plan.completed        | Progress dimension        | Execution history   | Productivity sub-score |
| income_received       | Finance dimension         | Earnings history    | Earnings sub-score     |

---

## Event Schema Standard

Every event follows this standard schema:

```json
{
  "eventId": "evt_20260724_001",
  "eventType": "learning.lesson.completed",
  "eventVersion": "1.0",
  "timestamp": "2026-07-24T12:00:00Z",
  "source": "learning-service",
  "userId": "usr_uuid",
  "correlationId": "corr_abc123",
  "data": {
    "lessonId": "lesson_456",
    "courseId": "course_789",
    "duration_minutes": 25,
    "score": 85
  },
  "metadata": {
    "producerVersion": "1.2.3",
    "environment": "production",
    "traceId": "trace_xyz"
  }
}
```

## Cross-References

- **Core Components.md** — Components that produce and consume events
- **Data Flow.md** — How event data flows through the system
- **Decision Flow.md** — How events trigger decision lifecycles
- **Knowledge Flow.md** — How events trigger knowledge updates
- **PRD-002** — Events update User DNA dimensions
- **PRD-001** — Events trigger HPI recalculation and journey stage changes
- **RSH-001** — Events related to validated problems trigger problem-specific responses

### Future Expansion

- Event sourcing for complete system state reconstruction
- Complex event processing (CEP) for pattern detection
- Event-driven workflows with compensation (Saga pattern)
- Cross-user events for community and collaboration features
- External webhook events for third-party integrations
- Event replay for system recovery and testing
- Event analytics for user behavior insights
