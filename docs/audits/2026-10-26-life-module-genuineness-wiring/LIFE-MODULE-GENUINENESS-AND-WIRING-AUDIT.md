# Life Module Genuineness & Wiring Audit — 2026-10-26

> **Scope**: every Life-area module reachable from `apps/web`, traced through
> `UI → api-client hook → tRPC procedure → application service → repository →
external adapter → persisted result → UI refresh`.
>
> **Branch / HEAD at audit start**: `main` @ `b3a59359` (`feat(web): auto-launch
ollama service when starting local agent`). Working tree already contained the
> uncommitted changes listed in §9 — none were reverted, reset or rewritten.
>
> **Nothing in this report is a production or live verification.** No deployment
> was contacted, no database was written, no provider was called, no money moved.
> A claim is only ever "the code path exists and is wired", never "it works in
> production".

---

## 1. Executive summary

**What is genuine.** The parts of VedMoulya that can actually earn money are the
parts that persist to Postgres and carry evidence:

| Genuine capability                                                       | Why it is credible                                                                                                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity, auth, provider credentials                                     | Real Postgres repositories + encrypted credential store; every module read is owner-scoped                                                                                                             |
| Missions (Execution)                                                     | Real runtime composition (`MissionService`), Postgres mission checkpointing when a DB is present, refuses to run in production without durable persistence, boot-time recovery of interrupted missions |
| Revenue evidence loop (`world.*`)                                        | Observations → prospects → verified payments with a **bounded status chain** and a **mandatory payment-evidence gate**; Postgres write-through stores in production                                    |
| Client Ops (leads, proposals, contracts, quotations, invoices, payments) | Real Postgres repository path + full UI with query invalidation after mutations                                                                                                                        |
| Knowledge / Memory / Brain                                               | Real Postgres repositories (`PostgresKnowledgeRepository`, `PostgresMemoryRepository`, brain stores)                                                                                                   |
| AI provider routing                                                      | Real adapters (OpenAI/Google/DeepSeek) registered from env; mock only when `AI_ENABLE_MOCK=true` is explicitly set                                                                                     |

**What is simulated or disconnected.**

1. **Marketplace was the worst offender and is now repaired.** The screen showed
   12 installed assets, 3 providers, 2 updates, 8 templates and 100%
   compatibility — all literal strings — over an `INITIAL_ASSETS` array. The real
   `marketplace.getMarketplace` payload was fetched and then ignored, and
   install/uninstall only flipped React state. The backend itself is unseeded and
   in-process, and there is no install/uninstall procedure at all.
2. **Career / Learning / Business / Marketplace are read-only snapshot layers.**
   Their routers expose only `getX`, `getViewModel`, `getConfig`,
   `invalidateCache`. Domain state (`CareerProfileService`, `LearningProfile…`,
   `Business…Service`, `MarketplaceCatalogService`) lives in per-process `Map`s —
   never persisted, never seeded. On the first read after a restart a _guest_
   career/learning/business profile is fabricated in memory so the page has
   something to render.
3. **Three Life screens read the API envelope instead of the snapshot** — a real
   wiring break, now repaired (§7).
4. **Personal Health and Finance have no module of their own.** `/health/*` is
   operational health (`/health/live`, `/health/ready`, `/health/check`); there is
   no `/finance`, `/profile`, `/portfolio` or `/journey` route.
5. **`sendProposal` does not send anything.** It flips `status: 'sent'` and writes
   an in-app notification. SMTP exists in this repo only for identity
   verification emails (`services/identity/src/auth/VerificationEmailSender.ts`).
   There is no email/CRM integration for outreach — outreach is a manual,
   approval-gated human step.

**Fastest realistic path to first revenue.** Not the Marketplace, and not a
"finished Life OS". The shortest honest path is a **paid AI-assisted content &
follow-up workflow delivered through the already-built Content Agency + Client
Ops pipeline**: real deliverable generation, real proposals/invoices/payments,
real revenue verification — with the `world.*` evidence loop from the moment the
first prospect conversation happens. See §10.

