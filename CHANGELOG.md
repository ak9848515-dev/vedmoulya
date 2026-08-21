# Changelog

All notable changes to VedMoulya are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **SPRINT-042 — FOUNDER EVIDENCE ENTRY UI** (2026-08-16, 🟢 COMPLETE — PURE
  COMPOSITION SPRINT, NEW ENGINES CREATED: 0). `EvidenceEntryPanel` in the
  Command Center INTELLIGENCE tab: problem registration (evidence REQUIRED),
  observation (provenance REQUIRED), prospect registration (provenance
  REQUIRED, discoveryStatus not sendable), advance (display-only valid
  transitions; backend rejects illegal jumps with INVALID_TRANSITION),
  verified-payment capture (real payment-evidence text REQUIRED). Every
  mutation maps 1:1 to an existing gateway procedure; zero business rules in
  React; honest EMPTY/UNKNOWN states; backend errors verbatim; every save
  refreshes radar/NBA. Fixed two genuine UI defects found by live Chrome
  verification: D1 `handleSaved` now refetches `prospectsQuery` (stale
  next-state options after a transition); D2 the drawer-open effect now
  depends on `[open]` only (was an infinite `problemList` refetch loop — 30+
  refetches in 2s, each burning a rate-limit token). Real-Chrome Scenarios
  1–9 **19–20/20 PASS** incl. cross-user mutation **403 FORBIDDEN** live;
  web **292/292** · api **1010/1010** · identity **295/295** · typecheck **0**
  · lint **0/0** · `next build` **PASS**. No fabricated evidence/customers/
  revenue.

- **SPRINT-041B — FIRST-LOGIN PROFILE SETUP VERIFICATION + RECTIFICATION**
  (2026-08-16, 🟢 COMPLETE — VERIFICATION + MINIMAL RECTIFICATION SPRINT,
  **NEW ENGINES CREATED: 0**). The first-login profile experience did not
  exist; built it entirely over the existing estate:
  - Domain: `UserProfile` gained `age/gender/purpose/primaryGoal` and a
    deterministic `isComplete()` — the server is the source of first-login
    truth, never client flags.
  - Persistence: 4 idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
    columns on the existing `users` table (verified live against Docker
    Postgres).
  - API: JWT-authenticated `GET /api/v1/identity/auth/me` +
    `PATCH /api/v1/identity/auth/me/profile` — userId derived from the
    verified token, IDOR-impossible by construction.
  - Web: `refreshProfile()` / `completeProfile()` through the existing
    auth-api/session-manager/store; `/onboarding/profile` page (existing UI
    components, Name prefilled, closed vocabularies); single central
    `OnboardingRedirect` gate in Providers (explicit `profileComplete===false`
    only; auth-flow screens excluded — no loop).
  - **Defects found by live Chrome verification + fixed:** D1 the gate did not
    re-fire on client-side navigation after signup (no pathname dependency) →
    now watches `usePathname()`; D2 `?next=` captured at mount could be stale
    → now resolved at the point of use. +2 regression tests.
  - Verified: real-Chrome Scenarios A–D **15/15 PASS**; web **276/276**,
    identity **295/295**, api **1010/1010**, typecheck **0**, lint **0/0**,
    `next build` **PASS** (58 pages).

- **SPRINT-041 — FOUNDER OPERATING LOOP HARDENING + REAL-WORLD READINESS**
  (2026-08-16, 🟢 COMPLETE — HARDENING + VERIFICATION SPRINT, **NEW ENGINES
  CREATED: 0**): the founder operating loop is now trustworthy for repeated
  founder use — verified live against the gateway with clearly-marked LOCAL
  TEST data (no fabricated evidence/customers/revenue). **Genuine defects
  found + fixed (minimal):** D1 — `advanceProspect` (world-model) fabricated a
  payment-evidence default (`Verified payment from X.`) when `verifiedPaymentText`
  was omitted, letting a VERIFIED_PAYMENT transition succeed with zero
  verification evidence; it now REQUIRES real evidence text
  (`PAYMENT_EVIDENCE_REQUIRED`) · D2 — `evidenceQuality` (world-model) reported
  `provenance: HIGH` with zero records (`every()` over `[]` is vacuously true);
  now `UNKNOWN` with zero records · D3 — `nextBestAction` /
  `opportunityComparisonState` (world-model) let a stale advisory STOP
  (`stopReason` from an assessment taken before a verified payment) say STOP
  forever, and a paid opportunity's TALK_TO_CUSTOMERS claimed "evidence quality
  is insufficient"; advisory STOP now yields to verified-payment evidence
  (founder-terminal REJECTED/DISMISSED still dominate) and the paid-opportunity
  NBA explains repeatability honestly · D4 — real-Postgres restart-recovery test
  (`PersistenceStores.test.ts`) extended to the world evidence-loop stores
  (`world_problems`/`world_observations`/`world_prospects`). **Verification:**
  live evidence loop **26/26 PASS** · world-model **302/302** · services/api
  **1010/1010** · identity **283/283** · web **247/247** · typecheck 0 · lint
  0/0 · `next build` PASS (57 pages) · benchmarks chain exit 0 (opportunity
  20/20 · evidence 20/20 · discovery 10/10 · calibration 13/13 · provider 11/11
  · learning 25/25 · quality gates 16/16) · coverage gate 45/45 PASS. Honest:
  the ONE founder blocker is that evidence-loop ENTRY has no web-UI mutation
  surface yet (Command Center is presentation + founder-approval only by
  design) — next highest-value follow-up is a Command Center evidence-entry UI.
- **SPRINT-040 — FOUNDER EVIDENCE LOOP + LOCAL RUNTIME VERIFICATION** (2026-08-16,
  🟢 COMPLETE — VERIFICATION + DEFECT-FIX SPRINT, **NEW ENGINES CREATED: 0**): the
  first end-to-end operational path was proven live over the frozen estate —
  Docker runtime → register/login → founder observation → provenance validation →
  evidence persistence → scoring → customer discovery → next-best-action →
  verified-payment progression — with the founder remaining the ultimate
  authority. **Defects found + fixed (minimal):** D1 — the identity `users` table
  was the ONE Postgres store never created anywhere (its DB init only opened a
  connection), so first-run auth failed `REGISTRATION_FAILED`; fixed with the
  estate-convention `PostgresIdentityRepository.ensureTable()` (idempotent
  `CREATE TABLE IF NOT EXISTS users` + unique email/google_id indexes), wired
  fire-and-forget in `createProductionIdentityRepository()` and **awaited** in the
  web auth-app for a deterministic cold start · D2 — `IDENTITY_DATABASE_URL`
  unset locally → added to gitignored `apps/web/.env.local` pointing at the Docker
  Postgres (dev creds already public in compose; no API keys) · D3 — no email-
  verification delivery exists anywhere (no SMTP), while the domain blocks
  sign-in for unverified accounts → registered users could never sign in; fixed
  with a dev/test-only `user.verifyEmail()` at registration in the existing
  `AuthService.signUp` (mirrors the existing Google path; production/staging
  unchanged — the domain rule still blocks until a real verification flow ships) ·
  D4 — Next dev cache corruption (`vendor-chunks/@vercel.js`, environment
  artifact) → `.next` cleared. **Live verification:** sign-up 201 · duplicate 409 ·
  validation 400 · sign-in 200 · session 200 · sign-out 200; provenance refusal;
  claimed VERIFIED downgraded to OBSERVED; calibration refuses UNKNOWN fabrication;
  prospect bounded chain + invalid-jump refusal; verified-payment-only ladder
  REVENUE_VERIFIED → REPEAT_REVENUE → REPEATABLE_BUSINESS; explainable next-best-
  action (TALK_TO_CUSTOMERS, NO_COST, explicit STOP branch); radar/drilldown/
  command-center read models; honest empty datasets. Suites: world-model
  **298/298**, identity **283/283** (+2 verify-split tests), api **1010/1010**,
  web **220/220** (+1 auth-app bootstrap test); typecheck **0**; scoped lint
  **0/0**; `next build` **PASS** (56 pages); benchmarks chain **all PASS**;
  coverage gate **2/2 PASS** (identity 88.14/80.39/92.39/89.07, api
  93.01/80.07/95.03/93.83). Docker: postgres + redis healthy, `vedmoulya_default`
  network, `/` + `/login` 200. Honest: `vedmoulya-web` is not a container (not in
  compose — web runs via `next dev`); production email verification remains a
  documented pre-existing gap; only LOCAL TEST data used — nothing fabricated.
  Deliverables: `04_Sprints/SPRINT-040_*` (8).
- **SPRINT-039 — FOUNDER EVIDENCE LOOP** (2026-08-15, 🟢 COMPLETE — COMPOSITION
  SPRINT, **NEW ENGINES CREATED: 0**): closed the last loop between the founder's REAL
  observations and the system's advisory scoring over the frozen estate —
  **founder observations with MANDATORY provenance** (`FounderObservation`;
  provenance-required, refused `PROVENANCE_REQUIRED` otherwise; sanitized at the
  boundary; explicit evidence states OBSERVED/REPORTED_BY_CUSTOMER/FOUNDER_OBSERVED/
  DOCUMENTED/VERIFIED/HYPOTHESIS/UNKNOWN/CONFLICTING; claimed VERIFIED downgraded,
  never trusted at face value; HYPOTHESIS is the honest default) ·
  **customer-discovery ledger** (`CustomerDiscoveryRecord` — NOT a CRM, no PII dumps;
  bounded status chain CONTACTED→…→VERIFIED_PAYMENT with LOST from any active state;
  discovery ≠ validation, interest ≠ revenue, WTP ≠ payment; ONLY a verified_payment
  record reaches REVENUE_VERIFIED) · **bounded evidence calibration**
  (`CALIBRATION_DELTA_MAX` 0.05 per event over the EXISTING SPRINT-038 factors;
  strength-scaled; UNKNOWN never becomes zero; conflicts visible, never silently
  resolved; every adjustment keeps its evidence trail) · **deterministic 8-dimension
  evidence quality** (provenance/directness/recency/independence/repetition/
  specificity/contradiction/verification; honest UNKNOWN; stale evidence never
  inflates) · **explainable NEXT BEST ACTION** (TALK_TO_CUSTOMERS/TEST_WTP/
  REQUEST_PAYMENT/VERIFY_PROBLEM/RUN_NO_COST_EXPERIMENT/STOP with WHY/EVIDENCE/
  LEARNING/RISK/NEXT-DECISION; the system CAN say "do not build this") ·
  **evidence-driven opportunity comparison** (STRONG_EVIDENCE/PROMISING/
  NEEDS_CUSTOMER_VALIDATION/INSUFFICIENT_EVIDENCE/STOP/UNKNOWN — a high score alone
  is never STRONG_EVIDENCE) · **Command Center drill-downs** (expandable evidence /
  prospects / next action per opportunity; honest EMPTY copy) · **voice read-only
  presentation** (CommandCenterQuestionRouter evidence questions; VOICE ≠
  AUTHORIZATION preserved) · owner-scoped stores (in-memory + Postgres
  `world_observations` / `world_prospects`) · gateway `world.*` +10 procedures
  (observationRecord/observationsList/prospectRegister/prospectAdvance/
  prospectsList/evidenceQualityView/factorCalibrate/nextBestActionView/
  opportunityCompare/opportunityDrilldownView — auth + rate tier + IDOR + zod) ·
  **`evidence:benchmark` 20/20 + `discovery:benchmark` 10/10** wired into `npm run
benchmarks` (now 20 harnesses) + vitest gates. Verification 2026-08-15: world-model
  **298/298 (23 files)**, services/api **1010 (50 files)**, web **219/219 (22 files)**,
  typecheck **0**, lint **0 errors · 0 warnings**, `next build` **PASS**, benchmarks
  chain all PASS, coverage gate **world-model 91.11/82.18/90.83/94.34 · api PASS**,
  production-config-check honest. Honest: **EMPTY datasets** — NO fabricated
  observations/prospects/customers/revenue; real founder observation entry ready now;
  live world signals + real provider execution remain **OPERATOR-REQUIRED**; no real
  customer/revenue evidence exists. Deliverables: `04_Sprints/SPRINT-039_*` (13).
