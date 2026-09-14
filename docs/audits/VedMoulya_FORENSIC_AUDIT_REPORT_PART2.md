# VedMoulya — Forensic Audit, Part 2 (extended phases)

**Continues:** `VedMoulya_FORENSIC_AUDIT_REPORT.md`
**Date:** 2026-09-12
**Branch / HEAD:** `main` @ `5a8874861b2f3f61844bfbe20c602a3d1512c539`
**Code changed in Part 2:** **none.** Every item below is either a _verified clean_ result or a
_reported (not remediated)_ finding. All gate results in Part 1 §S therefore still hold.
These phases close most of Part 1 §U.9.

Reproduction commands for everything in this document are in §P2.9.

---

## P2.1 Test forensics — skipped / disabled tests

Scanned every `.ts`/`.tsx` under `apps/web/src`, `packages/`, `services/` for
`it.skip` / `test.skip` / `describe.skip` / `it.todo` / `it.failing` / `xit` / `xdescribe`.

**Result: 2 occurrences, both legitimate.**

| Location                                                            | Form                                                       | Verdict                                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/api/src/__tests__/ConnectionBudgetConcurrency.test.ts:44` | `const describeReal = testUrl ? describe : describe.skip;` | **INFO** — a real-Postgres integration suite gated on `testUrl` being present. Skips when no database is provisioned (local runs, no infra). This is correct conditional-integration behaviour, not a disabled failure. |
| `services/api/src/__tests__/PersistenceStores.test.ts:96`           | same pattern                                               | **INFO** — same.                                                                                                                                                                                                        |

**No permanently-skipped test, no `.todo` placeholder test, and no commented-out assertion
was found.** Nothing was skipped, weakened, or deleted to make a gate pass.

---

## P2.2 Frontend product audit — dead UI, placeholders, fake data

Checks run against `apps/web/src` (production files only, tests excluded):

| Check                                                                                                       | Result                                                                               |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Dead anchors `href="#"`                                                                                     | **0**                                                                                |
| No-op handlers `onClick={() => {}}`                                                                         | **0**                                                                                |
| `alert(` / `debugger` / `console.debug` leftovers                                                           | **0** (the "debugger" hits are product copy describing an _ABAP debugger assistant_) |
| `TODO` / `FIXME` / `HACK` in any `.tsx`                                                                     | **0**                                                                                |
| Fake/placeholder data markers (`John Doe`, `lorem`, `foo@bar`, `test@example`, `dummy data`, `sample data`) | **0**                                                                                |

### "Coming soon" cards — verified as honest empty states, not dead buttons

The only placeholder UI in the app is a set of explicitly-labelled empty states:

- `apps/web/src/app/business/page.tsx` — 6 tabs (Goals, Projects, KPIs, Finance, Risks,
  Opportunities) each render a heading plus "…coming soon." text.
- `apps/web/src/app/career/page.tsx` — 4 tabs (Resume, Interview, Jobs, Certifications),
  same pattern.

**Verdict: INFO — acceptable.** Each is a `<Card>` with an explicit "coming soon" sentence
disclosed to the user. There is **no** button that appears functional and does nothing, no
fabricated metric, and no hardcoded production-looking data. This is the honest way to ship
a not-yet-built module, and it was **not** removed.

---

## P2.3 API / route matrix — frontend calls vs registered procedures

This closes the largest gap in Part 1 §F. Method: parse every namespace/procedure registered
by the gateway's `createAppRouter` in `services/api/src/services/RouterRegistry.ts`, then
extract every `api.<ns>.<proc>.<useQuery|useMutation|useInfiniteQuery|query|mutate|fetch|setData|invalidate|refetch>`
call site in `apps/web/src`, and diff.

| Metric                                          | Count |
| ----------------------------------------------- | ----- |
| Registered namespaces                           | 52    |
| Registered procedures                           | 641   |
| Distinct procedures called by the web app       | 454   |
| **Frontend calls with NO registered procedure** | **0** |
| **Frontend namespaces not registered**          | **0** |

### **Result: the frontend↔gateway contract is intact.** Zero broken calls.

There is no call site in the web application that targets a procedure the gateway does not
register, and no call site targeting an unregistered namespace. Every route the UI depends on
exists.

### P2.3.1 Finding (P3): 51 registered procedures have no caller _and_ no documentation

187 procedures are registered but never called by the web app. Of those, I then searched the
rest of the repository (`scripts/`, `services/`, `packages/`, e2e tests, all markdown,
`07_Operations/`) for any textual consumer:

- **122** have some other textual reference (usually a router-module comment or a benchmark).
- **65** have **no consumer anywhere scanned**.
- Of those 65, **14 are documented** in `03_Architecture/API_V1_CONTRACT.md`.
- **51 are uncalled, unreferenced anywhere, and undocumented.**

**This is deliberately reported, not remediated.** Reasons:

1. The gateway's stated architecture is a "unified tRPC router exposing all certified
   modules" — the API surface is a product contract for clients outside this repository
   (external/ops/mobile), so "no caller here" is **not** proof of dead code.
2. Removing them would delete functioning API surface — explicitly forbidden by the brief.
3. Documenting all 51 in the contract would require asserting input/output schemas I would
   be inferring, i.e. risk of fabrication. Worse than a gap.

The 51 (grouped for a follow-up decision — document as public surface, or retire):

- `ecosystemWorkflow.*` — **all 11** (`start`, `get`, `list`, `approve`, `reject`, `pause`,
  `resume`, `cancel`, `listWorkflows`, `getWorkflow`). Note: this is the _entire_ namespace,
  and its only other implementation was the untyped duplicate class deleted in Part 1 §C.4.
- `world.problem*` — 12 (`problemGet`, `problemAssess`, `problemAdvance`, `problemAddEvidence`,
  `problemPlanExperiment`, `problemCustomerDiscovery`, `problemBusinessCandidate`,
  `problemRecordCustomerSignal`, `problemRecordVerifiedPayment`, …).
- `world.*` other — 7 (`evidenceQualityView`, `factorCalibrate`, `graphRelations`,
  `nextBestActionView`, `observationsList`, `opportunityCompare`).
- `providers.*` writes — 4 (`createVersion`, `deleteProvider`, `setCapabilityMatrix`,
  `updateProvider`).
- `capabilities.*` — 4 (`deleteCapability`, `updateCapability`, `getTransitiveDependencies`, …).
- `context.*` — 4; `contentAgency.*` — 3; `ops.*` — 4 (`diagnostics`, `failures`, `trace`,
  `alertThresholds`); `memoryIntelligence.*` — 2; `learningIntelligence.*` — 2;
  `orchestrator.getConcurrency`, `liveIntelligence.verify`, `rag.getReadiness`,
  `clientOps.exportProposal`, `lifeOS.getConfig`.

---

## P2.4 Persistence wiring — every production repository factory is used

Extracted all exported factories from `services/api/src/infrastructure/ProductionRepositories.ts`
and checked each for references outside its own definition file.

**Result: 24/24 factories are referenced. Zero orphaned repository factories.**
(`createProductionIdentityRepository`, `…Memory…`, `…Decision…`, `…Execution…`,
`…Knowledge…`, `…ContentAgency…`, `…ClientOps…`, `…Provider…`, `…Capability…`, `…Context…`,
`…ExecutionStrategy…`, `…Goal…`, `…Task…`, `…Pipeline…`, `…Learning…`, `…Brain…`,
`…KnowledgeIntelligence…`, `…MemoryIntelligence…`, `…OSIntelligence…`,
`…ContextFabricRepository`, `…ApplicationRepository`, `…RequirementSessionStore`,
`…RagRepository`, `createEISql` — all consumed.)

Combined with Part 1 §C.2 (the in-memory repositories are a documented, test-injected
hermetic double, not a production default), the gateway's repository wiring is clean.

---

## P2.5 Provider / AI adapter matrix

Inventoried every runtime adapter class in `services/orchestrator/src/providers/` and every
place one is constructed.

**Implemented adapters (8):** `OpenAIProvider` (raw fetch, legacy),
`VercelAIProvider` (SDK, primary), `DeepSeekProvider`, `GoogleGeminiProvider`,
`OllamaProvider`, `OpenAICompatibleProvider`, `OpenAIEmbeddingProvider`, `MockProvider`.

**Runtime registration** (`services/orchestrator/src/index.ts::registerPlatformProviders`):
`openai` (`VercelAIProvider`, or `OpenAIProvider` when
`AI_RUNTIME_LEGACY_RAW_FETCH=true`), `deepseek`, `google`, `ollama`, plus one
`OpenAICompatibleProvider` per configured custom provider, plus `MockProvider` when mock mode
is on. `AI_ENABLE_MOCK=true` (outside vitest) registers **only** the mock, on purpose, so real
providers cannot burn timeout/retry budget against fake endpoints — documented and correct.

### P2.5.1 Verified: `anthropic` is catalog-only, and the repo _knows_ it

`anthropic` appears in the `ProviderId` union (`packages/ai/src/types/index.ts`) and in the
provider catalog, but **no Anthropic adapter exists**, and a test asserts it is absent from
runtime registration (`services/orchestrator/src/__tests__/index.test.ts:248`:
`expect(actual).not.toContain('anthropic')`).

This is explicitly acknowledged by the repository, not an oversight:
`services/api/src/infrastructure/ProductionAIConfig.ts` documents and **enforces** that
`AI_DEFAULT_PROVIDER` must name a family with a real adapter:

> `'(catalog-only family — no ProviderAdapter exists). Choose AI_DEFAULT_PROVIDER=openai, deepseek or google.'`

**Verdict: INFO — known, guarded, intentional.** Not a defect.

### P2.5.2 Verdict on the `protocol` field: documented limitation, not broken wiring

`AddProviderPanel.tsx` offers protocols including `'anthropic-compatible'`, and maps them to
registry _families_. This looked like a UI option that cannot work, so it was traced fully:

- The UI maps protocol → family (`PROTOCOL_TO_FAMILY`) and **rejects** anything unsupported
  with an explicit error, and its own comment states it _"never claims a custom endpoint is
  wired into the AI runtime."_
- `registerProvider` stores a **registry record** (family + model metadata) — it does **not**
  register a runtime adapter. `providers.testConnection` does branch on `protocol`
  (`openai-compatible` → probes `{endpoint}/models`; others → reachability only).
- Runtime adapters are built from environment-configured credentials
  (`registerPlatformProviders`), a separate path.

**Verdict: INFO — honest, self-documented behaviour.** The UI does not promise execution it
cannot deliver. The residual nicety — warning a user that the `anthropic` family has no
adapter — is a UX polish item, not a wiring defect.

---

## P2.6 The deleted duplicate router, re-examined after the fact

Part 1 §C.4 removed `services/api/src/routers/EcosystemWorkflowRouter.ts`. Part 2 independently
confirmed _why_ it was dead, which strengthens the deletion:

- The gateway's `ecosystemWorkflow` namespace is implemented **inline** in
  `RouterRegistry.ts:4643+` against `services.ecosystemWorkflow`.
- That service is a real, live wiring:
  `ApiApplicationService:600` declares
  `readonly ecosystemWorkflow: import('@vedmoulya/ecosystem').WorkflowExecutionService` and
  `:2175` constructs `new WorkflowExecutionService({...})`.
- The deleted class exposed **the same 11 operations** (`start`, `get`, `list`, `approve`,
  `reject`, `pause`, `resume`, `cancel`, `listWorkflows`, `getWorkflow`) with every input and
  return typed `unknown` / `Promise<unknown>`, and was **never instantiated anywhere**
  (`git grep EcosystemWorkflowRouter` → no references outside itself).

So it was a **parallel, untyped, unreachable duplicate** of infrastructure that already
existed correctly elsewhere. Deleting it removed genuine redundancy (Part 1 §D/Phase 17) and
lost no functionality. `typecheck`, `build`, and the full test suite all pass without it.

---

## P2.7 Updated test-quality position

Part 1 §L reported the suite as green (830 files / 10,609 tests) but did not claim a
per-assertion quality review. Part 2 adds the mechanical checks that can be done reliably:

| Mechanical check                     | Result                                       |
| ------------------------------------ | -------------------------------------------- |
| Permanently skipped / disabled tests | **0**                                        |
| `.todo` placeholder tests            | **0**                                        |
| Test files                           | 871 (of 3,990 tracked)                       |
| Suite result                         | 830 files, 10,609 tests, all passing         |
| Coverage gate                        | 14/14 projects, 54 workspaces, 80% threshold |

**Still not claimed:** a semantic review of all 871 test files for assertions that cannot
fail ("does this assertion actually protect behaviour?"). That remains open (§P2.8).

---

## P2.8 Remaining findings after Part 2

| ID     | Severity        | Finding                                                                                                                                              | Disposition                                                                                                                                           |
| ------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2.8.1 | **P3**          | 51 registered procedures are uncalled, unreferenced and undocumented (§P2.3.1). Includes the entire `ecosystemWorkflow` namespace.                   | **Reported.** Requires a product decision (publish in `API_V1_CONTRACT.md` or retire). Not removed — API surface may serve clients outside this repo. |
| P2.8.2 | **P3**          | The `anthropic` provider family is selectable in the UI but has no runtime adapter (§P2.5.1).                                                        | **Reported.** Already documented and enforced in `ProductionAIConfig`; a UI warning would be the polish fix.                                          |
| P2.8.3 | **P3**          | `services/content-agency` has no DDL / migration runner (Part 1 §U.1).                                                                               | **Open** — needs a provisioning decision; docs already corrected.                                                                                     |
| P2.8.4 | **P3**          | 71 env vars used but undocumented (Part 1 §U.2).                                                                                                     | **Reported.** Mostly runner-provided, test-only, or defaulted knobs.                                                                                  |
| P2.8.5 | **NOT CLAIMED** | Semantic test-quality review of 871 test files; deep security review (SSRF/XSS/IDOR/tenant isolation); per-engine orchestration state-machine trace. | **Genuinely not done.** Not reported as clean.                                                                                                        |

**No P0, P1 or P2 finding remains open from either part.**

---

## P2.9 Reproduction commands

```bash
# Skipped / disabled tests
grep -rnE '\b(it|test|describe)\.(skip|todo|failing)\b|\bxit\(|\bxdescribe\(' \
  --include='*.ts' --include='*.tsx' apps/web/src packages services

# Dead UI / placeholders / fake data
grep -rnE 'href="#"' --include='*.tsx' apps/web/src
grep -rnE 'onClick=\{\(\)\s*=>\s*\{\s*\}\}' --include='*.tsx' apps/web/src
grep -rnE 'TODO|FIXME|HACK' --include='*.tsx' apps/web/src

# tRPC matrix (namespaces/procedures registered vs called)
#   parse `createAppRouter` in services/api/src/services/RouterRegistry.ts
#   vs  `api.<ns>.<proc>.<hook>` call sites in apps/web/src

# Persistence factories
grep -nE '^export (function|const) create' \
  services/api/src/infrastructure/ProductionRepositories.ts

# Provider adapters and registration
ls services/orchestrator/src/providers/
grep -n 'registerProvider' services/orchestrator/src/index.ts
```

---

## P2.10 Grade impact

Part 2 **raises** confidence on the frontend and API layers without changing the headline
grade.

- **Verified clean (new):** zero broken frontend→gateway calls across 52 namespaces / 641
  procedures; zero dead UI handlers, dead anchors, debug leftovers, fake data, or TODO markers
  in the web app; zero permanently-skipped tests; 24/24 repository factories wired.
- **Confirmed with proof (new):** the Part 1 router deletion removed an untyped, never
  instantiated duplicate of already-working infrastructure.

The grade therefore stays **B+**, for the same reasons given in Part 1 — the open P3s
(schema provisioning, 51 undocumented procedures, env-var documentation) are real, and the
semantic test-quality review plus deep security review remain genuinely unperformed. Part 2
moves several "unknown" areas to "verified clean", which is progress toward an **A** but not
yet there.