---

## 2. Method

1. Read the current git state, the freeze/release documents (`CURRENT_STATE.md`,
   `docs/audits/*`) before touching anything.
2. For each module: locate the route, the hook in `apps/web/src/lib/api-client.ts`,
   the procedure in `services/api/src/services/RouterRegistry.ts`, the handler in
   `services/api/src/routers/*.ts`, the application service in
   `packages/services/src/*`, and the repository in
   `services/api/src/infrastructure/ProductionRepositories.ts` /
   `PersistenceStores.ts`.
3. Treat a module as **persisted** only when a Postgres store is constructed for
   it; treat UI constants, per-process `Map`s and fixtures as **not persisted**.
4. Run `tests`, `eslint` and `tsc` on the touched packages (§8).

Classification vocabulary used below: **VERIFIED LIVE** (independently observed
against an authorised running environment) · **IMPLEMENTED, LIVE UNVERIFIED** ·
**PARTIAL / DISCONNECTED** · **MOCK / SIMULATED** · **HARDCODED / LOCAL-ONLY** ·
**BLOCKED** · **NOT IMPLEMENTED**.

> No module reached **VERIFIED LIVE** in this audit: no deployment, database or
> provider endpoint was contacted. Everything below is at most
> _IMPLEMENTED, LIVE UNVERIFIED_.

---

## 3. Module matrix

| #   | Module                         | Route(s)                                     | Classification                                                            | Persistence                             | One-line evidence                                                                                                                                  |
| --- | ------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Life OS / Dashboard            | `/`, `/life`                                 | IMPLEMENTED, LIVE UNVERIFIED                                              | reads persisted engines                 | `apps/web/src/app/life/page.tsx:130,162` reads `data?.data`; `LifeOSAssembler` composes dashboard/career/learning/business/marketplace snapshots   |
| 2   | Career                         | `/career`                                    | PARTIAL / DISCONNECTED (read-only, non-persistent)                        | in-memory `Map`                         | `packages/services/src/career/CareerProfileService.ts` (Map + `createGuestProfile`); `CareerRouter.ts:11-16` exposes no mutations                  |
| 3   | Learning                       | `/learning`                                  | PARTIAL / DISCONNECTED (read-only, non-persistent)                        | in-memory `Map`                         | `LearningRouter.ts` mirrors Career; page body is honest placeholders                                                                               |
| 4   | Business                       | `/business`                                  | PARTIAL / DISCONNECTED (read-only snapshot; finance reads are real)       | in-memory snapshot + Postgres ClientOps | `BusinessRouter.ts:11-16` read-only; finance tab reads real `clientOps.getRevenueOverview`                                                         |
| 5   | Finance                        | _(no route; inside `/business` Finance tab)_ | PARTIAL                                                                   | Postgres (ClientOps invoices/payments)  | `clientOps.getRevenueOverview` derives paid/outstanding/overdue from invoices + payments                                                           |
| 6   | Health (personal)              | —                                            | NOT IMPLEMENTED                                                           | —                                       | `/health/{live,ready,check}` are operational endpoints only                                                                                        |
| 7   | Execution / Missions           | `/missions`, `/autonomous-builder`           | IMPLEMENTED, LIVE UNVERIFIED                                              | Postgres when DB present                | `MissionService` logs `persistence: this.options.sql ? 'postgres' : 'in-memory'`; gateway passes `sql` + `requireDurablePersistence` in production |
| 8   | Knowledge                      | `/knowledge`                                 | IMPLEMENTED, LIVE UNVERIFIED                                              | Postgres                                | `PostgresKnowledgeRepository` in `ProductionRepositories.ts`; `dashboard-view.tsx` uses `useKnowledgeDashboard`                                    |
| 9   | Memory                         | `/memory`                                    | IMPLEMENTED, LIVE UNVERIFIED                                              | Postgres                                | `PostgresMemoryRepository`; `memory/dashboard-view.tsx`                                                                                            |
| 10  | AI / Provider Router           | `/providers`, `/ai`, `/ai-world`             | IMPLEMENTED, LIVE UNVERIFIED                                              | Postgres credentials (encrypted)        | `registerPlatformProviders` registers real adapters; provider connect/disconnect mutations used by `ProviderConnectFlow.tsx`                       |
| 11  | Marketplace                    | `/marketplace`                               | **was HARDCODED / LOCAL-ONLY → repaired to PARTIAL (honest unavailable)** | none (in-process, unseeded)             | See §5 and §7                                                                                                                                      |
| 12  | Revenue / Opportunities        | `/revenue`                                   | IMPLEMENTED, LIVE UNVERIFIED                                              | Postgres write-through (prod)           | `world.observationRecord/prospectRegister/prospectAdvance` + `FounderEvidenceLoop` bounded chain                                                   |
| 13  | Profile & Settings             | `/settings`                                  | IMPLEMENTED, LIVE UNVERIFIED                                              | depends on section                      | `settings-sections.ts` single source of truth; account/security use identity                                                                       |
| 14  | Progress / Portfolio / Journey | `/progress`                                  | PARTIAL                                                                   | reads Life OS snapshot                  | `progress/page.tsx:63` `asRecord(data?.data)`; portfolio/journey are derived views, no own store                                                   |
| 15  | Local Workspace / Agent        | `/api/local-agent/start`                     | IMPLEMENTED, LIVE UNVERIFIED                                              | host process                            | Spawns the local agent and probes Ollama on `127.0.0.1:11434`                                                                                      |
| 16  | Content Agency (AC-001)        | `/content-agency/*`                          | IMPLEMENTED, LIVE UNVERIFIED                                              | Postgres (schema now declared)          | See §6 — the 16 `content_agency_*`/`client_ops_*` tables had **no DDL anywhere** until the in-flight repair in the working tree                    |
| 17  | Client Ops (AC-002)            | `/content-agency/ops/*`                      | IMPLEMENTED, LIVE UNVERIFIED                                              | Postgres                                | CRM/proposals/contracts/quotations/invoices/payments/documents + `utils.clientOps.*.invalidate()` after mutations                                  |

