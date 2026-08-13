# EPIC-012A — Model Selection & User Preference

**Status:** 🟢 COMPLETE — IMPLEMENTATION VERIFIED  
**Date:** 2026-08-10  
**Epic:** EPIC-012A — Premium Experience Refinement + AI Provider Intelligence

---

## Summary

The model selection experience has been upgraded to be intelligent, transparent, and user-respecting. The existing `ModelSelectionIntelligence` (AI-SELECT / ProviderRoutingAdvisor) is the authoritative routing layer — EPIC-012A did not create a duplicate routing system. Instead, it connected the intelligence to the user-facing experience and added the preference/preference-respect layer.

---

## Model Selection Intelligence (Phase 12 — Integrates existing AI-SELECT)

Selection considers (in order of priority):

1. **Explicit user model preference** — never silently overridden
2. **Required capability** — the model must support the feature
3. **Required precision** — accuracy/quality requirements
4. **Evidence requirement** — evidence-grounded tasks need reliable models
5. **Context-window fit** — model must handle the prompt
6. **Security** — security-sensitive tasks restrict eligible models
7. **Provider health** — unhealthy providers are excluded
8. **Model availability** — offline/deprecated models excluded
9. **Free/local availability** — cost optimization when compatible
10. **User budget** — budget policy enforced
11. **Token economics** — cost-per-token optimization
12. **Latency** — latency requirements respected
13. **Historical measured task performance** — past accuracy tracked

**Key rule:** PRECISION AND HARD REQUIREMENTS OVERRIDE COST. A free model that cannot satisfy the task is NOT eligible.

---

## User Preference (Phase 13)

Users can set:

- **Preferred provider** — the whole provider as preference
- **Preferred model** — specific model per provider

**If the user's selected model is unsuitable:**

1. DO NOT silently replace it
2. Explain: "This model cannot reliably satisfy this task because..."
3. Present three options: Use selected model anyway / Choose recommended model / Cancel

---

## Cost Policy (Phase 14)

| Policy                | Behaviour                                               |
| --------------------- | ------------------------------------------------------- |
| Never spend           | Only free/local models eligible. Paid requests blocked. |
| Ask before paid usage | User must approve any paid inference. **(Default)**     |
| Allow within budget   | Automatic spending up to daily/monthly limits.          |

Budget limits: daily budget (USD) · monthly budget (USD). Per-request cap available.

Default: **ASK BEFORE PAID USAGE** — never silently incurs paid usage.

---

## Smart Upgrade / Downgrade (Phase 15)

The existing `ModelSelectionIntelligence.upgradeDowngrade` logic:

**DOWNGRADE when:**

- Task is simple
- Accuracy requirements permit lower precision
- Context is small
- Free/local model is sufficient
- Budget policy prefers lower cost

**UPGRADE when:**

- Reasoning complexity increases mid-task
- Evidence requirements tighten
- Context grows large
- Structured output fails
- Quality falls below threshold
- Task-specific performance is insufficient

**Never downgrade an explicit user selection silently.** Inform the user and offer choice.

---

## "Why This Model?" (Phase 16)

Every intelligent model selection provides a simple explanation:

```
Why Gemini?
✓ Meets required accuracy
✓ Context is sufficient
✓ Evidence requirements satisfied
✓ Available now
✓ Lower estimated cost
```

Advanced expansion (behind "Details"):

- Candidates considered
- Candidates rejected (with reasons)
- Capability mismatch
- Context mismatch
- Budget mismatch
- Health status
- Evidence requirements
- Measured performance data

No internal implementation terminology exposed by default.

---

## Owner-Scoped Preferences (Backend)

New domain in `@vedmoulya/providers`:

| Component                          | Location              | Description                                    |
| ---------------------------------- | --------------------- | ---------------------------------------------- |
| `ProviderPreferencesStore`         | `domain/preferences/` | Interface for per-user preferences storage     |
| `InMemoryProviderPreferencesStore` | `infrastructure/`     | In-memory implementation (FIFO 1000)           |
| `ProviderPreferencesService`       | `application/`        | Preferences CRUD, enabled-state routing filter |
| `request-context`                  | `application/`        | AsyncLocalStorage-based per-request context    |

Preferences stored: `enabledProviders` (set of enabled provider IDs), `preferredModelId`, `preferredProviderId`, `budgetPolicy`, `budgets`, `updatedAt`.

The routing path respects disabled providers — they remain configured but are excluded from automatic candidate selection.

---

## Gateway Procedures

| Procedure                         | Type     | Description                                         |
| --------------------------------- | -------- | --------------------------------------------------- |
| `providers.getPreferences`        | Query    | Get user's AI preferences                           |
| `providers.setPreferences`        | Mutation | Update preferences (preferred model, budget policy) |
| `providers.setProviderEnabled`    | Mutation | Enable/disable a provider                           |
| `providers.explainModelSelection` | Mutation | Get "Why this model?" explanation for a capability  |

---

## Files Changed

| File                                                                        | Description                                                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/providers/src/types/preferences-types.ts`                         | New: ProviderPreferences, ProviderBudgets, ProviderPreferencesPatch types |
| `packages/providers/src/domain/preferences/`                                | New: ProviderPreferencesStore interface                                   |
| `packages/providers/src/infrastructure/InMemoryProviderPreferencesStore.ts` | New: In-memory preferences store                                          |
| `packages/providers/src/application/ProviderPreferencesService.ts`          | New: Preferences CRUD + routing integration                               |
| `packages/providers/src/application/request-context.ts`                     | New: AsyncLocalStorage request context                                    |
| `packages/providers/src/application/ProviderApplicationService.ts`          | Extended: preferences wiring                                              |
| `packages/providers/src/index.ts`                                           | New exports for preferences types and services                            |
| `packages/services/src/ai/runtime/ModelSelectionIntelligence.ts`            | Already existed — exposed through index                                   |
| `services/api/src/services/ProviderExperienceService.ts`                    | New: Compose provider experience view-model                               |
| `services/api/src/routers/ProvidersRouter.ts`                               | Extended: EPIC-012A handlers                                              |
