# EPIC-015 — VedMoulya Intelligence: Architecture

> **Status:** Implementation verified (2026-08-11).
> The Intelligence layer answers — for THIS task — _"is something significantly
> better available?"_ across configured providers, free providers, local models,
> GitHub projects and paid providers. It is **DISCOVERY + EVIDENCE + SECURITY +
> LICENSE + FRESHNESS**, never a static directory of tools.

---

## 1. Guiding principle

> "I know what you are trying to accomplish. I checked what you already have,
> I checked what is currently available, I checked the evidence, security and
> licensing. Here is what I recommend, why, what it requires — **you decide**.
> If you decline, I continue with the best available option."

Every stage of the intelligence pipeline has an **explicit state**; nothing jumps
from DISCOVERED to CONFIGURED. **Discovery is NOT evidence.** Social/community
signals are discovery signals only — they never independently establish provider
legitimacy, security, pricing, API availability or model availability.

---

## 2. Intelligence pipeline

```
DISCOVER → IDENTIFY → VERIFY → SECURITY SCREEN → LICENSE CHECK →
CAPABILITY ANALYSIS → AVAILABILITY ANALYSIS → COST/FREE ANALYSIS →
QUALITY EVALUATION → USER/TASK RELEVANCE → RECOMMENDATION →
USER APPROVAL IF REQUIRED → CONFIGURATION / INSTALLATION →
VALIDATION → ROUTING → CONTINUOUS MONITORING
```

Never jump directly from DISCOVERED to CONFIGURED. A better option that requires
activation (subscription, API key, GitHub connection, download, local install,
external application, extra permission) produces an **approval recommendation**,
never an automatic activation.

---

## 3. New workspace: `@vedmoulya/ecosystem-intelligence`

A clean layering following the repository conventions
(types → contracts → domain → infrastructure → application):

```
packages/ecosystem-intelligence/
  src/
    types/        intelligence-types.ts      — closed unions + typed records
    contracts/    intelligence-ports.ts      — the ONLY external seams
    domain/       GitHubConnectionManager    — least-privilege GitHub auth
                  SecurityAssessor           — evidence-backed security gate
                  LicenseEngine              — software + model license
                  FreeResourceIntelligence   — quota ≠ free; staleness
                  AcquisitionPlanner         — controlled repo pipeline
                  TaskIntelligenceEngine     — "better for THIS task?"
                  RecommendationAssembler    — premium approval cards
                  LifecycleLedger            — provenance-preserving memory
                  NotificationGate           — relevance-gated events
    infrastructure/ InMemoryIntelligenceStores — owner-scoped, IDOR-safe
    application/  EcosystemIntelligenceApplicationService — the facade
    __tests__/    10 deterministic suites
```

### 3.1 Domain engines