**16 module areas audited** (the task listed 14 explicitly; Content Agency and
Client Ops were discovered in the repository and are the revenue-critical ones).

---

## 4. Confirmed genuine paths (with evidence)

### 4.1 Revenue evidence loop — `world.*`

- `services/api/src/routers/WorldRouter.ts:1511-1553` — `prospectRegister`,
  `prospectAdvance`, `prospectsList` handlers.
- `packages/world-model/src/application/WorldModelService.ts:1405-1497` —
  `registerProspect` requires provenance; `advanceProspect` **refuses**
  `VERIFIED_PAYMENT` without real payment evidence
  (`PAYMENT_EVIDENCE_REQUIRED`), then records the payment and advances status.
- `packages/world-model/src/domain/FounderEvidenceLoop.ts:299-330` — bounded
  transition table (`CONTACTED → CONVERSATION → PROBLEM_CONFIRMED →
SOLUTION_INTEREST → WTP_SIGNAL/PAYMENT_REQUESTED → VERIFIED_PAYMENT`), with
  `canAdvanceProspect` refusing jumps. Comment: _"conversation ≠ customer,
  interest ≠ revenue, WTP ≠ payment."_
- `packages/world-model/src/domain/FounderEvidenceLoop.ts:645-700` — evidence
  quality is per-dimension and returns `UNKNOWN`/`NEEDS_REVIEW` rather than a
  fabricated score; `nextBestAction` may return `STOP`.
- UI: `apps/web/src/components/EvidenceEntryPanel.tsx:225-236,414-522` wires
  `prospectsList`, `observationRecord`, `prospectRegister`, `prospectAdvance`.
- Persistence: `services/api/src/infrastructure/PersistenceStores.ts:325-338`
  builds `PostgresWorldProspectStore` etc. **only when `NODE_ENV` is
  production/staging** (`resolvePersistenceBundle`, lines 480-492).

