# EPIC-007 — AI Application Factory: Application Blueprint

> **Status:** COMPLETE · **Date:** 2026-08-08
> The blueprint is the **source of truth** for a generated application
> (Phase 7). Every generated project carries one; the UI exposes it through
> `factory.getDetail`.

---

## 1. Blueprint shape (`ApplicationBlueprint`)

```
ApplicationBlueprint
├── specification        ApplicationSpecification (Phase 1)
├── architecture         ApplicationArchitecture (Phase 2)
├── taskGraph            ApplicationTaskGraph (Phase 3, loop-reusable)
├── technologies         Array<{ name, category }>
├── files                planned files (path, kind, purpose, producedBy)
├── dependencies         declared runtime dependencies
├── environment          env contract + secrets policy
├── database             schema + storage notes
├── APIs                 typed API contract endpoints
├── tests                unit + integration test plan
├── deployment           supported target + artifact
└── acceptanceCriteria   derived from the specification
```

`BlueprintService.build` derives it deterministically from the specification +
architecture + task graph + planned file tree. The UI shows a **preview**
(plan estimate, technologies, what will be built) before any file is written —
the Phase 8 approval gate.

## 2. The three controlled archetypes

| Archetype        | Generated project          | Key capabilities                                                                                                                     |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `abap-debugger`  | ABAP Debugger Assistant    | ABAP source input, syntax analysis, error explanation, SAP knowledge retrieval, correction suggestions, test generation, explanation |
| `restaurant-app` | Restaurant App             | menu, categories, cart, orders, customer interface, admin dashboard, responsive UI                                                   |
| `ai-app-builder` | AI App Builder (meta-test) | requirements capture, architecture suggestions, capability selection, guided implementation                                          |

Archetypes are **declarative templates** (`catalog/archetypes.ts` +
`catalog/generator.ts`), not special-case code — the architecture stays generic
so future app builders reuse the same engines.

## 3. Generated file tree (deterministic, typed, testable)

Every generated project follows the same convention (adopted from the
create-t3-app / Next.js conventions per the Adoption Audit):

```
Applications/app-{id}/
├── package.json          build manifest (scripts: build, test)
├── tsconfig.json         strict TypeScript configuration
├── src/
│   ├── index.ts          typed application entry point
│   ├── index.test.ts     unit tests for the entry point
│   ├── ui-design.md      UI/UX design document (responsive, a11y, states)
│   └── api/
│       ├── contract.ts   typed API contract (endpoints + shapes)
│       └── contract.test.ts  API contract integration tests
├── db/
│   └── schema.sql        database schema
└── (per-archetype modules + their per-module unit tests)
```

Every module ships a matching `*.test.ts` — the validation pipeline's
unit-test gate requires one test per source module.

## 4. FileOperation model (Phase 5/6)

Every generated change has:

```
FileOperation {
  operationId, kind (create|modify|delete|rename),
  path, toPath?, content?,
  reason,            // WHY this change exists (explainability)
  originatingTask,   // which specialist/task produced it
  actionClass,       // SAFE_WRITE / DESTRUCTIVE_WRITE / SECRET_ACCESS / …
  status,            // applied | rejected | rolled_back
  rollbackContent?,  // preserved before destructive ops
  validationStatus   // untested → validated (after the pipeline)
}
```

Flow: **READ → PLAN → PATCH → TEST → REVIEW** — never "read → rewrite the
entire repository". The workspace rejects any non-granted operation and keeps a
rollback stack.

## 5. Execution policy (Phase 9) — applied to every operation

| Action class                        | Default    | Requirement            |
| ----------------------------------- | ---------- | ---------------------- |
| READ_ONLY                           | allowed    | —                      |
| SAFE_WRITE                          | controlled | grants as configured   |
| DESTRUCTIVE_WRITE                   | blocked    | explicit authorization |
| NETWORK / DATABASE / CODE_EXECUTION | blocked    | explicit authorization |
| SECRET_ACCESS                       | prohibited | explicit configuration |
| DEPLOYMENT                          | blocked    | explicit authorization |

No unrestricted shell, filesystem, network, or package installation exists.

## 6. Economics (Phase 17)

`EconomicsTracker` records, per project:

- `aiCalls`, `inputTokens`, `outputTokens`, `totalTokens`, `estimatedCostUsd`
- `cacheHits`, `iterations`, `retries`
- `providerUsage` (per provider)
- `generationTimeMs`
- `estimatedBefore` (the plan preview estimate) vs the actual `after` snapshot

The UI shows estimate-vs-actual; the benchmark compares manual vs factory.

## 7. Registry lifecycle (Phase 13)

`ApplicationRegistry` tracks: application ID, owner, specification, blueprint,
version, status, repository path, technologies, AI capabilities, deployment
status, health, last build, last validation, created/updated timestamps.

Statuses: `DRAFT → PLANNED → BUILDING → VALIDATING → READY → DEPLOYED` with
`FAILED` and `ARCHIVED` terminal states. CRITICAL/HIGH security findings move a
build to `FAILED` (never `READY`).

## 8. Version control (Phase 15)

`VersionControlPort` supports init / branch / commit / diff / prepare-PR. **It
never pushes.** PR preparation produces a draft (title + body from the commit
journal) that an operator reviews and pushes. Complete change history is
preserved in the journal.

## 9. Deployment abstraction (Phase 16)

```
Application → DeploymentAdapterPort
              ├── local        (ADOPT — packages dist/Applications/…/artifact.tar.gz)
              ├── vercel       (WRAP — prepares a build; operator pushes)
              ├── firebase     (declared target — future)
              ├── cloud_run    (declared target — future)
              └── self_hosted  (declared target — future)
```

Deployment requires `authorized: true`; every adapter blocks otherwise.
