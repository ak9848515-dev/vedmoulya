# UX-AUDIT.md

> **UX score: 6.0 / 10** (source-based).
> **Evidence limitation:** no fresh browser session, screenshots, or a11y run were performed during this
> audit. Conclusions are drawn from routes, components, state wiring, and API calls, plus existing test
> evidence. They are **not** visually verified. Existing `UX-AUDIT.md` (repo root) was **not** overwritten.

---

## 1. Route / screen inventory (63 routes)

| Group                     | Routes                                                                                                                                                                                                                                                                                                                                                 | Notes                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Identity / first-run      | `login`, `signup`, `oauth2redirect`, `verify-email`, `onboarding/profile`, `settings`                                                                                                                                                                                                                                                                  | Complete-looking funnel.                                               |
| Mission / execution       | `missions`, `progress`, `task-manager`, `autonomous-builder`, `loop`, `execution`, `execution-strategy`, `os`, `goals`                                                                                                                                                                                                                                 | Trust-critical: must separate running/verified/delivered.              |
| Revenue / client delivery | `missions`, `portal/*` (`content`, `deliverables`, `invoices`, `login`), `content-agency/*` (12 routes)                                                                                                                                                                                                                                                | Draft/approval UX lives here.                                          |
| Intelligence / catalogs   | `ai`, `ai-world`, `brain`, `intelligence`, `live-intelligence`, `context`, `context-fabric`, `knowledge`, `memory`, `learning*`, `capabilities`, `capability-marketplace`, `marketplace`, `ecosystem*`, `enterprise-brain`, `world` (panel), `career`, `business`, `life`, `applications`, `providers`, `verify`, `progress`, `dashboard` (`page.tsx`) | **High catalaog surface** — many are presentation panels over engines. |

**Information-architecture concern:** ~30 of 63 routes are _engine/panel_ surfaces. From a real user's
perspective these are undifferentiated and raise "which one do I use?" friction. The platform's value
concentrates in a handful (login → providers → missions → verification → draft approval).

---

## 2. Friction points (each with problem / screen / consequence / minimal correction / verification)

### UX-01 — Too many top-level destinations obscure the core journey

- **Problem:** a first-time user has no single, obvious path to "get a verified deliverable".
- **Screen:** global navigation over the 63 routes above.
- **Consequence:** time-to-first-success inflated; abandoned onboarding.
- **Minimal correction:** promote a guided "Start here" journey (Providers → New Mission → Review → Approve)
  and group engine panels under a secondary "Explore" area — no visual redesign needed.
- **Verify:** a scripted Playwright journey reaches a VERIFIED mission artifact in N clicks from the dashboard.

### UX-02 — Provider "connection status" may contradict reality

- **Problem:** docs label Google/OpenRouter/Ollama catalog-only, while they execute (G-02); health status can
  also be untruthful (the uncommitted fix targets this).
- **Screen:** `providers` route; `ProviderConnectionTester`/`ProviderSetupOrchestrator`; `ProvidersRouter`.
- **Consequence:** user cannot trust whether AI is actually usable → failed first AI task.
- **Minimal correction:** render a single **truthful** state per provider (catalog / configured / reachable /
  executed) sourced from the same registry; fix CQ-01 so an unconfigured provider reads `down`.
- **Verify:** provider card state matches a live probe; states documented.

### UX-03 — Trust separation (planned / running / verified / drafted / submitted / paid) is not uniformly visible

- **Problem:** revenue rules are correct in code, but the UI must _show_ them everywhere, not just in the
  revenue screens.
- **Screen:** `missions`, `progress`, `portal/deliverables`, `portal/invoices`.
- **Consequence:** a user could read "delivered/sent/paid" ambiguously → trust erosion.
- **Minimal correction:** a consistent status chip vocabulary across all artifact surfaces, with the
  `submitted`/`paid` states driven only by real records.
- **Verify:** component tests assert that no state label renders "submitted/paid" without the corresponding record.

### UX-04 — Wide, partially-verified state coverage (loading/empty/error/offline)

- **Problem:** with 63 routes, per-route loading/empty/error coverage is likely uneven.
- **Screen:** all data surfaces.
- **Consequence:** blank screens / silent failures on slow providers (local Ollama is slow: ~165–180 s per
  report generation in evidence).
- **Minimal correction:** standard loading/empty/error primitives; surface long-running job progress with ETA
  or heartbeat (the Ollama latency makes this essential).
- **Verify:** each data route renders the three states under a stubbed API.

### UX-05 — Long-running mission feedback granularity

- **Problem:** mission runs take minutes with a local model; the user needs current objective/blocker/next action.
- **Screen:** `missions`, `progress`.
- **Consequence:** user assumes hang; manual refresh; duplicated runs.
- **Minimal correction:** expose the objective/step/verification state already produced by the engine
  (step-1..step-4 with attempts) as a live checklist.
- **Verify:** Playwright observes step transitions without refresh.

### UX-06 — Accessibility / contrast / responsive not verified

- **Problem:** a11y and mobile behavior are asserted by tests but not by a fresh a11y run here.
- **Screen:** all.
- **Consequence:** unknown.
- **Minimal correction:** run the existing `npm run test:a11y` in CI on the core journey only.
- **Verify:** `test:a11y` green on login → missions → approve.

---

## 3. What the UX gets right (evidence)

- The **human approval boundary** is a first-class product state (`pendingApproval: true`, `submitted: false`)
  — verified in `_rev002a-live/m2-delivery-verification.txt` and the REVENUE-004A run.
- **Honest empty/error copy** is a stated repo convention (SPRINT-038/039 "honest EMPTY datasets"), lowering
  fabricated-data UX risk.

## 4. Evidence limitations

- No browser screenshots, no Lighthouse/a11y run, no responsive pass. Every UX claim above is source-derived
  unless it cites a runtime log. A follow-up browser-based UX pass is required to raise confidence above 6.0.