### 4.2 Client Ops money trail

- `packages/services/src/content-agency/ClientOperationsApplicationService.ts:638`
  `sendProposal` — status `draft → sent` + in-app notification. **No external
  send.**
- `…:929` `acceptProposal` — promotes the linked lead to `won`.
- `…:1029` `addPayment` — validates the invoice, records the payment, marks the
  invoice `paid` **only when the sum of recorded payments covers the amount**.
- `…:1064` `getRevenueOverview` — paid / outstanding / overdue derived from
  invoices + payments.
- No fabrication: a failed status update after a recorded payment returns
  `'Payment recorded but invoice could not be marked paid'`.

### 4.3 Scheduler honesty

- `services/api/src/routers/SchedulerRouter.ts:67-79` — `getRuntimeStatus`
  returns `{ active: false, reason: 'not_started' }` when no cadence driver is
  bound. The UI never claims automatic discovery is running.
- `apps/web/src/app/api/trpc/[trpc]/route.ts:169-190` — the cadence driver starts
  only **after** persistence hydration succeeds, inside the Next.js server
  process. There is no cron/worker deployment in the repository (no `vercel.json`
  crons, no worker entrypoint), so "continuous" operation is bounded by request
  traffic and process lifetime — reported as such, not assumed.

### 4.4 AI routing

- `services/orchestrator/src/index.ts:171-193` — registering providers short
  circuits to `MockProvider` **only** when `AI_ENABLE_MOCK=true` and
  `NODE_ENV !== 'test'`; production registers the real adapters from env.

---

## 5. Marketplace integrity findings (re-verified at HEAD `b3a59359`)

All four previously reported findings were still present in
`apps/web/src/app/marketplace/page.tsx` (11,738 bytes at HEAD):

| Finding              | Evidence at HEAD                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Fixed stat values    | `value: '12'` (Installed Assets), `'3'` (AI Providers), `'2'` (Updates), `'8'` (Templates), `'100%'` (Compatible)            |
| Hardcoded asset list | `const INITIAL_ASSETS: MarketplaceAsset[] = [...]` — 6 rows, 3 marked `Installed`                                            |
| Hook result unused   | `const { isLoading } = useMarketplace(userId);` — the snapshot was fetched, never read                                       |
| Local-only install   | `handleToggleInstall` mapped over React `useState` assets; `Configure` button switched tabs, `Uninstall` toggled local state |

Backend reality (this is why the fix is "unavailable", not "wire it up"):

- `services/api/src/routers/MarketplaceRouter.ts:11-16` — the only procedures are
  `getMarketplace`, `getViewModel`, `getConfig`, `invalidateCache`. **There is no
  install/uninstall mutation**, and `RouterRegistry.ts:2832-2845` registers
  exactly those four.
- `packages/services/src/marketplace/MarketplaceCatalogService.ts`,
  `MarketplaceAssetService.ts`, `MarketplaceProviderService.ts`,
  `MarketplaceInstallationService.ts` are all `new Map(...)` in-process stores.
- `registerAsset(` / `registerProvider(` / `startInstallation(` have **no call
  site outside `__tests__`** — the catalog is never seeded, so in production the
  snapshot is genuinely empty (`totalAssets: 0`, no providers, no updates).

Therefore: an install mutation over an unseeded, per-process map would be _fake
persistence_ (silently lost on the next request after a cold start). The honest
repair is to render what the backend returns and mark the capability unavailable.

---

## 6. Confirmed wiring defects (repaired)

