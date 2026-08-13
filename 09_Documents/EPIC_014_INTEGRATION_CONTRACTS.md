# EPIC-014 — Integration Contracts

> **Status:** 🟢 **IMPLEMENTED & VERIFIED** (2026-08-10) — companion to
> [EPIC_014_EXECUTION_ARCHITECTURE.md](./EPIC_014_EXECUTION_ARCHITECTURE.md);
> [EPIC_014_COMPLETION_REPORT.md](./EPIC_014_COMPLETION_REPORT.md).
> Decision D2: the generic integration contract **extends the BLD-014 marketplace** semantics —
> no separate plugin system, no hardcoded connector names in execution logic.

---

## 1. Principle

> "Only expose an integration as EXECUTABLE when actual evidence / authentication / capability
> exists." — EPIC-014 Phase 15.

An integration contract is a **declarative, evidence-backed description** of what an external tool
or service _could_ do inside VedMoulya and _how honestly_ it can be used today. It is never
invented: `apiEvidence`, `automation`, and `availability` are derived from registered facts, and
`UNKNOWN` is a first-class value.

---

## 2. The contract

```ts
// packages/execution-bridge/src/contracts/execution-ports.ts (integration/execution contract types)
export type IntegrationKind =
  | 'EXTERNAL_APPLICATION' // Canva, Gmail, LinkedIn… (usually MANUAL)
  | 'OPEN_SOURCE' // self-hostable project
  | 'GITHUB_PROJECT' // discovered repo (EVALUATE-only, never auto-cloned)
  | 'LOCAL_MODEL' // Ollama / LM Studio / OpenAI-compatible
  | 'NATIVE_API'; // evidence-backed public API

export type IntegrationAutomation =
  | 'EXECUTABLE' // adapter + evidence + ready
  | 'EXECUTABLE_WITH_APPROVAL' // irreversible / paid → approval gate
  | 'EXECUTABLE_WITH_CONFIGURATION' // needs setup (deep-link existing config)
  | 'MANUAL' // external app with no executable API
  | 'UNKNOWN';

export interface IntegrationContract {
  integrationId: string;
  name: string; // 'Gmail', 'Canva', 'Ollama'… — data, not code branches
  kind: IntegrationKind;
  capabilities: CapabilityId[]; // EPIC-013 capability vocabulary
  automation: IntegrationAutomation;
  /** Never assumed: 'yes' only when a public/authorized API is evidenced. */
  apiEvidence: 'yes' | 'no' | 'UNKNOWN';
  authState: 'NONE' | 'REQUIRED' | 'CONFIGURED' | 'UNKNOWN';
  /** Where the user sets it up — existing screens only, never a new config UI. */
  configDeepLink?: 'providers' | 'settings' | 'applications' | 'marketplace';
  availability: 'AVAILABLE' | 'NEEDS_CONFIGURATION' | 'UNAVAILABLE' | 'UNKNOWN';
  /** BLD-014 marketplace semantics (D2). */
  installationState?: 'not_installed' | 'installed' | 'active';
  /** Capability → adapter binding when automation ≠ MANUAL/UNKNOWN. */
  adapterBinding?: { adapter: AdapterKind; providerId?: string; modelId?: string };
  evidence: CapabilityEvidence[];
  /** Human-friendly explanation of what using this integration means today. */
  userNote?: string; // e.g. "Manual step required — Canva. We'll pause and resume."
}
```

---

## 3. Evidence gating rules (never violated)

| Field                      | Rule                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `apiEvidence: 'yes'`       | Only when a public/authorized API is evidenced (official docs/source).                     |
| `automation: 'EXECUTABLE'` | Requires adapter present + evidence + (paid ⇒ budget-policy approval).                     |
| `automation: 'MANUAL'`     | External app without an executable API — **never** "automation complete".                  |
| `authState`                | From the registry/preferences; `UNKNOWN` when not configured.                              |
| `availability`             | From the adapter registry's live availability report (e.g. local model endpoint running?). |
| Cost / quota               | `UNKNOWN` when unknown — never fabricated.                                                 |

---

## 4. Registry & marketplace linkage (D2)

- **`IntegrationRegistry`** (NEW, in `execution-bridge`): a bounded, owner-scoped registry of
  contracts keyed by `integrationId`, fed by: configured providers (NATIVE_API/DIRECT_PROVIDER),
  discovered local models (`LocalModelDiscovery`), AI-World GitHub projects (EVALUATE-only),
  and a small declarative seed of well-known external applications (Canva/Gmail/… — all marked
  `MANUAL`/`UNKNOWN` until an API is evidenced; no automation claims).
- **Marketplace surface (EXTEND BLD-014):** `marketplace.integrations` lists contracts with
  `installationState` reusing `MarketplaceInstallationService` semantics — an integration with
  `automation: 'EXECUTABLE_WITH_CONFIGURATION'` is "installable/activatable" through the existing
  marketplace flow (deep-link to the existing config screen). No new plugin-install UI.

---

## 5. Seed contracts (honest defaults)

| Integration                | Kind                 | automation                | apiEvidence | authState | availability                             |
| -------------------------- | -------------------- | ------------------------- | ----------- | --------- | ---------------------------------------- |
| Gmail                      | EXTERNAL_APPLICATION | MANUAL                    | UNKNOWN     | UNKNOWN   | UNKNOWN                                  |
| Google Drive               | EXTERNAL_APPLICATION | MANUAL                    | UNKNOWN     | UNKNOWN   | UNKNOWN                                  |
| LinkedIn                   | EXTERNAL_APPLICATION | MANUAL                    | UNKNOWN     | UNKNOWN   | UNKNOWN                                  |
| Canva                      | EXTERNAL_APPLICATION | MANUAL                    | UNKNOWN     | UNKNOWN   | UNKNOWN                                  |
| GitHub (as project source) | GITHUB_PROJECT       | EXECUTABLE_WITH_APPROVAL* | yes         | REQUIRED  | NEEDS_CONFIGURATION                      |
| Ollama / LM Studio         | LOCAL_MODEL          | EXECUTABLE                | UNKNOWN     | NONE      | AVAILABLE **only when endpoint running** |

\* GitHub project adoption is EVALUATE → explicit user approval before any clone; never automatic.
These seeds are **declarative data**; execution logic branches on the contract fields, never on names.

---

## 6. Security

- Contracts are untrusted inputs (from discovery): `SecurityScanner` (AI World) output feeds
  `evidence`; nothing is executed from a contract's text.
- `configDeepLink` is an internal route allowlist (providers/settings/applications/marketplace) —
  never an arbitrary URL.
- No credentials stored on a contract; `authState` references registry state only.

---

## 7. Acceptance mapping

- "An integration is exposed as EXECUTABLE only with evidence" → §3 rules + §5 seed table.
- "External applications are never claimed automatable" → `MANUAL` + `userNote` + resume flow.
- "No hardcoded Gmail/LinkedIn/Canva in execution logic" → registry data, name-agnostic engine.
- "BLD-014 marketplace extended, not duplicated" → `marketplace.integrations` + reuse of
  `MarketplaceInstallationService` semantics.
