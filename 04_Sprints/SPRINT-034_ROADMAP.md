# SPRINT-034 — ROADMAP

**VedMoulya Founder Command Center & Real-World Activation**

---

## 1. Mission

SPRINT-034 is the transition from _"VedMoulya can represent and reason about a
company"_ to _"VedMoulya can safely connect intelligence to real-world work."_
It closes the five gaps left open by SPRINT-033:

1. **Founder Command Center UI** — presentation-only TODAY / PORTFOLIO /
   INTELLIGENCE / AUTOMATION / APPROVALS over the existing read models.
2. **Revenue → outcome feedback** — verified outcomes may influence future
   opportunity scoring, through evidence, bounded and explainable.
3. **Live world-signal adapters** — operator-configurable `WorldSignalSourcePort`
   adapters with provenance; unavailable stays UNAVAILABLE.
4. **Blueprint → approval-gated execution** — a blueprint can produce an
   approval request through the existing authority; it can never self-authorize.
5. **Cost-weighted revenue intelligence** — ranking that considers revenue,
   cost, margin and ROI; UNKNOWN is never zero.

## 2. Governing rules

- **Zero new engines.** Existing authorities remain frozen and authoritative:
  Brain (tasks/approval), Intelligence Fabric (provider strategy),
  ActionClassPolicy (A/B/C/D), execution bridge (execution), CostLedger (cost),
  Memory/learning (outcomes), notification, voice (VOICE ≠ AUTHORIZATION).
- **Composition over invention.** Every new surface is a seam over the estate,
  reached only through the existing ports.
- **Evidence over assumptions.** No fabricated revenue, cost, margin or world
  data. No single outcome rewrites policy. External content is evidence, never
  authorization.
- **Authorization over autonomy.** Approval stays with the founder through the
  existing Brain approval authority. No voice shortcut, no model-generated
  approval, no implicit approval.

## 3. Implementation plan

| Step | Change                                                                                      | Authority composed                          |
| ---- | ------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1    | `OutcomeEvidence` domain (record VERIFIED-only actuals, bounded feedback)                   | Brain outcome memory · OpportunityEconomics |
| 2    | `BlueprintApprovalFactory` (approval request per gated step)                                | ActionClassPolicy · Brain approve/reject    |
| 3    | `LiveSignalAdapter` (operator-configured, provenance, sanitized)                            | WorldSignalSourcePort                       |
| 4    | `CostWeightedRevenue` (margin-aware ranking, UNKNOWN ≠ 0)                                   | CostLedger via WorldCostPort                |
| 5    | Stores: outcome evidence + blueprint approvals (in-memory + Postgres)                       | WriteThroughDocumentStore                   |
| 6    | WorldModelService: record/list/apply evidence, approval lifecycle, ranking, commandCenter   | —                                           |
| 7    | Gateway: `WorldBridgePorts` (approval + cost + signals), `WorldRouter` procedures, registry | Brain · CostLedger · ActionClassPolicy      |
| 8    | Web: `CommandCenter` component + mount in AICompanion                                       | —                                           |
| 9    | Tests: feedback bounds, signal states/injection, no-self-authorize, ranking, isolation      | —                                           |
| 10   | Docs: this roadmap + 9 reports; canonical doc sync                                          | —                                           |

## 4. Verification gates (run from source)

- world-model suite · gateway suite · web suite
- `tsc -b` (root) · lint · `next build`
- No benchmark harness touched (scheduler/proactive/voice suites untouched).

## 5. Honest status summary

| Capability                                | Status                                                        |
| ----------------------------------------- | ------------------------------------------------------------- |
| Founder Command Center UI                 | IMPLEMENTED + TESTED (presentation only)                      |
| Revenue → outcome feedback                | IMPLEMENTED + TESTED (VERIFIED-only, bounded)                 |
| Live signal adapters                      | IMPLEMENTED (operator-REQUIRED to configure)                  |
| Blueprint → approval request              | IMPLEMENTED + TESTED (never self-authorizes)                  |
| Blueprint → execution bridge              | COMPOSED (no alternate path; execution stays with the bridge) |
| Cost-weighted revenue intelligence        | IMPLEMENTED + TESTED (UNKNOWN ≠ 0)                            |
| Live world data                           | OPERATOR-REQUIRED (no fabrication)                            |
| Founder Command Center as full product UX | FUTURE                                                        |