| Defect                                                            | Impact                                                                                                                                                                                             | Evidence                                                                                                 |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/business` read the tRPC **envelope** as if it were the snapshot | Every list (`goals`, `projects`, `kpis`, `risks`, `insights`) rendered empty, `profile.businessName` always null, journey strip always "not started" — for every user, regardless of backend state | `apps/web/src/app/business/page.tsx:222` at HEAD: `const raw = (data ?? {}) as Record<string, unknown>;` |
| `/career` passed the envelope to `careerJourneySteps`             | Journey strip permanently reporting "not started"                                                                                                                                                  | `career/page.tsx:180` at HEAD                                                                            |
| `/learning` passed the envelope to `learningJourneySteps`         | Same                                                                                                                                                                                               | `learning/page.tsx:180` at HEAD                                                                          |
| Fabricated status badges                                          | `Skills Analyzed` (career), `5-day streak` (learning), `All Systems Healthy` (business) — none backed by data                                                                                      | `career/page.tsx:174`, `learning/page.tsx:174`, `business/page.tsx:261` at HEAD                          |

---

## 7. Repairs implemented

All repairs are additive and local to the UI layer; no API contract, frozen
module or architectural boundary was changed.

| File                                                                        | Change                                                                                                                                                                                                                                                                                                                                                                                          | Reason                                                                                                                                                                           |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/marketplace/marketplace-view.ts` **(new)**                | Pure derivation of counts/assets/providers/updates/compatibility from the `getMarketplace` payload; `unavailable` / `empty` / `ready` states; explicit `MARKETPLACE_INSTALL_AVAILABLE = false` + reason                                                                                                                                                                                         | Makes fabricated numbers structurally impossible — the page has no other data source                                                                                             |
| `apps/web/src/app/marketplace/page.tsx`                                     | Rewritten to render only the derived view. Removed `INITIAL_ASSETS`, every fixed count, `'2 Updates Available'`, `handleToggleInstall` and all `setAssets` state. Added transport-error + retry, `unavailable` and `empty` states, real provider list with reported status, real update list, compatibility derived from reported checks. Install/uninstall render **disabled** with the reason | §5                                                                                                                                                                               |
| `apps/web/src/app/career/page.tsx`                                          | `careerJourneySteps(data?.data)`; removed the `Skills Analyzed` badge + unused import                                                                                                                                                                                                                                                                                                           | §6                                                                                                                                                                               |
| `apps/web/src/app/learning/page.tsx`                                        | `learningJourneySteps(data?.data)`; removed the `5-day streak` badge                                                                                                                                                                                                                                                                                                                            | §6                                                                                                                                                                               |
| `apps/web/src/app/business/page.tsx`                                        | Snapshot read from `data.data`; journey fed the snapshot; `All Systems Healthy` replaced by a badge derived from `snapshot.health.overall` and rendered only when present                                                                                                                                                                                                                       | §6                                                                                                                                                                               |
| `apps/web/src/app/business/__tests__/business-autonomous-modules.test.tsx`  | Fixture now returns the real envelope `{ success, data }` instead of a bare snapshot                                                                                                                                                                                                                                                                                                            | The fixture contradicted the production contract (`fromServiceResult` wraps every procedure result); with the corrected fixture the test **verifies** the page reads `data.data` |
| `apps/web/src/app/marketplace/__tests__/marketplace-view.test.ts` **(new)** | 15 tests: derived counts, dedupe, update marking, no invented compatibility %, gateway-failure and missing-payload unavailability, malformed-row rejection, install-capability flag, plus source guards against `INITIAL_ASSETS` / fixed counts / `setAssets`                                                                                                                                   | §5 regression guard                                                                                                                                                              |
| `apps/web/src/app/marketplace/__tests__/page.render.test.tsx` **(new)**     | 5 DOM tests (jsdom): rendered stat values equal the snapshot's counts and never `12`; install buttons are disabled; empty snapshot renders the empty state with no fabricated assets; gateway rejection and transport error render their own honest states                                                                                                                                      | Proves the behaviour in the DOM, not just in a pure function                                                                                                                     |
| `apps/web/src/app/__tests__/life-envelope-wiring.test.ts` **(new)**         | 7 tests asserting the three screens read the snapshot (not the envelope) and no fabricated badges return                                                                                                                                                                                                                                                                                        | §6 regression guard                                                                                                                                                              |