| Engine                     | Responsibility                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GitHubConnectionManager`  | GitHub connects SEPARATELY from Google auth. `public_metadata` baseline; repo read + write require explicit review; write requires a separate consent flag — **never obtained silently**. Tokens never live here (opaque `tokenRef` only).                                                                                           |
| `SecurityAssessor`         | 20+ checks (install scripts, credential collection, RCE paths, secret exposure, sandbox requirement…). Classification `TRUSTED / TRUSTED_WITH_REVIEW / SECURITY_REVIEW_REQUIRED / SUSPICIOUS / BLOCKED / UNKNOWN` with evidence. Honest wording: _"no blocking indicators found in the checks performed"_, never a blanket _"safe"_. |
| `LicenseEngine`            | Software license and model license evaluated SEPARATELY. `PERMISSIVE / RESTRICTIVE / COMMERCIAL_RESTRICTED / LICENSE_UNKNOWN` — unknown is never auto-approved for a commercial factory.                                                                                                                                             |
| `FreeResourceIntelligence` | `FREE_API / FREE_WITH_QUOTA / OPEN_WEIGHTS / OPEN_SOURCE / LOCAL / SELF_HOSTABLE / PAID / UNKNOWN` — "free within quota" ≠ unlimited free. Stale evidence → `STALE`, never assumed still free.                                                                                                                                       |
| `AcquisitionPlanner`       | `DISCOVERED → SECURITY_REVIEW → RELEVANCE → APPROVAL_REQUIRED → APPROVED → ACQUIRED → SANDBOXED → ANALYZED → STORED → CONFIGURED                                                                                                                                                                                                     | BLOCKED | REJECTED`. READ / CLONE / EXECUTE / INSTALL / CONFIGURE / USE are DIFFERENT actions. |
| `TaskIntelligenceEngine`   | Quality-first selection: `QUALITY → EVIDENCE → ACCURACY → TASK FIT → RELIABILITY → USABILITY → FREE/LOCAL → COST`. `MATERIAL_IMPROVEMENT_MARGIN = 8` quality points. Cost never overrides a required quality threshold.                                                                                                              |
| `RecommendationAssembler`  | `BETTER_CAPABILITY_FOUND / USEFUL_OPEN_SOURCE_FOUND / FREE_LOCAL_MODEL_AVAILABLE` cards: current vs recommended, why, requires, risks, allowed actions.                                                                                                                                                                              |
| `LifecycleLedger`          | `DISCOVERED → VERIFIED → SECURITY_REVIEWED → RECOMMENDED → USER_APPROVED → CONFIGURED → VALIDATED → ACTIVE → STALE → DEPRECATED → BLOCKED`. Never silently deletes deprecated resources; preserves provenance.                                                                                                                       |
| `NotificationGate`         | Only meaningful kinds, relevance ≥ 60/100 surface. Never one notification per ecosystem event.                                                                                                                                                                                                                                       |

### 3.2 Contracts (narrow seams — reuse, not rebuild)

The Intelligence layer **never reaches inside another engine**. Its only external
seams reuse what the frozen estate already provides:

- **`BrainCandidatePort`** (EPIC-016) — the SAME normalized candidate seam
  (configured providers / AI World discoveries / local models) the planner,
  execution bridge and Brain consume. Exactly one source seam for the platform.
- **`BrainPreferencePort`** (EPIC-014/016) — the EPIC-014 preference ledger;
  explicit signals only, inferred behavior never auto-promoted.
- **`GitHubAuthPort`** — GitHub App architecture, short-lived tokens, server-side
  exchange. Never exposes tokens/codes.
- **`GitHubRepoSourcePort`** — read-only repository metadata.
- **Owner-scoped stores** — every lookup keyed by `(userId, id)`; IDOR
  impossible by construction.

### 3.3 Application service

`EcosystemIntelligenceApplicationService` answers the Brain's intelligence
questions — `findBestCapability / findFreeAlternative / findLocalAlternative /
findGitHubCapability / findBetterProvider / checkCapabilityFreshness /
evaluateSecurity / evaluateLicense / requestUserApproval / getAcquisitionPlan /
getFallbackPlan` — through the narrow ports. Every method takes the session
`userId`; secrets never cross this layer.

---

## 4. Gateway wiring

Two new tRPC namespaces in the frozen `RouterRegistry`:

- **`github.*`** — `getConnection / beginConnect / completeAuth / verify / revoke /
disconnect / listRepositories / getPermissions`. Permission review is a
  first-class step (`repoAccessExplicit`, `writeConsent`).
- **`ecosystemIntelligence.*`** — `findBetterOption` (heavy) / `findFreeAlternative` /
  `findLocalAlternative` / `findGitHubCapability` / `findBetterProvider` /
  `evaluateSecurity` / `evaluateLicense` / `checkCapabilityFreshness` /
  `getAcquisitionPlan` (heavy) / `approveAcquisition` / `rejectAcquisition` /
  `respondToRecommendation` / `listLifecycle` / `getLifecycle` /
  `listNotifications` / `markNotificationRead`.

All procedures authenticated + rate-limited (standard/heavy tiers); the auth
middleware enforces `input.userId === session user` AND the service is
owner-scoped (IDOR refused at both layers). Secrets never cross the gateway.

Gateway infrastructure: `EcosystemIntelligencePorts.ts` provides the deterministic
GitHub auth adapter (hermetic CI; live GitHub App exchange = operator step) and
the repository-facts adapter over the AI World discovery store (public repos are
platform-wide facts; private repos only under an explicit grant).

---

## 5. Web UI — `/ecosystem-intelligence`

Premium, clean, progressive disclosure (four tabs):

1. **Task Intelligence** — objective + capability + quality target + privacy →
   `findBetterOption`. The premium "Better capability found" card (current vs
   recommended with quality bars, why, requires, risks, actions: Use Recommended /
   Continue With Current / Review Details / Don't Suggest Again), the honest
   fallback plan, the full options grid, and quick questions (free / local /
   open-source / better provider).
2. **GitHub Connect** — connection state, least-privilege permission review with
   explicit consent toggles, begin/complete authorization, verify / revoke /
   disconnect, and the accessible-repositories list (public vs private boundary).
   Secrets/codes never rendered.
3. **Repository** — security gate + license check + acquisition pipeline:
   assessment form, plan with classification/checks/license verdict/approval
   boundary, approve/reject, and a standalone license quick-check.
4. **Intelligence Memory** — relevance-gated notifications + lifecycle records
   with full provenance (state → state history, evidence, timestamps).

Navigation: "Ecosystem Intelligence" sidebar entry (`/ecosystem-intelligence`).
API client: `useGitHub*` + `useIntelligence*` typed hooks mirror the gateway
contracts.

---

## 6. Honest boundaries

- **GitHub** is connected separately from Google auth; the Google identity token
  is never reused as a GitHub credential. Public discovery needs no repo access.
- **Live GitHub App exchange, live ecosystem discovery and real security scans**
  are **operator steps** (no credentials on this machine) — the deterministic
  adapter is the hermetic default and the ports are ready for live adapters.
- A provider response alone is never success; unexecutable / unevidenced /
  unlicensed resources are reported honestly (PARTIAL, UNKNOWN, LICENSE_UNKNOWN).
- The Intelligence layer **never executes, installs or clones** anything.

---

## 7. Related documents

- [`EPIC_015_BASELINE_AUDIT.md`](./EPIC_015_BASELINE_AUDIT.md)
- [`EPIC_015_SECURITY_MODEL.md`](./EPIC_015_SECURITY_MODEL.md)
- [`EPIC_015_GITHUB_INTELLIGENCE.md`](./EPIC_015_GITHUB_INTELLIGENCE.md)
- [`EPIC_015_COMPLETION_REPORT.md`](./EPIC_015_COMPLETION_REPORT.md)
- Brain integration: [`EPIC_016_BRAIN_ARCHITECTURE.md`](./EPIC_016_BRAIN_ARCHITECTURE.md)