- **SPRINT-038 — OPPORTUNITY DISCOVERY & REVENUE VALIDATION** (2026-08-15, 🟢 COMPLETE —
  COMPOSITION SPRINT, **NEW ENGINES CREATED: 0**): VedMoulya became PRACTICAL over the
  frozen estate — **practical problem representation** (`BusinessProblem`, evidence/
  provenance-REQUIRED; a problem without evidence is refused `EVIDENCE_REQUIRED`;
  evidence sanitized; confidence derived never fabricated; external evidence never
  becomes authority — structural) · **three distinct advisory scores** (PROBLEM /
  BUSINESS-OPPORTUNITY / EXPERIMENT — deterministic weighted composites, documented
  weights, factors exposed, UNKNOWN never zero) · **explainable problem levels 0–4** ·
  **bounded lifecycle** (no idea→business jump; transitions validated) ·
  **verified-payment-only revenue ladder** (INTEREST/WTP never reach REVENUE_VERIFIED;
  ONLY a verified payment does; 2→REPEAT_REVENUE, 3+→REPEATABLE_BUSINESS) ·
  **zero/low-cost experiment planner** (NO_COST preferred; approvalRequired for
  spend/external actions) · **customer discovery preparation** (never a fabricated
  interview result) · **STOP / kill-bad-ideas** (the system CAN say "do not build
  this") · **advisory Business Candidate** (requires verified payment + WTP evidence) ·
  **provider economics over the existing Intelligence Fabric** (existing providers
  preferred; capability gap → CAPABILITY GAP DETECTED founder notification; NO automatic
  paid-provider adoption; PRIVATE never falls back to public) · **Opportunity Radar**
  in the Command Center (presentation-only) · gateway `world.*` +13 procedures (auth +
  rate tier + IDOR + zod) · owner-scoped problems store (in-memory + Postgres
  `world_problems`) · **`opportunity:benchmark` 20/20** wired into `npm run benchmarks`
  - vitest gate. Verification 2026-08-15: world-model **260/260 (21 files)**,
    services/api **1000+1 skip (50 files)**, web **218/218 (22 files)**, typecheck **0**,
    lint **0 errors · 0 warnings**, `next build` **PASS**, benchmarks all PASS (+20/20),
    coverage gate **8/8 touched** (world-model 91.21/82.14/92.33/94.2). Honest: **EMPTY
    datasets** — NO fabricated customers/revenue/market data; real observation entry
    ready; live world signals + real provider execution remain **OPERATOR-REQUIRED**; no
    real customer/revenue evidence exists. Deliverables: `04_Sprints/SPRINT-038_*` (12).
- **SPRINT-037 — LIVE ORCHESTRATION & REAL-WORLD EXECUTION PROOF** (2026-08-15, 🟢 COMPLETE —
  COMPOSITION + ACTIVATION SPRINT, **NEW ENGINES CREATED: 0**): proves the first complete
  real-world execution loop over the frozen estate — **`OrchestrationPlanSource`**
  (gateway infrastructure) adapts an APPROVED `OrchestrationPlan` into a
  `FactoryCapabilityPlan` the EXISTING `ExecutionRunService` runs (approved-only
  structural gate; `executed:false` never flipped; capability vocabulary mapped through
  the existing `CapabilityMapper`; honest provider-state mapping UNKNOWN→CONFIGURE /
  AVAILABLE→READY; per-step WHY/cost/privacy carried; NO alternate runtime) ·
  **`world.approveOrchestrationPlan`** — approval routes EXCLUSIVELY through the
  existing Brain approval port (decision recorded on the plan; no voice/model/plan
  self-authorization) · **`world.startOrchestrationPlan`** — composes the existing
  `ExecutionRunService.start` (auth + rate tier + IDOR + zod; unapproved plan →
  deterministic rejection; idempotent per plan) · **Command Center** automation view +
  AUTOMATION tab show the plan → provider/model/WHY → expected-vs-observed cost →
  status → verification → outcome lifecycle (UNKNOWN stays UNKNOWN) ·
  **`integration:provider` operator test** (`npm run integration:provider`) — composes
  the REAL authorities, requires explicit operator configuration, fails clearly without
  credentials (exit 2 — verified), strict cost/time limits, never silently falls back to
  fake adapters. Verification 2026-08-15: services/api **1000 passed · 1 skipped · 50
  files**, world-model **220/220 · 18 files**, typecheck **0** (`tsc -b` + api + web),
  lint **0 errors · 0 warnings**, `next build` **PASS**, benchmarks chain all PASS
  (16/16 + 13/13 + 11/11), coverage gate **45/45 PASS** (world-model 92.49/82.37/93.2/95.2;
  api branch 80.32). Honest: LIVE provider execution remains **OPERATOR-REQUIRED** —
  production-config-check reports AI PROVIDERS NOT_CONFIGURED, so the approved-plan →
  bridge path is IMPLEMENTED + hermetic-TESTED but NOT LIVE-VERIFIED; multi-provider
  live comparison = OPERATOR-REQUIRED; an analytical workflow records an OPPORTUNITY,
  never REVENUE. Deliverables: `04_Sprints/SPRINT-037_*` (11) +
  `SPRINT-037_PRODUCTION_READINESS.md`.
- **SPRINT-036 — PRODUCTION MULTI-PROVIDER ORCHESTRATION** (2026-08-15, 🟢 COMPLETE —
  COMPOSITION SPRINT, **NEW ENGINES CREATED: 0**): moves VedMoulya from "multi-provider
  orchestration architecture exists" to "bounded real workflows are PLANNED across multiple
  providers safely, cost-aware, privacy-aware and explainably" over the frozen estate
  (Intelligence Fabric · WorkflowBounds · ActionClassPolicy · Brain approval · execution
  bridge · CostLedger · ProviderHealthLedger all authoritative): **`MultiProviderOrchestrator`**
  composition seam (world-model) — per-step provider binding + WHY + expected cost through
  the EXISTING fabric `selectStrategy` (CHEAP/FAST/QUALITY/PRIVATE/BALANCED; privacy
  overrides cost; PRIVATE + no local candidate → honest NO_SELECTION, never a public
  fallback) · **bounded deterministic retry/fallback policy** (`decideRetryPolicy` — never
  retries policy/cost/malformed; quota → fallback, no futile retry; transient → bounded
  retry (≤ 3) → privacy-safe fallback → STOP; verification disagreement → NEEDS_REVIEW,
  never price-resolved) · **orchestration plan store** (owner-scoped, stable-key idempotent
  upsert, in-memory + Postgres `world_orchestration_plans`) · **deterministic provider
  fixtures + scenario engine** (`ProviderOrchestrationScenarios` — the §14 workflow
  research → reasoning → economic analysis → verification → finalization, **11/11 PASS**) ·
  **`provider:benchmark` harness** (18th in the `npm run benchmarks` chain — strategy
  tradeoff table, no winner declared) · gateway **`world.orchestratePlan` +
  `world.listOrchestrationPlans`** (auth + rate tier + IDOR + zod; plan `executed:false` +
  `authorizationRequired:true` STRUCTURAL — representation only, never executes/spends/
  approves; runtime path remains the EXISTING execution bridge; provider output can never
  grant authority). Verification 2026-08-15: world-model **214/214** (18 files, +14),
  gateway **987 passed · 1 skipped** (49 files, +2), voice untouched, typecheck **0**
  (`tsc -b` + api + world-model), lint **0 errors · 0 warnings**, `next build` **PASS**,
  benchmarks chain **18/18 PASS**, coverage recomputed — world-model **92.49 stmts /
  82.72 branch / 92.95 funcs / 95.19 lines**, api **93.19 / 80.32 / 95.15 / 93.99**,
  coverage gate **45/45 PASSED**. Honest: live multi-provider EXECUTION remains
  **OPERATOR-REQUIRED** (no credentials, no live calls — the normal suite is hermetic
  fixtures); provider economics from fixtures not the ledger; autonomy levels unchanged.
  Deliverables: `04_Sprints/SPRINT-036_*` (12).

- **SPRINT-035 — PRODUCTION HARDENING, CALIBRATION & FOUNDER COMMAND CENTER COMPLETION**
  (2026-08-15, 🟢 COMPLETE — HARDENING + COMPLETION SPRINT, **NEW ENGINES CREATED: 0**): closes
  all six SPRINT-034 future items over the frozen estate (Brain · Intelligence Fabric ·
  ActionClassPolicy · execution bridge · CostLedger · Memory · Voice remain authoritative):
  **full coverage recompute** (world-model 93.73/83.92/95.60/96.50; services/api
  93.18/**80.32**/95.14/93.98 — api branch restored 76.7%→80.32% via new
  `WorldBridgePorts.test.ts` 34 tests over the REAL gateway seams; **coverage gate 45/45**,
  no exclusions) · **Command Center drill-downs** (expandable WHAT/WHY/EVIDENCE/COST/RISK/
  NEXT-ACTION per item; approval detail through the existing Brain authority) · **bounded
  owner-scoped timeline** (composed from existing stores — no new event store; stable-key
  idempotent, paginated, owner-isolated) · **cost view** over the real CostLedger
  (OBSERVED/ESTIMATED/UNKNOWN — UNKNOWN never zero, ROI only with evidence) ·
  **deterministic outcome/score calibration benchmark** (`CalibrationScenarios` + harness +
  vitest gate — **13/13 PASS**; `FEEDBACK_DELTA_MAX` 0.05 safety boundary proven; unverified
  evidence never scores; conflicting evidence visible; wired as the 17th `benchmarks`
  harness) · **voice presentation of the Command Center** (`CommandCenterQuestionRouter` +
  read-only `CommandCenterPresentationPort` — VOICE ≠ AUTHORIZATION preserved, no side
  effects) · **honest per-kind signal health** (lastSuccess/lastError, AVAILABLE only after
  a real observation) · **signal operator runbook** (no credentials) · **production
  configuration check** (`scripts/production-config-check.ts`). Verification 2026-08-15:
  world-model **200/200** (17 files), gateway **985+1 skip** (49 files), web **216/216**
  (22 files), voice **115/115** (7 files), typecheck **0**, lint **0 errors · 0 warnings**,
  `next build` **PASS**, benchmarks chain **17/17 PASS**, coverage gate **45/45 PASS**.
  Honest: Postgres, AI providers, world signals, STT/TTS, approved-blueprint execution and
  backup/recovery remain **OPERATOR_REQUIRED** — nothing unconfigured is silently assumed.
  Deliverables: `04_Sprints/SPRINT-035_*` (12).

- **SPRINT-034 — FOUNDER COMMAND CENTER & REAL-WORLD ACTIVATION** (2026-08-15, 🟢
  COMPLETE — COMPOSITION + ACTIVATION SPRINT, **NEW ENGINES CREATED: 0**): closes the five
  SPRINT-033 gaps over the frozen estate (Brain · Intelligence Fabric · ActionClassPolicy ·
  execution bridge · CostLedger · Memory · Voice remain authoritative):
  **Founder Command Center** (`apps/web/src/components/CommandCenter.tsx`, mounted in the
  AICompanion) — presentation/composition ONLY TODAY / PORTFOLIO / INTELLIGENCE /
  AUTOMATION / APPROVALS tabs over the existing read models; approvals route solely through
  `world.decideBlueprintApproval` → the existing Brain approve/reject; no-spam TODAY,
  UNKNOWN-cost honesty, UNAVAILABLE signal honesty, always-present boundary notice ·
  **Revenue → outcome feedback** (`OutcomeEvidence`): VERIFIED-only actuals (unverified /
  hypothesis / fabricated figures REFUSED — never inferred, UNKNOWN stays UNKNOWN); bounded
  explainable feedback into `evaluateOpportunity` (Δ ≤ 0.05 per single outcome — one outcome
  NEVER rewrites policy; every adjustment carries its evidence trail) · **Live world-signal
  adapters** (`LiveSignalAdapter` over the frozen `WorldSignalSourcePort`):
  operator-configurable (server-side token only), provenance-REQUIRED, untrusted-content
  sanitizer (script/markup/control-char strip + payload caps + timeout), honest
  AVAILABLE/UNAVAILABLE/ERROR — never fabricated SUCCESS · **Blueprint → approval-gated
  execution** (`BlueprintApprovalFactory`): approval requests only for C/D-gated steps
  (re-classified through the existing ActionClassPolicy — a stored class is never trusted),
  full exposure (action/reason/business/workflow/provider/cost/scope/risk/outcome/
  reversibility/authority), `executed:false` STRUCTURAL, decisions route exclusively through
  the Brain authority; execution stays with the existing bridge — no alternate path, no
  voice shortcut, no implicit approval · **Cost-weighted revenue intelligence**
  (`CostWeightedRevenue` over CostLedger via a narrow `WorldCostPort`): margin/ROI-aware
  ranking — UNKNOWN cost/revenue/margin never treated as zero; assumptions exposed;
  roiUsd vs rankScore separated · durable owner-scoped stores (in-memory + Postgres
  `world_outcome_evidence`, `world_blueprint_approvals`) · gateway `world.*` +7 procedures
  (33 total — auth + rate tier + central IDOR + zod) · verification 2026-08-15 from source:
  world-model **187/187** (16 files, +45), gateway **951 passed · 1 skipped** (48 files),
  web **214/214** (22 files, +11 CommandCenter), typecheck **0** (`tsc -b`), lint **0**,
  `next build` **PASS** · honest: live world signals, live approved-blueprint execution and
  real revenue inflow remain OPERATOR-REQUIRED; no fabricated data, no income promises, no
  automatic business creation · deliverables `04_Sprints/SPRINT-034_*` (10) · prior:
  SPRINT-033 Autonomous Company OS 🟢 COMPLETE
- **SPRINT-033 — AUTONOMOUS COMPANY OS** (2026-08-15, 🟢 COMPLETE — COMPOSITION SPRINT,
  ZERO NEW ENGINES): extends `packages/world-model` (the SPRINT-032 business OS seam)
  with the **founder intelligence, revenue intelligence and controlled execution
  blueprint** representations the repository lacked: `RevenueIntelligence`
  (evidence-carrying revenue streams — estimated/actual revenue, costs, automation %,
  human effort, customers, conversion, retention; a figure without evidence is REFUSED;
  advisory `RevenueSnapshot` totals/margins only from evidence; advisory
  BUILD/BUY/AUTOMATE/OUTSOURCE/STOP/SCALE decision hints, UNKNOWN when no evidence) ·
  `FounderBriefing` (advisory, no-spam composition — TODAY pending approvals /
  active+high-risk opportunities / revenue streams / estimated revenue / daily cost /
  emergency stop / autonomy posture + what-changed (recent world observations) +
  attention items + signal status; `hasContent:false` → caller must NOT notify) ·
  `WorkflowExecutionBlueprint` (the CONTROLLED Opportunity → founder approval →
  workflow specification → provider/capability selection → execution (existing bridge
  ONLY) → verification → outcome path as a REPRESENTATION — per-step A/B/C/D via the
  existing `ActionClassPolicy`, approval gates on class-C steps, bounds via the
  existing `WorkflowBounds`; `executed:false` + `authorizationRequired:true`
  STRUCTURAL; no voice-only authorization, no hidden execution, no autonomous
  spending) · Part B opportunity-model extensions (`expectedMargin` +
  `founderInvolvement` factors 16→18 + closed `OPPORTUNITY_CATEGORIES` 17-category
  vocabulary, normalized never invented) · owner-scoped revenue-stream persistence
  (in-memory + Postgres `world_revenue_streams` in the shared persistence bundle) ·
  gateway `world.*` +7 procedures (registerRevenueStream / listRevenueStreams /
  removeRevenueStream / revenueSnapshot / revenueDecisions / founderBriefing /
  buildBlueprint — auth + rate tier + central IDOR + zod; world.* now 26 procedures) ·
  WorldPanel gains the founder briefing + revenue snapshot cards (existing design
  system, evidence-only wording). **Zero new engines**: no Company/Revenue/Founder/
  Execution engine; Brain (tasks+authorization), Fabric (provider strategy), execution
  bridge (execution), memory (memory), CostLedger (cost accounting) all remain
  authoritative; the new surfaces are advisory and structurally incapable of
  approving/spending/executing. **Verification (2026-08-15):** world-model **142/142**
  (12 files, +39 new), gateway **947 passed · 1 skipped (48 files)**, web **203/203**
  (21 files), typecheck **0** (root + api + web), lint **0**, `next build` **PASS**.
  **Honest:** live world signals + live multi-provider execution remain
  OPERATOR-REQUIRED; the Founder Command Center (TODAY/PORTFOLIO/INTELLIGENCE/
  AUTOMATION/APPROVALS) is a planned FUTURE surface (UX plan); no income promises,
  no automatic business launch, no unsupported claim of autonomous operation.
  **Deliverables:** `04_Sprints/SPRINT-033_{ROADMAP,COMPANY_OS_MODEL,OPPORTUNITY_MODEL,
AI_WORKFORCE_MODEL,WORKFLOW_FACTORY,REVENUE_MODEL,AUTONOMY_SECURITY,UX_PLAN,
TEST_REPORT,COMPLETION_REPORT}.md`.
- **SPRINT-032 — WORLD MODEL & BUSINESS OPERATING SYSTEM** (2026-08-14, 🟢 COMPLETE —
  COMPOSITION SPRINT, ZERO NEW ENGINES): new **`packages/world-model`** — the bounded,
  owner-scoped **world representation + business operating model** composed over the
  frozen estate: typed `WorldGraph` (23 entity types, closed 32-shape relation
  vocabulary, provenance-REQUIRED observations — no fabricated facts, stable-key
  idempotency, FIFO bounds 200 entities / 500 relations per owner, bounded paginated
  queries, dangling-edge cleanup) · configurable `BusinessUnit` (identity, purpose,
  target customer, offerings, workflows, opportunities, costs, revenue, KPIs,
  automation 0–5, AI capabilities, human responsibilities, approval requirements —
  never hard-coded businesses, never assumed profitable) · `OpportunityEconomics`
  (16-factor evidence-only scoring, every factor exposed, advisory composite — never
  objective truth; zero/low-capital NO_COST / LOW_COST / CAPITAL_REQUIRED / UNKNOWN
  across ₹0–₹25,000 tiers; no income promises) · `AIWorkforce` (ROLE ≠ MODEL ≠
  PROVIDER ≠ AGENT; advisory provider binding via the existing Fabric
  `selectStrategy`; workers never execute/spend/approve, never escalate) ·
  `WorkflowFactory` (generic business workflows + bounded decomposition through the
  existing Fabric `WorkflowBounds` — `executed:false` structural) · `HumanAIBoundary`
  (composes the existing `ActionClassPolicy` A/B/C/D) · `WorldSignalSourcePort`
  interfaces ONLY (UNAVAILABLE / ERROR honesty — no fabricated world data) ·
  `WorldModelService` composition seam + narrow ports · gateway **`world.*` 8
  procedures** (auth + rate tier + IDOR + zod) via `WorldBridgePorts` · durable
  owner-scoped in-memory + Postgres stores in the shared persistence bundle ·
  `WorldPanel` in the AICompanion. Full suite **8 793 passed | 1 skipped (701
  files)**; world-model **103/103** (99.3% stmts / 93.9% branches / 99.5% funcs);
  typecheck **0**; lint **0**; `next build` **PASS**. Honest: live world signals and
  live multi-provider execution remain **OPERATOR-REQUIRED**; the world model never
  approves/spends/executes and never promotes to memory. Prior: SPRINT-031 control
  plane 🟢 COMPLETE.
- **SPRINT-031 — ACTIVE INTELLIGENCE & AUTONOMY CONTROL PLANE** (2026-08-14, 🟢
  COMPLETE — COMPOSITION SPRINT, ZERO NEW ENGINES): new **`packages/control-plane`** —
  autonomy settings (levels 0–5), emergency stop, cycle/gates, owner-scoped
  opportunity lifecycle records; gateway `control.*` procedures + `ControlPanel` UX.
- **SPRINT-030 — AUTONOMOUS INTELLIGENCE, MULTI-PROVIDER ORCHESTRATION &
  CONTINUOUS OPERATIONS** (2026-08-14, 🟢 COMPLETE — COMPOSITION SPRINT, ZERO NEW
  ENGINES): new **`packages/intelligence-fabric`** — the **Intelligence Fabric**, an
  ADVISORY, provider-neutral orchestration layer that composes the frozen estate
  without duplicating a single engine: **`StrategyCandidate`** orchestration contract
  (provider count is config-driven; business logic never names a provider) ·
  **`SelectionStrategy`** (CHEAP / FAST / QUALITY / PRIVATE / BALANCED — deterministic,
  explainable, advisory; privacy overrides cost: a PRIVATE task never routes remote on
  price alone, and with no local candidate selection honestly returns none) ·
  **`ProviderHealthLedger`** (evidence-only runtime health — UNKNOWN until real calls
  are observed; HEALTHY / DEGRADED / UNAVAILABLE / MISCONFIGURED derived
  deterministically; quota exhaustion → UNAVAILABLE; never fabricated) ·
  **`CostPolicyGuard`** (measure-only over the existing `CostLedger` trace spine — zero
  spend is `undefined`, never 0; fail-closed caps task $1 / daily $10 / provider $5 /
  workspace $20 with exhausted-bucket reporting; execution-time budget remains the
  frozen `RunBudgetGuard`) · **`WorkflowBounds`** (depth ≤ 8 · tasks ≤ 24 · parallel
  fan-out ≤ 8 · provider calls ≤ 64 · cost ≤ $5 · time ≤ 600 s — no unbounded fan-out,
  no infinite loops) · **`VerificationChainPolicy`** (bounded A → critique → verify;
  max depth 3 / providers 3 / steps 4 with deterministic stop conditions; disagreement
  → NEEDS_REVIEW, never silent execution) · **`ResultNormalizer`** (provider-agnostic
  text / json / tool / error contract + secret redaction of malicious provider output)
  · **`AutonomyPolicy`** (levels 0–5 mapped onto the EXISTING A/B/C/D classification —
  single-step transitions, class B requires an explicit user-authorization record,
  class C at level 3 only ASKS (the existing approval authority decides), class D never;
  silence / voice / AI-plans are never approval) · gateway **`fabric.*`** 8 procedures
  (getProviderHealth / allProviderHealth / observeOutcome / checkCostPolicy /
  classifyAutonomy / selectStrategy / validateWorkflow / evaluateVerificationChain —
  auth + rate tier + central IDOR guard + zod) via **`FabricBridgePorts`** (the only
  seams to the real CostLedger + provider registry) · cadence driver now optionally
  refreshes proactive recommendations on the scheduler heartbeat (`ProactiveRefreshPort`,
  `runDiscovery:false` default — no autonomous action, no-spam preserved) ·
  **`FabricPanel`** (Provider Network) in the AICompanion — observed health only
  ("UNKNOWN until real calls are observed") + autonomy-gating notice, keyboard + aria,
  mobile-friendly · verification re-run 2026-08-14: full suite **8 613 passed | 1
  skipped (682 files)**, gateway 922/46, web 190/19, fabric 53/8, proactive 60/7,
  voice 107/6 (untouched), typecheck 0, lint 0, coverage gate **43/43** (api branch
  81.33% restored via new bridge-port tests), `next build` PASS, benchmarks chain EXIT
  0 · honest: the Fabric is ADVISORY — it observes / measures / selects / validates but
  never executes, spends or authorizes; live multi-provider decomposition + execution
  remain OPERATOR-REQUIRED (credentials + configured registry); outcome-memory evidence
  into selection remains honest-empty (SPRINT-031); background cadence productization
  with operator policy UI deferred. Deliverables: `04_Sprints/SPRINT-030_{BASELINE_AUDIT,
ARCHITECTURE_REPORT,PROVIDER_ORCHESTRATION,SECURITY_REPORT,COST_INTELLIGENCE,
AUTONOMY_MODEL,BUSINESS_OPPORTUNITY_MODEL,TEST_REPORT,COMPLETION_REPORT}.md`.

- **SPRINT-029 — PROACTIVE INTELLIGENCE & AUTOMATION FABRIC** (2026-08-14, 🟢 COMPLETE —
  COMPOSITION LAYER, ZERO NEW ENGINES): new **`packages/proactive`** — an evidence-only
  recommendation model (10 categories: OPPORTUNITY · RISK · TASK · AUTOMATION ·
  REVENUE_OPPORTUNITY · COST_SAVING · TIME_SAVING · LEARNING_OPPORTUNITY ·
  BUSINESS_OPPORTUNITY · SYSTEM_IMPROVEMENT; an estimate is never fabricated, UNKNOWN
  stays UNKNOWN) · **`ProactiveIntelligenceService`** composition seam riding the EXISTING
  Brain pipeline (`discoverIntelligence`/`dailyPriorities`/`listOpportunities`/
  `listTasks`; stable-key idempotency — re-refresh never duplicates; a DISMISSED
  recommendation is never resurrected; bounded per owner) · **`ActionClassPolicy`
  A/B/C/D** composing the frozen Brain `SENSITIVE_ACTIONS` + marketplace
  irreversible-action vocabulary — NO new authorization authority; silence/voice/
  AI-plans are never approval; `proactive.accept` on a class-C recommendation returns
  `APPROVAL_REQUIRED` (the proactive layer can never authorize) · **`AutomationDiscovery`**
  (repetitive workflows with a ≥2-occurrence evidence floor and the full TRIGGER → INPUT
  → CAPABILITIES → TRANSFORMATION → APPROVAL → ACTION → VERIFICATION → OUTPUT → MEMORY
  representation; class D never proposed) · **`BusinessOpportunityAssessor`**
  (research/score ONLY — never spends/registers/publishes/commits; evidence-based
  score; cost/revenue UNKNOWN honesty; always `authorizationRequired`) ·
  **`DailyBriefingAssembler`** (no-spam — `hasContent:false` → caller must NOT notify) ·
  owner-scoped recommendation store (in-memory + Postgres, `PRIMARY KEY (owner, key)`,
  stable-id upserts) in the shared persistence bundle · gateway **`proactive.*`** 6
  procedures (refresh/list/dismiss/accept/briefing/assessBusiness — auth + rate tier +
  central IDOR guard + zod) · unified **`ProactivePanel`** UX in the AICompanion
  (WHAT/WHY/VALUE/RISK/COST/ACTION cards, approval chip + disabled accept on class C,
  durable dismiss, honest empty/loading/error wording, keyboard + aria, mobile-friendly)
  · canonical `05_Docs/CURRENT_ARCHITECTURE_STATE.md` created · verification re-run
  2026-08-14: full suite **8 540 passed | 1 skipped (671 files)**, gateway 907/44, web
  186/18, proactive 59/7, voice 107/6, typecheck 0, lint 0, coverage gate **42/42**,
  `next build` PASS, benchmarks chain EXIT 0 · honest: background proactive cadence
  (`ProactiveSchedulerPort.onCadence`) prepared but NOT productized (refresh is
  user-triggered today — SPRINT-030+); outcome-memory evidence reports honest empty (no
  fabricated learning recommendations); live discovery/execution remain operator steps.
  Deliverables: `04_Sprints/SPRINT-029_{PROACTIVE_INTELLIGENCE_REPORT,
AUTOMATION_ARCHITECTURE,AUTHORIZATION_MODEL,PROVIDER_ORCHESTRATION,
BUSINESS_OPPORTUNITY_MODEL,UX_REPORT,SECURITY_REPORT,TEST_REPORT,COMPLETION_REPORT}.md`
  - `SPRINT-026_029_RECONCILIATION_REPORT.md`.

- **SPRINT-028 — VEDMOULYA VOICE ASSISTANT** (2026-08-13, 🟢 COMPLETE — PRODUCTION
  VOICE EXPERIENCE OVER THE EXISTING BRAIN, ZERO NEW ENGINES): real runtime-backed
  **STT/TTS adapters** (`RuntimeSpeechToTextAdapter` / `RuntimeTextToSpeechAdapter` —
  provider-neutral OpenAI-compatible HTTP, bounded payloads, AbortSignal + timeouts,
  normalized errors, `kind: REAL`, credentials server-side only) · **Voice → Brain
  bridge** (`VoiceAssistantService` — transcribe → existing intent interpretation →
  ANSWER intents reuse the exact `ai.stream` Q&A runtime, ACTION intents become real
  `brain.createTask` tasks) · **VOICE ≠ AUTHORIZATION** enforced + proven: sensitive
  actions route to `WAITING_FOR_APPROVAL`, approval ONLY via the non-voice
  `voice.confirmSensitive` button which calls the existing Brain `approve` authority
  (no voice-only shortcut — structural test) · **owner-scoped conversation turns** with
  no promotion path into facts/preferences/outcomes/learning · **`voice.status`
  truth**: live probe distinguishes CONFIGURED (real adapter answers) / UNAVAILABLE /
  ERROR / MOCK (never CONFIGURED) · **unified voice UX** in the AICompanion
  (`VoicePanel` — IDLE/LISTENING/TRANSCRIBING/THINKING/WAITING_FOR_APPROVAL/
  RESPONDING/SPEAKING/ERROR/CANCELLED states, mic control, transcript, cancellable
  playback, retry, permission-denied recovery, keyboard + aria + live-region
  accessibility, mobile-friendly; response text always stands — TTS failure is never a
  task failure) · full suite **8 467 passed | 1 skipped (662 files)**, gateway
  898/43, web 181/17, voice 107/6, typecheck 0, lint 0, coverage gate 41/41, `next
build` PASS · honest: real STT/TTS providers remain operator-required
  (`VOICE_STT_*`/`VOICE_TTS_*` env; voice.status reports MOCK never CONFIGURED until
  configured). Deliverable: `04_Sprints/SPRINT-028_COMPLETION_REPORT.md`.

- **SPRINT-027 — PLATFORM INTEGRITY & SPEECH FOUNDATION** (2026-08-13, 🟢 COMPLETE —
  INTEGRITY GAPS CLOSED + SPEECH SEAMS IN PLACE, ZERO NEW ENGINES): R-1 rate limiting
  moved from an in-memory sync helper to an async **RateLimiter port** (in-memory default
  with honest `distributed:false`; explicit Redis backend `RATE_LIMIT_BACKEND=redis` with
  INCR+PEXPIRE fixed window, loud once-only degradation to bounded in-memory buckets, and
  fail-fast config errors — distributed safety is never silently claimed) · R-2 gateway
  audit made **durable + owner-scoped** via a new `AuditLogStore` (WriteThroughDocumentStore
  backed; in-memory only when unwired) · new **`packages/voice`** workspace: narrow
  `SpeechToTextPort`/`TextToSpeechPort` seams + deterministic mock adapters (MOCK kind,
  refused in production unless `VOICE_ENABLE_MOCK=true`) + `VoiceIntentGate` enforcing
  **VOICE ≠ AUTHORIZATION** (reuses the Brain's `IntentInterpreter` + `SENSITIVE_ACTIONS`;
  approval only via the existing non-voice mechanism) + owner-scoped bounded conversation
  store (in-memory + Postgres; interaction artifacts with NO promotion into facts/
  preferences/outcome memory/learning) + `SpeechApplicationService` composition seam + 8
  `voice.*` gateway procedures (authenticated, rate-limited, owner-checked, honest
  error-code mapping) · hygiene: **deleted dead `services/notifications`** (proven: zero
  references), removed the dead Mic control + Phoenix branding from AICompanion and the
  dashboard "Ask Phoenix" description · **pre-existing P1 fixed**: `next build` was red on
  `main` because the goals problem-panel pulled server-only `node:*` into the client bundle
  via the brain barrel — now deep-imports pure constant modules · full suite **8 100/8 100
  PASS (646 files)**, gateway 745/38, web 167/16, typecheck 0, lint 0, benchmarks GREEN
  (SPRINT-023 30/30 + SPRINT-024 36/36 + SPRINT-025 25/25), `next build` PASS · honest
  status: real STT/TTS providers remain operator-required (`voice.status` reports MOCK,
  never CONFIGURED). Deliverables: `04_Sprints/SPRINT-027_{BASELINE_AUDIT,EVIDENCE,COMPLETION_REPORT}.md`.

- **SPRINT-026 — VOICE INTELLIGENCE + COMPLETE-SYSTEM ARCHITECTURE AUDIT** (2026-08-13,
  🟢 COMPLETE — AUDIT + ARCHITECTURE SPRINT, no product features by design): a full
  16-phase audit (forensic inventory → flow integrity → provider orchestration → voice
  architecture + safety model → proactive/automation → UX → code quality →
  database/persistence → security → testing → market research → capability map →
  architectural decision → roadmap) with **every conclusion traceable to code, tests
  or identified external research** — spot-checked core suites **251/251 PASS**
  (brain + execution-bridge + capability-marketplace) and `tsc -b` + api typecheck **0**.
  - **Verdict: the system is coherent.** The claimed Brain-governed pipeline, quality-first
    provider selection, fail-closed approval/budget/verification, honest outcome verdicts,
    durable owner-scoped persistence and zero-new-engines learning **match the
    implementation**. No P0 defects. Two P1 operational gaps (in-memory rate limit R-1,
    in-memory gateway audit R-2 — both single-instance-ok, both multi-instance/GA blockers),
    plus P2/P3 hygiene findings.
  - **Voice architecture decided:** voice is an **interaction layer over the existing
    Brain** — the only missing foundation is a **speech runtime** (`TEXT_TO_SPEECH` /
    `SPEECH_TO_TEXT` are catalog capabilities but no production provider adapter declares
    `speech`; only Mock does) + an owner-scoped conversation store. New narrow
    `SpeechToTextPort` / `TextToSpeechPort` adapter seams (frozen `ProviderAdapter`
    discipline) + `brain.createTask` composition. Safety model: **voice never authorizes**
    — plans are read aloud, confirmation requires a non-voice on-screen/PIN gesture
    recorded in the decision store. No new intelligence/memory/approval/budget/scheduler/
    notification/provider-selection engine.
  - **Proactive + automation decided:** compose existing engines only — `dailyPriorities` +
    `discoverIntelligence` + scheduler cadence + relevance-gated notifications for the
    "attention digest"; `AutomationBoundaryEngine` A/B/C/D classification for automation
    (external actions default to draft + approval). **No autonomous-agent engine.**
  - **Key findings:** `services/notifications` is dead code (never imported — delete/archive);
    AICompanion has a dead Mic button + misleading "Powered by Phoenix AI" label; frozen
    pre-022 EI repositories still carry the latent `sql.json()` double-encoding pattern
    (documented follow-up); several intelligence stores remain in-memory in production
    (documented operator steps).
  - **Deliverables:** `04_Sprints/SPRINT-026_{BASELINE_AUDIT,ARCHITECTURE_REPORT,
VOICE_ARCHITECTURE,AUTOMATION_MAP,UX_AUDIT,SECURITY_AUDIT,TEST_GAP_REPORT,
PRODUCT_RESEARCH,ROADMAP,COMPLETION_REPORT}.md`.
  - **Roadmap:** 4 sprints to major release — SPRINT-027 (integrity + speech foundation),
    SPRINT-028 (voice assistant), SPRINT-029 (proactive + automation), SPRINT-030
    (production readiness + UX polish). GO on this roadmap; NO-GO on voice-as-engine and
    on any GA before R-1/R-2 are closed.

- **SPRINT-025 — CONTINUOUS LEARNING, OUTCOME MEMORY & ADAPTIVE IMPROVEMENT** (2026-08-12,
  🟢 GREEN — IMPLEMENTATION VERIFIED): makes VedMoulya learn from completed REAL
  problem-solving journeys — PROBLEM → UNDERSTAND → PLAN → EXECUTE → VERIFY → OUTCOME →
  CAPTURE EVIDENCE → LEARN → UPDATE USER/DOMAIN/PROVIDER/STRATEGY SIGNALS → IMPROVE NEXT
  DECISION — with **zero new engines** (no new brain/memory/recommendation/decision/
  budget/scheduler/notification/provider-selection/execution engine). All learning flows
  through the EXISTING `@vedmoulya/brain` outcome memory + `AdaptiveScoreLedger`
  (recency-weighted decay) + `PreferenceLedger` (EXPLICIT > INFERRED).
  - **Phase 1 — outcome learning model:** `LearningSignal` (FACT / INFERENCE / UNKNOWN —
    separated, never promoted) + deterministic `deriveLearningSignals`
    (evidence-supported signals only: domain · task type · outcome + verification status ·
    provider used/failed · failover · budget · artifact verification · approval · strategy ·
    confidence) — FACT vs INFERENCE vs UNKNOWN separated; **one observation is never
    promoted into a permanent user belief**.
  - **Phase 2 — memory integration:** `BrainOutcomeMemory` enriched with
    `verdict`/`verification`/`signals`/`corrections`; `recordLearning` now derives the
    honest verdict via `deriveOutcomeVerdict` — **UNKNOWN/FAILED never become SUCCESS**;
    inconclusive evidence stores UNKNOWN, never success (memory-pollution prevented).
  - **Phase 6 — user correction loop:** new `correctLearning` (EXPLICIT user correction →
    `PreferenceLedger` EXPLICIT fact with source/confidence/evidence/timestamp — **stronger
    authority than any inferred preference; an inferred preference can never override an
    explicit current user instruction**); additive `explicit_user_correction`
    `PreferenceEventSource`; gateway `brain.correctLearning` (auth + rate tier + IDOR) +
    `useBrainCorrectLearning` hook.
  - **Phase 4 — adaptive decision signals:** `ProviderRoleAssigner` gains an optional
    advisory experience input — **quality-first selection preserved**; verified historical
    signals only inform tie-breaks + the selection `experienceSignal` reason, never
    hardcoded rules, never override security/approval/budget/quality.
  - **Phase 9 — transparency UI:** `/brain` learning feed (`BrainLearningPanel`) shows
    plain-language source labels — **"You told me" (user-confirmed) / "I observed"
    (evidence) / "I inferred" (system)** — with confidence, evidence count, freshness and
    a **Correct / Forget** affordance (per-correction entry + corrections list).
  - **Phase 8 — deterministic learning benchmark:** `scripts/learning-benchmark.ts`
    (`npm run learning:benchmark`, wired into `benchmarks` + CI + release) — **15
    real-architecture journeys / 25/25 PASS** through the REAL `BrainApplicationService` +
    real `InMemoryBrainStores` + real `AdaptiveScoreLedger` + real `deriveOutcomeVerdict`:
    verified success → learning signal · verified failure → failure signal · UNKNOWN → no
    false learning · one failure → weak signal · repeated failure → stronger signal ·
    repeated strategy → positive signal · user correction → overrides inference · stale
    learning → reduced influence (real decay math) · provider + capability performance
    signals · cross-user isolation (owner-keyed ledger) · untrusted output never becomes
    user fact · new decision uses verified historical signal (advisory tie-break) ·
    security/policy overrides learned signal · budget limit overrides learned optimization
    (frozen `BrainBudgetGuard`).
  - **Validation (current tree):** brain **152/152** (LearningSignals 17 + correctLearning/
    verdict-memory additions) · gateway **716 passed + 1 skipped / 35 files** (BrainRouter
    `correctLearning` router test) · web **167/167** · scheduler benchmark **13/13** ·
    SPRINT-023 journeys **30/30** · SPRINT-024 runtime benchmark **36/36** (both untouched) ·
    learning benchmark **25/25** · root `tsc -b` + api + web typecheck **0** · full-repo
    lint **0**. Honest: live-provider execution + Postgres persistence for learning stores
    remain operator steps (the benchmark is a deterministic hermetic composition over the
    real stores). Docs: `04_Sprints/SPRINT-025_{BASELINE_AUDIT,EVIDENCE,COMPLETION_REPORT}.md`;
    MASTER_ROADMAP / PROJECT_STATUS / CHANGELOG / README / task_progress synchronized.

- **SPRINT-024 — LIVE OUTCOME VERIFICATION & REAL-RUNTIME EXECUTION** (2026-08-12,
  🟢 GREEN — IMPLEMENTATION VERIFIED): moves outcome verification from primarily
  hermetic/scripted proof toward **REAL RUNTIME ARTIFACT VERIFICATION** — the core
  rule _never fabricate successful execution_ is enforced by inspecting the REAL
  artifact independent of the execution claim. **Composition only — zero new
  engines:** `ArtifactReaderPort` (root-confined, size-bounded, read-only) + narrow
  `ArtifactExpectation` vocabulary (FILE_EXISTS · FILE_ABSENT · JSON_VALID ·
  JSON_FIELD · CSV_VALID · CALCULATION · DRY_RUN; PASS/FAIL/**UNKNOWN**) + deterministic
  `ArtifactVerifier` + production `NodeArtifactReader` (no path traversal, no symlink
  escape, honest UNKNOWN for found-but-unreadable evidence) — composed INTO the
  existing `StepVerifier` (`verifyArtifacts`/`attachArtifacts`: success only when the
  execution contract AND the real artifact both verify). **Phase 2 — honest outcome
  state**: `deriveOutcomeVerdict` (SUCCESS/FAILED/UNKNOWN/AWAITING_APPROVAL/CANCELLED/
  BUDGET_EXHAUSTED) refined so a **definitive verification FAIL is FAILED** (never
  SUCCESS, never masked as UNKNOWN) while inconclusive evidence stays UNKNOWN;
  `OutcomeVerdict` tests **11/11**. **Phase 4 — real-runtime journeys**:
  `scripts/runtime-verification-benchmark.ts` (`npm run runtime:verification:benchmark`,
  CI + release wired) — **12 real-artifact journeys / 36/36 PASS** over REAL temp-boundary
  files (REAL FILE SUCCESS · MISSING ARTIFACT → FAILED · MALFORMED → FAILED ·
  CALCULATION SUCCESS/MISMATCH · DRY-RUN SUCCESS · APPROVAL REQUIRED (nothing executes
  before approval — real boundary stayed empty) · BUDGET EXHAUSTION (frozen
  `BrainBudgetGuard` fail-closed) · FAILURE + FAILOVER (real fallback artifact verifies)
  · UNKNOWN EVIDENCE → UNKNOWN · MULTI-STEP (step failure blocks full success) ·
  CONTRADICTORY EVIDENCE (verification wins)). **Phase 5 — UI**: `/goals` problem panel
  gains an outcome-contract strip (Problem → Planned → Did → Evidence → Verification →
  Outcome) with the six plain-language verdict labels — “Task completed” is never shown
  merely because a provider returned a completion message. **Validation**: brain +
  execution-bridge **172/172** · goals **77/77** · gateway **714 + 1 skip / 35 files** ·
  web **167/167** · scheduler **13/13** · SPRINT-023 journey benchmark **30/30** (kept
  untouched as regression) · runtime benchmark **36/36** · root + api typecheck **0** ·
  full-repo lint **0 problems**. Honest: live-provider execution remains an operator
  step (never fabricated). Docs:
  `04_Sprints/SPRINT-024_{BASELINE_AUDIT,EVIDENCE,COMPLETION_REPORT}.md`.

- **SPRINT-023 — OUTCOME INTELLIGENCE & REAL-PROBLEM EXECUTION** (2026-08-12): a
  **composition sprint** — the 12-step problem→outcome loop (understand → define
  outcome → decompose → allocate → execute → verify → recover → approve → deliver →
  measure → learn) is proven to compose from the EXISTING estate with **zero new
  engines**. Two narrow genuine gaps only:
  - **Typed problem understanding** — `packages/goals/src/types/problem-types.ts`
    (`ProblemDefinition`: intent ANSWER/ACTION/OUTCOME/UNKNOWN · domain ·
    desiredOutcome · constraints · missingInformation · approvalRequirements ·
    successCriteria · riskLevel · confidence · provenance; UNKNOWN stays UNKNOWN,
    nothing fabricated) + deterministic `ProblemUnderstandingService` (composes the
    existing `GoalUnderstandingService`; measurability-filtered success criteria,
    time-token deadline detection, amount-gated budget detection — negative cases
    regression-tested) + `GoalsApplicationService.understandProblem` + gateway
    `goals.understandProblem` (auth + rate tier + owner-inert) + `useUnderstandProblem`
    api-client hook + a compact "Understand a problem" panel on `/goals` (intent /
    domain / constraints / missing info / success criteria / risk with an
    advanced-detail disclosure).
  - **Hermetic outcome-journey benchmark** — `scripts/outcome-journey-benchmark.ts`
    (`npm run outcome:journey:benchmark`): **12 real-world journeys / 30/30
    assertions PASS**, each ending in an actual outcome or an honest actionable
    failure — simple question · multi-step research · document/data · automation ·
    coding · career · business/earning · tool/API · provider failure +
    bounded failover → **recovery on the fallback provider** (keyed on the true
    runtime capability id — never vacuous) ·
    verification failure (abstention caught, never reported as success) · human
    approval workflow (paid option pauses AWAITING_APPROVAL via the real
    `purchase` sensitive action; nothing executes before approval; outcome only
    after) · budget/token exhaustion (BrainBudgetGuard trips mid-run, fail-closed
    stop). Wired into the `benchmarks` chain + CI + release. The benchmark script
    follows the repository's established `require-await` exemption convention.
  - **Composition (reused, not rebuilt):** `QualityFirstSelector`
    (quality → evidence → usability → free/local → cost) · `AutomationBoundaryEngine`
    (no fake full automation) · `ApprovalEngine` (irreversible actions gate
    approval) · `CapabilityDecomposer` · Brain `BrainApplicationService`
    (execution · failover · verification · approval · budget via the existing
    `BrainBudgetGuard`/`LoopBudget`) · goals task-DAG engine. **No duplicate
    scheduler / budget / notification / approval / execution engine.**
  - **Validation (current tree):** goals **77/77** (11 files) · new gateway router
    test **3/3** · full gateway **714 passed + 1 skipped / 35 files** · web
    **167/167** · root typecheck **0** · lint **0**.
  - Docs: MASTER_ROADMAP / PROJECT_STATUS / CHANGELOG / task_progress synchronized.
    Honest: live provider execution stays an operator step; the journeys are
    deterministic hermetic compositions over scripted ports.

- **PRODUCTION STARTUP & ENVIRONMENT HARDENING — SOURCE-OF-TRUTH AUDIT** (2026-08-12):
  with Docker/WSL now **VERIFIED GREEN on the development machine** (pgvector/pg16 +
  redis:7-alpine both HEALTHY on 0.0.0.0:5432/6379), the startup/environment path was
  re-audited from source and every gate exercised against the REAL infrastructure.
  - **Startup path already correct (EPIC-018/019), verified end-to-end**: `scripts/startup.sh`
    runs the repository's TS runtime (`npx tsx scripts/load-env.ts` → `scripts/preflight.ts`)
    — the historical plain-`node -e require('@vedmoulya/core')` ERR_MODULE_NOT_FOUND defect
    stays fixed; full `bash scripts/startup.sh --dev --timeout 45` bounded run exits 0
    (env load → dev preflight all READY → Docker infra → port check → dev server → health
    check PASSED attempt 2 → clean bounded shutdown, no process left behind).
  - **Real-Postgres operator gate closed**: `POSTGRES_TEST_URL=postgres://vedmoulya:vedmoulya-dev@localhost:5432/vedmoulya npx vitest run services/api/src/__tests__/PersistenceStores.test.ts` → **4/4 PASSED** against the live Docker Postgres (the Sprint-22 "only gap to GREEN"); dev preflight with the Docker URLs → Database/Redis **✓ READY**, `npm run doctor` → **PASS — Postgres/Redis configured and reachable**.
  - **Production fail-closed verified**: `preflight --mode production` exits **1 BLOCKED**
    (AUTH/DATABASE/REDIS MISCONFIGURED) with actionable WHAT/WHY/REQUIRED/ACTION rows;
    `npm run build -w apps/web` exit 0; CI-style production boot (`next start` +
    `AI_ENABLE_MOCK=true` + strong `AI_OPENAI_API_KEY` + non-loopback logical DB/Redis
    URLs) → server Ready ~1.5s, `health.check` HTTP 200 with honest `status: critical`
    component detail, `live` 200 `alive`, `ready` 200 `not_ready`; persistence defers
    table creation with loud warnings when the DB is unreachable (bounded one-shot per
    store — never a silent loss); the AI World cadence driver boots and its first tick
    aborts fail-closed when the user directory is unavailable (logged, no crash);
    graceful shutdown verified.
  - **Documented contract confirmed**: a real `NODE_ENV=production` boot REFUSES loopback
    infrastructure URLs by design — a fully-green production boot requires non-loopback
    real Postgres/Redis (staging/operator step); the CI-blessed explicit-mock escape is
    the supported local production-style verification, and core config still requires the
    default provider's key even with `AI_ENABLE_MOCK=true` (mock only satisfies the gateway
    provider gate — defense in depth, never a silent mock).
  - **Environment contract hygiene**: `.env.example` + `.env.production.example` now
    document **`AI_WORLD_CADENCE_REFRESH_INTELLIGENCE`** (the EPIC-021 cadence flag was
    consumed by `scheduler-cadence.ts` but undocumented); `scripts/startup.sh` comments
    corrected to the built-in loader (`process.loadEnvFile` via `@vedmoulya/core`
    `loadEnvFilesSafe` — the dotenv dependency was removed earlier); no secrets, no
    placeholder values, no second config system. Env matrix verified from source:
    40 vars (.env.example) / 42 (.env.production.example); `AUTH_JWT_SECRET` required
    everywhere (no default); `IDENTITY/REDIS/MEMORY/DECISION/EXECUTION/KNOWLEDGE` URLs
    strict non-loopback outside development (memory falls back to `DATABASE_URL`); AI
    keys openai/deepseek required in production when the default provider names them,
    anthropic/google catalog-only (never consumed).
  - **AI provider runtime truth re-confirmed**: OpenAI → Vercel AI SDK `VercelAIProvider`
    (raw-fetch only via explicit `AI_RUNTIME_LEGACY_RAW_FETCH=true`); DeepSeek →
    `DeepSeekProvider` (SDK `createOpenAI` → api.deepseek.com); Mock → dev default,
    production only with explicit `AI_ENABLE_MOCK=true`; Anthropic/Google/OpenRouter/
    Ollama stay catalog-only `UNSUPPORTED_RUNTIME` — no adapter fabricated.
  - **Validation**: gateway **711 passed / 1 skipped**, core **323 passed** (incl. preflight
    - startup config tests), web **167 passed**, scheduler benchmark **13/13 PASS**, root
      typecheck **0**, lint **0**, startup.sh bounded run **exit 0**.

- **EPIC-018/019/020/021/022 GAP-CLOSURE SPRINT** (2026-08-12): closes every
  remaining documented gap across the audited epics with **zero new engines**.
  - **EPIC-018/020 — real notifications in the bell drawer**: the generic
    notification drawer (`NotificationsDrawer.tsx`) now renders the EXISTING
    EPIC-015 notification store (`ecosystemIntelligence.listNotifications` /
    `markNotificationRead`, Postgres-backed since SPRINT-022) instead of
    `MOCK_NOTIFICATIONS` — unread/actionable filters, per-item + mark-all
    read, kind-aware chips and deep-links all preserved.
  - **EPIC-018/019/020/021/022 — JSON double-encoding eliminated** (the
    SPRINT-022 §2b follow-up): the frozen pre-022 EI repositories bound
    `JSON.stringify(x)::jsonb` tagged-template interpolations, which
    postgres.js serializes TWICE (escaped-JSON text in the database). All 11
    repositories (app-factory · providers · context · capabilities ·
    requirements · context-fabric · os-intelligence · learning · knowledge ·
    memory · enterprise-brain) now bind via `sql.json()` — exactly one
    encoding — and their hermetic test fakes gained `json()` shims that
    REJECT pre-stringified strings so a regression back to double-encoding
    fails hermetic tests instead of being silently normalized. Real Postgres
    was the proof: this exact class of bug was caught live in SPRINT-022.
  - **EPIC-019 — one env loader**: `scripts/load-env.ts` now uses the shared
    built-in loader (`@vedmoulya/core` `loadEnvFilesSafe` →
    `process.loadEnvFile`, same strategy as `scripts/lib/probes.ts`); the
    `dotenv` dependency is removed from the repository.
  - **EPIC-021 — scheduled opportunity refresh + notifications**: the
    EPIC-018 `SchedulerCadenceDriver` now also drives the Brain's EXISTING
    `discoverIntelligence` per user on the same heartbeat
    (`AI_WORLD_CADENCE_REFRESH_INTELLIGENCE` default on; status exposes
    `refreshIntelligenceEnabled`). NEW opportunities surface through the
    EXISTING EPIC-015 relevance-gated `notify()` as a new
    `NEW_OPPORTUNITY` kind (in `IntelligenceNotificationKind`,
    `NotificationGate.MEANINGFUL_KINDS`, drawer + ecosystem-intelligence UI
    labels, `/ai-world` runtime chip “opportunity refresh on”; `NEW_OPPORTUNITY`
    deep-links to `/brain` where opportunities live). One driver, one
    scheduler, one budget engine, one notification store — nothing rebuilt;
    the Brain's own event-id dedupe makes the refresh idempotent in steady
    state. Honest edge: after a Postgres outage where boot hydration failed,
    the first recovered refresh can re-detect already-notified events — the
    relevance gate bounds the blast radius (documented in code).
  - **SPRINT-022 closure** (from the earlier turn): real-Postgres
    restart-recovery executed 4/4 against a live PostgreSQL 16 (the single
    YELLOW gap), which exposed + fixed the JSON double-encoding above; the
    persistence fakes gained the same `json()` shim hardening.
  - **Validation (current tree)**: frozen EI repos **123 files / 1266
    passed** · persistence + ecosystem + scheduler **16 files / 155 passed +
    1 skip** · full gateway **34 files / 709 passed + 1 skip** (cadence
    driver +4 EPIC-021 tests) · web **16 files / 167 passed** · scheduler
    benchmark **13/13 PASS** · preflight dev **READY / exit 0** · typecheck 0
    (root build + services/api + web) · lint 0. Honest: live provider
    execution / live ecosystem discovery remain OPERATOR REQUIRED.

- **SPRINT-022 — Persistent Intelligence Foundation** (2026-08-12, 🟢 GREEN —
  **PERSISTENT INTELLIGENCE VERIFIED**; real-Postgres restart-recovery executed
  and passed 4/4 against a live PostgreSQL 16 instance):
  replaces the critical in-memory intelligence stores with **durable,
  owner-scoped Postgres persistence** behind the frozen store ports — **no
  memory/scheduler/budget/notification/execution engine is rebuilt or
  duplicated**. New `@vedmoulya/core` `WriteThroughDocumentStore` base
  (synchronous mirror preserving the frozen sync store contracts + async
  write-through: parameterized idempotent upserts/deletes bound via
  **`sql.json()`** — exactly one JSON encoding, verified against live Postgres
  — microtask batch coalescing, drain-until-quiescent so in-flight trailing
  writes persist, bounded re-queue on outage, boot `hydrate()` + shutdown
  `flush()`, per-owner FIFO retention). **19 tables across 5 packages**: scheduler (schedules/jobs/
  runs/source policies/cooldowns), brain (tasks/decisions/opportunities/
  intelligence events/outcome memory/adaptive-score ledger), ecosystem
  (GitHub connections metadata/lifecycle/recommendations/**notifications incl.
  read state**/acquisitions), bridge loop runs, AI World discovery items +
  user state. **`resolvePersistenceBundle()`** gateway resolver: deterministic
  in-memory in dev/test, Postgres in production/staging (one lazy pool,
  idempotent table creation, per-store error-isolated hydration), partial
  overrides; `ApiApplicationService` injects one bundle into AI World,
  Scheduler, Brain, Intelligence, Bridge; `route.ts` awaits hydration before
  the cadence driver starts (no post-restart duplicate runs) and flushes on
  SIGTERM/SIGINT. **Brain learning + notifications survive restart** (upsert by
  stable id — never duplicated; IDOR enforced at the query level via
  `PRIMARY KEY (owner, key)`). **Validation**: persistence hermetic suite
  **7 files / 43 passed + 1 env-gated skip** (write-through, hydration, FIFO
  retention, IDOR, outage isolation, no-log-leak, trailing-write, restart
  round-trip, sql.json single-encoding) · **real-Postgres restart-recovery
  4/4 PASSED** (live PostgreSQL 16: create state across all 12 store families →
  flush → recreate the bundle over the same DB → hydrate → no duplicate
  records + owner isolation + notification read-state) · full gateway
  **34 files / 705 + 1 skip** · web **167/167** · scheduler **42/42** ·
  benchmark **13/13** · typecheck 0 · lint 0 · Chrome journey PASSED. Defects
  fixed: polymorphic `deleteDoc` shadowing (deletes silently never persisted),
  same-tick dedup, trailing-write durability gap (code-review finding),
  `addItems` count parity, boot hydrate/driver race, fake-sql
  `TemplateStringsArray` trap, and the **JSON double-encoding defect exposed
  by real Postgres** (`JSON.stringify(x)::jsonb` stored escaped-JSON text —
  fixed via the `sql.json()` binding; the same latent pattern in the frozen
  pre-022 EI repositories is documented as a mechanical follow-up). Docs:
  `04_Sprints/SPRINT-022_{PERSISTENCE_ARCHITECTURE,PERSISTENCE_SECURITY,COMPLETION_REPORT}.md`.

- **EPIC-018 closure — AI World Scheduler runtime cadence driver** (2026-08-12):
  closes the audit-found gap where `scheduler.tick()` had **no runtime caller** —
  6-hour / daily / weekly discovery was modeled but never executed automatically.
  Adds the smallest production-quality **`SchedulerCadenceDriver`**
  (`services/api/src/observability/scheduler-cadence.ts`, reusing the
  os-health-scheduler pattern): periodic tick (default 10 min, tunable via
  `AI_WORLD_CADENCE_ENABLED` / `AI_WORLD_CADENCE_INTERVAL_MS`) · no-overlap
  guard · unref'd interval · graceful stop · per-user error isolation · honest
  abort when the identity directory is unavailable · users from the EXISTING
  identity directory (bounded) · wall-clock fail-closed truncation · aggregate-
  only logs (no secrets). The driver implements NO scheduling policy —
  due-ness/cooldowns/rate limits/budgets stay in the existing `DiscoveryScheduler`
  and its `RunBudgetGuard` over the frozen LoopBudget (exactly one scheduler and
  one budget engine preserved; manual Run now keeps the same bounded path). New
  gateway procedure `aiWorldScheduler.getRuntimeStatus` (auth + rate tier + IDOR
  guard) reports honest activation (enabled/disabled/not_started) bound once at
  the route layer; the `/ai-world` Discovery Activity panel gains a minimal
  runtime indicator that never claims scheduled discovery when the driver is off.
  Validation: driver tests **13/13** · SchedulerRouter+registry **45/45** · full
  gateway **702/702 / 33 files** · web **166/166** · benchmark **13/13 PASS** ·
  typecheck 0 (root + web) · lint 0 · **real Chrome journey PASSED** (server log
  proves the driver ticks at boot and fails closed without the user directory).
  Honest boundaries: live discovery sources and Postgres scheduler persistence
  (schedules reset on restart — not claimed) remain operator steps; the generic
  notifications drawer still renders placeholders (future UI sprint); the
  single-process driver is correct for the current single-instance deployment
  (multi-replica = one driver + persistence + distributed lock, documented).
  Docs: `09_Documents/EPIC_018_SCHEDULER_{COMPLETION_REPORT,EVIDENCE}.md`;
  numbering note added to MASTER_ROADMAP (the EPIC-018 label is shared by the
  scheduler epic and the startup epic — distinct files preserved).

- **EPIC-020 — Outcome & Revenue Intelligence layer** (2026-08-12): an additive, outcome-first extension of the verified EPIC-020 Continuous Intelligence epic (audited + verified first, per the mandate; one genuine defect fixed — `ProvidersRouter.getRuntimeStatus` lint). Adds to `@vedmoulya/brain`: the generic **Outcome model** (`outcome-types.ts` — OutcomeType×14, Priority, Constraint, Status, Value, Evidence, Effort, Satisfaction), the transparent **OutcomePriorityEngine** (hierarchy: user outcome → urgency → impact → money → time → feasibility → evidence → quality → user fit → cost → free/local — **quality never outranked by price**; UNKNOWN contributes zero), and the **DailyOutcomeEngine** (Today's Top N composed from existing tasks/opportunities/events). **Money intelligence**: `Opportunity` gains evidence-only fields (`requiredCapabilities` · `requiredProviders` · `estimatedEffort` · `cost` · `risk` · `approvalRequirement` · `recommendedNextAction`; TRUSTED_WITH_REVIEW → review requirement; no fabricated income). **Satisfaction loop**: `evaluateOutcome` records YES/PARTIALLY/NO → `OutcomeEvaluation.satisfaction` + `BrainOutcomeMemory.satisfaction`. **Gateway**: `brain.dailyPriorities` (+ central IDOR guard) and `satisfaction` input on `evaluateOutcome`. **UI**: “Today's most valuable actions” panel + 3-value satisfaction buttons on `/brain` (no new giant dashboard). **Validation**: brain **111/111** · gateway **683/683** (BrainRouter **17/17**) · web **165/165** · typecheck 0 · lint 0 · **outcome-intelligence benchmark 23/23 PASS** (wired into `benchmarks` + CI + release) · browser journeys PASSED (outcome-intelligence + continuous-intelligence regression). Honest: live execution/persistence remain operator steps; Postgres `OutcomeStore` documented operator step. Docs: `09_Documents/EPIC_020_{OUTCOME_INTELLIGENCE_ARCHITECTURE,VALUE_MODEL,MONEY_INTELLIGENCE,OUTCOME_SECURITY,OUTCOME_EVIDENCE,OUTCOME_COMPLETION_REPORT}.md`.

- **EPIC-020 — Continuous Intelligence & Adaptive Orchestration** (2026-08-12):
  turns VedMoulya into a **continuously improving operating intelligence** — the Brain
  UNDERSTANDS → DISCOVERS → COMPARES → SELECTS → ASKS APPROVAL → CONFIGURES →
  EXECUTES → VERIFIES → EVALUATES → LEARNS → MONITORS → RE-OPTIMIZES across multiple
  AI providers, GitHub/open-source resources, local models, free-tier resources and
  paid providers. **Nothing rebuilt** (EPIC-006…019 preserved); `@vedmoulya/brain` is
  **extended with new narrow ports**: `BrainUsagePort` (provider usage/limits evidence —
  KNOWN/UNKNOWN/ESTIMATED, never fabricated), `BrainExperiencePort` (adaptive
  task×provider performance evidence), `BrainMemoryPort` (durable structured outcome
  feedback), `BrainDiscoveryBridgePort` (screened AI World/scheduler events → Brain),
  `OpportunityStore`/`IntelligenceEventStore` (owner-scoped). New domain: `UsageIntelligence`
  (evidence-gated cost estimates, quota exhaustion only when KNOWN ≤ 0, failure
  classification), `AdaptiveScoreLedger` (recency-weighted, EXPLICIT outranks INFERRED),
  `ExecutionFailover` (bounded fallback, never re-picks the failed provider),
  `OpportunityIntelligence` (7 categories, uncertainty on every opportunity, never income
  promises; SUSPICIOUS/BLOCKED never become opportunities). Service: N-provider `assignMany`
  realization (DEEP_RESEARCH / QUALITY+HIGH), fail-closed evidence-backed budget estimates,
  detect → classify → fallback → continue within budget, `discoverIntelligence`, learning
  feedback (scores + memory + recurring-task opportunities), `providerScores`; `BrainTask`
  gains `failoverEvents`. Gateway `brain.*` **+7 procedures** (discoverIntelligence,
  listOpportunities, updateOpportunity, listIntelligenceEvents, updateIntelligenceEvent,
  providerScores, dashboard) behind auth + rate tiers + IDOR; `BrainDashboardService` + `/brain`
  operating dashboard (status hero · opportunities · Continuous AI World — discovery is never
  adoption · learning feed). Validation: brain **101/101**, gateway **683/683 / 32 files**
  (BrainRouter 13/13 incl. IDOR), web 26/26, typecheck 0, **continuous-intelligence benchmark
  22/22 PASS** (wired into `benchmarks` + CI + release), **browser journey PASSED**
  (`continuous-intelligence.spec.ts`). Honest limitations: live provider execution, live
  ecosystem/GitHub discovery and Postgres persistence for brain stores/memory are
  **operator steps**; repository acquisition/execution stays EPIC-015 approve-gated;
  AI World bell notification wiring is planned. Docs:
  `09_Documents/EPIC_020_{BASELINE_AUDIT,ARCHITECTURE,ORCHESTRATION_MODEL,PROVIDER_USAGE_MODEL,SECURITY_MODEL,DECISION_MODEL,EVIDENCE,COMPLETION_REPORT}.md`.

- **EPIC-019 — Platform Startup, Environment & Provider Runtime Hardening** (2026-08-12):
  adds **no product features** — it fixes the startup/environment/provider-runtime problems
  shown during the latest verification and hardens the honesty boundary
  (**catalog evidence ≠ runtime capability · configuration ≠ availability · availability ≠
  execution · execution ≠ successful outcome**). Verdict **🟢 GREEN — IMPLEMENTATION VERIFIED**.
  - **One canonical startup strategy:** every startup/diagnostic command
    (`scripts/startup.sh`, `npm run preflight`, `npm run doctor`, `scripts/check-port.ts`)
    resolves mode, loads the environment and probes the machine through ONE shared surface
    (`scripts/lib/probes.ts` — tsx runtime, built-in `process.loadEnvFile`, root `.env.local`
    then `apps/web/.env.local` in development, production/staging root-only; existing shell
    vars win; secrets never printed). No script may duplicate startup logic.
  - **Provider runtime truth (`@vedmoulya/core`):** `provider-runtime.ts` is the single source
    of truth with state vocabulary **CONFIGURED / AVAILABLE / NOT_CONFIGURED /
    UNSUPPORTED_RUNTIME / MOCK / DISABLED / ERROR**; `getConfig` and
    `validateProductionAIConfig` agree with the actual runtime registry
    (`registerPlatformProviders` contract-tested). **DeepSeek is fully wired (option A)** —
    `DeepSeekProvider` (Vercel AI SDK `createOpenAI` → `https://api.deepseek.com`) registers
    when `AI_DEEPSEEK_API_KEY` is set and is a valid production default; live execution stays
    an operator step (16/16 deterministic tests, no fabricated live claims). Anthropic /
    Google / OpenRouter / Ollama stay **catalog-only (`UNSUPPORTED_RUNTIME`)** — set keys are
    never consumed and catalog-only defaults fail fast in production.
  - **`npm run doctor` (EPIC-019/11):** new CLI `scripts/doctor.ts` + `npm run doctor` /
    `npm run doctor:prod` report Environment · Node · npm · TypeScript runtime · Database ·
    Redis · Docker · Web build · AI runtime · Default provider · Provider adapters ·
    Provider taxonomy/catalog · Port <webPort> · Configuration — PASS/FAIL/NOT_REQUIRED/WARN/
    INFO rows, deterministic exit code, **never prints secrets** (leak-tested).
  - **Port handling (EPIC-019/8):** `startup.sh` detects occupied ports via
    `scripts/check-port.ts` (same probe as doctor), names the owner PID, and either prompts
    ([1] stop process · [2] use another port · [3] cancel) or fails deterministically with
    `--ci` / non-TTY. New flags: `--port N`, `--timeout N` (bounded runs), `--ci`.
  - **Bounded + clean (EPIC-019/10):** every verification command runs under `timeout`;
    `startup.sh` adds a bounded health check (`/api/trpc/health.check`), process-tree cleanup
    on INT/TERM/EXIT (`taskkill /T` on Windows) and bounded `docker compose`; nothing waits
    indefinitely for next dev/start, docker, a database, redis or Playwright.
  - **ANSI-free captured logs (EPIC-019/9):** new `npm run verify`
    (`scripts/verify.sh`) runs doctor + affected package/gateway/orchestrator/web tests +
    typecheck + lint with `NO_COLOR=1 FORCE_COLOR=0 CI=1 TERM=dumb` so verification logs stay
    readable in PowerShell/agents — the application UI is untouched.
  - **Development & production posture:** development boots with **zero AI credentials**
    (deterministic mock registered automatically); production remains **fail-closed**
    (`AUTH_JWT_SECRET`, non-loopback `IDENTITY_DATABASE_URL`/`REDIS_URL`, real AI key or
    explicit `AI_ENABLE_MOCK=true`, production build required — never built implicitly, never
    a silent mock fallback).
  - **Evidence:** `09_Documents/EPIC_019_PROVIDER_RUNTIME_MATRIX.md` (per-provider evidence
    table) + `09_Documents/EPIC_019_COMPLETION_REPORT.md` (root causes, decisions, before/
    after, risks, operator-required items); MASTER_ROADMAP / README / CHANGELOG /
    task_progress synchronized.

- **EPIC-018 — VedMoulya Production Startup & Environment Reliability** (2026-08-11):
  makes VedMoulya startup **deterministic, understandable, safe and environment-aware** — it
  must never appear to "randomly crash". Every startup failure answers WHAT / WHY / REQUIRED /
  CONTINUES / ACTION. Verdict **🟢 GREEN — IMPLEMENTATION VERIFIED**. Nothing rebuilt:
  EPIC-012A–017 architecture preserved; runtime health still owned by the existing
  `HealthChecker` / `InfrastructureHealthProbe` / `health.*` / `ops.getDiagnostics`.
  - **Preflight engine (`@vedmoulya/core` — additive):** `PreflightEngine` in
    `packages/core/src/startup/preflight.ts` (pure + injectable, exported from the barrel) +
    `scripts/preflight.ts` CLI (`npm run preflight` / `npm run preflight -- --mode production`).
    Checks: environment (config evaluation) · authentication (`AUTH_JWT_SECRET`) · database ·
    redis · AI configuration · provider registry · production build · Docker. Statuses:
    READY / DEGRADED / BLOCKED / MISCONFIGURED / DEPENDENCY_UNAVAILABLE / NOT_CONFIGURED.
    Exit 0 = no required check failed, exit 1 = blocked, exit 2 = bad usage.
  - **`scripts/startup.sh` fixed:** the broken plain-Node config validation
    (`node -e "require('@vedmoulya/core').getConfig()"` → `ERR_MODULE_NOT_FOUND` because
    `@vedmoulya/core` exports TS sources) is replaced by the repository's established TS
    runtime (**tsx**) via the preflight. Startup now: loads the environment (root `.env.local`,
    then `apps/web/.env.local` in development), distinguishes **DEV vs PRODUCTION**, requires
    the production build when `.next/BUILD_ID` is missing (never builds implicitly — corrected
    by EPIC-019; startup fails with the exact build action), starts Docker Compose Postgres/Redis
    only when Docker is available (dev continues on the in-memory convention with a clear
    warning; production is BLOCKED with instructions), and never hides the original error.
  - **Environment model:** one authoritative loader — Node's built-in `process.loadEnvFile`
    (`loadEnvFileSafe` / `loadEnvFilesSafe`), no dotenv dependency. Root `.env.local` is
    investigated and NOT auto-created (would duplicate/drift the JWT secret from
    `apps/web/.env.local`); `.gitignore` already excludes all `.env.local` files. Server-only
    secrets never reach the browser bundle (`NEXT_PUBLIC_*` is the only client surface).
  - **AI provider classification (honest):** OpenAI = REGISTERED + EXECUTABLE + VERIFIED
    (Vercel AI SDK adapter); DeepSeek = **REGISTERED + EXECUTABLE** via `DeepSeekProvider`
    (Vercel AI SDK `createOpenAI` → `https://api.deepseek.com`, Chat Completions path;
    16/16 deterministic tests; live execution = operator step with `AI_DEEPSEEK_API_KEY`);
    Mock = registered (dev) / explicit opt-in (production); Anthropic, Google, OpenRouter,
    Ollama = **TAXONOMY ONLY / NOT AVAILABLE** (catalog/registry only — no adapter).
    `AI_DEFAULT_PROVIDER=deepseek` now activates the runtime provider when the key is set.
  - **Validation:** preflight tests **20/20**; full `@vedmoulya/core` suite **273/273**; full
    repo suite **619 files / 7,756 tests / 0 failures** (the historical Aug-09
    `reading 'config'` Vitest crash does not reproduce); core typecheck 0; `npm run preflight`
    dev exit 0 (READY) and production exit 1 (BLOCKED with resolutions); `bash
scripts/startup.sh --dev` verified end-to-end (preflight → Docker warning → dev server on
    :3000); `npm run dev` HTTP 200 + health.check success.
  - Docs: `09_Documents/EPIC_018_{STARTUP_ARCHITECTURE,ENVIRONMENT_MODEL,PREFLIGHT,SECURITY,
EVIDENCE,COMPLETION_REPORT}.md` (the scheduler epic's security model was preserved as
    `EPIC_018_SCHEDULER_SECURITY.md`); MASTER_ROADMAP / PROJECT_STATUS / README / CHANGELOG /
    task_progress synchronized. Honest limitations: Docker/Postgres/Redis for a
    production-like local run, real AI keys, STAGING/PRODUCTION platforms and a manual root
    `.env.local` are OPERATOR REQUIRED; no adapters exist for taxonomy-only providers.

- **EPIC-017 — Live Intelligence Bridge** (2026-08-11):
  an **INTEGRATION epic** that closes the loop between the EPIC-016 Brain, the EPIC-015 Intelligence layer and
  the frozen execution ecosystem — **USER TASK → BRAIN UNDERSTAND → CAPABILITY DISCOVERY → PROVIDER/MODEL
  INTELLIGENCE → ECOSYSTEM INTELLIGENCE → SECURITY/LICENSE/AVAILABILITY → QUALITY EVALUATION → CURRENT VS
  BETTER → RECOMMENDATION → APPROVAL → CONFIGURATION/HAND-OFF → VALIDATION → EPIC-014 EXECUTION → VERIFY →
  EVALUATE → PREFERENCE FEEDBACK**. New workspace `@vedmoulya/live-intelligence-bridge` (types → contracts →
  domain → infrastructure → application) with **no duplicated intelligence/execution/approval/security/memory/
  routing engine** — every capability is consumed through the existing narrow ports. Verdict **🟢 GREEN —
  IMPLEMENTATION VERIFIED** (live provider execution, live GitHub OAuth exchange, live ecosystem discovery and
  real repository scanning are **operator steps** — deterministic adapters are the hermetic default; no
  fabricated live-provider/GitHub claims).
  - **Intelligence bridge:** the Brain can request provider / model / GitHub / local / free / paid / external /
    alternative candidates, each carrying structured evidence (`qualityEvidence` · `taskFit` · `securityStatus` ·
    `availability` · `costClass` · `freeTierStatus` · `localAvailability` · `confidence` · `recommendation` ·
    `approvalRequired`) — UNKNOWN is first-class, values never fabricated.
  - **Find-better-capability:** CURRENT CONFIGURATION vs AVAILABLE ALTERNATIVES with structured decision evidence
    (task fit · capability match · quality evidence · availability · cost class · security status · reason) —
    never hidden chain-of-thought; **quality always above cost/free preference**.
  - **Multi-provider orchestration reuse:** N providers with meaningful roles when justified — reusing the
    EPIC-016 `ProviderRoleAssigner` / `ParallelPlanner` / `ConflictDetector` / `OutputAssembler` /
    `CriticStrategy` / `BrainBudgetGuard` (never rebuilt).
  - **Free/local/GitHub/paid decision:** FREE ≠ BEST · LOCAL ≠ BEST · GITHUB ≠ TRUSTED · PAID ≠ BEST;
    paid/materially-better options require an explicit approval card with evidence-backed cost (or UNKNOWN) +
    free/local alternatives.
  - **GitHub intelligence connection (safe):** Google auth ≠ GitHub auth; least privilege; repository lifecycle
    preserved (DISCOVERED → SECURITY REVIEW → RELEVANCE → APPROVAL → ACQUIRE → SANDBOX → ANALYZE → STORE →
    OPTIONAL CONFIGURATION); no secrets in UI/prompts/logs.
  - **Approval bridge:** the Brain recommends → policy decides → user approves → execution performs — approvals
    mandatory for purchase/subscription/deploy/publish/send/share/delete/write/private-repo/external-app/
    irreversible actions.
  - **Configuration bridge:** deep-links into the EXISTING provider / local-model / GitHub surfaces — **no
    duplicate configuration screens**; validate after configuration.
  - **Execution bridge to EPIC-014:** approved plans reach the execution engine (`RunBudgetGuard` / `LoopEngine` /
    `ValidationPipeline` / `ApprovalEngine` / `CostLedger` / `Audit` / `ExecutionRunner` reused; budgets preserved,
    fail-closed — a recommendation can never bypass execution safety).
  - **Result evaluation + preference feedback:** structured outcome evidence only; task-specific, evidence-based,
    time-aware, reversible provider-performance facts (EXPLICIT vs INFERRED, never silently promoted).
  - **AI World notifications:** only materially relevant changes reach the existing bell surface (NEW_MODEL /
    BETTER_MODEL / FREE_QUOTA / PROVIDER_DEGRADED / NEW_GITHUB_PROJECT / SECURITY_CHANGE / NEW_LOCAL_MODEL /
    BETTER_CAPABILITY / PRICE_CHANGE / MODEL_DEPRECATED) — no notification spam, no second notification system.
  - **Gateway `liveIntelligence.*`:** 7 procedures (start · discover · compare · recommend · approve · execute ·
    evaluate) behind auth + rate tiers + the central IDOR guard; `LiveIntelligenceBridgePorts.ts` wires the frozen
    estate with zero duplication.
  - **UI:** `/live-intelligence` premium page — stage rail (Understand → Discover → Compare → Recommend → Approve →
    Hand-off → Execute → Verify → Evaluate → Feedback) · capability/candidate cards with evidence chips ·
    better-option approval cards (Use recommended / Keep current / View evidence) · honest no-better-option branch ·
    execution summary · structured feedback (also a `handoff` bridge step so approved plans reach execution).
  - **Validation:** bridge package **45/45**, gateway `LiveIntelligenceBridgeRouter` **7/7** through the real tRPC
    pipeline (full gateway **660/660 / 31 files**), web **159/159**, **browser journey PASSED**
    (`live-intelligence-bridge.spec.ts` — task → understand → discover → compare → honest recommendation →
    hand-off → execute → verify → evaluate → feedback), **bridge benchmark 10/10 PASS** (`npm run
bridge:benchmark` — full deterministic loop with failure cases, wired into the `benchmarks` chain + CI +
    release), **full-repo lint 0/0** (incl. eliminating pre-existing working-tree debt in the providers package /
    ModelSelector / settings / e2e), typecheck 0.
  - **Honest limitations:** live provider execution, live GitHub OAuth exchange, live ecosystem discovery and real
    repository scanning are **operator steps**; external applications stay honest manual/configuration hand-offs;
    in-memory bridge stores (Postgres = documented operator step).
  - Docs: `09_Documents/EPIC_017_{BASELINE_AUDIT,ARCHITECTURE,INTEGRATION_CONTRACTS,SECURITY_MODEL,
LIVE_INTELLIGENCE,EVIDENCE,COMPLETION_REPORT}.md`; MASTER_ROADMAP / PROJECT_STATUS / README / task_progress
    synchronized.

- **EPIC-015 — VedMoulya Intelligence** (2026-08-11):
  the Intelligence layer answers **"For THIS task, is something significantly better available?"** across
  configured providers, free providers, local models, GitHub projects and paid providers — **DISCOVERY +
  EVIDENCE + SECURITY + LICENSE + FRESHNESS, never a static directory**; nothing is fabricated and nothing is
  auto-activated. Verdict **🟢 GREEN — IMPLEMENTATION VERIFIED** (live GitHub App exchange, live ecosystem
  discovery and real repo scanning are operator steps — the deterministic adapters are the hermetic default).
  - **New workspace `@vedmoulya/ecosystem-intelligence`** (types → contracts → domain → infrastructure →
    application): `GitHubConnectionManager` (GitHub connects SEPARATELY from Google auth — least-privilege
    `public_metadata` baseline, explicit repo-read review, separate write consent, never silent) ·
    `SecurityAssessor` (20+ evidence-backed checks, BLOCKED stops the pipeline, sandbox-enforced, honest
    _"no blocking indicators found in the checks performed"_ wording — never a blanket "safe") ·
    `LicenseEngine` (software + model license evaluated separately; LICENSE_UNKNOWN first-class) ·
    `FreeResourceIntelligence` (free-with-quota ≠ unlimited free; stale evidence → STALE) ·
    `AcquisitionPlanner` (controlled repo pipeline — READ ≠ CLONE ≠ EXECUTE ≠ INSTALL ≠ CONFIGURE ≠ USE) ·
    `TaskIntelligenceEngine` (quality-first: QUALITY → EVIDENCE → ACCURACY → TASK FIT → RELIABILITY →
    USABILITY → FREE/LOCAL → COST; material-improvement margin 8; a better option that requires activation
    produces an approval recommendation, never automatic activation) · `RecommendationAssembler`
    (premium approval cards: current vs recommended, why, requires, risks, actions) · `LifecycleLedger`
    (DISCOVERED→…→BLOCKED with provenance — deprecated resources never silently deleted) ·
    `NotificationGate` (only meaningful, relevance-gated events surface).
  - **Narrow seams reuse the frozen estate** (zero duplication): the Brain's `BrainCandidatePort` — exactly
    ONE candidate seam for the whole platform — plus the `BrainPreferencePort` (EPIC-014 explicit-signal
    ledger) and narrow `GitHubAuthPort` / `GitHubRepoSourcePort`; owner-scoped stores are IDOR-safe by
    construction (keyed `(userId, id)`).
  - **Gateway:** `github.*` + `ecosystemIntelligence.*` tRPC namespaces (**25 procedures**) behind auth +
    rate tiers + the dual IDOR guard (auth middleware + owner-scoped service); deterministic
    `EcosystemIntelligencePorts.ts` adapters (public repos from the AI World discovery store; private repos
    only under an explicit grant).
  - **UI:** premium **`/ecosystem-intelligence`** page (sidebar "Ecosystem Intelligence") — Task
    Intelligence (objective + capability + quality/privacy → the "Better capability found" card + honest
    fallback + options grid + free/local/open-source/better-provider quick questions) · GitHub Connect
    (permission review with explicit consent toggles, begin/complete authorization, verify/revoke/disconnect,
    accessible repositories with public/private boundary — secrets/codes never rendered) · Repository
    (security gate + license check + acquisition approval) · Intelligence Memory (relevance-gated
    notifications + lifecycle provenance). Typed `useGitHub*`/`useIntelligence*` api-client hooks.
  - **Validation:** package **93/93** deterministic tests (coverage gates pass 91.6/80.2/95.2/93.9),
    gateway **EcosystemIntelligenceRouter 12/12** through the real tRPC pipeline (full gateway suite
    **653/653**), web **159/159** (+13 UI-helper tests), **browser journey PASSED**
    (`ecosystem-intelligence.spec.ts` — ask the intelligence → GitHub permission review → CONNECTED →
    repository security review → memory provenance; no secrets in the UI), **intelligence benchmark
    12/12 PASS** (`npm run intelligence:benchmark`, wired into the `benchmarks` chain + CI + release),
    typecheck 0, ESLint 0/0.
  - **Honest limitations:** live GitHub App authorization, live ecosystem discovery and real repository
    security scanning are **operator steps**; repository cloning/install/execution is **not built by
    design** (approval-gated future infrastructure); in-memory stores.
  - Docs: `09_Documents/EPIC_015_{BASELINE_AUDIT,ARCHITECTURE,SECURITY_MODEL,GITHUB_INTELLIGENCE,COMPLETION_REPORT}.md`;
    MASTER_ROADMAP / PROJECT_STATUS / README / task_progress synchronized.

- **EPIC-016 — VedMoulya Brain: Phase 0+1 — Constitution, Baseline & Core Architecture** (2026-08-11):
  builds the **central intelligence & orchestration coordinator** — a new workspace
  `@vedmoulya/brain` that UNDERSTANDS → REPRESENTS → DECIDES → EXPLAINS → SELECTS →
  PLANS by **consuming the frozen estate through narrow ports** (no rebuilt engine, no
  second router, no duplicate planner). Verdict **🟢 GREEN — IMPLEMENTATION VERIFIED**
  (live provider execution is an operator step; GitHub/external-app acquisition is
  EPIC-015 — ports ready, not built here).
  - **Domain (10 components):** `IntentInterpreter` (UNKNOWN stays UNKNOWN, bounded
    assumptions, material ambiguity surfaced) · `BrainModeSelector` (FAST/BALANCED/
    QUALITY/DEEP_RESEARCH/COST_SENSITIVE/PRIVATE_LOCAL) · `ProviderRoleAssigner` (13
    roles, N derived from task/quality/evidence, quality-first with free-wins-when-
    sufficient, no-candidates → error never faked, local fallback only when available) ·
    `ParallelPlanner` (execution-graph waves) · `ConflictDetector` (AGREEMENT …
    UNRESOLVED) · `OutputAssembler` (provenance-preserving synthesis) · `CriticStrategy` ·
    `BrainBudgetGuard` (estimate/check-before/check-during, fail-closed) ·
    `BrainPolicyEngine` (sensitive actions publish·send·deploy·purchase·subscribe·delete·
    share·install·connect_account **always** require explicit approval — the Brain may
    recommend, never grant itself permissions) · `BrainDecisionRecorder` (provenance on
    every major decision) · `OutcomeEvaluator` (EXPLICIT vs INFERRED — never silently
    promoted).
  - **Ports:** `BrainPlanPort` (EPIC-013 reuse) · `BrainCandidatePort` (EPIC-012A/B +
    EPIC-012C reuse) · `BrainExecutionPort` (EPIC-006 LoopEngine specialist seam reuse) ·
    `BrainContextPort` (minimal authorized context) · `BrainPreferencePort` (EPIC-014
    ledger reuse) · owner-scoped stores (IDOR-safe by construction).
  - **Gateway:** `brain.*` — 13 procedures (createTask/plan/selectResources/execute/
    verify/requestApproval/approve/reject/getStatus/listTasks/getDecisionRecords/cancel/
    evaluateOutcome) behind auth + rate tiers + the central IDOR guard; `BrainPorts.ts`
    wires the frozen estate with zero duplication.
  - **UI:** `/brain` premium page — task input + examples, full-chain Run + per-stage
    Continue, stage rail, intent panel, N-provider role cards, approval gates
    (Approve/Reject/Request approval), honest hand-offs (missing-capabilities,
    no-runtime-path), verification checklist, synthesized result with provenance,
    decision records, budget/trace/owner-scoped history.
  - **Validation:** brain **82/82** tests (incl. a journey-driven regression — decision
    records are now carried on the task, fixing a store-only write), gateway
    **BrainRouter 7/7** through the real tRPC pipeline, web **146/146**, **real-Chrome
    browser journey PASSED** (full pipeline + approval gate + decision records),
    **brain benchmark 12/12 PASS** (`npm run brain:benchmark` — single vs routed
    LoopEngine vs brain N-provider; wired into the `benchmarks` chain + CI), typecheck
    0, ESLint 0/0 on changed files.
  - **Honest limitations:** live provider execution is an operator step; external-app/
    GitHub acquisition is EPIC-015 (ports ready, not built here); in-memory stores
    (documented operator step, unchanged convention).
  - Docs: `09_Documents/EPIC_016_{BRAIN_BASELINE_AUDIT,BRAIN_ARCHITECTURE,
BRAIN_DECISION_MODEL,BRAIN_PROVIDER_ORCHESTRATION,BRAIN_SECURITY_MODEL,
COMPLETION_REPORT}.md`; MASTER_ROADMAP / PROJECT_STATUS / README / task_progress
    synchronized.

- **EPIC-014 — Capability Execution Engine: PLAN → EXECUTE → VERIFY** (2026-08-10):
  executes EPIC-013 `FactoryCapabilityPlan`s **safely and honestly** through a new
  workspace `@vedmoulya/execution-bridge` — the execution layer over the frozen
  platform (no rebuild of LoopEngine / routing / provider intelligence / AI World /
  capability planner). Verdict **🟢 GREEN — IMPLEMENTATION VERIFIED** (live provider
  execution is an operator step — no fabricated execution; external apps stay honest
  manual hand-offs; GitHub resources stay EVALUATE-only).
  - **Plan → Run bridge:** `PlanRunResolver` maps every plan step to a bounded
    disposition (**EXECUTABLE / APPROVAL_REQUIRED / CONFIGURE_REQUIRED /
    MANUAL_REQUIRED / UNAVAILABLE**) before anything runs; `CapabilityMapper`
    normalizes plan steps into the frozen `AIOrchestratorSpecialistPort` shape — no
    second planning system, no new routing engine. Only EXECUTABLE + READY steps
    execute; CONFIGURE pauses with the existing deep-link; EXTERNAL / MANUAL /
    UNAVAILABLE are **never executed** — runs complete honestly as PARTIAL.
  - **Step verification:** `StepVerifier` is the explicit execution contract — pre:
    capability/provider/model/auth/availability/config/evidence/budget/approval/
    dependencies; post: completed + expected artifact + deterministic output
    contract. A provider response alone is never success.
  - **Approval & hand-off enforcement:** `ApprovalRuntime` integrates the existing
    `ApprovalEngine` semantics — irreversible/gated steps pause at
    WAITING_FOR_APPROVAL; approve resumes from the correct point, reject → honest
    PARTIAL. Manual/external/configure steps produce a clear hand-off ("Video
    assembly requires Canva configuration/manual completion") — never fabricated
    API execution.
  - **Run intelligence + budget:** `RunIntelligence` tracks current/completed/
    failed/blocked/waiting steps, provider/model, quality, cost/latency where known,
    next action. `RunBudgetGuard` wraps the frozen `LoopBudget` (iterations / tokens /
    cost USD / wall-clock) — **fail-closed**, budget failure = BLOCKED with no
    further provider calls; iterations survive resume passes.
  - **Preference feedback ledger:** `PreferenceLedger` records explicit-vs-inferred
    outcomes with full provenance (timestamp, step, reason, confidence, source);
    inferred behavior is **never** silently promoted to a permanent preference.
    Feeds EPIC-015 (not built here).
  - **Gateway + UI:** owner-scoped `execution.*` tRPC namespace (start / get / list /
    approve / reject / completeHandoff / cancel / retry / getPreferenceEvents) behind
    the central auth/IDOR guard + rate limits; `ExecutionRunner` embedded in the
    `/capability-marketplace` plan experience — step timeline (✓ ● ○ 🔒 ⚠),
    approval prompt, hand-off list, progressive disclosure, premium + minimal.
  - **Validation:** execution-bridge **23/23** deterministic tests (approval gate &
    rejection, budget exhaustion → BLOCKED, provider failure → bounded retry,
    validation failure, PARTIAL, resume from checkpoint, user-selected model,
    double-execution re-entry guard, no silent replacement, IDOR, ownership
    isolation, ledger provenance); gateway **634/634** (incl. `ExecutionBridgeRouter`
    6/6 through the real tRPC pipeline); web **120/120**; **real-Chrome browser
    journey PASSED** (`execution-journey.spec.ts` — plan → execute → step completes
    → approval boundary → manual hand-off → resume → final state); **execution
    benchmark 8/8 PASS** (`npm run execution:benchmark`, wired into the hermetic
    `benchmarks` chain). Typecheck 0 · ESLint 0/0 on all changed files.
  - **Honest limitations:** live provider execution = operator step (no credentials
    on this machine); external applications remain manual checkpoints (no API-
    automation evidence); GitHub repositories EVALUATE-only; run store is
    in-memory (Postgres run/artifact stores = documented production operator step).
  - Docs: `09_Documents/EPIC_014_{BASELINE_AUDIT,IMPLEMENTATION_MAP,EXECUTION_ARCHITECTURE,
INTEGRATION_CONTRACTS,SECURITY,EVIDENCE,COMPLETION_REPORT}.md`; MASTER_ROADMAP /
    PROJECT_STATUS / README / task_progress synchronized; CHANGELOG updated.

- **EPIC-013 enrichment seam activated** (2026-08-10): capability plans now receive an **advisory AI insight** when a provider is configured — `CapabilityMarketplaceApplicationService.plan()` invokes the `CapabilityEnrichmentPort` (a single bounded economy call over the frozen `AIOrchestratorSpecialistPort`, the same port the loop + factory reuse) and attaches an `aiInsight` overlay (natural-language summary · AI-suggested steps/capabilities · provider/model provenance) **only when the provider returns `confident: true`**. Prompt-injection hardened (outcome delimited as untrusted data, capabilities whitelisted, summary length-capped); a failure or timeout NEVER fails the deterministic plan (swallowed, no overlay). New shared `AIPlanInsightCard` component renders the overlay on the `/capability-marketplace` page and the `/applications` capability plan builder (clearly labeled advisory — the deterministic plan remains the source of truth). Tests: capability-marketplace **+3** (confident attach + persistence, throwing enrichment non-fatal, non-confident → no overlay), gateway `CapabilityMarketplaceRouter` **+1** through the real tRPC pipeline — package **55/55**, gateway router **6/6**, web **120/120**, typecheck 0, lint clean. Without a configured provider, plans are created exactly as before (no insight).

- **EPIC-013 — AI Capability Marketplace & Factory Intelligence** (2026-08-10):
  connects AI World intelligence (EPIC-012C) with VedMoulya's application/content/
  factory ecosystem — a new workspace `@vedmoulya/capability-marketplace`
  (types → contracts → domain → infrastructure → application) that answers "For
  this requested outcome, what AI capabilities are required, which
  providers/models/tools can perform them, how can they be integrated, and what
  is the best execution plan?". Verdict **🟢 GREEN — IMPLEMENTATION VERIFIED**
  (optional AI enrichment of plans is an operator step; every capability/
  provider claim stays evidence-first — UNKNOWN is never fabricated, external
  applications are never assumed to be API-automatable).
  - **Capability graph (20+ ids):** TEXT_GENERATION, REASONING, CODING, RESEARCH,
    RAG, VISION, IMAGE_GENERATION, VIDEO_GENERATION, VIDEO_EDITING, AUDIO_GENERATION,
    TEXT_TO_SPEECH, SPEECH_TO_TEXT, MUSIC, AVATAR, TRANSLATION, DOCUMENT_PROCESSING,
    EMBEDDINGS, WEB_RESEARCH, BROWSER_AUTOMATION, CODE_EXECUTION, DEPLOYMENT — a
    capability is **never assumed to be API-executable**; executability is a
    per-candidate fact.
  - **`CapabilityDecomposer`** — outcome → ordered execution steps (the spec's
    video example: Research → Script → Fact verification → Storyboard → Visual
    generation → Voice generation → Music/audio → Video assembly → Quality
    evaluation → Final export) with an honest general fallback that never
    pretends to know a specialized pipeline.
  - **Integration types (`IntegrationClassifier`)** — NATIVE_API /
    DIRECT_PROVIDER / OPEN_SOURCE / LOCAL_MODEL / GITHUB_PROJECT /
    EXTERNAL_APPLICATION / MANUAL_STEP / UNKNOWN with `apiAvailable:
'yes' | 'no' | 'unknown'` decided from evidence — a tool available only
    inside an external application is EXTERNAL_APPLICATION with **no assumed
    API**; never pretend an external app has automation if evidence does not
    support it.
  - **Candidate classification** — READY (configured API model) / CONFIGURE
    (discovered provider with strong evidence) / EVALUATE (GitHub project
    requiring testing) / EXTERNAL / MANUAL / UNAVAILABLE / UNKNOWN.
  - **`AutomationBoundaryEngine`** — FULLY_AUTOMATED / PARTIALLY_AUTOMATED /
    HUMAN_APPROVAL / MANUAL per step; never claims full automation where the
    provider/API does not support it (open-source = at most partial until
    setup+verification; irreversible steps gate behind approval); plan-level
    percent (the UI's `████████░░ 80%` bar).
  - **`QualityFirstSelector`** — CAPABILITY → QUALITY → PRECISION → ACCURACY →
    EVIDENCE → RELIABILITY → AVAILABILITY → USER PREFERENCE → FREE/LOCAL → COST
    → LATENCY — **the cheapest tool never wins when it produces inferior
    output**; quality-first ties break toward free/local, then cost.
  - **`ApprovalEngine`** — irreversible actions (publish / send / deploy /
    purchase / delete / externally share) become explicit **human approval
    points**.
  - **`CapabilityPlanner`** — OUTCOME → DECOMPOSE → MATCH (configured providers
    - local models + AI World discoveries through the narrow `CapabilitySourcePort`)
      → CLASSIFY → SELECT → ASSEMBLE the `FactoryCapabilityPlan` (required
      capabilities, candidates, execution steps, automation, estimated cost/time
      **only when evidence exists**, evidence, risks, approval points, unavailable
      capabilities, recommendations) — missing capabilities are reported honestly,
      never filled with a fake tool.
  - **Configuration bridge** — recommendations deep-link into the EXISTING
    provider configuration (CONFIGURE_PROVIDER + suggested family) / local-model
    evaluation (EVALUATE_LOCAL_MODEL) / external-tool review (REVIEW_EXTERNAL_TOOL)
    — **no duplicated configuration screens**.
  - **Gateway `capabilityMarketplace.*` namespace** — plan (heavy tier) /
    getPlan / listPlans / capabilities (standard tier) — auth + rate limits +
    the standard IDOR guard (foreign plan ids → null/empty); `CapabilitySourcePorts.ts`
    feeds EXISTING provider/local/AI-World intelligence into the planner (zero
    duplication); optional non-fatal `CapabilityEnrichmentPort` over the frozen
    runtime.
  - **UI** — dedicated **`/capability-marketplace` page** (nav "Capability
    Market"): plan builder → premium plan view with capability checklist
    (✓ Research ✓ Script ✓ Fact Check ✓ Voice ✓ Visuals ✓ Assembly ✓ Quality
    Check), per-step AI plan table (step → chosen tool → integration type),
    automation bar, **Requires approval** list (e.g. Final publish), evidence +
    risks + recommendations, honest unavailable-capability callouts, plan
    history; **`/applications` third mode "Capability Plan"** (shared
    `CapabilityPlanBuilder` — start a factory request from a capability plan
    alongside Product Intelligence and Direct Factory); api-client hooks
    `useCapabilityPlan/GetPlan/ListPlans/MarketplaceView`.
  - **Security** — discovered tools/repos stay untrusted (EPIC-012C scanner);
    never auto-install/clone/execute; external apps never claimed automatable;
    irreversible actions never silently automated; owner-scoped plan store
    (bounded FIFO 50/owner). - **Tests (+57):** capability-marketplace **52/52** (8 files — decomposition, integration classification incl. no-assumed-API, automation boundary incl.
    irreversible gating, quality-first cheapest-never-wins, approval engine,
    planner assembly + evidence + risks + recommendations incl. regression
    tests for cost-estimate selected-only counting and manual-fallback
    unavailable reporting, bounded store + owner isolation, application service
    IDOR), gateway **+5 `CapabilityMarketplaceRouter.test.ts`** through the real
    tRPC pipeline incl. cross-user IDOR refusal (**full gateway 627/627 /
    27 files retained**), web **120/120**, typecheck 0 (capability-marketplace /
    services/api / apps/web), ESLint clean (two new files added to the
    documented closed-union object-injection allowlist — same proven pattern as
    CapabilitySourcePorts). Reviewer findings (cost-over-count, dead fetch,
    manual-fallback hiding, typed unions + free-tier passthrough) all addressed.
  - **Honest limitations:** optional AI plan enrichment is an operator step (the
    deterministic planner is the shipped default); cost/time estimates only when
    evidence exists; in-memory plan store; no Postgres/Docker on this machine
    (unchanged).
  - Docs: `09_Documents/EPIC_013_COMPLETION_REPORT.md`; CHANGELOG / MASTER_ROADMAP /
    task_progress synchronized.

- **EPIC-012C — AI World Discovery, Provider Catalog & Market Intelligence** (2026-08-10):
  VedMoulya's first **AI WORLD DISCOVERY & MARKET INTELLIGENCE LAYER** — a new
  workspace `@vedmoulya/ai-world` (types → contracts → domain → infrastructure →
  application) that continuously answers "What is new? · What is actually useful?
  · What is free? · What can run locally? · What can VedMoulya configure? · What
  should I pay attention to? · What should I ignore?" — prioritizing **QUALITY and
  USEFULNESS over volume**. Verdict **🟢 GREEN — IMPLEMENTATION VERIFIED**
  (live ecosystem discovery remains an operator step; unknown metadata stays
  UNKNOWN — never fabricated).
  - **Discovery categories:** AI providers (hosted / emerging / open-model /
    local / enterprise), AI models (foundation / reasoning / coding / vision /
    multimodal / embedding / speech / video / image / open-weight / local),
    GitHub repositories (agents / orchestration / RAG / vector DBs / local
    inference / serving / evaluation / observability / browser automation /
    generation / speech / document intelligence / coding agents / workflow),
    AI applications (video / design / coding / research / automation / content /
    marketing / productivity / BI) and **important AI news** (only developments
    that could materially affect VedMoulya, provider availability, pricing, free
    tiers, the open-source ecosystem, model capabilities, automation
    opportunities or product strategy — never generic tech news).
  - **Pluggable source abstraction:** `AIDiscoverySource` port (type / id /
    name / priority / capabilities / freshness policy / async `discover` with
    `SourceBudget`) — the UI is never hardcoded to a website; a deterministic
    `StaticCatalogDiscoverySource` ships as the hermetic default + the
    orchestrator support session-based discovery into an existing store.
  - **Evidence-first everywhere:** every `DiscoveryItem` carries id, title,
    category, source, `sourceUrl`, discoveredAt, publishedAt, summary,
    capabilities, pricing, free/local availability, relevance, confidence and
    `evidence[]` — **never fabricated**: missing capability/pricing/license/activity
    metadata is honestly reported UNKNOWN; `SecurityScanner` sanitizes all
    source-provided text (strips embedded URLs from titles/summaries, neutralizes
    script/onerror/steering payloads) so discovered content is always treated as
    **untrusted input** (prompt-injection / poisoned-metadata / deceptive-claim
    protection — a source claiming `capabilities: ['all']` or
    `freeAvailability: true` while pricing is UNKNOWN is downgraded with an
    explicit reason; never executes arbitrary discovered content).
  - **Relevance scoring:** `RelevanceScorer` combines 10 weighted signals
    (VedMoulya relevance, technical usefulness, quality, recency, evidence
    confidence, free availability, local usability, integration potential,
    community/adoption, strategic importance) — **popularity is never the driver**;
    a small repo with direct VedMoulya usefulness outranks a viral product with
    none. A **one-click-configurable** bonus (item maps to a provider registry
    family) lifts CONFIGURE-ready discoveries (e.g. OpenRouter) into the high
    tier that the AI World UI highlights.
  - **Free-first classification:** `FreeResourceClassifier` independently answers
    FREE API / FREE WITH QUOTA / OPEN WEIGHTS / OPEN SOURCE / LOCAL /
    SELF HOSTABLE / PAID / UNKNOWN with per-claim reasons — and **FREE never
    means automatically recommended**: recommendation order is QUALITY →
    CAPABILITY → EVIDENCE → USABILITY → FREE/LOCAL → COST. LOCAL is derived from
    actual runtime claims (Ollama / LM Studio / llama.cpp / vLLM…) rather than
    open-weight provenance.
  - **GitHub repository intelligence:** `GitHubRepositoryIntelligence` extracts
    language, stars, forks, license, activity, documentation quality, deployment
    complexity, local/self-host capability, VedMoulya relevance and security
    considerations where the evidence exists — and **flags** abandoned (no
    commits in 18+ months), unclear license, low documentation, suspicious
    metadata and security concerns — a repo is never recommended because it has
    many stars.
  - **Recommendation engine:** every discovery receives an explicit state —
    IGNORE / WATCH / REVIEW / TRY / CONFIGURE / INTEGRATE — from deterministic
    rules (quality, evidence, free/local availability, capability fit,
    integration surface, provider-registry mapping); a free local permissive
    coding model with high evidence → TRY, a closed high-cost low-relevance
    product → IGNORE.
  - **Bounded daily evolution (no uncontrolled crawler):** `DiscoveryOrchestrator`
    enforces source limits, a `DiscoveryBudget` (max sources per run, max items
    per source, max total items, processing budget, max evidence per item,
    storage limits) and per-source rate-limit/cooldown tracking — a source that
    fails, times out, or is on cooldown is **skipped with the error recorded,
    never fatal**; dedup is fingerprint-based (title+source+category+publishedAt)
    with `UNKNOWN` publishedAt never silently evicting real content.
  - **Owner-scoped application service + bounded store:**
    `DiscoveryApplicationService` (getWorld / getDigest / list / getItem /
    markRead / markAllRead / setAction / runDiscovery) with per-user attention
    state keyed by owner (IDOR-safe by construction) and a **bounded FIFO
    `InMemoryDiscoveryStore`** (max 200 items, evicts oldest) with read/action
    state and generation tracking; `runDiscovery` re-runs the orchestrator
    (respecting cooldowns) and bumps the store generation — refresh, then read.
  - **Digest:** `DigestBuilder` produces a concise **"AI WORLD — TODAY"** summary
    (top important updates, recommendations, new GitHub projects, news — never a
    long feed), taking unread-state and user actions into account.
  - **Gateway (`aiWorld.*` namespace):** getWorld (bell panel view), getDigest,
    list, getItem, markRead, markAllRead, setAction (none / watching /
    dismissed) and runDiscovery (heavy tier) — auth + rate limits + zod + the
    standard owner-scope guard; wired through `ApiApplicationService`.
  - **AI World UI:** a **dedicated top-right bell** (🔔 with an unread dot and a
    premium hover/press treatment) opens the **AI World drawer** — NOT a generic
    notification center — structured as `🔥 Important for VedMoulya` / `⭐
Recommended for You` / `🧩 New GitHub Projects` / `📰 AI Updates` with
    per-section counts, scroll-to-page affordance, and per-item actions
    (watching / dismissed / mark read). A **dedicated `/ai-world` page** gives
    the full discovery list with filters (category, recommendation), the
    today-digest header, evidence / capability / pricing / availability chips
    (never colour-only), full evidence lists with `sourceUrl`, per-item action
    buttons (mark read, watch, dismiss) and a **Run discovery** button (bounded,
    rate-limited). **Discovery → provider configuration:** CONFIGURE-able items
    (registry-family providers like OpenRouter) render an explicit
    **"Configure Provider"** action that deep-links into the EXISTING AI
    Providers screen (`/providers?configure=<family>`) — the existing provider
    configuration + EPIC-012B intelligence refresh + routing are reused, never
    duplicated. GitHub items offer WATCH / OPEN (external `sourceUrl` in a new
    tab) / EVALUATE — never auto-clone/install.
  - **Security:** all discovered content sanitized as untrusted input;
    credentials/private user data never leave the platform (sources receive no
    user data); discovery never executes downloaded content; owner-scoped state;
    IDOR refused on every procedure.
  - **Tests (+122):** `packages/ai-world` **115/115** (normalization incl.
    malicious-text steering, fingerprint dedup + duplicate/UNKNOWN-date handling,
    evidence-first UNKNOWN honesty, 10-signal relevance scoring incl. the
    configurable bonus, free/local classification precedence, GitHub intelligence
    incl. abandoned/unclear-license/suspicious flags, recommendation states
    incl. CONFIGURE mapping, digest bounds + dedup, orchestrator budgets /
    source failure / rate-limit cooldown / dedup inside a run, bounded FIFO
    store with eviction + owner isolation + stale-read tolerance, application
    service world/digest/list/actions + generation bump + owner scope, static
    catalog determinism) + gateway **7/7** in `AIWorldRouter.test.ts` (real tRPC
    pipeline: getWorld/getDigest/list/getItem/markRead/markAllRead/setAction/runDiscovery,
    unread counts, action state, cross-user IDOR refusal). Web suite green
    (**120/120**), gateway full suite **622/622**, typecheck 0 (ai-world /
    services/api / apps/web), ESLint clean on all changed files.
  - **Honest limitations:** live ecosystem discovery (GitHub API, official model
    catalogues, trusted technical/news sources) is an **operator step** — the
    shipped default is the deterministic static catalogue + the pluggable source
    port (live adapters are documented seams; no fabricated discovery evidence);
    in-memory store (Postgres contract-tested via the in-memory double); no
    Postgres/Docker on this machine (unchanged).
  - Docs: `09_Documents/EPIC_012C_COMPLETION_REPORT.md`; MASTER_ROADMAP /
    PROJECT_STATUS / CHANGELOG / task_progress synchronized.

- **EPIC-012B — AI Provider Intelligence & Model Discovery** (2026-08-10): makes
  VedMoulya an **intelligent AI provider manager** — DISCOVER → VERIFY → UNDERSTAND
  → CLASSIFY → RANK → ROUTE → MEASURE → LEARN — as an INCREMENTAL layer over the
  frozen EPIC-012A intelligence (no routing engine rebuilt, no duplicate
  telemetry/design system, no hardcoded catalogue). Verdict
  **🟢 GREEN — IMPLEMENTATION VERIFIED** (live provider-API discovery remains an
  operator step; unknown metadata stays UNKNOWN — never fabricated).
  - **Safe refresh mechanism:** `ProviderIntelligenceRefreshService` — re-derives
    the profile from registry facts, runs the optional provider-metadata
    discovery port (**fail-safe: a failed discovery never fails the provider** —
    it stays Connected with PARTIALLY_VERIFIED intelligence and UNKNOWN fields),
    computes the safe delta (added / removed / preserved models — removed models
    are marked unavailable, **never silently deleted**), and reports an honest
    verification state (FULLY_VERIFIED / PARTIALLY_VERIFIED / UNVERIFIED).
  - **Persistent model-lifecycle ledger:** `knownModels` — every model id ever
    seen with its lifecycle verdict (`active` / `unavailable` / `deprecated`),
    surviving across refreshes. A model that disappears upstream stays excluded
    from routing even after subsequent refreshes; a returning model becomes
    active again. **User preferences are structurally untouched by refresh.**
  - **Staleness + caching:** `ProfileStaleness` verdict (age vs a 24h default
    refresh policy, injectable clock) + `ProviderIntelligenceStore` port with a
    **bounded FIFO `InMemoryProviderIntelligenceStore`** (max 500, evicts oldest;
    keyed by providerId — owner isolation is structural, no cross-user surface).
    `getIntelligenceStatus` is **cache-first** — the UI never re-derives profiles
    or re-queries metadata on every render; refresh only when stale.
  - **Model lifecycle in the profile:** `ModelIntelligence.lifecycleStatus`
    (INFERRED 'active' from catalog presence — never claimed as provider-verified;
    UNKNOWN when not stated).
  - **Routing extension (no duplicate routing):** `ProviderCandidateIntelligence`
    gains OPTIONAL intelligence facts (`resourceType`, `freeToUse`,
    `unavailableModelIds`) populated by `RuntimePorts` from the SAME registry
    classification the intelligence layer uses + the cached lifecycle ledger.
    `ProviderRoutingAdvisor.pickModel` never selects unavailable/deprecated
    models; `ModelSelectionIntelligence` uses the intelligence facts (FREE
    MUST NOT BEAT QUALITY — a free model that cannot satisfy the task is NOT
    eligible; a paid model does not win simply because it is paid) with the
    deterministic fallback preserved for the frozen contract. Quota-aware
    why-summary copy ("Free within your available quota." for FREE_API_QUOTA).
  - **Gateway:** `providers.getIntelligenceStatus` (cache-first read + staleness)
    and `providers.refreshIntelligence` (explicit safe refresh, mutation) — auth
    - rate limits + zod + the standard IDOR guard; wired through
      `ApiApplicationService` (bounded in-memory store shared with the routing
      ports); provider deletion clears its cached intelligence.
  - **UI (progressive disclosure, never cluttered):** provider rows on the main
    AI Providers screen now open a **dedicated configuration view** (click the
    provider name — the model selector + enable switch stay on the main screen):
    connection status · selected model · **Model intelligence card** (verification
    state, "Verified X ago · Update available" staleness, one-click **Update
    intelligence**) · models with capability chips + lifecycle dots (Active /
    Preview / Deprecated / Unavailable — never colour-only) + context + pricing ·
    Usage & quota · Pricing & limits · Advanced diagnostics (provenance,
    coverage, refresh policy) — each behind disclosure. Error state with Retry
    (no raw stack traces).
  - **Security:** credentials never travel through intelligence records
    (test-verified: no sk-…/api-key/bearer patterns in serialized profiles);
    provider metadata is registry-safe; usage/preferences stay owner-scoped;
    IDOR test-verified on both new procedures.
  - **Tests (+20):** providers **143/143** (refresh, staleness with injectable
    clock, delta + known-models persistence across refreshes, model-return
    reactivation, bounded FIFO cache, cache-first reads, stale re-derivation,
    deletion cache-clear, credential isolation, fail-safe discovery, owner
    isolation), services routing **25/25** (intelligence facts override cost
    heuristics, AGGREGATOR never free, fallback preserved, unavailable-model
    exclusion), gateway **14/14** in `ProviderIntelligenceRouter.test.ts`
    (status/refresh through the real tRPC pipeline + IDOR + ledger→routing
    exclusion via `RuntimePorts`). Typecheck 0 across packages/providers,
    packages/services, services/api, apps/web; ESLint 0/0 on all changed files
    (incl. clearing pre-existing debt: `exp!` assertions, redundant casts,
    unused imports).
  - **Honest limitations:** live provider-API model discovery (official
    model-list endpoints) and live refresh against real provider metadata are
    **operator steps** — the fail-safe declared-only discovery is the default and
    verification is never claimed beyond what a source proved; no Postgres/Docker
    on this machine (unchanged).
  - Docs: `09_Documents/EPIC_012B_COMPLETION_REPORT.md`; CHANGELOG synchronized.

- **EPIC-012A — Premium Experience Refinement + AI Provider Intelligence** (2026-08-10):
  transforms the VedMoulya front end into a **premium, minimal, consistent intelligent
  operating system** while making the AI Provider system **significantly more
  intelligent and user-respecting**. Verdict **🟢 GREEN — IMPLEMENTATION VERIFIED**.
  - **AI Providers screen redesigned (Phases 4–6 / 17):** consolidated premium view —
    aggregate usage indicator (`✦ AI Usage 184K / 1M tokens $12.40 82% Free`), clean
    provider rows (Provider → Model → Availability → ON/OFF), inline enable/disable
    toggle, availability indicators (text + icon + colour — never colour alone),
    Usage & Economics detail behind one click. Original registry/benchmark tabs behind
    "Advanced — Provider Registry" (progressive disclosure).
  - **ModelSelector component:** compact, scrollable, searchable model dropdown with
    "Auto" option, keyboard navigation (Arrow Up/Down/Enter/Escape), click-outside
    close, mobile bottom sheet (< 768px), selected model checkmark, capability labels,
    status badges. Disabled providers show collapsed read-only selector.
  - **Settings AI tab (Phase 14):** budget policy radio-card selector (Never spend /
    Ask before paid usage / Allow within budget), daily/monthly budget inputs, link
    to providers screen for preferred model selection.
  - **Owner-scoped provider preferences (Phases 12–15):** `ProviderPreferencesStore`
    with `InMemoryProviderPreferencesStore` — per-user enabled/disabled providers,
    preferred model, budget policy, budgets; enabled-provider filter in the routing
    candidate path; disabled providers remain configured but excluded from automatic
    selection. Full IDOR protection.
  - **Gateway wiring:** `providers.*` namespace extended with `getExperience`,
    `getPreferences`, `setPreferences`, `setProviderEnabled`, `getUsageDetail`,
    `explainModelSelection` — all behind auth + rate limits + owner scope.
  - **Provider intelligence already existed (Phases 7–11):** verified from source —
    `ProviderIntelligenceService`, `ModelResourceClassifier` (LOCAL / FREE_HOSTED /
    FREE_API_QUOTA / USER_PAID_API / AGGREGATOR / OPEN_MODEL / CUSTOM_ENDPOINT /
    ENTERPRISE), `HardwareCompatibilityService` (SAFE / POSSIBLE_SLOW /
    NOT_RECOMMENDED / UNSUPPORTED / UNKNOWN), `LocalModelDiscovery` (Ollama / LM
    Studio / OpenAI-compatible), `ModelSelectionIntelligence` (budget policy, user
    preference, smart upgrade/downgrade, "Why this model?" summaries). Every
    property carries provenance — never fabricates unknown information.
  - **Front-end consistency:** global design system honoured across all screens;
    `Switch`, `Card`, `Badge`, `Loading`, `EmptyState` from `@vedmoulya/ui` reused;
    dark mode, responsive (desktop/tablet/mobile), premium animations.
  - **Validation:** gateway typecheck 0 errors · web typecheck 0 errors · providers
    tests **125/125** · ESLint clean · no duplicate routing/telemetry/design system
    · no hardcoded model catalogue · no credential leakage.
  - **Honest limitations:** live provider intelligence profile generation, live model
    capability discovery, live local model discovery, live free resource intelligence,
    live "Why this model?" with real AI reasoning, live cost ledger aggregation are
    **operator steps** (require configured AI provider with API credentials).
  - Docs: `09_Documents/EPIC_012A_{BASELINE_AUDIT,UX_REFINEMENT,PROVIDER_INTELLIGENCE,
MODEL_SELECTION,COMPLETION_REPORT}.md`; CHANGELOG synchronized.

- **EPIC-012 — Production Observability, Control Plane & Operations** (2026-08-10): makes
  VedMoulya **observable, diagnosable, controllable and economically measurable in
  production** — CONNECTS and COMPLETES the existing telemetry estate (the Phase 0
  gap audit `09_Documents/EPIC_012_BASELINE_AUDIT.md` classified every capability
  from source first; nothing was rebuilt blindly). Verdict
  **🟢 GREEN — COMPLETE WITH OPERATOR ACTIVATION REQUIRED** (OTel/Langfuse live
  export + `OPS_OPERATOR_IDS` are operator steps; no live vendor evidence
  fabricated).
  - **ExecutionTrace spine (`@vedmoulya/core` tracing):** `ExecutionTrace` /
    `TraceSpan` / `TraceStatus` (OK · ERROR · FAILED · ABSTAINED ·
    BUDGET_EXCEEDED · TIMEOUT · PROVIDER_FAILURE · VALIDATION_FAILURE ·
    SECURITY_BLOCK · USER_CANCELLED — superset of the loop termination reasons,
    mapped 1:1 via `normalizeTraceStatus`), stable identifiers
    (traceId/spanId/parentSpanId/executionId/userId/applicationId/correlationId),
    `TelemetryPort` (narrow engine seam — `NoopTelemetryPort` default = zero
    behavior change), `ExecutionTraceProvider` (AsyncLocalStorage-parented spine
    so a single trace reconstructs USER → REQUIREMENTS → FACTORY → LOOP → AI →
    RAG → PROVIDER → QUALITY → REFINEMENT → DEPLOYMENT), and a **bounded,
    owner-scoped `TraceStore`** (FIFO 5000 + optional TTL — observability can
    never become an unbounded memory sink; telemetry never throws into engine
    code).
  - **Engine telemetry (Phases 3–7):** loop-engine (`loop.run` span + `loop.step`
    events carrying authoritative per-provider tokens/cost/latency/retried/
    fallback), app-factory (`factory.create/approve/build/resume/deploy` spans
    with economics attributes from the persisted `EconomicsTracker`),
    experience (`experience.evaluate` spans — verdict/overall/findings/blocking),
    requirements (start/answer/plan/approve spans), rag (`rag.ingest`/`rag.search`
    spans — collection/chunks/strategy/embedding_model/evidence state). All five
    engine packages typecheck + all 457 tests stay green.
  - **AI runtime bridge (Phase 2/3):** `TraceProviderOtelBridge` implements the
    frozen `AIObservability.OtelBridge` seam against the trace spine — every
    `ai.*` span (provider/model/latency/tokens/cost/cache/retry/fallback/429/5xx/
    timeout/abstention/budget) lands in the correlated trace, redacted via the
    runtime's `redactSecrets` on all string attributes. No new vendor dependency;
    the pre-existing OTel/Langfuse exporters are the operator-activated export
    path (no fabricated live evidence).
  - **Unified cost & token ledger (Phase 8):** `CostLedger` — a pure query over
    stored traces: totals + per provider/application/user + per-execution rows
    (cost per request/application/build/refinement/user/provider/model, cache
    savings, retries) + **anomaly detection** (COST_SPIKE > 3× median, > 6×
    critical; REPEATED_CALLS ≥ 5 identical AI calls in 60 s; CACHE_MISS_BURST ≥ 8
    calls with 0 cache hits). The ledger MEASURES only — frozen token-budget
    enforcement (`LoopBudget`, runtime guards) remains authoritative.
  - **Application health model (Phase 10):** `assessApplicationHealth` derives
    **HEALTHY / DEGRADED / BLOCKED / FAILED / UNKNOWN** from persisted evidence
    (status, validation gates, security report, UI quality, repair loop) —
    rule-first, so a numeric quality score can never mask a critical security
    finding.
  - **Control plane (Phases 9/11):** `ops.*` tRPC namespace wired into the
    RouterRegistry — inspect (listTraces/getTrace/listFailures/getDiagnostics/
    costLedger/costAnomalies/applicationHealth/providerHealth/alerts/auditLog) +
    control (retry/cancel/revalidate/requality/disableProvider/enableProvider).
    Every read is owner-scoped for non-operators (IDOR refused at the store
    boundary); platform-wide reads and every control action require the
    **`OperatorGate`** (`OPS_OPERATOR_IDS` allowlist — empty = deny-all, fail
    closed); every control action is **audited** (`AuditTrail` ring 500) and
    emits a `control` span.
  - **Incident diagnostics (Phase 12):** `buildIncidentDiagnostics` answers WHAT
    FAILED / WHEN / WHERE / WHY / WHAT WAS ATTEMPTED / WHAT PROVIDER / WHAT
    RETRIES / WHAT FALLBACK / WHAT EVIDENCE / USER STEP / OPERATOR STEP — never
    "Something went wrong.", no secrets, no stack traces.
  - **Alerting (Phase 13):** `AlertEngine` — 11 threshold rules (provider error
    rate 10%, latency p95 120 s, 429/min 10, RAG fallback 50%, abstention 30%,
    cost anomaly 5×, token anomaly 3×, quality regression 15 pts, security ≥1,
    deployment ≥1, application failures ≥3), configurable with validated clamps,
    bounded history (200), no alerts for normal behavior.
  - **Security (Phase 14):** `EPIC_012_SECURITY_AUDIT.md` — no keys/secrets in
    logs or traces, owner-scoped telemetry, operator authorization (deny-all
    default), audit trail, retention controls, safe errors, IDOR test-verified
    (cross-user trace read → NotFound; non-operator control → OPS_FORBIDDEN).
  - **Tests:** core tracing 13/13; control plane `OpsControlPlane.test.ts` 22/22;
    `AlertEngine.test.ts`; end-to-end `ObservabilityWiring.test.ts` — a real
    application journey (create → approve → build → quality → deploy) runs
    through the real pipeline and is **reconstructed from one correlated trace**;
    gateway full suite **595/595 tests / 23 files**; `ProductionEngineWiring`
    made hermetic regardless of local provider keys. Lint + typecheck clean on
    all changed files.
  - **Docs:** `09_Documents/EPIC_012_{BASELINE_AUDIT,OBSERVABILITY_ARCHITECTURE,
TELEMETRY_MODEL,COST_MODEL,SECURITY_AUDIT,OPERATIONS_GUIDE,
COMPLETION_REPORT}.md`; MASTER_ROADMAP / PROJECT_STATUS / CHANGELOG / README /
    task_progress synchronized.
  - **Honest limitations:** OTel/Langfuse live export + `OPS_OPERATOR_IDS` are
    operator-activation steps (no live vendor credentials on this machine, per
    the no-fabrication rule); load/scale re-run deferred (observability adds no
    synchronous blocking path); no Postgres/Docker on this machine (unchanged
    from EPIC-011).

- **EPIC-011 — Production Validation & Autonomous Quality** (2026-08-09): turns
  EPIC-010's implementation-verified experience intelligence into
  **production-evidenced functionality** — rebuilds nothing (baseline audit
  verified from source: `09_Documents/EPIC_011_BASELINE_AUDIT.md`; no new
  workspace — verify/benchmark scripts + e2e spec only). Verdict
  **🟢 GREEN — IMPLEMENTATION VERIFIED / LIVE VALIDATION PENDING**.
  - **Live AI runtime validation** (`npm run ai:production:verify`):
    operator-safe (never prints keys — only the 7-char prefix; never unbounded;
    never silently falls back to mocks; exit 2 = no key, 3 = quota-blocked).
    Verifies authentication, model availability, timeout/retry/fallback,
    structured output, token accounting, budget enforcement, provider routing,
    evidence/abstention, error normalization, streaming, telemetry. **Found +
    fixed a REAL production defect the hermetic suites could not**: the Vercel
    AI SDK v7 rejects `system`-role messages — `VercelAIProvider` now passes
    system prompts via the top-level `instructions` option at all three call
    sites (regression tests 13/13; before: `System messages not allowed`;
    after: the call reaches the real OpenAI API — blocked only by the account's
    zero billing credits, reported honestly as LIVE VALIDATION BLOCKED).
  - **Live AI critique** (`npm run ai:critique:verify`): activates the EPIC-010
    `AICritiquePort` seam over the frozen runtime with a deterministic task
    (the ABAP UI); measures latency/tokens/cost; the evidence-first merge never
    weakens when AI is absent. Live path reached the real provider →
    quota-blocked → honest exit 3.
  - **Production benchmark** (`npm run production:benchmark`): **8/8 real
    applications** (ABAP · Restaurant · Finance · Healthcare · Education ·
    E-commerce · Workflow · AI-support) through requirements → plan →
    10-dimension quality → critic → targeted refinement → security gate —
    **VERDICT PASS** (8/8 archetype-matched · 8/8 × 10 dims · refinement
    targeted + approval-gated 8/8 · security blocked 2/2 critical/high ·
    evidence-first 8/8; est. ~$0.017/app, 0 real AI calls — honest; timing
    understand 11ms · plan 3ms · evaluate 0.7ms · refine 0.2ms).
  - **Quality gates** (`npm run quality:gates:verify`): **16/16 PASS** —
    CRITICAL/HIGH security, data leak, authorization failure, functional-test
    failure, grounding failure, structured-output failure all BLOCK
    (NOT_READY); **aggregate-score masking FORBIDDEN**; the critic→refine→
    retest loop is bounded by LoopBudget (ITERATION_LIMIT before the next call;
    token budget enforced independently).
  - **Browser visual validation + regression**
    (`apps/web/e2e/visual-validation.spec.ts`): real Chrome, real factory
    build, real generated UI in the sandboxed preview. Desktop/Tablet/Mobile:
    device re-framing to the declared width, **zero horizontal overflow**, real
    UI + labeled textarea + empty-state, interaction at 375px; **committed
    deterministic screenshot baselines** (`abap-{desktop,tablet,mobile}` PNGs,
    `toHaveScreenshot` 1% threshold) — the regression comparison run passes;
    a missing baseline FAILS (never silently passes). Resolves the EPIC-010
    "visual validation not pixel-verified" condition.
  - **Failure-chaos + adversarial security** re-verified green (51 + 33 + 31
    deterministic tests): IDOR, cross-user isolation, prompt/retrieval
    injection, malicious code, tool denial, secret leakage, authorization
    bypass, score-masking — all fail safely; no critical/high findings; no
    unbounded loops; no budget violations.
  - **Observability:** reuses `AIMetrics` (live in-run counters) +
    `AIObservability` (NOOP default; OTel/Langfuse exporter seams deferred) —
    no competing telemetry introduced.
  - **Regression:** orchestrator 50 (incl. the adapter-fix regression tests) ·
    experience 50 · requirements 130 · journey spec 3/3 · visual spec PASS.
  - **Honest limitations:** live AI + live RAG validation are operator steps
    (zero-credit provider account — the call reached the real API and was
    honest-reported BLOCKED, exit 3; no Postgres/Docker on this machine —
    `npm run rag:pg:verify` documents exact steps); visual baselines cover the
    ABAP acceptance app on Chromium/win32; OTel/Langfuse deferred.
  - Docs: `09_Documents/EPIC_011_{BASELINE_AUDIT,LIVE_AI_VALIDATION,
RAG_VALIDATION,VISUAL_VALIDATION,SECURITY_VALIDATION,PRODUCTION_BENCHMARK,
COMPLETION_REPORT}.md`; MASTER_ROADMAP / PROJECT_STATUS / CHANGELOG /
    README / task_progress synchronized.

- **EPIC-010 — Adaptive Application Experience & Visual Intelligence** (2026-08-09):
  the VISUAL INTELLIGENCE & QUALITY layer ABOVE the Application Factory — generated
  applications become not merely _functionally correct_ but also _visually
  coherent, application-specific, responsive, accessible, evidence-reviewed and
  targeted-refinable_. **Zero architectural change** to the frozen platform — the
  baseline audit verified the implementation from source
  (`09_Documents/EPIC_010_BASELINE_AUDIT.md`), and no frozen system was rebuilt.
  - **New workspace `@vedmoulya/experience`** (20 source files) following the
    frozen layering (types → contracts → domain → infrastructure → application →
    catalog). Executes NO AI directly: the critic/quality engines are deterministic
    logic over the persisted application workspace; the optional AI-critique port
    is a non-fatal seam over the frozen runtime.
  - **Phases 1–7 — Design Intelligence:** typed `ApplicationDesignSystem`
    (structured tokens for typography/colors/spacing/radius/elevation/surfaces/
    buttons/forms/navigation/cards/tables/dialogs/notifications/badges/charts/
    empty-loading-error states), **domain-aware visual strategy** (`archetype` —
    ABAP debugger professional/dense · restaurant visual/warm · finance
    trustworthy/analytical · healthcare calm/accessible · education
    engaging/friendly · enterprise structured — never one universal template),
    `DesignDecision` (decision/rationale/source/alternatives/confidence/affected
    components), `UIBlueprint` (screens/routes/navigation/components/layouts/
    responsive/states/interactions/a11y), **state intelligence** (LOADING/EMPTY/
    SUCCESS/ERROR/PARTIAL/OFFLINE/UNAUTHORIZED/FORBIDDEN/VALIDATION — never only
    the happy path), **responsive intelligence** (mobile/tablet/desktop behavior
    per component — never just shrinking desktop), and **accessibility**
    (keyboard/focus/semantics/labels/contrast/screen-reader/touch-target/reduced
    motion).
  - **Phases 8–13 — Critic & Quality:** `VisualCriticEngine` (10 dimensions →
    structured evidence-classified findings VC-xxx with severity/area/issue/
    evidence/recommendation), unified `ApplicationQualityEvaluation`
    (FUNCTIONAL/UX/VISUAL/ACCESSIBILITY/SECURITY/PERFORMANCE/AI/RAG/DATA/
    ARCHITECTURE — **a high aggregate score can never hide a critical failure**),
    **evidence-first review** (CONFIRMED/LIKELY/UNCERTAIN/NOT_FOUND — never
    manufactured confidence), **targeted refinement** (a single finding touches
    only the affected component — never regenerate-all; untouched files preserved
    and reported), **change impact** (affected requirements/screens/components/
    files/tests/architecture/security/deployment surfaced before refinement).
  - **Phases 15–18 — Quality Center & Security:** workspace **QUALITY tab** with
    overall + 10 dimension drill-downs (findings → evidence → recommendation →
    refine); design/implementation **traceability** (requirement → design decision
    → UI blueprint → component → file → test → visual review); **token-efficient**
    refinement (zero AI calls measured — evaluation avg 0.97ms); **security**
    (refinement flows through the factory's owner-scoped engine — cross-user
    evaluation/refinement refused, IDOR proven by test).
  - **Gateway (`experience.*` namespace):** `evaluate`/`findings`/`refine`
    (approval-gated, owner-scoped) on authenticated + rate-limited procedures;
    `ApiApplicationService` wiring; **router-registry E2E** (create → approve →
    build → evaluate → findings → refine → cross-user refusal through the real
    tRPC pipeline) + a **router coverage walker** that fires every namespace
    procedure through the real pipeline with schema-generated inputs (full +
    minimal optional-omitted variants — 34 namespaces, 391+ schema-valid
    procedures) so no registry handler closure is dead code.
  - **Optional AI-powered critique seam (Phase 8/11, 2026-08-09):** the
    deterministic critic is now complemented by an **optional, non-fatal,
    provider-neutral AI critique** that critiques the generated UI through a
    live provider and returns findings in the SAME evidence-first format.
    `AICritiquePort` (contract in `packages/experience`) — a single bounded
    reasoning call over the **frozen `AIOrchestratorSpecialistPort`** (the same
    port the loop + factory use; capability `reasoning`, quality tier standard,
    bounded input/output tokens, optimization enabled) **attributed to the
    AUTHENTICATED user** (`ctx.userId`, never the application id) so the AI
    runtime's per-user rate limits, caches and audit attribution stay correct. Evidence-first merge in
    `VisualCriticEngine.critiqueWithAI`: AI findings are **groundedness-gated**
    (evidence must quote actual artifact content, else demoted
    UNCERTAIN/NOT_FOUND) and **proposed-for-review only — never auto-fixable**
    (auto-fix stays with deterministic findings). Abstention, parse failures or
    provider absence return an honest abstained result and the deterministic
    evaluation stands unchanged — **no fabricated critique, ever**.
    Gateway: `createExperienceAICritiquePort` adapter
    (`services/api/src/infrastructure/ExperienceAICritiquePort.ts`) builds a
    BOUNDED prompt (UI files only — view/component paths or UI-rendering
    extensions, 12-file × 2 500-char caps, design tokens + screens included,
    quoted-evidence + abstention rules) and tolerantly parses findings
    (markdown fences, shape-filtered — bad severity/area/empty evidence
    dropped). New `experience.evaluateWithAI` procedure (auth + rate limits +
    IDOR, standard tier) + `evaluateWithAI` on `ExperienceApplicationService`;
    `ExperienceEngine` gained an `AICritiquePort` seam field and `evaluateWithAI`
    plumbing; QUALITY tab in `/applications` gained an **"AI critique"** toggle.
    Tests: **14 seam tests** (groundedness gate, no-fabrication, abstention
    honesty, bounded prompt, tolerant parse, never auto-fixable) +
    **7 adapter tests** (bounded prompt excludes non-UI files, oversized-file
    truncation, fence-tolerant parse, invalid-shape drop) + gateway router
    `evaluateWithAI` + cross-user IDOR refusal; benchmark extended with a
    deterministic AI-seam check (findings proposed-for-review, evidence-gated).
  - **Benchmark** (`npm run experience:benchmark`): hermetic deterministic —
    **7/7 scenarios** through the full pipeline (ABAP Debugger, Restaurant,
    Finance Dashboard, Healthcare Appointments, AI Customer Support, Enterprise
    Workflow, E-commerce), quality 7/7 all 10 dimensions, evidence-classified
    7/7, targeted + approval-gated refinement 7/7, untouched files preserved
    (never regenerate-all), security gate blocks NOT_READY on critical/high
    2/2, cross-user refusal verified.
  - **Validation:** experience package **36 tests / 3 files — 0 failures**
    (95.19% stmts · 80.34% branches · 97.56% funcs · 96.64% lines), gateway
    **549 tests / 19 files — 0 failures** (95.77% stmts · 80.61% branches ·
    97.8% funcs · 96.42% lines), **coverage gate 🟢 34/34 workspaces ≥80%**,
    typecheck 0 (experience/api/web), **ESLint 0 errors / 0 warnings repo-wide**
    (incl. eliminating pre-existing debt — floating promise in
    `scripts/app-factory-benchmark.ts` + one documented object-injection ignore),
    regression green (requirements 95 · app-factory 108 · loop-engine 106).
  - **Honest limitations:** visual validation is **IMPLEMENTATION VERIFIED, not
    pixel-verified** (the critic evaluates design system/blueprint/files against
    structured rules — no headless pixel assertions, and the epic's rule "never
    claim visual validation that was not executed" is honored); the deterministic
    critic remains the default (the AI-critique seam is implemented + tested but
    live-provider execution is an **operator step** — `OPENAI_API_KEY`/provider
    key required, same machine constraint as AI-RUNTIME-003/EPIC-007/008/009 —
    and without a provider it abstains honestly, never faking a critique); no
    live external provider/DB execution on this machine (no Docker/WSL).
  - Docs: `09_Documents/EPIC_010_{BASELINE_AUDIT,DESIGN_SYSTEM,VISUAL_CRITIC,
QUALITY_MODEL,COMPLETION_REPORT}.md`; MASTER_ROADMAP / PROJECT_STATUS /
    CHANGELOG / README / task_progress synchronized.

- **EPIC-009 — Product Intelligence & Requirements Engine** (2026-08-09): the
  INTELLIGENCE LAYER ABOVE THE APPLICATION FACTORY — transforms
  `USER PROMPT → APPLICATION FACTORY` into
  `USER IDEA → UNDERSTAND → ANALYZE → EXTRACT REQUIREMENTS (with provenance) →
DETECT AMBIGUITY/CONFLICTS → ASK HIGH-VALUE QUESTIONS → PROPOSE SAFE DEFAULTS →
COMPLETE PRODUCT PLAN → USER APPROVAL → APPLICATION FACTORY → LOOP ENGINE →
BUILD → VALIDATE`. The user never needs to become a prompt engineer.
  - **New workspace `@vedmoulya/requirements`** following the frozen layering
    (types → contracts → domain → infrastructure → application → catalog),
    orchestrating **17 deterministic domain engines** — no AI in the core path,
    no rebuild of any frozen system (AI Runtime, RAG, EvidenceEvaluator, token
    optimization, LoopEngine, Application Factory, workspace, IDOR all reused
    as-is; the only AI surface is an optional, non-fatal enrichment port over
    the frozen runtime).
  - **Provenance spine (Phases 1–3):** `ProductIntent` with explicit / inferred /
    assumptions / unknowns ledger and `RequirementSet` (13 categories) where
    every claim and requirement carries `source` (USER/INFERENCE/QUESTION/
    DEFAULT/MEMORY/RAG/SYSTEM) + confidence + reason — **inference is never
    silently converted into user-provided fact**; the UI renders provenance badges.
  - **Question intelligence (Phases 5–8):** `AmbiguityEngine` +
    `RequirementQuestionEngine` — BLOCKING questions must be answered (they carry
    NO safe default by design), IMPORTANT are asked when practical, OPTIONAL are
    never asked (their default applies); ranked by weighted impact and **bundled**
    by topic (no one-question-per-message spam); every question has rationale +
    impacts and is phrased in plain language.
  - **Safe defaults (Phase 9):** `SafeDefaultEngine` proposes ASSUMPTION/DEFAULT/
    REASON/IMPACT for every non-critical unknown; the user may accept-all / edit /
    reject; **security-sensitive defaults can never silently apply**.
  - **Completeness gate (Phase 10):** `CompletenessEngine` returns
    NOT_READY/READY_WITH_ASSUMPTIONS/READY — **a numeric score can never override
    a critical unknown**; `plan()` and `approve()` deterministically refuse while
    any critical unknown or unanswered BLOCKING question exists.
  - **Conflict detection (Phase 11):** `ConflictDetector` explains contradictions
    and offers explicit a/b/both resolution — never silently chooses one side.
  - **Full product plan (Phases 12–23):** 18-section `ProductBrief` → user
    journeys (happy/failure/empty/permission/network/validation/recovery) →
    experience strategy (interaction model chosen from requirements, never
    chatbot-by-default) → application-specific `DesignSpecification` →
    `ProductArchitecture` (choice/reason/alternative/tradeoff + complexity guard)
    → `AIStrategy` (AI only when required, through the frozen runtime) →
    `RAGStrategy` (only when external/domain knowledge is needed) →
    `ToolStrategy` (purpose/permissions/data access/risk/approval) →
    `SecurityPlan` (security-by-design) → `CostPlan` (tokens/calls/cost/latency) →
    dependency-aware `BuildPlan` (parallel waves, executed by the EPIC-006
    LoopEngine) → `PlanReview` with the APPROVE/MODIFY/ANSWER/CANCEL gate.
  - **Change control (Phases 24–26):** `ChangeImpactAnalyzer` is **mandatory** — a
    follow-up request first produces impact across all 10 areas + what-will-change /
    what-will-not-change + risks + cost, then asks for approval; `RequirementVersionControl`
    appends versions (the historical record is never silently mutated);
    `TraceabilityIndexer` answers "which requirement caused this feature / which
    test validates it".
  - **Memory (Phase 27):** accepted defaults and decisions recorded per session;
    **never leaked between users or unrelated applications**.
  - **Gateway:** `requirements.*` tRPC namespace (15 procedures — start / get /
    list / delete / answer / acceptAllDefaults / decideDefault / resolveConflict /
    plan / approve / reject / handoffGoal / handoffToFactory / changeImpact)
    behind auth + IDOR + rate limits + zod; owner-scoped sessions enforced at the
    engine (`getOwned`), never at the UI; `PostgresRequirementSessionStore`
    (production) + in-memory double; `handoffToFactory` flows an APPROVED plan
    straight into `factory.create`.
  - **UI (Phase 28):** `/applications` gained a **Product Intelligence** mode
    (recommended) beside Direct Factory — a two-panel premium Product Builder:
    conversation ("What do you want to build?") + progressive intelligence panel
    (Understanding · Requirements · Questions · Assumptions · Product · Design ·
    Architecture · AI · Security · Cost · Plan), mobile tabs, resume existing
    sessions, never faked.
  - **Benchmark (Phases 29–30):** `npm run requirements:benchmark` — 7 real
    scenarios (restaurant, ABAP debugger, AI support, finance dashboard,
    e-commerce, healthcare appointments, enterprise workflow): **PASS** — 7/7
    understood (avg 11ms) · 7/7 plan-gated until resolved · 7/7 approved +
    handoff goals · 7/7 IDOR refused · 0 AI calls (deterministic core).
  - **Validation:** requirements package **95 tests / 8 files — 0 failures**;
    gateway **+5 router tests** (RequirementsLifecycleRouter: start→answer→
    plan→approve→handoffGoal→handoffToFactory→changeImpact + cross-user
    refusal) on top of the registry suite (**31/31**); typecheck 0 across
    packages/requirements, services/api, apps/web; no dependency changes.
  - **Docs:** `09_Documents/EPIC_009_{BASELINE_AUDIT,REQUIREMENTS_ARCHITECTURE,
QUESTION_INTELLIGENCE,DESIGN_INTELLIGENCE,SECURITY_MODEL,EVALUATION,
COMPLETION_REPORT}.md`; MASTER_ROADMAP / PROJECT_STATUS / README /
    task_progress synchronized.
  - **Honest limitations:** deterministic core (0 AI calls — optional enrichment
    is the future model-based surface); four factory archetypes (other domains
    route through `generic-web` with per-domain derived content); live Postgres
    session store contract-tested via the in-memory double; live-provider/DB
    journeys are operator steps (no Docker/WSL on this machine).

- **EPIC-008 — Real Application Workspace & Production UX** (2026-08-09): moves VedMoulya
  from _"the Application Factory can generate applications"_ to _"a real user can create,
  inspect, modify, validate, resume and manage an application through VedMoulya"_ — a
  PRODUCT USABILITY sprint that **rebuilds nothing** from the frozen platform
  (baseline audit: `09_Documents/EPIC_008_BASELINE_AUDIT.md`).
  - **Persistent application lifecycle (Phase 1):** new `ApplicationProjectRepository`
    port (`packages/app-factory/src/contracts/application-repository.ts`) with two
    implementations — `InMemoryApplicationRepository` (hermetic double, deep-cloned
    documents) and `PostgresApplicationRepository` (production JSONB full-document row
    keyed by application id with an owner column). The `FactoryEngine` now persists the
    complete project document (metadata, spec, architecture, blueprint, files,
    validation, security, deployment, economics, version history, termination state) on
    every mutation — **applications survive page refresh, user logout, and server
    restart** (proven by restart-survival tests). Lifecycle ops added: `rename`,
    `archive` (never auto-deletes), `resume` (FAILED/ARCHIVED → DRAFT keeping the plan +
    workspace), `delete` (**explicit `confirm: true` required**), `history`.
  - **Version history (Phase 14):** append-only `ApplicationVersion` records per
    significant transition (version, change, status, author, AI tasks, tokens, cost,
    tests passed, security findings, build status, timestamp); rollback is
    forward-only via `resume` — destructive rollback intentionally excluded.
  - **Ownership enforced at the engine (Phase 2/22):** every lifecycle operation
    resolves through owner-scoped `getOwned` — a foreign `userId` cannot rename,
    archive, delete, resume, or read history (**IDOR refused at the engine, never at
    the UI**). Workspaces stay keyed by application id, so cross-application file
    access is prevented by construction.
  - **Gateway (Phase 1/22):** all `FactoryRouter` handlers made async; new handlers
    `rename`/`archive`/`delete`/`resume`/`history` with zod inputs registered on the
    authenticated procedures (heavy tier for create/build, standard for the rest);
    `createProductionApplicationRepository()` wired into `ApiApplicationService`
    options; new router tests `services/api/src/__tests__/FactoryLifecycleRouter.test.ts`.
  - **Workspace UI (Phase 3–6):** `/applications` rebuilt as the production application
    workspace — `page.tsx` is the create flow (goal entry incl. the **ABAP Debugger
    Assistant** acceptance example → UNDERSTAND→SPECIFY→ARCHITECT→PLAN → **APPROVE**
    gate → build → manage) and `workspace.tsx` is the new 12-tab `ApplicationWorkspace`
    (Overview · Specification · Architecture · Plan · Build · Files · Diff · Tests ·
    Security · History · Deployment · Settings), desktop + mobile responsive, no raw
    stack traces, loading/empty/error states everywhere. Build panel shows the **real**
    persisted execution state (current task, specialist, iteration, tokens, estimated
    cost, elapsed, status) — never faked. Files/Diff/Tests/Security/Deployment tabs
    render only persisted workspace evidence; deployment stays an explicit user action.
  - **Repair loop UI (Phase 11, 2026-08-09):** the engine now runs a **bounded
    6-attempt repair loop** (`MAX_REPAIR_ATTEMPTS = 6`) during build validation —
    diagnose → apply deterministic patch → diff (recorded as file operations) →
    re-validate — with every attempt persisted (`RepairAttempt`: attempt/limit/
    diagnosis/patches/result). Exhausting the loop while validation still fails ends
    the application **FAILED with `REPAIR_LIMIT_REACHED`**; a proposed-but-unappliable
    fix stops the loop and reports `VALIDATION_FAILURE` honestly (no spinning). The
    `/applications` workspace shows the **attempt n/6 counter**, per-attempt
    diagnosis → patches → result cards, and a **REPAIR_LIMIT_REACHED banner with
    resume-and-rebuild** — and never pretends the application is ready (status is
    now FAILED for anything other than PASS, including PARTIAL). Backed by the
    persisted engine trace, never faked.
  - **Validation (Phase 23/25):** app-factory **108 tests / 17 files** (new
    `FactoryPersistenceLifecycle.test.ts`: creation, persistence roundtrip, restart
    survival, ownership denial, lifecycle policy, delete confirm, version history;
    `PostgresApplicationRepository.test.ts` + `InMemoryApplicationRepository.test.ts`:
    DDL, JSONB round-trip, deep-clone, owner-scoped list, delete;
    `RepairLoop.test.ts`: bounded loop, convergence, REPAIR_LIMIT_REACHED, no-op
    stop), gateway **526 tests / 16 files** (incl. create→rename→archive→resume→
    history→delete + cross-user ownership refusal), typecheck 0, **lint 0/0 on all
    changed areas (36 files)**, **coverage gate measured 🟢 93.53% stmts ·
    81.55% branches · 95.94% funcs · 95.36% lines (all ≥80%)**. No dependency
    changes — build/bundle/audit gates unchanged.
  - **Docs (Phase 24):** `09_Documents/EPIC_008_{BASELINE_AUDIT,WORKSPACE_ARCHITECTURE,
COMPLETION_REPORT}.md`; MASTER_ROADMAP / PROJECT_STATUS / README / task_progress
  - **Real-user browser journey (2026-08-09):** `apps/web/e2e/applications-journey.spec.ts`
    drives the actual UI in Chrome with a real JWT session (BLD-016C harness):
    `/applications` → ABAP Debugger example → create → Plan tab → approve → build →
    persisted READY → Tests PASS → Files (`package.json`/`src/index.ts`) → Diff
    (`Change review`) → `Deploy locally (authorize)` → deployed, plus a full-page-reload
    persistence test that reopens the project from `Your applications`. Serial, 2/2
    passing. Enabler: `createProductionApplicationRepository` now falls back to the
    in-memory hermetic registry when NODE_ENV is development/test (documented RAG
    convention — Postgres unchanged for production/staging; new deterministic tests in
    `ProductionEngineWiring.test.ts`). Gateway suite now **528/528**.
  - **QUALITY-tab browser journey (EPIC-010 Phase 21, 2026-08-09):** a third serial
    Chrome journey drives the quality center end-to-end through the REAL pipeline (no
    UI stubbing): build → READY → **Quality** tab (verdict + overall score card, 10
    dimensions, critic findings with rendered evidence classes) → **trigger a targeted
    refinement** (`Fix automatically` on a deterministic auto-fixable MEDIUM finding →
    the approval-gated change-impact PLAN renders with the affected file
    `src/ui/app.ts` + the untouched-preservation guarantee — never silently applied)
    → **Diff** tab (`Change review` — persisted kind·status·path·originating-task ops)
    → **Tests** tab (build validation report still PASS, because the plan did not
    mutate files). **3/3 serial journeys passing** (create→deploy · QUALITY
    end-to-end · reload persistence). All three journeys now toggle **Direct Factory**
    first (the `/applications` page defaults to the EPIC-009 Product Intelligence
    builder since EPIC-009 landed).
  - **Honest limitations:** live-provider user journey is a documented operator step
    (same machine constraint as AI-RUNTIME-003/EPIC-007 — no Docker/WSL); the Postgres
    path is contract-tested via the in-memory double (live DB = operator step, same as
    RAG); Preview (Phase 13) surfaces validation/security evidence rather than a
    rendered app (generated artifacts are validated structured projects, and the UI
    never claims visual quality it did not render); rollback is forward-only.

- **EPIC-007 — AI Application Factory** (2026-08-08): the APPLICATION FACTORY layer
  **above** the frozen platform that turns a natural-language application idea into a
  structured, validated application project (UNDERSTAND → SPECIFY → ARCHITECT → PLAN →
  APPROVE → GENERATE → TEST → CRITIQUE → REFINE → BUILD → PACKAGE → DEPLOY/EXPORT).
  - **New workspace `@vedmoulya/app-factory`** (`packages/app-factory`) following the
    frozen layering (types → contracts → domain → infrastructure → application →
    catalog). The factory executes NO AI directly and rebuilds NO platform
    capability: every specialist call flows through the same `AIOrchestratorSpecialistPort`
    the loop uses (AI-SELECT / EI-002 / EI-004 / EI-003 / Evidence-First), tools through
    the frozen ToolRuntime, and the generation loop through the **EPIC-006 LoopEngine**
    (a backward-compatible optional pre-built `graph` input carries the application task
    graph). Build-vs-adopt audit: `09_Documents/EPIC_007_ADOPTION_AUDIT.md` — no blind
    adoption (agents/hosted generators/builder platforms REJECTED; scaffolding
    conventions ADAPTED; AST patchers + deployment WRAPPED behind seams).
  - **Phases 1–4:** `SpecificationEngine` (typed `ApplicationSpecification`; unresolved
    requirements never silently assumed), `ArchitectureEngine` (technology-aware, not
    vendor-locked), `TaskGraphBuilder` (application task graph → loop graph, sequential +
    parallel waves), reusable specialist roles (logical capabilities, not hardcoded
    providers).
  - **Phases 5–9:** deterministic `generateProject` (typed, structured, testable,
    lintable, buildable) + `FileOperationLayer` (READ→PLAN→PATCH→TEST→REVIEW;
    create/modify/delete/rename with rollback + full audit trail) + `ExecutionPolicy`
    (READ_ONLY allowed / SAFE_WRITE controlled / DESTRUCTIVE_WRITE blocked unless
    authorized / NETWORK+DATABASE+CODE_EXECUTION blocked / SECRET_ACCESS prohibited /
    DEPLOYMENT explicit — no arbitrary shell/fs/network/package execution).
  - **Phases 7–8:** `BlueprintService` (source of truth) + `PlanPreviewService` — **Phase 8
    approval gate: no files are generated until the user approves the plan**.
  - **Phases 10–12:** `ValidationPipeline` (deterministic gates + bounded auto-fix),
    `UIQualityEvaluator` (responsive/a11y/consistency/empty-loading-error states),
    `SecurityReviewer` (**CRITICAL/HIGH findings block completion**).
  - **Phases 13–17:** `ApplicationRegistry` (DRAFT→…→ARCHIVED), per-application
    **isolated workspaces** (Phase 14 — cross-contamination prevented by construction),
    version control that **never auto-pushes** (Phase 15), vendor-neutral
    `DeploymentAdapterPort` (Phase 16 — local implemented, Vercel declared; explicit
    authorization required), `EconomicsTracker` (Phase 17 — estimate-before vs actual).
  - **Phase 18:** first three validation applications — ABAP Debugger, Restaurant App,
    AI App Builder — all pass the full pipeline (deterministic, not faked).
  - **Phase 20 API + UI:** `factory.*` tRPC namespace (create/approve/build/status/
    getDetail/deploy/list/vcInit/vcBranch/vcCommit/vcDiff/vcPreparePullRequest/vcHistory
    behind auth + IDOR + rate limits + zod) + `/applications` execution experience (goal →
    plan → approve → build → validation → security → files/ops → VCS → deploy).
  - **Phase 19 benchmark** (`npm run factory:benchmark`): spec accuracy 3/3, build 3/3,
    tests 3/3, security blocks 0/3; honest overhead measured (~18 specialist calls / ~3 780
    tokens / ~$0.03 per generated application) vs human intervention reduced to plan
    approval.
  - **Validation:** app-factory **83 tests** (93.42% stmts / 81.81% branches / 95.08%
    funcs) · gateway registry **31 tests** incl. the full `factory.*` lifecycle ·
    loop-engine **106 tests** (pre-built graph backward compatible) → coverage gate
    **32/32 workspaces ≥80%** · lint 0/0 · typecheck 0 · build + bundle budgets PASS ·
    audit 0 vulns. Honest limitations: in-memory workspaces + VCS journal (real fs/git
    behind seams); generated projects are validated structured projects (production
    deployment = operator step); no live external DB/provider execution (no Docker/WSL).
    Docs: `09_Documents/EPIC_007_{ADOPTION_AUDIT,ARCHITECTURE,APPLICATION_BLUEPRINT,
SECURITY_MODEL,EVALUATION,COMPLETION_REPORT}.md`.
- **EPIC-006 — Orchestrated AI / Loop Engine** (2026-08-08): a **controlled, measurable,
  evidence-first orchestration engine** — not a chatbot, not a generic autonomous agent.
  Solves complex goals by UNDERSTOOD → DECOMPOSED → ASSIGNED TO SPECIALISTS → EXECUTED →
  EVIDENCE-CHECKED → CRITIQUED → REFINED → VALIDATED → COMPLETED, using the **existing AI
  Runtime rather than bypassing it**.
  - **New workspace `@vedmoulya/loop-engine`** (`packages/loop-engine`) following the
    frozen layering (types → contracts → domain → infrastructure → application →
    catalog). The loop executes NO AI directly: every specialist call goes through
    `AIOrchestratorSpecialistPort` (AI-SELECT / EI-002 / EI-004 / Evidence-First via the
    frozen `AIOrchestrationService`), RAG through `RagSearchPort`, tools through
    `ToolRegistryToolPort` (frozen `ToolRuntime`) — **no provider SDK imported by the
    loop, no capability duplicated** (`09_Documents/EPIC_006_BASELINE_AUDIT.md`).
  - **Phase 1 Goal Understanding:** typed `GoalSpecification` (objective, constraints,
    required capabilities, evidence requirements, success criteria, risk level, budget
    envelope, latency preference, allowed tools, max iterations) derived deterministically
    with `derivationReasons`; underspecified goals suspend with
    `USER_CLARIFICATION_REQUIRED` instead of guessing.
  - **Phase 2 Task Decomposition:** typed `LoopTaskGraph` (task ID, dependencies, capability,
    input, expected output, evidence requirement, budget, timeout, retry policy, status)
    with dependency waves — **sequential and parallel tasks** supported.
  - **Phase 3 Specialist Selection:** per-task `explain()` selection through the frozen AI
    runtime — every selection is explainable in the trace (capability/model/provider,
    reason, tokens, cost).
  - **Phase 4 Loop Engine:** bounded loop PLAN→EXECUTE→OBSERVE→EVALUATE→CRITIQUE→REFINE→
    RE-EXECUTE→VERIFY→COMPLETE with **six hard budgets** (max iterations, tokens, cost,
    latency, provider calls, tool calls) checked BEFORE the next call — the loop
    terminates before exhaustion, never after. Absolute `maxLoopGuard` safety valve.
  - **Phase 5 Critic/Evaluator:** deterministic `CriticEvaluator` (completion, evidence,
    unsupported claims, required sections, min length, schema via the frozen
    `StructuredOutputValidator`, format, token bound, security) returning
    **PASS | FAIL | PARTIAL | ABSTAIN** — the same model can never blindly declare its
    own answer correct because the deterministic gate always runs first.
  - **Phase 6 Evidence-First loop:** INSUFFICIENT_EVIDENCE → retrieve more (bounded),
    CONFLICTING_EVIDENCE → investigate conflict, SUPPORTED → continue, unsupported claim
    → reject/refine; max iterations → bounded incomplete/abstention result. Never
    manufactures certainty.
  - **Phase 7 Adaptive loop:** `RefinementPlanner` decides WHY another iteration is needed
    (missing evidence → RAG task; weak reasoning → reasoning task; bad code → coding task;
    conflicting evidence → verification task; invalid output → structured fix; missing
    requirement → clarification) — never simply calls the same model repeatedly.
  - **Phase 8 Cost/token optimization:** every task runs with EI-003 optimization;
    `LoopBudget` tracks input/output/total tokens, estimated cost, latency, provider calls,
    tool calls, iterations; only minimum necessary state passes between tasks.
  - **Phase 9 Memory:** NEVER auto-writes intermediate results; transient execution state /
    evidence / final result are separated; only `proposedMemories` from a SUCCESS + PASS run
    are surfaced for **explicit user approval**.
  - **Phase 10 Security:** inherits auth + IDOR (user-scoped runs) + gateway rate limits +
    tool allowlists (echo, current_time, calculator) + schema validation + audit + timeout +
    cost limits; no arbitrary shell/filesystem/network/code execution; a denied tool aborts
    with SECURITY_BLOCK.
  - **Phase 11 Observability:** explainable execution trace per run (run ID, goal ID, task
    graph, iteration, selected capability, provider/model, tokens, cost, latency, evidence
    state, tool calls, critic result, retry, fallback, termination reason).
  - **Phase 12 Termination:** explicit `TerminationReason` — SUCCESS, BUDGET_EXCEEDED,
    ITERATION_LIMIT, TIMEOUT, EVIDENCE_INSUFFICIENT, EVIDENCE_CONFLICT, SECURITY_BLOCK,
    TOOL_FAILURE, PROVIDER_FAILURE, VALIDATION_FAILURE, USER_CLARIFICATION_REQUIRED,
    CANCELLED. Never silently terminates.
  - **Phase 13 First use cases** (declarative catalog, generic architecture):
    ABAP Debugger Assistant (understand → retrieve SAP knowledge → analyze → fix → static
    validation with the calculator tool → critique → final), Restaurant App Builder
    (requirements → architecture → UI plan → implementation plan → critique → refinement),
    General AI App Builder (requirements → architecture → capabilities → implementation →
    validation).
  - **Phase 14 API:** `loop.*` tRPC namespace — start, status, getTrace, cancel, resume,
    listRuns, listPatterns — behind auth + IDOR + rate limits; internal engine details
    never exposed (DTO boundary).
  - **Phase 15 UI:** `/loop` execution experience — goal → plan → current task → AI
    specialist → evidence → critique → iteration → result; shows WHY VedMoulya is doing
    this without raw model internals; cancel/resume, clarification, recent runs, dark mode.
  - **Phase 16 Testing:** 13 loop-engine test files / **106 tests** (simple goal, multi-step,
    parallel waves, dependency graph, provider failure, timeout, RAG failure, insufficient
    evidence, conflicting evidence, critic failure, budget exhaustion, iteration exhaustion,
    tool denial, security violation, structured output failure, successful refinement) +
    gateway `loop.*` end-to-end in the router-registry suite (30 tests). Proven: **no
    infinite loops, no uncontrolled provider calls, no uncontrolled tool calls, no budget
    overrun**.
  - **Phase 17 Measurement:** new `npm run loop:benchmark` (`scripts/loop-benchmark.ts`) —
    hermetic, deterministic, same model in both paths. Measured: single-model **3/9** vs
    orchestrated **7/9** goal success; first-pass success 4/6; avg iterations 1.44; avg
    tokens 160 vs 1 240; avg cost $0.0002 vs $0.0015; avg latency 4ms vs 31ms; evidence
    sufficiency 8/9; abstention 1/9. **Honest reading:** orchestration is NOT universally
    better — it costs more on easy first-shot-correct goals (measured) but converts
    failures into successes (refinement, evidence retrieval, conflict investigation, retry)
    and terminates explicitly under pressure — never silently, never infinitely. Measured
    limitation: the deterministic critic cannot detect semantic defects that satisfy every
    section check (false-acceptance probe) — documented, not hidden; the model-critique
    enhancement is the planned follow-up.
  - **Validation:** loop-engine coverage **93.93% statements / 82.6% branches / 95.83%
    functions / 94.02% lines** (≥80%) → coverage gate now **31/31 workspaces ≥80%**; lint
    0/0; typecheck 0; `next build` + bundle budgets PASS; `npm audit --omit=dev` 0
    vulnerabilities; full suite 0 failures.
  - Docs: `09_Documents/EPIC_006_{BASELINE_AUDIT,ARCHITECTURE,LOOP_ENGINE,EVALUATION,
COMPLETION_REPORT}.md`; MASTER_ROADMAP / PROJECT_STATUS / CHANGELOG / README /
    task_progress synchronized. Verdict **🟢 GREEN — EPIC-006 COMPLETE**. Remaining honest
    limitations: no live external DB/provider execution on this machine (WSL has no distros
    → Docker engine cannot start — same constraint as AI-RUNTIME-003); real-data loop
    calibration and the model-critique enhancement are follow-ups.

- **AI-RUNTIME-003 — Production AI Calibration, Live RAG Validation & Runtime Intelligence Hardening** (2026-08-08):
  moved the AI runtime from _implementation verified_ to _measured and calibrated_.
  **Zero architectural change** to the frozen AI-RUNTIME-002 design — no engine rebuilt,
  no second RAG/optimizer/router created.
  - **RAG quality calibration** — new `npm run rag:calibrate` (`scripts/rag-calibrate.ts`):
    an 11-query dataset (exact, semantic, ambiguous, irrelevant, duplicate, conflicting,
    stale, multi-document, prompt-injection, tenant-isolated) swept across minScore ×
    topK. Best measured config **minScore 0.3 / topK 3 → precision 0.875 (↑43.2% vs
    the 0.611 eval baseline), recall 1.000, rejection 1.000, authz 1.000, sufficiency
    1.000** on the calibration corpus. The global default **0.2 is retained by evidence**
    (at 0.3 the existing eval/smoke corpora lose recall + sufficiency); 0.3 is
    documented as a per-query/per-collection precision option.
  - **Provider routing calibration** — new `npm run provider:calibrate`
    (`scripts/provider-calibrate.ts`): 7 task-type scenarios (complex reasoning, simple,
    coding, structured extraction, low-cost, vision, latency-first) × candidate pool —
    **45 checks, 0 failures**, every decision deterministic + explainable via
    `ai.explainSelection`. **Measured defect fixed in `ProviderRoutingAdvisor`:** the
    `latency-first` strategy could still select an 18× slower provider because the
    benchmark/context edge outweighed the doubled latency weight; the latency weight
    was raised (×4 vs balanced) with regression tests.
  - **Evidence-First accuracy evaluation** — new `npm run accuracy:evaluate`
    (`scripts/accuracy-evaluate.ts`): 12 checks through the real runtime — abstention
    on unsupported/conflicting/stale evidence, conflict surfaced, prompt-injection
    content inside retrieved documents handled, no fabricated answers.
  - **Input-optimization calibration** — `scripts/token-benchmark.ts` extended: mean
    end-to-end latency (13ms hermetic) + a budget-breach guard proving an infeasible
    token budget is **rejected after compression, never silently truncated**; the
    41.6% mean context-reduction benchmark with 6/6 required evidence preserved
    holds.
  - **Live RAG operator tooling** — new `npm run rag:pg:verify`
    (`scripts/rag-live-verify.ts`): executes the complete Postgres/pgvector path
    (migration → schema → ingest → embed → persist → vector retrieval → tenant/user
    isolation → rollback/readiness) when `DATABASE_URL` + `AUTH_JWT_SECRET` are
    configured, and exits 0 with a clear `SKIPPED` message otherwise — **never
    silently falls back to in-memory repositories in production**.
  - **Real-world 20-scenario matrix** — new `npm run matrix:realworld`
    (`scripts/realworld-matrix.ts`): **20/20 scenarios, 25 checks** through the real
    runtime pipeline — simple, complex reasoning, coding, SAP/ABAP, business
    analysis, knowledge retrieval, user-specific, grounded, unsupported (abstain),
    conflicting (abstain), long-context (optimized), low-token-budget, provider
    failure (retry-recover), provider timeout (fallback), provider 429 (retry-recover),
    RAG failure (abstain when grounding required), cache hit, cache miss,
    structured output, streaming (full stage sequence).
  - **Measured-and-rejected calibrations** (frozen values retained with evidence —
    documented, not hidden): a tighter conflict-similarity band `[0.45, 0.85]` was
    rejected because genuine short conflicts (0.306 similarity) sit within 0.011 of
    complementary evidence (0.317) — a similarity-only band cannot separate them, and
    missing a genuine conflict is unacceptable for Evidence-First (a false conflict
    abstains safely; documented known limitation); the `minConflictRelevance` floor
    change to 0.25 was rejected because it re-introduced false conflicts from
    irrelevant low-score docs in the eval corpus (0.3 retained).
  - **Tool runtime + observability validation:** the existing ToolRuntime (24 tests),
    AIObservability (29), FailureSafety (20) and AISecurity (20) suites were
    re-verified green — no gaps found, no duplicate implementation added.
  - **Validation:** full suite **6 604 tests / 511 files — 0 failures**; coverage gate
    **30/30 workspaces ≥80%**; ESLint 0 errors / 0 warnings; typecheck 0; `next build`
    - bundle budgets PASS; `npm audit --omit=dev` 0 vulnerabilities.
  - Docs: `AI_RUNTIME_003_{BASELINE_AUDIT,RAG_CALIBRATION,PROVIDER_CALIBRATION,
ACCURACY_EVALUATION,Completion_Report,EVIDENCE}.md`; MASTER_ROADMAP / PROJECT_STATUS
    / README / task_progress synchronized. Verdict **🟢 CONDITION-FREE PRODUCTION
    APPROVED**. Remaining honest limitation: no live external DB/provider execution on
    this machine (WSL has no distros → Docker engine cannot start); the production path
    is implemented + deterministically tested and the operator commands are documented.

- **AI-RUNTIME-002 CLOSEOUT — Condition-Free Production Approval** (2026-08-08):
  every condition from the closeout mission (C-01…C-12 + Phases 13–15) resolved
  with executable evidence; verdict upgraded 🟡 READY WITH CONDITIONS →
  **🟢 CONDITION-FREE PRODUCTION APPROVED**.
  - **C-01 Production RAG/pgvector:** standalone `RAG_MIGRATION_001` (create
    extension/table/indexes + rollback, idempotent), `ensureRagReady` fail-fast
    gate (migrate + verify schema queryable) wired into the gateway for
    production/staging, `checkRagHealth`/`isRagReady` health + readiness checks,
    docker-compose upgraded to `pgvector/pgvector:pg16`.
  - **C-02 RAG smoke:** `npm run ai:smoke` — hermetic full-pipeline smoke
    (ingest → chunk → embed → persist → retrieve → rank → optimize → runtime →
    provider → grounded response; 26 checks, no secrets) plus `npm run
ai:smoke:live` for real credentials (operator-run, never falsely claimed).
  - **C-03 Observability:** `AIObservability` abstraction — NOOP/TEST/OTel/Langfuse
    exporter seams, request-ID correlation, user/tenant correlation opt-in,
    secret redaction + configurable payload capture; spans for run/retrieval/
    evidence/optimization/model-selection/provider/retry/fallback/validation.
  - **C-04 Secure tool runtime:** `ToolRuntime` — typed ToolDefinition/Request/
    Result, ToolRegistry with capability → user/tenant authorization → policy →
    schema validation → timeout/cancellation → rate limit → output validation →
    audit; allowlist/denylist; safe pure tools only (echo, current_time,
    calculator — no shell/fs/network/db surface).
  - **C-05 Failure safety:** `FailureSafety.test.ts` — 16 failure modes proven
    (DB/vector/embedding unavailable, retrieval/provider timeout, 429/5xx,
    malformed output, insufficient/conflicting evidence, token/context budget
    exceeded, unauthorized context, cache failure, telemetry failure, tool
    authorization failure).
  - **C-06 Security:** `AISecurity.test.ts` — prompt injection, indirect
    injection via retrieved documents, cross-user cache access, cross-tenant
    retrieval/IDOR, secret/telemetry leakage, tool authorization bypass, SSRF
    surface, unsafe tool arguments, malicious structured output, oversized
    input; no P0/P1 remains.
  - **C-07 Production configuration:** `validateProductionAIConfig` fail-fast
    validator (provider key, RAG DB, token budgets, timeout, tool policy);
    `.env.production.example` expanded (AI_MAX_INPUT/OUTPUT_TOKENS,
    AI_PROVIDER_TIMEOUT_MS, AI_TOOL_ALLOWLIST, AI_PROMPT_CACHE_ENABLED,
    AI_ENABLE_MOCK=false, AI_RUNTIME_LEGACY_RAW_FETCH=false); dev mocks never
    silent in production.
  - **C-08 Real provider path:** test-proven production config registers the
    Vercel AI SDK adapter; raw-fetch requires explicit opt-in.
  - **C-09 RAG quality:** `npm run rag:eval` — deterministic labeled dataset;
    measured baseline: precision 0.611, recall 1.000, irrelevant rejection
    0.878, authorization filtering 1.000, evidence-sufficiency accuracy 1.000.
  - **C-10 Token optimization:** `npm run ai:benchmark` — 3 cases, mean 41.6%
    context saved, 6/6 required evidence preserved (lower tokens ≠ lower
    quality).
  - **C-11 Structured output:** malformed/partial/schema-mismatch/retry/safe-
    failure coverage; no raw LLM output becomes truth unvalidated.
  - **C-12 End-to-end:** `EndToEndPipeline.test.ts` — full production path for
    both `orchestrate()` and `stream()` (auth → RAG → evidence → AI-SELECT →
    optimize → model → budget → SDK → provider → structured → quality →
    telemetry → typed response → UI).
  - **Phase 13 UI/UX:** `AICompanion.test.tsx` (9 tests) — runtime stage
    mapping/labels, streamed chunk reveal, provider chip, error path (no raw
    exception, no misleading success), abstention display, no infinite spinner;
    web vitest project gains the react JSX transform for component tests.
  - **Phase 14 gates (final run 2026-08-08):** full suite **6 601 tests /
    511 files — 0 failures** · coverage **30/30 ≥80%** · lint 0/0 · typecheck 0
    · `next build` PASS · bundle budgets PASS · `npm audit --omit=dev` 0 vulns.
  - **Phase 15 docs:** `AI_RUNTIME_002_CONDITION_AUDIT.md` updated to the
    post-remediation resolved state; `AI_RUNTIME_002_CONDITION_FREE_CERTIFICATION.md`
    created (initial conditions, audit findings, fixes, per-capability
    verification, measured results, condition-resolution matrix, honest
    limitations, final verdict 🟢).
  - **Honest limitations:** live external provider/DB verification is a
    documented operator step (`npm run ai:smoke:live`; apply RAG_MIGRATION_001
    on a real Postgres) and is distinguished from implementation verification;
    real-data calibration is a follow-up.

- **AI-RUNTIME-002 — SDK Runtime, Intelligent Provider Routing & Context Optimization** (2026-08-07):
  converts the AI runtime from reliable provider-independent execution into
  intelligent, observable, optimized, provider-aware execution. Verdict 🟡 READY
  WITH CONDITIONS (upgraded to 🟢 on 2026-08-08 — see closeout above).
  - **Vercel AI SDK integrated (real, primary path):** `ai` v7 + `@ai-sdk/openai`
    installed; `VercelAIProvider` (services/orchestrator) executes generateText /
    streamText / Output.object / embedMany behind the frozen `ProviderAdapter`
    boundary. Business engines never import provider SDKs. Usage accounting,
    finish-reason/model metadata, abort-timeout, 429/5xx/401 error normalization.
    Raw-fetch `OpenAIProvider` retained only behind explicit
    `AI_RUNTIME_LEGACY_RAW_FETCH=true`.
  - **Production RAG (`@vedmoulya/rag`, new workspace):** deterministic chunking,
    embedding provider contract + OpenAI SDK embeddings, `InMemoryRagRepository`
    (hermetic test double) and `PostgresRagRepository` (pgvector-ready JSONB
    schema, migration-ready), application service with vector→keyword fallback,
    `rag.*` tRPC namespace (ingest/search/stats/delete) behind auth + IDOR +
    rate limits, wired into `AIOrchestrationService` through a failure-tolerant
    `RagRetrievalPort`.
  - **AI input optimization activated in the real runtime:** EI-003
    (rank → filter → deduplicate → compress → token estimate → budget check)
    via `ContextOptimizer`, measured in `TokenOptimizationResult`
    (original/final tokens, tokens removed, compression ratio, cost estimate,
    strategy, budgetBreached). No silent truncation; budget overage reported.
  - **Intelligent provider routing:** `ProviderRoutingAdvisor` consumes EI-002
    provider intelligence + EI-004 execution strategy ports — health gate,
    capability compatibility, context-window fit, cost-vs-budget, latency,
    strategy preference (quality/cost/latency-first + preferred providers),
    deterministic fallback chain, typed `ProviderSelectionExplanation` with
    human-readable reasons; `explainSelection` runtime method + `ai.*` exposure.
  - **Prompt caching:** `PromptCacheManager` separates stable context from the
    dynamic request tail; tenant/user-scoped keys, TTL, hit/miss telemetry,
    graceful fallback; stable-prefix reuse verified (cache key parity fix).
  - **Streaming + structured output:** full IDLE→THINKING→PREPARING_CONTEXT→
    SELECTING_MODEL→STREAMING→VALIDATING→COMPLETED stage sequence through
    `stream()`; schema-validated `generateStructured` via `Output.object` with
    bounded retry and fallback (never trusts unvalidated model JSON).
  - **Evidence-First foundation (Phase 8):** `EvidenceEvaluator` measures
    groundedness deterministically and classifies it as SUFFICIENT_EVIDENCE /
    PARTIAL_EVIDENCE / INSUFFICIENT_EVIDENCE / CONFLICTING_EVIDENCE (evidence
    availability, mean relevance, source authority, source freshness,
    n-gram conflict detection). When a request sets `groundingRequired: true`
    and evidence is insufficient or conflicting, `orchestrate()` returns a
    typed abstention response — the runtime NEVER fabricates a grounded answer
    (`ai.abstention.count` metric). Evidence is attached to every RAG-backed
    response (`evidence` DTO field); `groundingRequired` flows through
    `ai.orchestrate`/`ai.stream` zod schemas.
  - **AI-SELECT (Phase 3):** `ContextOptimizer` returns a per-item
    `ContextSelectionExplanation` (selected/excluded, relevance score, tokens,
    human-readable reasons) so the runtime explains WHY each context item
    reached the model and what was dropped.
  - **AICompanion UX:** runtime-stage indicators (thinking/context/model/
    streaming/validating/error/fallback), no raw stack traces, mobile + dark
    mode preserved.
  - **Live smoke test:** `scripts/ai-live-smoke.ts` (`npm run ai:smoke:live`) —
    documented operator-run procedure; exits deterministically without keys.
  - **Coverage raised:** `packages/rag` 71.42→80.27%, `packages/services`
    79.56→80.28%, `services/orchestrator` 79.8→88.46% branch (new advisor,
    validator, SDK-adapter, embedding and RAG branch tests; abort-timer
    unhandled-rejection fixed).
  - **Evidence-First hardening (post-review):** grounding-required requests
    never hit the request cache (fresh evidence always; a cached fabricated
    answer can never be served for a grounding-required task);
    `groundingRequired` without `ragQuery` is rejected; RAG retrieval failure
    on a grounding-required task abstains (INSUFFICIENT evidence); `stream()`
    honours the same evidence contract; AI-SELECT `contextSelection` is
    attached to orchestrate/stream responses.
  - **Validation:** full suite **6 441 tests / 502 files — 0 failures**;
    coverage gate **30/30 ≥80%**; lint 0/0; typecheck 0; `next build` +
    bundle budgets PASS; `npm audit --omit=dev` 0 vulnerabilities.
  - Docs: `AI_RUNTIME_002_BASELINE_AUDIT.md`, `AI_RUNTIME_002_Completion_Report.md`,
    `AI_RUNTIME_002_EVIDENCE.md`; MASTER_ROADMAP / PROJECT_STATUS / README /
    task_progress synchronized (drift audit executed). Next: AI-RUNTIME-003
    (telemetry exporters, tool runtime, RAG hardening) or fold into APP-002.
- **AI-RUNTIME-001 — Production AI Readiness & Roadmap Reconciliation** (2026-08-07):
  full audit of every real AI path (no completion report trusted blindly).
  - **P0 fixed — gateway AI provider wiring:** `ApiApplicationService` constructed
    `AIOrchestrationService` with zero provider adapters registered, so every real
    AI call (Content Agency generation, ClientOps proposal drafting, Career/
    Business/Learning/Marketplace insight assemblies) threw
    `NotFoundError('Provider', …)` at runtime. The gateway now calls
    `registerPlatformProviders(this.ai)` — MockProvider in non-production
    environments, OpenAIProvider when `OPENAI_API_KEY` is present, and production
    never silently serves synthetic responses (mock requires `AI_ENABLE_MOCK=true`).
    `createOrchestrator()` now honors its config. Verified by new production-wiring
    tests + a real end-to-end gateway `orchestrate` smoke test.
  - **New `ai.*` tRPC namespace** — the canonical AI execution contract: `orchestrate`,
    `listProviders`, `listCapabilities`, `getProviderHealth`, `getAllProviderHealth`
    behind auth + IDOR + tiered rate limits + zod validation, with typed DTO returns.
  - **Token economics enforced:** new `TokenEstimationService` in `@vedmoulya/ai`
    (deterministic 4-char/token + message overhead + priming); `maxInputTokens` added
    to `OrchestrateRequestDTO` and the `ai.orchestrate` schema; the orchestrator
    estimates input tokens before any provider call and fails cheaply on budget
    breach; `ai.tokens.estimated` metric.
  - **Provider reliability:** OpenAI adapter now aborts hung requests (60s default,
    10s health check) and reports retryable timeouts.
  - **AICompanion wired to the real runtime** (was a canned/demo component): real
    `ai.orchestrate` calls with thinking/error states.
  - New tests: gateway registry `ai.*` end-to-end, provider wiring, orchestrator
    production-mock suppression, provider timeout, token estimation (4), budget
    guard (3). Full suite **6 321 tests / 489 files — 0 failures**; coverage gate
    **29/29 workspaces ≥80%**; lint 0/0; `next build` PASS.
  - Verdict 🟡 READY WITH CONDITIONS — conditions documented with owners + next
    actions in `09_Documents/AI_RUNTIME_001_Completion_Report.md`; next sprint
    AI-RUNTIME-002 (SDK-backed runtime + intelligent provider routing).

- **OS-003 — Version 1.0 Freeze & Release** (2026-08-07): the VedMoulya
  Operating System is **frozen at v1.0.0**. This is a release-engineering and
  architecture-freeze sprint — no new engines, no new business modules, no new
  dependencies.
  - **Version Manifest** — `03_Architecture/VEDMOULYA_V1_VERSION_MANIFEST.md`:
    version 1.0.0, release commit `dd4dffd`, all 35 workspaces at 1.0.0, engine
    versions, API version, database migration version, UI version, provider
    adapter versions, runtime/build/environment requirements.
  - **Public Platform Contract** — `03_Architecture/VEDMOULYA_PLATFORM_CONTRACT.md`:
    what the OS provides / does not provide, engine boundaries, integration
    contracts, extension points, provider/capability/knowledge/memory/execution/
    application integration.
  - **Architecture Freeze Record** — `03_Architecture/ARCHITECTURE_FREEZE.md`:
    frozen components, interfaces, dependencies, allowed extension points,
    breaking-change policy (ADR + impact + migration + version + regression),
    versioning rules.
  - **API Contract Snapshot** — `03_Architecture/API_V1_CONTRACT.md`: all 27
    production namespaces with purpose, procedures, auth, authorization, rate
    limits, validation, response/error contracts.
  - **Database Release Record** — `03_Architecture/DATABASE_V1.md`: schemas,
    tables, indexes, constraints, migrations, repositories, seed data,
    production/development requirements, backup/recovery expectations.
  - **Environment Contract** — `07_Operations/ENVIRONMENT_V1.md`: dev/test/
    staging/prod matrix, required env vars, secrets, external services,
    build/deploy commands, health checks, reproducibility.
  - **Release Engineering** — `docs/OS-003_Release_Engineering.md`: release
    scripts, versioning, build process, migration/seed process, health checks,
    rollback/backup/recovery procedures, CI validation, reproducibility.
  - **Tracking documents** — `CURRENT_STATE.md`, `FEATURE_MATRIX.md`,
    `IMPLEMENTATION_STATUS.md`, `REQUIREMENTS_TRACEABILITY.md` created and
    synchronized to the frozen state.
  - **Roadmap transition** — MASTER_ROADMAP + PROJECT_STATUS transitioned from
    OS FOUNDATION BUILD to **OS v1.0 FROZEN**, separating the FROZEN OS from
    POST-V1 APPLICATIONS (EPIC-006 — Application Platform, APP-001 Application
    Factory).
  - **Final certification** — `09_Documents/OS-003_V1_Release_Report.md` with
    the final verdict **🟢 VEDMOULYA OS v1.0 FROZEN**.
  - **Git release** — tag `v1.0.0` on commit `dd4dffd` (not pushed externally).
  - **Scheduled OS health-pass cadence** — `services/api` gains an operational
    scheduler (`startOSHealthScheduler`) that runs the existing `os.dashboard`
    pass on a fixed interval (default 5 minutes, `OS_HEALTH_INTERVAL_MS`
    overrides, `OS_HEALTH_SCHEDULER_ENABLED=0` disables). Each pass persists a
    health snapshot, so the OS snapshot history becomes a continuous
    monitoring feed. Reuses the runtime-metrics `setInterval` + `.unref()`
    pattern — no new dependency — with idempotent startup, overlap skipping,
    best-effort failure logging, and lazy boot from the tRPC route handler.
- **APP-001 — Context & Personal Intelligence Fabric** (2026-08-07): the
  first post-V1 application-platform sprint of **EPIC-006 — VedMoulya
  Application Platform**, consuming the frozen OS v1.0 contracts through
  narrow port seams (no frozen EI/OS contract modified). Verdict:
  **🟡 COMPLETE WITH CONDITIONS** (sole condition: the Storybook production
  build gate is red for the pre-existing upstream toolchain issue
  storybookjs/storybook#32301 — see below).
  - **New workspace `packages/context-fabric`** (`@vedmoulya/context-fabric`)
    following the frozen layering (types → contracts → domain →
    infrastructure → application → catalog).
  - **Personal Intelligence Graph** — user ↔ goals, projects, tasks, skills,
    knowledge, memories, documents, applications, preferences, work history,
    learning history and AI-interaction history, each with provenance,
    confidence, timestamps, source, permissions, lifecycle and relevance.
  - **Business / Enterprise Context Graph** — organization ↔ people, teams,
    clients, projects, processes, applications, documents, policies,
    knowledge and business capabilities, with membership-scoped access.
  - **Context Fabric** — unified abstraction over personal + enterprise
    context, memory, documents, knowledge, goals, tasks, projects,
    capabilities, execution history, permissions and provenance. Extends
    EI-003; does not replace it.
  - **Hybrid retrieval** — `RetrievalStrategy` interface combining keyword
    matching, graph-relationship boosts, memory relevance, recency and
    user/task relevance, with a deterministic ranker (no LLM required).
  - **Mandatory permission-aware pipeline** — identity → permission
    evaluation → eligible sources → retrieval → filtering → ranking →
    package (`PermissionEvaluationService`: ownership, organization
    membership, visibility scope, explicit deny; cross-user/cross-tenant
    denial tested).
  - **Provenance + explanation** — every item answers where/when/which
    source/why/confidence/permissions; `ContextExplanationService` produces
    human-readable “selected because…” reasons (basis for APP-004).
  - **`ContextFabricPackage`** — minimum-useful-context contract (request
    identity, goal/task refs, entities, relationships, memories, documents,
    capabilities, provenance, permissions, ranking scores, explanation,
    token/cost estimate, version) consumable by APP-002/003/004/006, the
    Execution Strategy and the Execution Orchestrator.
  - **Graph repository seam** — `GraphRepository` abstract interface with
    `InMemoryGraphRepository` (hermetic test double) and
    `PostgresGraphRepository` (JSONB, production default via
    `createProductionContextFabricRepository`) — a future graph backend is
    replaceable without touching domain/application contracts.
  - **API gateway:** `contextFabric.*` tRPC namespace — 11 procedures
    (getPersonalGraph, getBusinessGraph, search, getEntity, getRelationships,
    buildContextPackage, explainContextSelection, getProvenance,
    getPermissions, getSources, getHealth) behind auth + IDOR + rate-limit
    middleware, zod-validated, DTO boundaries.
  - **Web:** new `/context-fabric` Enterprise Context Fabric Explorer with
    eight tabs (Overview, Personal Graph, Business Graph, Search, Context
    Package, Provenance, Permissions, Diagnostics), lazy-loaded views
    (2.36 kB route bundle), real data flow, loading/empty/error states, dark
    mode, mobile-ready.
  - **Storybook:** `ContextFabric.stories.tsx` — 10 components with normal /
    empty / loading / error / restricted / high-volume states.
  - **Seed:** `scripts/seed-ei.ts` gains the 11th store
    (`context_fabric_graph` — 22 entities + 27 relationships referencing the
    seed goals/capabilities/contexts).
  - **Tests:** 9 package test files / 86 tests — coverage **93.17%
    statements / 81.14% branches / 97.08% functions**; gateway router +
    registry + production-wiring suites added. Full suite **6 309 tests /
    487 files, 0 failures**; coverage gate **29/29 workspaces ≥80%**
    (services/api function coverage closed 79.46% → 80.72% via the
    `contextFabric` registry test).
  - **Known condition:** `storybook build` exits 1 with
    `SB_BUILDER-WEBPACK5_0002` (“Cannot read properties of undefined
    (reading ‘tap’)”). Root cause is the **pre-existing** upstream
    incompatibility between Storybook 8.6.x and Next.js 15.5.22’s _bundled_
    webpack (storybookjs/storybook#32301) — reproduced with every APP-001
    story removed (not caused by this sprint), and only fixable by changing
    frozen dependency versions. Static output is complete; only the final
    compiler shutdown errors. Tracked in the APP-001 report §21.
  - Documentation: `03_Architecture/APP-001_Context_Fabric_Architecture.md`,
    `09_Documents/APP-001_Completion_Report.md`, MASTER_ROADMAP + PROJECT_STATUS
    - CHANGELOG + task_progress + README updated.
- **OS-001 — Enterprise Operating System Integration** (2026-08-07): the
  integration layer that turns the eleven Enterprise Intelligence Engines
  (EI-001…EI-010 + INT-001) into one Enterprise Operating System. It
  integrates, validates, optimizes and certifies the complete platform — no
  new engines, no redesigned architecture, no isolated components.
  - **New workspace `packages/os-intelligence`** (`@vedmoulya/os-intelligence`)
    following the EI-001…EI-010 layering (types → contracts → domain →
    infrastructure → application → catalog). It owns no engine — every engine
    is consumed through narrow `OSEngines` port contracts (the same seam
    pattern as `MemoryEngines`/`KnowledgeEngines`/`BrainEngines`).
  - **Engine registry:** one canonical catalog of all 11 engines — package,
    sprint, production repository and database table (no duplicated models,
    no isolated engines).
  - **Dependency matrix:** the package build graph (verified acyclic — the
    “no circular dependencies” gate) plus the runtime consultation graph (the
    integration matrix of who consults whom, with per-edge reasons).
  - **System health:** `OSHealthService` runs a live health pass over every
    engine port in parallel (fan-out, so end-to-end latency equals the slowest
    engine), measuring per-engine latency, data summaries and totals, and
    computes an **overall OS health score** (engines · dependencies · pipeline ·
    diagnostics).
  - **Pipeline validation:** `OSPipelineValidationService` validates the
    15-stage event flow — Goal → Project → Task Planning → Capability Selection
    → Knowledge Retrieval → Memory Retrieval → Provider Selection → Context
    Assembly → Decision → Execution Strategy → Execution Graph → Execution
    Session → Learning → Knowledge Update → Memory Update — every stage
    validated against the owning engine's live registry data.
  - **Cross-engine validation:** the nine integration pairs (Capability ↔
    Provider, Provider ↔ Context, Context ↔ Knowledge, Knowledge ↔ Memory,
    Memory ↔ Learning, Learning ↔ Brain, Brain ↔ Strategy, Strategy ↔
    Execution, Execution ↔ Learning).
  - **Diagnostics + platform validation:** `OSDiagnosticsService` battery
    (engine, dependency, contract, repository, pipeline, lifecycle, event-flow,
    ownership, database) and `OSValidationService.validatePlatform` — the
    definitive certification gate.
  - **Performance:** `OSPerformanceService` — end-to-end and per-engine latency
    measurement with total port-call counts.
  - **Persistence:** `OSRepository` contract with `InMemoryOSRepository`
    (hermetic test double) and `PostgresOSRepository` (`os_health_registry`
    JSONB table — persisted health snapshots, migration-ready, wired as the
    gateway production default via `createProductionOSIntelligenceRepository`).
  - **API gateway:** `os.*` tRPC namespace — 9 procedures (systemHealth,
    pipelineHealth, runDiagnostics, validatePlatform, engineStatus,
    dependencyGraph, performanceMetrics, dashboard, snapshots) behind auth +
    IDOR + rate-limit middleware, zod-validated.
  - **Web:** new `/os` Enterprise Operating System Dashboard with six tabs
    (Dashboard, Pipeline, Dependencies, Diagnostics, Performance, Snapshots),
    lazy-loaded views (50 kB budget), dark mode, mobile-ready.
  - **Seed:** `scripts/seed-ei.ts` now seeds the tenth store
    (`os_health_registry`, the certified-platform health snapshot).
  - **Tests:** 14 package test files / 138 tests + gateway router + production-
    wiring suites — full-suite green.
  - **Storybook:** `OperatingSystem/*` stories (`apps/web/src/stories/OS.stories.tsx`)
    documenting the shared presentational components (ScoreGauge, StatusBadge,
    StageBadge, SeverityBadge, EngineRow, StageRow, FindingRow, SnapshotRow).
  - Documentation: `03_Architecture/OPERATING_SYSTEM.md`,
    `09_Documents/OS-001_Completion_Report.md`, MASTER_ROADMAP + PROJECT_STATUS
    - CHANGELOG + task_progress updated.
- **EI-010 — Enterprise Memory Intelligence Platform** (2026-08-06): the tenth
  Enterprise Intelligence engine — the Enterprise Memory Layer of VedMoulya.
  It records, retrieves, ranks, compresses, consolidates and expires evolving
  experience across the entire operating system — not chat history, not a
  vector database, and not conversation memory. Knowledge (EI-009) remains
  authoritative facts; Memory is evolving experience; the two systems are
  architecturally separate but tightly integrated.
  - **New workspace `packages/memory-intelligence`**
    (`@vedmoulya/memory-intelligence`) following the EI-001…EI-009 layering
    (types → contracts → domain → infrastructure → application → catalog).
  - **The governance record:** `MemoryItem` captures WHAT VedMoulya remembers
    (type + title + content), WHERE it came from (source + 15 source types),
    WHO owns it (owner), WHAT it relates to (related goal/task/capability/
    provider/project/user/context/decision/execution), HOW much it matters
    (importance score + level + factors), HOW certain it is (confidence),
    HOW often it recurs (frequency), HOW fresh it is (recency), HOW used it is
    (usage count + consumers), WHERE it is in its life (lifecycle + compression
    state + retention policy + expiresAt), WHAT backs it (citations), WHAT links
    to it (relationships), and WHO did WHAT WHEN (audit trail).
  - **14 memory classes** (working, session, project, business, capability,
    provider, execution, decision, learning, context, user preference, failure,
    success, long-term) and **10 relationship types** (recalls, follows,
    precedes, supports, contradicts, supersedes, depends_on, similar_to,
    refines, produced_by).
  - **Domain services:** the full Memory Pipeline (Event → Capture →
    Classification → Importance Scoring → Consolidation → Relationship
    Detection → Ranking → Compression → Retrieval → Enterprise Brain →
    Execution → Learning → Memory Update), importance scoring, composite
    ranking, retrieval with 11 match modes (goal, project, user, capability,
    provider, context, time, importance, similarity, business module,
    keyword — deterministic, no LLM, no vector DB), compression (raw →
    compressed → summarized → collapsed), consolidation (duplicate merging),
    expiration (retention TTLs), lifecycle state machine (captured → validated
    → consolidated → ranked → compressed → active → archived → expired),
    analytics, citation verification, relationship detection, and reinforcement.
  - **`MemoryGraph` abstract interface** (future graph-storage seam) with
    in-memory and Postgres implementations (BFS traversal).
  - **Repositories:** `InMemoryMemoryRepository` (hermetic test double) and
    `PostgresMemoryRepository` (`memory_registry` JSONB table — items +
    relationships keyed by collection, indexed, migration-ready) +
    `createProductionMemoryIntelligenceRepository()`-ready wiring pattern.
  - **API gateway:** `memoryIntelligence.*` tRPC namespace — 23 procedures
    (capture, update, delete, getItem, listItems, retrieve, summarize,
    validate, consolidate, compress, expire, reinforce, transitionLifecycle,
    relate, detectRelationships, listRelationships, graph, shortestPath,
    listConsumers, recordConsumerUsage, getAnalytics, getTimeline,
    getDashboard) behind auth + IDOR + rate-limit middleware, zod-validated.
  - **Web:** new `/memory` Enterprise Memory Center with nine tabs (Dashboard,
    Explorer, Retrieval, Timeline, Relationships, Importance, Analytics,
    Compression, Retention), lazy-loaded views (50 kB budget), dark mode,
    mobile-ready.
  - **Seed:** `scripts/seed-ei.ts` now seeds the ninth store (`memory_registry`,
    23 memory items across all 14 types + 17 relationships referencing the
    seed goals/providers/capabilities/contexts/decisions).
  - **Tests:** 8 package test files / 111 tests (83.55% branches) + gateway
    router + production-wiring suites — full-suite green.
  - **Storybook:** `MemoryIntelligence/MemoryCard` stories
    (`apps/web/src/stories/MemoryIntelligence.stories.tsx`) documenting the
    shared presentational components (MemoryCard, ScoreBadge, LifecycleBadge,
    CompressionBadge, RetentionBadge, RelationshipRow, TimelineRow, ConsumerRow).
  - Documentation: `EI-010_Enterprise_Memory_Intelligence.md` sprint spec,
    `03_Architecture/MEMORY_INTELLIGENCE.md`,
    `09_Documents/EI-010_Completion_Report.md`, MASTER_ROADMAP + PROJECT_STATUS +
    CHANGELOG + task_progress updated.
- **EI-009 — Enterprise Knowledge Intelligence Platform** (2026-08-06): the
  ninth Enterprise Intelligence engine — the Enterprise Knowledge Layer of
  VedMoulya. It is the authoritative knowledge source used by every Enterprise
  Intelligence Engine and every future business module — not a document
  management system, not a vector database, and not another RAG library.
  - **New workspace `packages/knowledge-intelligence`**
    (`@vedmoulya/knowledge-intelligence`) following the EI-001…EI-008 layering
    (types → contracts → domain → infrastructure → application → catalog).
  - **The governance record:** `KnowledgeItem` captures WHAT VedMoulya knows
    (title/description/category/tags), WHERE it came from (source + 12 source
    types), WHO owns and uses it (owner + consumer registry), WHETHER it is
    trusted (trust score + confidence), WHETHER it is current (lifecycle +
    validation), WHAT depends on it (dependencies + relationships), and HOW it
    should be used (citations + usage statistics).
  - **14 knowledge categories** (business, technical, user, project, AI, SAP,
    client, domain, policy, document, API, architecture, learning, execution)
    and **10 relationship types** (parent, child, depends_on, related_to,
    implements, consumes, produces, supersedes, uses, owned_by).
  - **Domain services:** trust scoring (provenance/validation/citations/usage/
    recency/dependency-risk), composite ranking, eight-mode search (semantic —
    deterministic lexical-semantic ranker, no LLM, no vector DB — keyword,
    category, relationship, dependency, consumer, trust, version), relationship
    detection + graph integrity, validation reports, lifecycle state machine
    (draft → review → active → deprecated → archived), versioning + Knowledge
    Diff, analytics, citation extraction/verification, explainer, and engine
    enrichment.
  - **`KnowledgeGraph` abstract interface** (future graph-storage seam) with
    in-memory and Postgres implementations (BFS traversal + shortest path).
  - **Repositories:** `InMemoryKnowledgeRepository` (hermetic test double) and
    `PostgresKnowledgeRepository` (`knowledge_registry` JSONB table — items,
    relationships, versions, consumers — indexed, migration-ready) +
    `createProductionKnowledgeIntelligenceRepository()`-ready wiring pattern.
  - **API gateway:** `knowledge.*` tRPC namespace — 24 procedures (create,
    update, delete, getItem, listItems, search, explain, validate, createVersion,
    listVersions, getVersion, diff, relate, detectRelationships,
    listRelationships, graph, shortestPath, listConsumers, recordConsumerUsage,
    listDependencies, transitionLifecycle, getAnalytics, getTimeline,
    getDashboard) behind auth + IDOR + rate-limit middleware, zod-validated.
  - **Web:** new `/knowledge` Enterprise Knowledge Center with ten tabs
    (Dashboard, Explorer, Search, Relationships, Dependencies, Timeline,
    Versions, Trust, Analytics, Consumers), lazy-loaded views (50 kB budget),
    dark mode, mobile-ready.
  - **Seed:** `scripts/seed-ei.ts` now seeds the eighth store
    (`knowledge_registry`, 30 knowledge items across all 14 categories + 26
    relationships referencing the seed goals/providers/capabilities/contexts).
  - **Tests:** 17 package test files / 142 tests (93.2% statements, 81.7%
    branches) + gateway router + production-wiring suites — full-suite green.
  - **Storybook:** `KnowledgeIntelligence/KnowledgeCard` stories
    (`apps/web/src/stories/KnowledgeIntelligence.stories.tsx`) documenting the
    shared presentational components (KnowledgeCard, TrustBadge, RelationshipRow,
    VersionRow, TimelineRow, ConsumerRow).
  - Documentation: `EI-009_Enterprise_Knowledge_Intelligence.md` sprint spec,
    `03_Architecture/KNOWLEDGE_INTELLIGENCE.md`,
    `09_Documents/EI-009_Completion_Report.md`, MASTER_ROADMAP + PROJECT_STATUS +
    CHANGELOG + task_progress updated; the former `EI-009_Enterprise_Brain` plan
    re-designated to the memory/knowledge synthesis vision.
- **EI-008 — Enterprise Brain (Central Decision Intelligence)** (2026-08-06): the
  eighth Enterprise Intelligence engine — the highest decision-making layer of
  VedMoulya. It coordinates every Enterprise Intelligence Engine and **decides**;
  it never executes, never calls an LLM, and owns no engine.
  - **New workspace `packages/enterprise-brain`** (`@vedmoulya/enterprise-brain`)
    following the EI-001…EI-007 layering (types → contracts → domain →
    infrastructure → application → catalog).
  - **The 14 decisions:** `BrainDecision` captures one explained choice per run —
    goal priority, task priority, execution order, capability selection, provider
    selection, context strategy, execution strategy, budget strategy, quality
    thresholds, risk assessment, retry policy, fallback policy, learning feedback,
    and business objectives — each with a recommendation, composite confidence,
    decision context, lifecycle status, version, and audit history.
  - **Explainability:** every decision ships with why · evidence · confidence ·
    trade-offs · alternatives · risks (`BrainDecisionReason` + `BrainExplainerService`).
  - **Decision pipeline:** `BrainPlanService` traces Receive Goal → Analyze →
    Consult Goal/Learning/Capability/Provider/Context/Execution-Strategy engines →
    Generate Decision Plan → Explain → Pass to Execution Orchestrator (11 steps),
    producing one `BrainDecisionPlan` per goal with overall confidence.
  - **Human approval:** decisions and plans are born `proposed` and transition
    `proposed → approved → handed_off` (or `rejected` / `superseded`) through
    versioned, actor-scoped, audited transitions (`DecisionHistory`). A plan can
    only be handed to the orchestrator after its decisions are approved.
  - **Metrics + dashboard:** `BrainMetricsService` aggregates trend, per-type and
    per-status counts, and average confidence; the dashboard DTO carries totals,
    recent decisions, and recent plans.
  - **Persistence:** `BrainRepository` contract with `InMemoryBrainRepository`
    (hermetic test double) and `PostgresBrainRepository` (`brain_registry` JSONB
    table keyed by (collection, id) — decisions + plans, migration-ready, wired as
    the production default via `createProductionBrainRepository`).
  - **API gateway:** `enterpriseBrain.*` tRPC namespace — 14 procedures
    (decideGoal, plans, decisions, timeline, history, approve/reject decision,
    approve/reject/hand-off plan, metrics, dashboard) behind auth + IDOR +
    rate-limit middleware, zod-validated.
  - **Web:** new `/enterprise-brain` Enterprise Brain Dashboard with eight tabs
    (Dashboard, Explorer, Timeline, History, Analytics, Confidence, Comparison,
    Recommendations), lazy-loaded views (50 kB budget), dark mode, the live
    "decide a goal" pipeline runner, and the human-approval workflow.
  - **Seed:** `scripts/seed-ei.ts` now seeds the seventh store
    (`brain_registry`, 14 explained decisions + 1 plan referencing the seed
    goal/providers/capabilities/contexts).
  - **Tests:** 8 package test files / 94 tests (96%+ statements, 88%+ branches) +
    gateway router + production-wiring suites — full-suite green.
  - **Storybook:** `EnterpriseBrain/DecisionCard` stories (proposed / approved /
    with-actions), `PipelineStep`, `PlanCard`, `ConfidenceBadge` in
    `apps/web/src/stories/EnterpriseBrain.stories.tsx`.
  - Documentation: `EI-008_Enterprise_Brain.md` sprint spec,
    `03_Architecture/ENTERPRISE_BRAIN.md`, `09_Documents/EI-008_Completion_Report.md`,
    MASTER_ROADMAP + PROJECT_STATUS + task_progress updated.
- **EI-007 — Enterprise Learning Intelligence Platform** (2026-08-06): the
  seventh Enterprise Intelligence engine — VedMoulya now learns from every
  execution and improves itself over time.
  - **New workspace `packages/learning-intelligence`** (`@vedmoulya/learning-intelligence`)
    following the EI-001…EI-006 layering (types → contracts → domain →
    infrastructure → application → catalog).
  - **Learning signals:** a `LearningEvent` captures one observed outcome per
    run across 10 categories (provider, context, capability, prompt, budget,
    quality, execution, business, user preference, failure) with confidence,
    cost, latency, accuracy, retries, quality, feedback, business outcome, and
    a source reference (goal/task/session/pipeline/manual).
  - **Aggregation:** `LearningAggregationService` derives per-entity
    `LearningModel`s (success rate, averages, confidence from sample size,
    trend delta) plus per-category stats and a 14-day trend.
  - **Recommendations:** `LearningRecommendationService` generates the seven
    EI-007 recommendations — best provider, best context, best strategy, best
    capability, best budget, best prompt, best execution pattern — enriched
    from the live engine registries through narrow port contracts.
  - **Learning safety:** `LearningSafetyService` + `LearningDecision` enforce
    human approval, version history, rollback, audit trail, and confidence
    thresholds. Recommendations are born `pending` and never become actionable
    without explicit human approval.
  - **Insights + reports:** `LearningInsightService` (info/warning/critical)
    and `LearningReportService` (per-category reports with top and at-risk
    entities).
  - **Persistence:** `LearningRepository` contract with
    `InMemoryLearningRepository` (hermetic test double) and
    `PostgresLearningRepository` (`learning_registry` JSONB table,
    migration-ready, wired as the gateway production default via
    `createProductionLearningRepository`).
  - **API gateway:** `learningIntelligence.*` tRPC namespace — 14 procedures
    (record/list/get/timeline events, models, insights, recommendations,
    approve/reject/rollback, analytics, reports, dashboard) behind auth + IDOR
    - rate-limit middleware, zod-validated.
  - **Web:** new `/learning-intelligence` Enterprise Learning Intelligence
    Dashboard with six tabs (Dashboard, Explorer, Timeline, Insights,
    Recommendations, Analytics), lazy-loaded views (50 kB budget), dark mode,
    and the human-approval workflow in the Recommendations tab.
  - **Seed:** `scripts/seed-ei.ts` now seeds the sixth store
    (`learning_registry`, 54 events referencing the seed goals/providers/
    capabilities/context catalogs).
  - **Tests:** 10 package test files / 111 tests (97%+ statement coverage) +
    gateway router + production-wiring suites — full-suite green.
  - **Storybook:** `LearningIntelligence/LearningEventRow` stories
    (`apps/web/src/stories/LearningIntelligence.stories.tsx`) documenting the
    shared presentational event-row component (success / failure / budget
    signals) — built cleanly into `storybook-static`.
  - Documentation: `EI-007_Learning_Intelligence.md` sprint spec,
    `03_Architecture/LEARNING_INTELLIGENCE.md`, `09_Documents/EI-007_Completion_Report.md`,
    MASTER_ROADMAP + PROJECT_STATUS updated.
- **CERT-002 — Enterprise Certification Fix & Hardening** (2026-08-06): resolved
  every CERT-001 condition (C-01…C-06).
  - **B-01 / C-01 — Pipeline capability resolution fixed:** the Enterprise
    Intelligence Pipeline now resolves AI-feature names (`reasoning`, `coding`, …)
    to registry capabilities through a real translation layer
    (`PipelineBuilderService.requiredCapabilities` →
    `CapabilityApplicationService.findByAIFeatures`). All 5 seed catalog goals
    build a validated `ready` pipeline; the 4 previously failing tests
    (`IntelligenceApplicationService.test.ts`, `routers.test.ts`) pass.
  - **C-02 — Lint + build gates restored:** 308 source lint errors remediated;
    generated `out/` + `android/` assets excluded from ESLint; full-repo
    `eslint .` is 0 errors / 0 warnings. `next build` unblocked: the
    `node:*` built-in leak into the client bundle was eliminated by marking the
    8 pure EI/AI packages `sideEffects: false` and deep-importing `PIPELINE_CATALOG`;
    Storybook-named exports were extracted out of route pages into sibling
    `components.tsx` modules (`execution-strategy`, `goals`, `execution`); the
    `providers`, `execution`, and `goals` pages were split into lazy-loaded views
    to meet the 50 kB bundle budget.
  - **C-03 — Coverage gate restored:** coverage config added to
    `packages/intelligence`; `services/api` include pattern fixed; Postgres repo
    tests added; gate now passes **23/23** workspaces ≥80%.
  - **C-04 — Postgres repositories for the 5 in-memory EI packages:**
    `PostgresCapabilityRepository`, `PostgresContextRepository`,
    `PostgresExecutionStrategyRepository`, `PostgresGoalRepository`,
    `PostgresTaskRepository`, and `PostgresPipelineRepository` (JSONB-document
    pattern, matching `PostgresProviderRepository`). Exported from each package
    barrel and wired into the gateway as production defaults via new
    `createProduction{Capability,Context,ExecutionStrategy,Goal,Task,Pipeline}Repository()`
    factories in `services/api/src/infrastructure/ProductionRepositories.ts`.
    In-memory repositories remain the hermetic test double.
  - **C-05 — Dependency hygiene:** `hono` upgraded to `^4.12.34` across the five
    engine services (moderate CORS ReDoS advisory resolved; 9 → 8 findings). The
    remaining 8 findings are dev/build-toolchain (`vite` via Storybook peer
    conflict, `fast-uri` transitive) — tracked in `docs/CVE_TRACKING.md`.
  - **C-06 — Documentation accuracy:** README test counts corrected to the real
    suite size; MASTER_ROADMAP EI-006 entry updated to reflect the Postgres
    pipeline repository; `task_progress.md` synced.
  - **Final validation pass (2026-08-06):** full-suite re-run certifies
    **418 files / 5 506 tests — 0 failures** (exit 0), coverage gate **23/23**
    workspaces ≥80%, `eslint .` **0 errors / 0 warnings**, `next build` exit 0,
    bundle budgets exit 0. Closing fixes in this pass: 21 residual lint errors
    - 5 warnings in the new Postgres EI code (type-honest `| undefined` JSONB
      `??` guards, `Map`-based count aggregations, removed 6 dead in-memory
      fallbacks in `ApiApplicationService` so all six EI stores default to their
      production Postgres repositories); vitest full-suite teardown race
      (`Closing rpc while "onUserConsoleLog" was pending`) eliminated by no-op-ing
      the observability logger in the three gateway wiring suites; and a literal
      `\n` SQL defect in `PostgresExecutionStrategyRepository` count queries
      restored to real newlines. Full report:
      [`docs/CERT-002_Completion_Report.md`](./docs/CERT-002_Completion_Report.md).
  - **Follow-up:** the gateway `providers` store is now wired to
    `createProductionProviderRepository()` as well — all seven EI stores
    (capabilities, providers, context, execution-strategy, goals, tasks,
    pipeline) resolve Postgres-backed production repositories by default,
    completing the C-04 Postgres rollout.
  - **Follow-up:** `npm run seed:ei` (`scripts/seed-ei.ts`) loads the five EI
    seed catalogs (capabilities 13 · providers 7 · context 30 · strategies 4 ·
    goals 5) into their Postgres tables idempotently (`ON CONFLICT DO UPDATE`),
    so production EI registries start populated. Supports `--dry-run`,
    `--only=<store,…>`, and `EI_DATABASE_URL` overrides.

### Added

- **SPRINT PR-002B — Production Gateway Repository Wiring (all five engines)**
  (2026-08-02): mirrors the PR-002A identity wiring for the remaining four
  gateway engines — memory, decision, execution, and knowledge now resolve
  their production Postgres repositories (`PostgresMemoryRepository`,
  `PostgresDecisionRepository`, `PostgresExecutionRepository`,
  `PostgresKnowledgeRepository`) through each service module's existing DI
  registration instead of the in-memory test doubles. `ApiApplicationService`
  gains injectable `memoryRepository` / `decisionRepository` /
  `executionRepository` / `knowledgeRepository` overrides (backward
  compatible), `createProduction{Memory,Decision,Execution,Knowledge}Repository()`
  factories are exported, the four service packages were added to
  `services/api` dependencies and `apps/web` `transpilePackages`, and the
  shared vitest setup provisions the four engine `*_DATABASE_URL`s. The
  Map-backed in-memory repositories are retained exclusively as a hermetic
  test double. Regression tests cover factory resolution (DI reuse, singleton)
  and per-engine injection.

- **SPRINT PR-002A — Production Authentication Repository Wiring** (2026-08-02):
  - **Gateway authentication persistence wired to production**: `ApiApplicationService`
    now resolves the Identity engine's repository through the identity module's
    existing DI registration (`identity.repository` → `PostgresIdentityRepository`)
    instead of the in-memory dev repository — eliminating the last stub from the
    authenticated request path (`identity.getProfile` and friends now resolve
    `findById`/`findByEmail`/`save`/`update`/`delete` against Postgres). The
    repository is injectable (`new ApiApplicationService({ identityRepository })`)
    for tests, and `createProductionIdentityRepository()` reuses the identity
    service's DI wiring without duplicating registrations.
  - **Regression tests** (`services/api/src/__tests__/ProductionIdentityWiring.test.ts`):
    repository resolution (DI container → `PostgresIdentityRepository` singleton),
    repository injection (backward-compatible override), identity lookup
    (register → getUserById), authenticated profile retrieval through the real
    tRPC pipeline (JWT context → auth middleware → IDOR guard → router → service
    → repository), and JWT cross-service compatibility (identity `TokenService`
    access tokens verify in the gateway middleware; refresh tokens rejected).
  - **Web build wiring**: `@vedmoulya/identity` added to `transpilePackages` and
    `bcrypt` to `serverExternalPackages` so the Next.js server bundle can load
    the identity service's native dependency (SPRINT PR-002A).
  - **Lint gate restored for `InMemoryRepositories.ts`**: the pre-existing
    PR-002 repository file (untracked at sprint start) carried 104 errors /
    14 warnings (`require-await`, `no-unnecessary-type-conversion`,
    `no-unnecessary-condition`, `detect-object-injection`). Cleaned with
    justified file-level disables (sync Map-backed repos implementing
    Promise-returning interfaces; typed/closed-union key lookups), redundant
    `String()` coercions removed, and `countBy*` accumulators typed as
    `Partial<Record<...>>` so the `?? 0` fallback is type-honest. Repo-wide
    `npm run lint` is back to 0 errors / 0 warnings.

- **SPRINT PR-002 — Enterprise Operations & Production Excellence** (2026-08-01):
  - **Gateway per-request observability** (T1): request-metrics middleware in
    `services/api` records `api.requests.total` (throughput), `api.requests.latency_ms`
    (histogram), `api.requests.error` (error rate), and `api.ratelimit.hit` for every
    gateway procedure; regression tests assert both success and thrown-error paths
    (tRPC v11 `{ ok: false }` result handling).
  - **CORS hardening** (T8): the documented-but-unused `API_CORS_ORIGIN` is now
    enforced by all five service HTTP APIs (identity, decision, execution,
    knowledge, memory) via Hono `cors({ origin })` with a backward-compatible
    permissive `*` fallback for unset/empty/degenerate values.
  - **Operational scripts** (T6): `scripts/startup.sh` (env fail-fast validation,
    dev vs production modes, repo-root cwd), `scripts/shutdown.sh` (graceful
    SIGTERM then SIGKILL drain), and `scripts/backup.sh` (per-service `pg_dump`
    with `--db`/`--out` in both `--flag value` and `--flag=value` forms).
  - **Backup & DR documentation** (T7): `docs/runbooks/backup-restore-runbook.md`
    (RPO/RTO objectives, `pg_dump`/restore, schema rollback, environment recovery,
    restore-drill) and `docs/ops/SECRET_ROTATION.md` (secret inventory, rotation
    procedure, JWT rotation impact, schedules).
  - **Load-test harness fix** (T5): `scripts/load-test.mjs` `--output` path now
    uses `resolve()` so absolute paths work on Windows (was `D:\VedMoulya\C:\Users\…`
    ENOENT); verified against a live dev server.

- **SPRINT PR-001 — Production Closure** (2026-08-01):
  - `services/orchestrator` entry-point coverage: new `src/__tests__/index.test.ts`
    covering `createOrchestrator` (instance shape, MockProvider registration,
    `listProviders` contract, config acceptance); `src/index.ts` is now included
    in the coverage measurement (suite certified at 100/91.66/100/100).
  - **Documentation completion**: `docs/api/API_REFERENCE.md` (gateway tRPC
    routers + service OpenAPI endpoints), `docs/guides/DEVELOPER_SETUP.md`
    (dev environment, test/build/lint workflows, workspace inventory),
    `docs/guides/MODULE_REFERENCE.md` (apps/packages/services/scripts/CI map),
    `docs/ops/DEPLOYMENT_GUIDE.md` and `docs/ops/ROLLBACK_GUIDE.md`
    (production deploy/rollback procedures referencing the runbooks).

- **Hardening pass — 100/100 project gap closure** (2026-08-01):
  - **Functional gateway repositories**: `services/api/src/infrastructure/InMemoryRepositories.ts`
    replaces the previous `{} as never` dev stubs with Map-backed implementations
    of all five domain repository interfaces. This fixes the PR-002 load-test
    finding where `identity.getProfile` returned 500 (`repository.findById is not
a function`) — every protected gateway procedure now returns proper results
    or graceful 404/empty responses. Integration tests exercise the real
    application services through the gateway wiring.
  - **Rate-limit configuration** (PR-002/T5 follow-up): per-user in-memory rate-limit
    tiers are now env-configurable (`RATE_LIMIT_<TIER>_MAX` / `RATE_LIMIT_<TIER>_WINDOW_MS`,
    defaults preserved) and documented in `.env.example`; regression tests use
    `vi.resetModules()` + a static dynamic import (Vitest 4 rejects variable
    dynamic imports).

### Changed

- **Lint clean**: eliminated all ESLint warnings (0 errors / 0 warnings) —
  justified `security/detect-object-injection` disables on typed/closed-union
  record lookups, dev-script rule relaxation, explicit return types, and an
  `Object.hasOwn` guard in `DashboardConfigurationService.updateWidgetState`
  that closes a prototype-mutation vector for non-own widget ids.
- **Dependency overrides** added for transitive dev-only advisories (postcss,
  uuid, sharp, esbuild). Note: the `elliptic` advisory (GHSA-848j-6mx2-7j84) has
  no patched release (affected range `*`); it is dev-only and tracked in
  `docs/CVE_TRACKING.md`.
- **Dependency realignment (PR-001)**: lockfile regenerated so the `sharp
^0.35.0` / `uuid ^11.1.1` overrides apply (pins sharp 0.35.3, uuid 11.1.1),
  resolving previously reported transitive advisories; `npm audit` reduced from
  12 → 7 findings (6 low, 1 high dev-only). The remaining high (vite 5.4.21,
  GHSA-fx2h-pf6j-xcff) is dev-only (Storybook) and cannot be auto-fixed without
  breaking Storybook peer ranges — documented in `docs/CVE_TRACKING.md`.
- **Bundle budget**: landing page confirmed within budget (server page.js
  33 kB / client page chunk 23 kB vs 50 kB limit) after earlier dynamic-import
  work; no further action required.

### Fixed

- **Pre-existing `next build` failure resolved — lazy config evaluation to
  request time** (2026-08-02): `next build` (which forces `NODE_ENV=production`
  while evaluating route modules) previously threw during page-data collection
  because importing `@vedmoulya/api` evaluated configuration at module scope.
  Every module-scope config read in the bundle graph is now deferred to request
  time:
  - `@vedmoulya/core` `config` is a lazy Proxy over the new `getConfig()` —
    `loadConfiguration()` (fail-fast env validation) runs on the first access,
    not at import. Fail-fast semantics are unchanged: the first request-time
    access still rejects missing/placeholder/localhost secrets. The proxy
    delegates get/set/has/deleteProperty/ownKeys/getOwnPropertyDescriptor to
    the cached configuration for full behavioral parity.
  - `logger` defers `ConsoleLogger` construction (and `config.app.*` reads) to
    the first log call.
  - `featureFlags` defers the `config.features` seed to first use.
  - `services/api` now exports `getAppRouter()` / `getServices()` (lazy, cached
    singletons) instead of a module-scope `appRouter`; consumers updated
    (`@vedmoulya/api` exports, the web tRPC route handler, router tests).
    `InfrastructureHealthProbe` resolves `config.database.url` /
    `config.redis.url` at check time instead of construction.
  - `services/identity` `AuthorizationMiddleware` constructs the
    `AuthorizationService` lazily (its `BaseService` constructor reads config
    via the logger, so module-scope construction threw during build).
  - `services/decision` `DecisionConfig` and `services/execution`
    `ExecutionConfig` defer `loadConfigFromEnv()` to first access (module-scope
    `requireProdExternalUrl` reads of `DECISION_DATABASE_URL` /
    `EXECUTION_DATABASE_URL` threw during build). get/update/reset semantics
    unchanged.
  - `scripts/startup.sh` now forces `getConfig()` in its environment validation
    so production fail-fast still gates startup before anything starts.
  - Regression tests added (`packages/core/src/config/__tests__/lazyConfig.test.ts`)
    asserting import-inertness under `NODE_ENV=production` without secrets and
    fail-fast on first access.
    A CI web build with no env vars now passes; the dev server, workspace builds,
    and runtime request behavior are unchanged.

### Fixed

- **Live browser verification fixes (EPIC-013, 2026-08-10):** two real defects
  found by running the `/capability-marketplace` page in Chrome against the real
  gateway — both invisible to the hermetic suites.
  - **Client bundle crash (`node:crypto`):** `CapabilityPlanner` (re-exported by
    the package index and imported as a VALUE by the web client via
    `AIPlanInsightCard`) used `node:crypto` for its plan-id hash, which webpack
    cannot bundle for the browser — the page white-screened. Replaced with a
    portable deterministic FNV-1a string hash (no Node builtin; same id
    stability semantics).
  - **Provider registry unavailable without Postgres:** the gateway default
    always resolved `PostgresProviderRepository` (no dev/test fallback), so
    every provider-backed procedure (`capability.*`, provider intelligence,
    routing) 500'd on a Docker-less machine. `createProductionProviderRepository`
    now follows the established app-factory / requirements / RAG convention:
    the **seeded in-memory registry in development/test**, Postgres in
    production/staging (strict fail-fast preserved — no silent in-memory
    degradation in production). Stale Postgres-always assertions in
    `ProductionEngineWiring.test.ts` updated to match. Gateway suite **628/628**,
    lint clean.

---

## [1.0.0] — 2026-07-31

VedMoulya 1.0.0 is the first production release of the **Execution Operating
System** — a platform that empowers individuals to build sustainable livelihoods
through knowledge, execution, and intelligent technology. This release marks
**Feature Complete** and **Platform Freeze** status.

**Git:** tag `v1.0.0` (commit `2bef790`)

### Added

#### Foundation Layer

- Core libraries (`@vedmoulya/core`) with DI container, event bus, fail-fast
  configuration, logging, metrics, tracing, and health checking.
- Domain models (`@vedmoulya/domain`) for Identity, Knowledge, Memory, Decision,
  and Execution.
- UI component library (`@vedmoulya/ui`) with 30+ components using Radix UI +
  Tailwind CSS.
- Shared type definitions, DTOs, and workspace tooling packages
  (`@vedmoulya/shared`, `@vedmoulya/testing`, `@vedmoulya/config`,
  `@vedmoulya/ai`, `@vedmoulya/information`, `@vedmoulya/intelligence`).

#### Core Engines

- **Identity Engine**: authentication, authorization (CASL), password
  management, JWT tokens, sessions, Google OAuth.
- **AI Orchestrator**: provider abstraction (OpenAI, Anthropic, Mock), routing,
  fallback/retry, request cache, and metrics.
- **Knowledge Graph**: entities, graph traversal, and search.
- **Memory Engine**: memory management, retention policies, reflection, search.
- **Decision Intelligence**: entities, scoring, risk assessment, constraints.
- **Execution Intelligence**: mission planning, task management, progress
  tracking, scheduling.

#### Intelligence Platforms

- **Dashboard Experience**: Life OS dashboard with sections, insights, and
  recommendations.
- **Career Intelligence**: career paths, skills, job matching, resume processing.
- **Learning Intelligence**: learning paths, assessment, progress tracking.
- **Business Intelligence**: analytics, KPIs, goals, finances.
- **Marketplace Platform**: asset catalog, provider management, installation.
- **Life OS Integration**: unified platform orchestration, search, navigation,
  notifications, quick actions.

#### Application Layer

- **API Gateway**: tRPC-based gateway with 12 routers and 5 middleware
  components (auth, audit, rate limiting, CORS, security headers).
- **Web Application**: Next.js 15 app with 6 pages, 12 dashboard sections, and
  Storybook.

#### Production Hardening (SPRINT PH-001)

- **Fail-fast production configuration** (PH-001/T2): required secrets
  (`AUTH_JWT_SECRET`, `IDENTITY_DATABASE_URL`, `REDIS_URL`, AI provider keys,
  SMTP credentials, Google OAuth) are validated at startup outside
  `NODE_ENV=development`; missing, empty, placeholder, and localhost values are
  rejected with clear messages.
- **Per-workspace test tooling**: every workspace with tests ships
  `vitest.config.ts`, `test` scripts, and per-workspace v8 coverage (206 test
  files / 2,693 tests at release).
- **Repository foundation**: MIT `LICENSE`, `.editorconfig`, enhanced root
  `README.md`, dependency policy, and CVE tracking documentation.

#### Enterprise Operations & Reliability (SPRINT PH-002)

- **Observability stack** (PH-002/T1): OpenTelemetry collector, Prometheus, and
  Grafana provisioning (`configs/observability/`) with an optional
  `docker-compose` observability profile.
- **Runtime metrics**: process-level gauges (memory, CPU, uptime) for the
  Prometheus exporter, plus gateway observability bootstrap in the tRPC route
  handler.
- **Graceful shutdown** (PH-002/T2): ordered shutdown sequence (stop accepting →
  drain → flush metrics → close DB/Redis/AI/workers) with timeout bounding.
- **Load testing** (PH-002/T5): k6 load tests (`scripts/load/`) covering health,
  auth, dashboard, search, LifeOS, and AI scenarios.

### Changed

- **Security posture**: CI and release workflows now treat `npm audit` critical
  findings as blocking (`--audit-level=critical`).
- **AI configuration**: the default provider's API key is required in production
  when the AI assistant is enabled; any configured key must be a real secret
  (no placeholders / localhost).
- **Environment templates**: `.env.example` and `.env.production.example`
  document every required and optional configuration value (32 variables).

### Fixed

- **Coverage and quality gates**: workspace coverage thresholds enforced at 80%
  across all workspaces with tests; zero-test workspaces are treated as gate
  failures instead of silently passing.
- **Accessibility and performance scripts** wired into CI (Playwright a11y
  audit, Next.js bundle-size budgets).

### Quality Metrics

| Metric                | Result                   |
| --------------------- | ------------------------ |
| TypeScript Errors     | 0                        |
| Passing Tests         | 2,693 (206 test files)   |
| Production Build      | ✅ Successful            |
| Certification Reports | 18 BLD modules certified |
| Production Readiness  | 92/100 — 🟢 (2026-07-31) |

### Upgrade Notes

First production release — no upgrade path from previous versions.

---

[1.0.0]: https://github.com/ak9848515-dev/vedmoulya/releases/tag/v1.0.0