**Deliberately not done** (would require authorisation or would be dishonest):

- No marketplace install/uninstall mutation was added — the backing store is
  unseeded and in-process, so the mutation could not persist.
- No catalog seeding for the marketplace — inventing asset rows is exactly what
  this audit forbids.
- No persistence was added to Career/Learning/Business — that is a schema and
  architecture decision for the owning frozen modules, not a wiring repair.
- The 16 missing `content_agency_*` / `client_ops_*` DDL statements already
  existed as an uncommitted working-tree repair
  (`services/content-agency/src/infrastructure/persistence/contentAgencySchema.ts`,
  +1 export in `src/index.ts`, `DatabaseConnection.ts` wiring). They were
  reviewed and **left untouched**; they were **not executed against any
  database**.

---

## 8. Verification actually performed

| Command                                                                                                                                          | Result                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `npx vitest run apps/web/src/app/marketplace`                                                                                                    | **20/20 pass** (15 derivation + 5 render)   |
| `npx vitest run apps/web/src/app/__tests__/life-envelope-wiring.test.ts apps/web/src/app/marketplace`                                            | **22/22 pass**                              |
| `npx vitest run apps/web/src/app/business`                                                                                                       | **9/9 pass** (after the fixture correction) |
| `npx eslint apps/web/src/app/marketplace apps/web/src/app/career/page.tsx apps/web/src/app/learning/page.tsx apps/web/src/app/business/page.tsx` | **0 errors, 0 warnings**                    |
| `npx tsc --noEmit -p apps/web/tsconfig.json`                                                                                                     | **exit 0**                                  |
| `npx vitest run apps/web` (whole web workspace)                                                                                                  | see §8.1                                    |

### 8.1 Whole-workspace result (honest, including the failure)

`npx vitest run apps/web`, run twice after the changes (logs:
`_audit-web-tests.log`, `_audit-web-tests-rerun.log`):

```
Test Files  1 failed | 91 passed (92)
     Tests  1 failed | 1399 passed (1400)
```

The single failure is
`src/app/health/__tests__/ready-identity-schema-gate.test.ts › "refuses readiness
when the check does not settle within the probe bound"` — **Test timed out in
5000ms** (observed at 5017 ms) inside a `vi.useFakeTimers()` test.

- That file was **not modified by this audit** (not in §7, not in `git status`).
- The same file **passes 25/25 in isolation** (`npx vitest run
apps/web/src/app/health/__tests__/ready-identity-schema-gate.test.ts`).
- It is therefore reported as a pre-existing timing sensitivity under the
  92-worker parallel run, not as a pass and not as a regression of this work.

No test was skipped, weakened or deleted to obtain a green result; the single
fixture change is documented and explained in §7.

**Not performed (and therefore not claimed):** typecheck of the whole monorepo,
the full `npm run quality` gate, any production/live check, any real provider
call, any database migration or query, any deploy, push or publish.

---

## 9. Git state

| Field                                                    | Value                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch                                                   | `main`                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| HEAD at audit start                                      | `b3a59359`                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Remote                                                   | `origin git@github.com:ak9848515-dev/vedmoulya.git` (**not pushed**)                                                                                                                                                                                                                                                                                                                                                                               |
| Pre-existing uncommitted changes (preserved, untouched)  | `packages/mission-controller/src/application/MissionControllerService.ts`, `packages/mission-runtime/src/composition/MissionRuntime.ts`, `services/api/src/infrastructure/ProductionRepositories.ts`, `services/api/src/services/MissionService.ts`, `services/content-agency/src/index.ts`, `services/content-agency/src/infrastructure/persistence/DatabaseConnection.ts`, plus the untracked `_audit-*.mts` probes and `contentAgencySchema.ts` |
| Changes made by this audit                               | §7 (2 new source files, 1 rewritten page, 3 page repairs, 1 fixture correction, 2 new test files, this report)                                                                                                                                                                                                                                                                                                                                     |
| Push / merge / deploy / publish                          | **none**                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Money spent, prospects contacted, external messages sent | **none**                                                                                                                                                                                                                                                                                                                                                                                                                                           |

