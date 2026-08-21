# Sprints & Epics

> Sprint and epic management for VedMoulya — the operating cadence of the roadmap.
> Owner: Program Management · Updated: 2026-08-16 (SPRINT-042 FOUNDER EVIDENCE ENTRY UI 🟢 COMPLETE — PURE COMPOSITION SPRINT, NEW ENGINES CREATED: 0; closes the ONE founder usability gap from SPRINT-041 (evidence-loop entry had no web-UI mutation surface) — a real founder can now run the full evidence loop through the browser: OBSERVE → RECORD EVIDENCE → CREATE/CONTACT PROSPECT → ADVANCE VALIDATION → REQUEST/CAPTURE PAYMENT → VERIFY PAYMENT EVIDENCE → SEE REVENUE STATE → SEE UPDATED RADAR → SEE NEXT BEST ACTION, no manual gateway calls. **Pure composition:** every mutation maps 1:1 to an EXISTING gateway procedure (`world.problemRegister`/`observationRecord`/`prospectRegister`/`prospectAdvance`/`problemList`/`prospectsList` — auth + rate tier + central IDOR + zod, backend authoritative, zero business rules in React). **`EvidenceEntryPanel`** mounted in the Command Center INTELLIGENCE tab under "Add Evidence": Problem (evidence REQUIRED — no fabricated problems) · Observation (provenance REQUIRED, no VERIFIED self-claim) · Prospect (provenance REQUIRED, discoveryStatus NOT sendable — discovery ≠ validation) · Advance (display-only valid transitions from the bounded chain; illegal jumps cannot even be requested AND the backend rejects them anyway INVALID_TRANSITION — verified live) · Payment (VERIFIED_PAYMENT only from PAYMENT_REQUESTED; REAL payment-evidence text REQUIRED — never auto-filled, SPRINT-041 D1 preserved); honest EMPTY/UNKNOWN states, backend errors verbatim, 401/403/429/network user-safe, every save refreshes radar/NBA via existing onSaved() → Command Center load(). **Two genuine UI defects found ONLY by live Chrome verification + fixed minimally with failing-first regression tests:** D1 — `handleSaved` refetched only problemsQuery, so after a transition the drawer offered STALE next states (prospect list still showed the old status) → now also refetches prospectsQuery · D2 — the drawer-open effect depended on `[open, problemsQuery]` where problemsQuery is a fresh object identity every render → INFINITE refetch loop while open (measured 30+ refetches in 2s, each burning a rate-limit token until the gateway correctly 429'd) → now depends on `[open]` only (post-fix: 1 refetch on open). **Real-Chrome verification 19–20/20 PASS** (Scenarios 1–9: observation · provenance refusal no-record · prospect + valid transition · illegal jump rejected by backend · verified-payment evidence required + recorded with real LOCAL TEST evidence · honest empty state · radar refresh · persistence across reload · cross-user mutation **403 FORBIDDEN** live). Gates: web **292/292** · api **1010/1010** · identity **295/295** · domain PASS · typecheck **0** · lint **0 errors · 0 warnings** · `next build` **PASS** (58/58, dev stopped + .next cleared first) · honest: NO fabricated evidence/customers/revenue; advance options display-derived from the bounded chain constant (backend authoritative — a future "valid transitions" procedure would remove the mirrored constant, flagged as SPRINT-043 candidate) · deliverables 04_Sprints/SPRINT-042_* (5) · prior: SPRINT-041B first-login profile setup 🟢 COMPLETE) · 2026-08-16 (SPRINT-041B FIRST-LOGIN PROFILE SETUP VERIFICATION + RECTIFICATION 🟢 COMPLETE — verification + minimal rectification sprint, NEW ENGINES CREATED: 0; the first-login profile experience did NOT exist and was NOT wired to the authentication lifecycle (determination D+E: no /onboarding or /profile route; the /settings Profile tab was a static placeholder with a dead Save button; no first-login detection; the required Age/Gender/Purpose/Primary Goal had NO persistence representation; the identity PATCH /users/:id/profile route was unauthenticated and not web-exposed) — built the missing stack entirely over the EXISTING estate: domain `UserProfile` +age/gender/purpose/primaryGoal + deterministic `isComplete()` (server is the source of first-login truth, never client flags) · 4 idempotent ALTER columns on the existing users table (verified live against Docker Postgres) · JWT-authenticated `GET /me` + `PATCH /me/profile` (userId derived from the token — IDOR-impossible by construction, no userId field in the request) · web client `refreshProfile()`/`completeProfile()` via the existing auth-api/session-manager · `/onboarding/profile` page (existing @vedmoulya/ui components, Name prefilled from session, closed vocabularies) · single central `OnboardingRedirect` gate in Providers (fires ONLY on explicit server-derived profileComplete===false; auth-flow screens excluded — no loop); **two genuine defects found by LIVE Chrome verification and fixed minimally**: D1 the gate effect lacked a pathname dependency, so after registration's CLIENT-SIDE router.replace(next) it never re-fired (direct URL access redirected, signup flow did not — inconsistent) → gate now watches usePathname() and re-evaluates on every route change · D2 the onboarding page captured ?next= in a mount-time useMemo ([] deps), capturing a stale '/' when the query settled after first render → ?next= now resolved AT THE POINT OF USE (submit handler + complete-user effect); +2 regression tests that FAIL against pre-fix code; real-Chrome Scenarios A–D **15/15 PASS** (A: /login→Create an account→/signup→register→GATE→/onboarding/profile→fill+save→/intelligence→refresh keeps session→logout→re-login bypasses onboarding · B: completed user → default destination · C: incomplete user direct /intelligence → profile setup with ?next= preserved · D: cross-user update structurally impossible); gates: web **276/276** · identity **295/295** · api **1010/1010** · domain PASS · typecheck **0** · lint **0 errors · 0 warnings** · `next build` **PASS** (58/58 pages, dev stopped first) · honest: Google first-login verified structurally only (no OAuth credentials locally); profile completion is presence-based; the pre-existing unauthenticated PATCH /users/:id/profile route is NOT web-exposed but flagged as follow-up hardening · deliverables 04_Sprints/SPRINT-041B_* (6) · prior: SPRINT-041 founder operating loop hardening 🟢 COMPLETE) · 2026-08-16 (SPRINT-041 FOUNDER OPERATING LOOP HARDENING + REAL-WORLD READINESS 🟢 COMPLETE — hardening + verification sprint, NEW ENGINES CREATED: 0; the founder operating loop is now trustworthy for repeated founder use: everything verified LIVE against the gateway with clearly-marked LOCAL TEST data (observation entry with provenance refusal + no VERIFIED self-claim + sanitization · bounded customer-discovery chain with illegal-jump refusal · 8-dimension evidence quality with empty-set honesty · bounded calibration Δ ≤ 0.05 with UNKNOWN-never-zero + evidence trail · explainable next-best-action incl. STOP · Command Center drill-downs with explicit revenue state · real-Postgres restart recovery now covering the world evidence-loop stores · auth regression: sign-up 201 · duplicate 409 · weak 400 · wrong-pw 401 · session 200 · dev-only auto-verify gate intact (production unchanged) · security: cross-user input 403 FORBIDDEN live, no token 401, zero password logging); **three genuine honesty defects found + fixed minimally**: D1 `advanceProspect` fabricated a payment-evidence default (`Verified payment from X.`) when text was omitted — a VERIFIED_PAYMENT transition now REQUIRES real evidence text (PAYMENT_EVIDENCE_REQUIRED) · D2 `evidenceQuality` reported provenance HIGH with ZERO records (vacuous every()) — now UNKNOWN with zero records · D3 a stale advisory STOP (stopReason from an assessment taken before a payment) kept NBA/COMPARISON saying STOP forever, and a paid opportunity's TALK_TO_CUSTOMERS claimed "evidence quality is insufficient" — advisory STOP now yields to verified-payment evidence (founder-terminal REJECTED/DISMISSED still dominate), and the paid-opportunity NBA explains repeatability honestly; + real-Postgres restart-recovery extended to world_problems/world_observations/world_prospects · verification: live evidence loop **26/26 PASS** · world-model **302/302** (23 files) · services/api **1010/1010** (50 files) · identity **283/283** · web **247/247** · typecheck **0** · lint **0 errors · 0 warnings** · `next build` **PASS** (57 pages) · benchmarks chain **exit 0** (opportunity 20/20 · evidence 20/20 · discovery 10/10 · calibration 13/13 · provider 11/11 · learning 25/25 · quality gates 16/16) · coverage gate **45/45 PASS** · honest: NO fabricated evidence/customers/revenue; the ONE founder blocker is that evidence-loop ENTRY has no web-UI mutation surface yet (Command Center is presentation + founder-approval only by design) — next highest-value follow-up is a Command Center evidence-entry UI (pure composition over the verified gateway contracts) · deliverables 04_Sprints/SPRINT-041_* (8) · prior: SPRINT-040 founder operating loop + local runtime verification 🟢 COMPLETE) · 2026-08-16 (SPRINT-040 FOUNDER EVIDENCE LOOP + LOCAL RUNTIME VERIFICATION 🟢 COMPLETE — verification + defect-fix sprint, NEW ENGINES CREATED: 0; the first end-to-end operational path proven LIVE over the frozen estate: Docker runtime → register/login → founder observation → provenance validation → evidence persistence → scoring → customer discovery → next-best-action → verified-payment progression; defects found + fixed minimally: D1 identity `users` table never created anywhere (the ONE store violating the estate `ensureTable()` convention) → `PostgresIdentityRepository.ensureTable()` + factory wiring + awaited in the web auth-app · D2 `IDENTITY_DATABASE_URL` unset → added to gitignored `.env.local` (Docker dev creds) · D3 no email-verification delivery exists while the domain blocks sign-in → dev/test-only auto-verify in the EXISTING AuthService.signUp (production/staging unchanged) · D4 Next dev cache corruption → `.next` cleared; live verification: sign-up 201 · duplicate 409 · validation 400 · sign-in 200 · session 200 · sign-out 200; provenance refusal; claimed VERIFIED downgraded; calibration refuses UNKNOWN fabrication; prospect bounded chain + invalid-jump refusal; verified-payment-only ladder REVENUE_VERIFIED → REPEAT_REVENUE → REPEATABLE_BUSINESS; explainable next-best-action; honest EMPTY datasets; suites: world-model 298/298 · identity 283/283 · api 1010/1010 · web 220/220 · typecheck 0 · scoped lint 0/0 · next build PASS · benchmarks all PASS · coverage gate 2/2 PASS; Docker postgres+redis healthy, / + /login 200; honest: vedmoulya-web not a container (web runs via next dev); only LOCAL TEST data used · deliverables 04_Sprints/SPRINT-040_* (8) · prior: SPRINT-039 founder evidence loop 🟢 COMPLETE) · 2026-08-15 (SPRINT-039 FOUNDER EVIDENCE LOOP 🟢 COMPLETE — composition sprint, NEW ENGINES CREATED: 0: founder observations with MANDATORY provenance (refused PROVENANCE_REQUIRED otherwise; sanitized; explicit evidence states; claimed VERIFIED downgraded; HYPOTHESIS the honest default) · customer-discovery ledger (NOT a CRM — bounded status chain, discovery ≠ validation, interest ≠ revenue, WTP ≠ payment, ONLY a verified_payment record reaches REVENUE_VERIFIED) · bounded evidence calibration (Δ ≤ 0.05 per event over the existing SPRINT-038 factors; UNKNOWN never zero; conflicts visible) · deterministic 8-dimension evidence quality · explainable NEXT BEST ACTION (incl. STOP — the system CAN say "do not build this") · evidence-driven opportunity comparison (STRONG_EVIDENCE/PROMISING/INSUFFICIENT_EVIDENCE/NEEDS_CUSTOMER_VALIDATION/STOP/UNKNOWN) · Command Center drill-downs (evidence/prospects/next action; honest EMPTY copy) · voice read-only presentation (VOICE ≠ AUTHORIZATION preserved) · owner-scoped stores (in-memory + Postgres world_observations/world_prospects) · gateway world.* +10 procedures · evidence:benchmark 20/20 + discovery:benchmark 10/10 (benchmarks chain now 20 harnesses) + vitest gates · verification 2026-08-15: world-model 298/298 (23 files), services/api 1010 (50 files), web 219/219 (22 files), typecheck 0, lint 0/0, next build PASS, benchmarks all PASS, coverage gate world-model 91.11/82.18/90.83/94.34 · api PASS; HONEST: EMPTY datasets (no fabricated observations/prospects/customers/revenue; real founder observation entry ready); live world signals + real provider execution remain OPERATOR-REQUIRED · deliverables 04_Sprints/SPRINT-039_* (13) · prior: SPRINT-038 opportunity discovery & revenue validation 🟢 COMPLETE) · 2026-08-15 (SPRINT-037 LIVE ORCHESTRATION & REAL-WORLD EXECUTION PROOF 🟢 COMPLETE — composition + activation sprint, NEW ENGINES CREATED: 0: approved-plan → existing-bridge adapter `OrchestrationPlanSource` (approved-only, executed:false never flipped, capability mapping via the existing CapabilityMapper) · `world.approveOrchestrationPlan` through the existing Brain approval port · `world.startOrchestrationPlan` composing the existing ExecutionRunService (no alternate runtime) · Command Center automation lifecycle view · `integration:provider` operator test (fails clearly without credentials, exit 2 verified) · verification 2026-08-15: services/api 1000+1 skip (50 files), world-model 220/220 (18 files), typecheck 0, lint 0/0, next build PASS, benchmarks all PASS (16/16 + 13/13 + 11/11), coverage gate 45/45 (world-model 92.49/82.37/93.2/95.2; api 80.32 branch); LIVE provider execution remains OPERATOR-REQUIRED (AI providers NOT_CONFIGURED — no fabricated SUCCESS) · deliverables 04_Sprints/SPRINT-037_* (11) · prior: SPRINT-036 production multi-provider orchestration 🟢 COMPLETE) · 2026-08-15 (SPRINT-036 PRODUCTION MULTI-PROVIDER ORCHESTRATION 🟢 COMPLETE — composition sprint, NEW ENGINES CREATED: 0: `MultiProviderOrchestrator` seam (per-step provider binding + WHY + expected cost via the existing fabric; privacy overrides cost; PRIVATE + no local → honest NO_SELECTION) · bounded deterministic retry/fallback policy (never retries policy/cost/malformed; quota → fallback; transient → bounded retry → privacy-safe fallback → STOP; disagreement → NEEDS_REVIEW) · orchestration-plan store (owner-scoped, stable-key idempotent, in-memory + Postgres) · deterministic fixtures + scenario engine 11/11 · `provider:benchmark` (18th harness) · gateway `world.orchestratePlan` + `world.listOrchestrationPlans` — plan `executed:false` + `authorizationRequired:true` structural; runtime path remains the existing execution bridge · verification 2026-08-15: world-model 214/214, gateway 987+1 skip, typecheck 0, lint 0/0, next build PASS, benchmarks 18/18, coverage gate 45/45 (world-model 92.49/82.72/92.95/95.19; api 80.32 branch); live multi-provider EXECUTION remains OPERATOR-REQUIRED · deliverables 04_Sprints/SPRINT-036_* (12) · prior: SPRINT-035 production hardening & calibration 🟢 COMPLETE) · 2026-08-15 (SPRINT-035 PRODUCTION HARDENING, CALIBRATION & FOUNDER COMMAND CENTER COMPLETION 🟢 COMPLETE)

## Purpose

Manage epics, sprints, and the master roadmap. This folder is the **single canonical
home for all sprint documentation** — sprint deliverables (`SPRINT-XXX_*`), the master
roadmap, epic briefs, and the EI/OSR programs.

## Sprint documentation — one uniform architecture

- **Every sprint deliverable lives in `04_Sprints/`** — SPRINT-022 (Persistent
  Intelligence), SPRINT-024 (Live Outcome Verification), SPRINT-025 (Continuous
  Learning), SPRINT-026 (Voice + Architecture Audit), SPRINT-027 (Platform Integrity &
  Speech Foundation), SPRINT-028 (Voice Assistant), SPRINT-029 (Proactive Intelligence &
  Automation Fabric), SPRINT-030 (Intelligence Fabric), SPRINT-031 (Active Intelligence
  & Autonomy Control Plane), SPRINT-032 (World Model & Business Operating System),
  SPRINT-033 (Autonomous Company OS), SPRINT-034 (Founder Command Center &
  Real-World Activation), SPRINT-035 (Production Hardening, Calibration &
  Command Center Completion), SPRINT-036 (Production Multi-Provider
  Orchestration), SPRINT-037 (Live Orchestration & Real-World
  Execution Proof), SPRINT-038 (Opportunity Discovery & Revenue Validation),
  SPRINT-039 (Founder Evidence Loop), SPRINT-040 (Founder Operating Loop —
  Local Runtime Verification), SPRINT-041 (Founder Operating Loop Hardening &
  Real-World Readiness), SPRINT-041B (First-Login Profile Setup Verification
  - Rectification),
    plus the SPRINT-026→029 reconciliation report.
- **Uniform naming:** `SPRINT-XXX_<KIND>.md` (hyphen after the number, e.g.
  `SPRINT-022_COMPLETION_REPORT.md`). Document kinds follow the per-sprint deliverable
  convention (BASELINE_AUDIT / EVIDENCE / COMPLETION_REPORT / architecture / security /
  UX / test reports …).
- **SPRINT-023** (Outcome Intelligence & Real-Problem Execution, 2026-08-12) was a
  composition-only sprint with no standalone deliverable file — it is documented in
  `MASTER_ROADMAP.md`, `task_progress.md`, and the benchmarks it wired
  (`outcome:journey:benchmark`, 30/30).
- **`09_Documents/` holds the NON-sprint documentation** — EPIC completion reports
  (`EPIC-0XX_*`), AI-RUNTIME / OS / CERT / APP certification and architecture docs.
  No sprint docs live there.
- **`10_Sprints/` is historical only** (pre-v1.0 mission tracker) — not a home for
  current sprint deliverables.

### Sprint index (current)

| Sprint     | Focus                                                                         | Deliverable(s)                                                                    |
| ---------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| SPRINT-022 | Persistent Intelligence Foundation                                            | `SPRINT-022_{COMPLETION_REPORT,PERSISTENCE_ARCHITECTURE,PERSISTENCE_SECURITY}.md` |
| SPRINT-024 | Live Outcome Verification & Real-Runtime Execution                            | `SPRINT-024_{BASELINE_AUDIT,EVIDENCE,COMPLETION_REPORT}.md`                       |
| SPRINT-025 | Continuous Learning, Outcome Memory & Adaptive Improvement                    | `SPRINT-025_{BASELINE_AUDIT,EVIDENCE,COMPLETION_REPORT}.md`                       |
| SPRINT-026 | Voice Intelligence + Complete-System Architecture Audit                       | `SPRINT-026_*` (10 docs)                                                          |
| SPRINT-027 | Platform Integrity + Speech Foundation                                        | `SPRINT-027_{BASELINE_AUDIT,EVIDENCE,COMPLETION_REPORT}.md`                       |
| SPRINT-028 | VedMoulya Voice Assistant                                                     | `SPRINT-028_COMPLETION_REPORT.md`                                                 |
| SPRINT-029 | Proactive Intelligence & Automation Fabric                                    | `SPRINT-029_*` (9 docs)                                                           |
| SPRINT-030 | Autonomous Intelligence, Multi-Provider Orchestration & Continuous Operations | `SPRINT-030_*` (9 docs)                                                           |
| —          | SPRINT-026→029 reconciliation                                                 | `SPRINT-026_029_RECONCILIATION_REPORT.md`                                         |

## Scope

- Master roadmap (missions, epics, sprints, backlog)
- Sprint deliverables (SPRINT-022…030)
- Epic briefs (EPIC-001…EPIC-007)
- Enterprise Intelligence program (EI-001…EI-010)
- Open Source program (OSR-001…OSR-004)

## Current Status

- **Most recent engineering sprint:** SPRINT-030 (Autonomous Intelligence,
  Multi-Provider Orchestration & Continuous Operations) — 🟢 COMPLETE (2026-08-14),
  full suite 8 613 passed | 1 skipped (682 files).
- **Active roadmap:** 4-sprint arc — SPRINT-027 → 028 → 029 → 030 complete.
- **Roadmap spine:** `MASTER_ROADMAP.md` (authoritative, always-current).

## Architecture

```
04_Sprints/
  MASTER_ROADMAP.md        ← planning spine
  README.md                ← this index + sprint-doc convention
  SPRINT-0XX_*.md          ← sprint deliverables (uniform SPRINT-XXX_<KIND>.md)
  EPIC-001…007/            ← epic briefs
  ENTERPRISE_INTELLIGENCE/ ← EI-001…EI-010 design series
  OPEN_SOURCE/             ← OSR-001…OSR-004 program
```

## Responsibilities

- Program Management: maintain MASTER_ROADMAP, PROJECT_STATUS, task_progress and this
  index; every sprint writes its deliverables here under the uniform naming.
- Epic owners: keep epic briefs current.
- All contributors: reference epics/sprints in commits and docs.

## Deliverables

- Master roadmap
- Sprint deliverables (all under `04_Sprints/SPRINT-XXX_*`)
- Epic briefs and EI/OSR program documents
- Sprint status tracking

## Dependencies

- `00_Foundation/` (mission, constitution)
- `05_Docs/CURRENT_ARCHITECTURE_STATE.md` (canonical current architecture truth)
- `05_Docs/PROJECT_STATUS.md` (current status view)
- `09_Documents/` (EPIC / AI-RUNTIME / OS / CERT documentation — not sprint docs)
- `10_Sprints/` (pre-v1.0 historical records)

## Future Work

- Sprint retrospectives
- Roadmap automation (issue sync)
- SPRINT-031 deliverables (live multi-provider execution, cadence productization)
