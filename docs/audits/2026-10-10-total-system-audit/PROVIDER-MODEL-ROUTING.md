# Provider and Model Routing

## State distinctions

The product must distinguish registration, enabled/configured state, valid credentials, health/reachability, model/capability eligibility, actual generation, and current runtime availability. A provider card or registry entry alone proves none of the later states.

## Source evidence

- `services/orchestrator/src/index.ts::registerPlatformProviders` conditionally registers OpenAI/Vercel SDK, DeepSeek, Google Gemini, OpenRouter via `OpenAICompatibleProvider`, Ollama when a base URL is configured, custom endpoints, and Mock under its configured development/test/explicit production gate.
- `services/api/src/services/MissionService.ts` calls the shared registrar for mission execution; `services/api/src/services/ApiApplicationService.ts` also registers platform providers.
- Provider configuration/readiness UI is under `apps/web/src/app/providers`; setup and connection logic is in `services/api/src/services/ProviderSetupOrchestrator.ts` and `ProviderConnectionTester.ts`.
- Current docs drift: `09_Documents/EPIC_019_PROVIDER_RUNTIME_MATRIX.md` says Google/OpenRouter/Ollama have no runtime adapter and are `UNSUPPORTED_RUNTIME`, while registration code implements paths for Google (with key), OpenRouter (with key), and Ollama (with URL). README repeats a catalog-only claim for those providers. This is G-02, confirmed.
- The previous audit reports only historical live Ollama generation; cloud-provider generation has not been reproduced in this audit. Local `.env.local` exists but its values were not inspected or copied into this report.

## Status matrix (this audit)

| Provider family          | Registered in source                         | Required config              | Fresh reachability/generation evidence             | Task eligibility/cost evidence                                                      |
| ------------------------ | -------------------------------------------- | ---------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| OpenAI                   | Conditional adapter registration             | Provider key/config          | Not run                                            | Catalog/capability and cost gates exist; live cost attribution not freshly verified |
| DeepSeek                 | Conditional adapter registration             | Provider key/config          | Not run                                            | Catalog/capability and cost gates exist; live execution not freshly verified        |
| Google Gemini            | Conditional adapter registration             | Google AI key/config         | Not run                                            | Live task selection not freshly verified                                            |
| OpenRouter               | Conditional OpenAI-compatible adapter        | OpenRouter key/config        | Not run                                            | Per-model eligibility/cost not freshly verified                                     |
| Ollama                   | Conditional local adapter registration       | Base URL/model configuration | Historical local acceptance only; no fresh request | Local model capability/fallback behavior has tests; current matrix docs are stale   |
| Custom OpenAI-compatible | Conditional endpoint/key registration        | Endpoint and credential      | Not run                                            | Per-endpoint verification not freshly observed                                      |
| Mock                     | Gate-based dev/test or explicit prod setting | Explicit configuration       | Unit-test only                                     | Must remain clearly marked and never imply real generation                          |

## Findings

G-02 should be fixed by reconciling docs with the actual registration behavior and fail-closed configuration, not by removing working provider adapters. Add a deterministic contract test if the existing provider matrix tests do not assert the docs/registry relationship. G-17 remains deferred. No provider key values or external calls were used.