---

## 10. Shortest credible path to the first paying client

### 10.1 The offer

**"Done-for-you AI content + follow-up engine for one local service business."**

- **Customer problem**: the owner writes social posts/emails inconsistently and
  loses warm enquiries because nobody follows up.
- **Deliverable** (all producible today with verified code): a brand profile, a
  30-day content calendar, 12 long-form drafts + 8 short-form variants, a
  4-message follow-up sequence per enquiry channel, and one weekly report — all
  generated through Content Agency (`contentAgency.generate*`) and tracked as a
  project with deliverables in Client Ops.
- **Scope**: one business, one channel set, 30 days, 2 revision rounds.
- **Price**: a fixed **₹15,000–₹25,000** pilot for 30 days (price is a proposal,
  not a claim about what a buyer will pay). Payment: 50% on start, 50% on
  delivery, recorded via `clientOps.addPayment` only when actually received.
- **Why this offer**: zero infrastructure cost (existing repo + existing AI
  keys), no new integrations required, deliverable is inspectable by the buyer,
  and every step after "draft" is already persisted and auditable.

### 10.2 The pipeline, and where each step already exists

| Step             | Where it lives                                                                                  | Status                     |
| ---------------- | ----------------------------------------------------------------------------------------------- | -------------------------- |
| Offer definition | Client Ops quotation + proposal templates (`clientOps.createQuotation`, `createProposal`)       | implemented                |
| Prospecting      | `world.prospectRegister` (provenance **mandatory**) + Client Ops CRM leads                      | implemented                |
| Qualification    | `world.evaluateOpportunity` + `opportunityPipeline` (evidence-weighted, advisory)               | implemented                |
| Preparation      | `clientOps.generateProposal` (AI) → `status: 'draft'`                                           | implemented                |
| Approval         | Human review required before anything leaves the system — see 10.3                              | **manual gate, by design** |
| Delivery         | Client Ops projects + tasks + deliverables; Content Agency generation                           | implemented                |
| Invoicing        | Content Agency invoices + `clientOps.*Quotation/Contract`                                       | implemented                |
| Payment          | `clientOps.addPayment` — operator-recorded, verified against the invoice total                  | implemented (manual entry) |
| Verification     | `world.prospectAdvance → VERIFIED_PAYMENT` **refuses to advance without payment evidence text** | implemented                |
| Learning         | `world.factorCalibrate`, `nextBestAction`, `opportunityCompare`                                 | implemented                |

### 10.3 The honesty guardrails that already exist

- `sendProposal` sets `sent` but **transmits nothing** — outreach stays a human
  action, so there is no spam risk and no approval bypass.
- `VERIFIED_PAYMENT` is unreachable without real payment evidence.
- `nextBestAction` can return `STOP`.
- Evidence quality reports `UNKNOWN` rather than a fabricated score.

### 10.4 Remaining steps to a real paying client (in order)

1. Choose the deliverable format and price; record it as a Client Ops quotation
   (no external contact).
2. Identify 10 real prospects **the operator already knows** (past colleagues,
   local businesses with a visible content gap). Record each with provenance.
3. Hold 3 conversations. Record observations; let the loop tell you `TALK_TO_CUSTOMERS`
   or `TEST_WTP` — do not skip to building.
4. Generate one tailored proposal per interested prospect, review it by hand,
   and send it **manually** from the operator's own mailbox.
5. On acceptance: create the contract, deliver, invoice, and record payment only
   when the money is visible in the operator's account.
6. Advance the prospect to `VERIFIED_PAYMENT` with the transaction reference —
   the first real revenue row.

**Blockers to steps 2-6 that are not code**: the operator's prospect list, the
operator's mailbox, and the operator's willingness to have 3 sales conversations.
No credential, deployment or paid service stands between this repository and a
first invoice.

---

