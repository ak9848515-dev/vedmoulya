# SPRINT-038 — PROVIDER ECONOMICS

**Composition over the EXISTING Intelligence Fabric — existing providers preferred, no auto adoption**

## The rule

For every proposed AI workflow: task → required capability → existing
providers → capability/quality requirements → privacy → cost → latency →
provider health → **select the cheapest SUITABLE existing provider**.

- Existing providers are PREFERRED when they satisfy the requirements.
- Provider count is NOT a KPI. Do not add providers simply because another
  provider exists.
- If an existing provider cannot satisfy a required capability or quality
  threshold → **CAPABILITY GAP DETECTED** founder notification.

## How it composes

`problemProviderEconomics` calls the EXISTING `WorldFabricPort.selectStrategy`
(Intelligence Fabric) per required capability:

- **selection** — `{ capability, providerId, modelId, strategy, reasons,
preferredExisting: true }` when an existing provider matches the capability
  AND meets the quality requirement.
- **capability gap** — `{ requiredCapability, requiredQuality?, evaluatedProviders,
whyInsufficient[], localOpenSourceAlternative?, privacyImplications?,
founderApprovalRequired: true }` when:
  - no existing provider matched the capability, OR
  - the best candidate's quality is below the requirement, OR
  - the fabric is unavailable (honest — never a fabricated selection)

## The gap notification

A CAPABILITY GAP DETECTED notification includes: required capability, required
quality, existing providers evaluated, why they are insufficient, a local/
open-source alternative when one exists, privacy implications (PRIVATE tasks
never fall back to a public provider), and founder approval required. There is
NO automatic paid-provider adoption.

## Privacy

PRIVACY overrides cost where existing policy says so. A PRIVATE task with no
local/private candidate → an honest gap, never a silent public fallback.

## Cost control

All cost figures are evidence-carrying (`RevenueFigure`). Unknown cost stays
UNKNOWN — never converted to zero. The EXISTING CostLedger / CostPolicyGuard /
RunBudgetGuard remain authoritative for actual cost accounting (SPRINT-030+).

## Tests / benchmark

- Existing suitable provider preferred (fabric selects cheapest matching).
- Capability gap → founder notification, no auto adoption.
- PRIVATE + no local candidate → honest gap, no public fallback.
- Fabric unavailable → honest gap with availability reason.
- Quality below requirement → gap with quality reason.
