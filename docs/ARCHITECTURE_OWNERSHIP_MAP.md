# VedMoulya — Architecture Ownership & Runtime Map

**Document type:** Authoritative architecture inventory (documentation only)
**Created:** 2026-10-06 · P1.1 (AUDIT → DOCUMENT → VERIFY)
**Evidence basis:** the live repository checkout, inspected directly. Where a fact
could not be established from the repository it is marked **UNKNOWN** — it is never
guessed.

> **This document is descriptive, not prescriptive.** It records the architecture as
> it exists today so that future sprints do not accidentally create duplicate
> systems. It proposes **no refactor**. Status labels below are evidence labels, not
> quality judgements.

> **Independence note.** This task is deliberately independent of S7.0. No S7.0
> implementation file, `OpportunitySourceAdapter.ts`, `RouterRegistry.ts`,
> `package.json`, `package-lock.json`, auth/identity/OAuth WIP, Mission Controller
> WIP, `ProviderReadinessModel.ts` or CI/quality-gate WIP was modified. This file
> is the only change.

---

## Status vocabulary

Every capability below is labelled with exactly one status. These labels describe
**evidence**, not merit.

| Status                | Meaning                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **IMPLEMENTED**       | Source exists, is wired into the running gateway composition, and is exercised by tests in-repo.                                                    |
| **FIXTURE/TEST ONLY** | Exists only as a test fixture, benchmark harness, certification script, or stub. Not part of a request path.                                        |
| **EXPERIMENTAL**      | Implemented and reachable, but explicitly described in-source as provisional, bounded, not-yet-productized, or awaiting an operator step.           |
| **DEPRECATED/LEGACY** | Superseded by a newer component, or retained with zero referencing imports.                                                                         |
| **LIVE/DEPLOYED**     | Independently verified as running against production infrastructure with real users/data. **Nothing in this repository establishes this.** See §10. |
| **UNKNOWN**           | The repository does not contain enough evidence to classify.                                                                                        |
| **AMBIGUOUS**         | Two or more components plausibly own the capability; the repository does not resolve precedence.                                                    |

**No capability in this document is labelled LIVE/DEPLOYED.** Source code is not
proof of deployment. The repository's own `README.md` and
`docs/REPOSITORY_AUDIT_2026-10-06.md` both state that production infrastructure is
not provisioned and that deployment has not occurred.

---

## Section 1 — Current repository shape

**These are inventory counts. They are not test-coverage figures, not quality
scores, and not evidence of deployment.**

Verified directly from `package.json` manifests and the filesystem:

| Dimension                       |            Count | Source of truth                                                                                              |
| ------------------------------- | ---------------: | ------------------------------------------------------------------------------------------------------------ |
| npm workspaces (total)          |           **59** | `root package.json` → `workspaces: ["apps/*","packages/*","services/*"]`                                     |
| `apps/*`                        |            **1** | `apps/web` (`@vedmoulya/web`)                                                                                |
| `packages/*`                    |           **49** | `packages/*`                                                                                                 |
| `services/*`                    |            **9** | `services/*`                                                                                                 |
| API router modules              |           **49** | `services/api/src/routers/*.ts`                                                                              |
| API gateway procedures          |         **~710** | matches on `publicProcedure`/`protectedProcedure`/`router(` in `services/api/src/services/RouterRegistry.ts` |
| `RouterRegistry.ts` size        | **~6,576 lines** | file line count                                                                                              |
| `ApiApplicationService.ts` size | **~2,952 lines** | file line count                                                                                              |
| Web page routes                 |           **62** | `page.tsx` files under `apps/web/src/app`                                                                    |

### Service workspaces (9)

`api`, `content-agency`, `decision`, `execution`, `identity`, `knowledge`, `memory`,
`notifications`, `orchestrator`.

**Note on `services/notifications`:** the directory contains only `package.json`.
There is no `src/`, and no file in `services/`, `apps/` or `packages/` imports
`@vedmoulya/notifications`. Status: **DEPRECATED/LEGACY** (a workspace stub
remaining after the source was deleted — the SPRINT-027 completion report in
`README.md` records "dead `services/notifications` deleted (proven 0 refs)", yet
the manifest still exists in the workspace glob).

### Major runtime entry points

| Entry point                                                                    | Kind                                                                                     | Evidence                                                                                                                 |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `apps/web` → `next dev` / `next start` (`node scripts/run-next.mjs`)           | **Primary runtime.** Next.js App Router host.                                            | `apps/web/package.json` scripts                                                                                          |
| `apps/web/src/app/api/trpc/[trpc]/route.ts`                                    | **In-process API gateway entry.** Builds the whole gateway lazily on first request.      | file header: "the gateway runs inside the Next.js server — no standalone HTTP process"                                   |
| `apps/web/src/app/api/v1/identity/auth/[...path]/route.ts`                     | In-process Hono REST entry for identity.                                                 | file header (MOB-001)                                                                                                    |
| `apps/web/src/app/api/metrics/route.ts`                                        | Metrics endpoint.                                                                        | file exists                                                                                                              |
| `services/api/src/index.ts` → `getAppRouter()` / `getServices()`               | Gateway library export consumed by the Next route handler.                               | `services/api/src/index.ts`                                                                                              |
| `scripts/startup.sh` (production), `scripts/preflight.ts`, `scripts/doctor.ts` | Startup/ops scripts.                                                                     | `root package.json` scripts                                                                                              |
| `packages/local-ai` → `npm run local-agent`                                    | **Separate local host process** (Local Agent HTTP server on loopback `127.0.0.1:43117`). | `root package.json` → `"local-agent": "tsx packages/local-ai/src/agent/cli.ts"`; `packages/local-ai/src/index.ts` header |

### Status summary for §1

| Item                               | Status                                                               |
| ---------------------------------- | -------------------------------------------------------------------- |
| Workspace counts (59 / 1 / 49 / 9) | **IMPLEMENTED** (verified against manifests)                         |
| Router module + procedure counts   | **IMPLEMENTED** (verified against source)                            |
| `services/notifications`           | **DEPRECATED/LEGACY**                                                |
| Production deployment              | **LIVE/DEPLOYED → not established; treated as UNKNOWN/not-deployed** |