## 11. Remaining blockers (no secrets disclosed)

| Blocker                                                                                                                                                                                                                                                                                                                                  | Type                                 | Evidence                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No marketplace catalog/provider seeding and no install/uninstall API                                                                                                                                                                                                                                                                     | Code (owner decision)                | §5                                                                                                                                                            |
| Career / Learning / Business module state is per-process and read-only                                                                                                                                                                                                                                                                   | Code (frozen-module schema decision) | §3 rows 2-4                                                                                                                                                   |
| ~~`DATABASE_URL` is not present in `.env.local`~~ — **CORRECTED 2026-10-26 by MISSION 001**: `DATABASE_URL` _is_ set and resolves to a remote Neon host; the original check was truncated by `head -40`. See `docs/audits/2026-10-26-revenue-loop-persistence-proof/`. The `resolvePersistenceBundle` `NODE_ENV` observation still holds | Environment                          | re-checked with a full key inventory in MISSION 001                                                                                                           |
| `content_agency_*` / `client_ops_*` DDL not yet applied to any database                                                                                                                                                                                                                                                                  | Operator action                      | `contentAgencySchema.ts` exists in the working tree only; executing DDL against a live database was **not** authorised in this task                           |
| No outbound email/CRM for outreach                                                                                                                                                                                                                                                                                                       | Code (by design)                     | SMTP only in `services/identity/.../VerificationEmailSender.ts`                                                                                               |
| `AI_ENABLE_MOCK` is `true` in the local env                                                                                                                                                                                                                                                                                              | Environment                          | while set, every AI call takes the deterministic mock path (`registerPlatformProviders` early return) — AI text produced locally is **not** real model output |
| No deployed environment was checked                                                                                                                                                                                                                                                                                                      | Authorisation                        | no deploy/probe performed                                                                                                                                     |

---

## 12. The three highest-value next actions

1. **Apply the content-agency/client-ops schema to the target database and
   verify one invoice → payment → revenue-overview round trip.** Until those 16
   tables exist, the entire money-recording surface is non-functional in a live
   database, which makes every revenue claim below it theoretical.
2. **Seed the marketplace catalog from a real source (or delete the page from
   navigation).** An empty marketplace with disabled install buttons is honest
   but useless; a seeded one is a genuine feature. Both are better than what was
   there before.
3. **Run the first three prospect conversations and record them in the evidence
   loop.** The software is ready to _record and qualify_ revenue; it cannot
   create demand. This is the only step that converts any of the above into
   income.

---

## Appendix A — Files changed in this audit

```
apps/web/src/app/marketplace/marketplace-view.ts                    (new)
apps/web/src/app/marketplace/page.tsx                               (rewritten)
apps/web/src/app/marketplace/__tests__/marketplace-view.test.ts     (new)
apps/web/src/app/__tests__/life-envelope-wiring.test.ts             (new)
apps/web/src/app/career/page.tsx                                    (envelope unwrap, badge removed)
apps/web/src/app/learning/page.tsx                                  (envelope unwrap, badge removed)
apps/web/src/app/business/page.tsx                                  (envelope unwrap, health badge derived)
apps/web/src/app/business/__tests__/business-autonomous-modules.test.tsx (fixture → real envelope)
docs/audits/2026-10-26-life-module-genuineness-wiring/LIFE-MODULE-GENUINENESS-AND-WIRING-AUDIT.md (this file)
```

## Appendix B — What a future auditor should re-check first

1. Does `world_prospects` / `world_observations` actually hold rows in the target
   environment? (If not, the revenue loop has never been exercised for real.)
2. Do the `content_agency_*` tables exist? (`relation does not exist` was the
   pre-existing failure mode.)
3. Does `marketplace.getMarketplace` still return an empty snapshot?
4. Is `AI_ENABLE_MOCK` still set in the environment being evaluated? If yes, no
   AI output in that environment is real.
5. Does `scheduler.getRuntimeStatus` report `active: true`? If not, no automatic
   discovery has run.
