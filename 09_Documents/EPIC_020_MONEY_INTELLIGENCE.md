# EPIC-020 — Money & Opportunity Intelligence

**Money Intelligence · 2026-08-12**

## 1. Scope

VedMoulya identifies opportunities — earning, freelance, job, automation, business, digital-product, content, cost-saving, reusable-capability — **without becoming a money-making agent**. Narrow intelligence ports let the Brain reason over opportunities; every opportunity is evidence-backed, uncertainty-marked, and approval-gated.

## 2. What already existed (REUSED, never rebuilt)

- `Opportunity` (7 categories, uncertainty, `estimatedValue` only when evidenced) + `OpportunityIntelligence` (EPIC-020 continuous layer).
- AI World discovery → screened `IntelligenceEvent`s (EPIC-012C/015 security classification).
- Brain approval gates (`BrainPolicyEngine` / `ApprovalRuntime`).
- Outcome memory + adaptive score ledger (learning).

## 3. What this layer adds (evidence-only money fields)

`Opportunity` now carries the mission §3 fields — populated conservatively:

| Field                      | Rule                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `requiredCapabilities`     | only when the discovery event carries capability tags                                                                 |
| `estimatedEffort` / `cost` | only when evidence exists                                                                                             |
| `risk`                     | LOW/MEDIUM/HIGH/UNKNOWN from the existing security classification (TRUSTED_WITH_REVIEW → MEDIUM + review requirement) |
| `approvalRequirement`      | "security review before use" when review is required / UNKNOWN                                                        |
| `recommendedNextAction`    | always present — the exact next step                                                                                  |

**No fabricated income.** `detectFromOutcome` only creates an automation opportunity when the objective expresses recurrence AND the task completed AND the user accepted — and its value stays `UNKNOWN` unless measured.

## 4. Free/open/local-first with quality gate

Selection remains quality-first (frozen `ProviderRoleAssigner` semantics): free wins only when quality evidence is equivalent; a materially better paid option is **recommended with approval**, never silently subscribed. When the user rejects a paid option, the Brain continues with the best available alternative (verified by benchmark scenario 5).

## 5. Security posture (unchanged)

- Never execute arbitrary GitHub code, install packages automatically, or reuse Google tokens as GitHub credentials.
- Never claim a repository is safe, an API is free, or a model has capacity **without evidence**.
- UNKNOWN stays UNKNOWN; BLOCKED/SUSPICIOUS discoveries never become opportunities.
