# SPRINT-041 — BASELINE AUDIT

**Phase 1** · 2026-08-16

## Estate reviewed

- `04_Sprints/SPRINT-038_COMPLETION_REPORT.md` · `SPRINT-039_COMPLETION_REPORT.md` · `SPRINT-040_COMPLETION_REPORT.md`
- `05_Docs/PROJECT_STATUS.md` · `05_Docs/CURRENT_ARCHITECTURE_STATE.md` · `task_progress.md`
- `packages/world-model/src/domain/FounderEvidenceLoop.ts` (observation validation, evidence quality, calibration, next-best-action, comparison)
- `packages/world-model/src/application/WorldModelService.ts` (recordFounderObservation, registerProspect, advanceProspect, opportunityEvidenceQuality, calibrateProblemFactor, opportunityNextBestAction, compareOpportunities, opportunityDrilldown)
- `packages/world-model/src/domain/OpportunityDiscovery.ts` (`recommendStop`, revenue ladder, bounded lifecycle)
- Stores: `world-ports.ts` · `InMemoryWorldStores.ts` · `PostgresWorldStores.ts` · `services/api/src/infrastructure/PersistenceStores.ts`
- Gateway: `services/api/src/routers/WorldRouter.ts` (`world.*` procedures) · `middleware/auth.ts` (central IDOR) · `services/RouterRegistry.ts`
- Command Center: `apps/web/src/components/CommandCenter.tsx` · `packages/voice` (read-only presentation)
- Auth: `services/identity/src/auth/{AuthService,AuthRoutes,TokenService}.ts` · `apps/web/src/auth/*`

## What already works (verified, unchanged)

- Founder observation entry with MANDATORY provenance (domain + zod); sanitized at the boundary; claimed VERIFIED downgraded to OBSERVED/UNVERIFIED; UNKNOWN stays UNKNOWN.
- Bounded customer-discovery chain CONTACTED→CONVERSATION→PROBLEM_CONFIRMED→SOLUTION_INTEREST→WTP_SIGNAL→PAYMENT_REQUESTED→VERIFIED_PAYMENT (+LOST) with `INVALID_TRANSITION` refusal for jumps.
- Verified-payment-only revenue ladder (REVENUE_VERIFIED / REPEAT_REVENUE / REPEATABLE_BUSINESS); WTP/interest never reach revenue states.
- Deterministic 8-dimension evidence quality; bounded calibration (Δ ≤ 0.05, UNKNOWN never zero, conflicts visible, evidence trail on adjustments).
- Explainable NEXT BEST ACTION incl. STOP; opportunity comparison (STRONG_EVIDENCE requires verified payment + HIGH quality — high score alone never sufficient).
- Command Center drill-downs + read-only voice presentation (VOICE ≠ AUTHORIZATION).
- Owner-scoped stores (in-memory dev / Postgres production) + gateway `world.*` behind auth + rate tier + central IDOR + zod.
- Auth (SPRINT-040 fixes): identity users-table bootstrap, dev-only auto-verification, Docker runtime.
- Suites green at baseline: world-model 298/298 · api 1010 · identity 283 · web 247.

## Production-safe vs local-test-only

- **Production-safe:** the entire evidence-loop domain, gateway contracts, IDOR guard, dev-only verification gate (`NODE_ENV` ≠ production/staging), all deterministic scoring/calibration/NBA logic.
- **Local-test-only:** dev runtime uses in-memory world stores by design (`resolvePersistenceBundle`); only identity is always Postgres. All my verification used clearly-marked `LOCAL TEST` records.

## Operator-required (unchanged)

Real customer contact, interviews, payment confirmation, external provider execution, live market/world signals, spending, approval, evidence promotion, permanent-memory promotion, production Postgres for world stores.

## Missing for repeated founder use (this sprint's verification targets)

1. **Verified-payment evidence could be fabricated** — `advanceProspect` defaulted `verifiedPaymentText` to `'Verified payment from X.'` when omitted (silent fabrication).
2. **Empty-set fake precision** — `evidenceQuality` reported `provenance: HIGH` with zero records (`every()` over `[]` is vacuously true).
3. **Stale advisory STOP could never be contradicted by revenue** — a `stopReason` set by an earlier assessment kept NBA saying STOP even after a verified payment proved a buyer; the TALK_TO_CUSTOMERS `why` for a paid opportunity claimed "evidence quality is insufficient".
4. **Real-Postgres restart recovery didn't cover the world evidence-loop stores** (`world_problems` / `world_observations` / `world_prospects` absent from the restart-recovery test).
5. **No UI mutation surface for the evidence loop** — Command Center is presentation + founder-approval only; observation/prospect/payment entry is gateway-only (see `SPRINT-041_FOUNDER_READINESS.md`).

No rewrite of working architecture. The estate is authoritative; this sprint verifies, hardens the four genuine gaps above, and documents boundaries.
