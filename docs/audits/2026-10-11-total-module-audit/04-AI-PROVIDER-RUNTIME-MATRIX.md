# AI / Provider / Runtime Matrix

Source: `services/orchestrator/src/index.ts` (`registerPlatformProviders`),
adapters under `services/orchestrator/src/providers/`, contracts in
`packages/ai/src/types/index.ts`, startup in `packages/core/src/startup/`.

## Provider registration and health

| Provider       | Adapter                                                            | Registration condition                                     | Key resolution                                                 | Keyless health                                    | Status                                 |
| -------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------- |
| OpenAI         | `VercelAIProvider` (primary) / `OpenAIProvider` (legacy raw fetch) | `resolveOpenAIKey()` present                               | `AI_OPENAI_API_KEY`                                            | `'down'` (`VercelAIProvider.ts:130`)              | Wired; cloud not run live              |
| DeepSeek       | `DeepSeekProvider` (Vercel SDK path)                               | `resolveDeepSeekKey()` present                             | config                                                         | `'down'` (`DeepSeekProvider.ts:127`)              | Wired; cloud not run live              |
| Google Gemini  | `GoogleGeminiProvider` (`@ai-sdk/google`)                          | `resolveGoogleKey()` present                               | `AI_GOOGLE_API_KEY` (separate from OAuth)                      | `'down'` (`GoogleGeminiProvider.ts:149`)          | Wired; cloud not run live              |
| OpenRouter     | `OpenAICompatibleProvider`                                         | `resolveOpenRouterKey()` present                           | `AI_OPENROUTER_API_KEY`                                        | `'down'` (`OpenAICompatibleProvider.ts:128`)      | Wired; cloud not run live              |
| Ollama (local) | `OllamaProvider`                                                   | `AI_OLLAMA_BASE_URL` present                               | base URL + optional `AI_OLLAMA_TIMEOUT_MS` / `AI_OLLAMA_MODEL` | `'down'` when unhealthy (`OllamaProvider.ts:277`) | Wired; historically proven live        |
| Custom         | `OpenAICompatibleProvider`                                         | `providers.custom[]` with apiKey+endpoint                  | owner-scoped                                                   | `'down'` when unconfigured                        | Wired                                  |
| Mock           | `MockProvider`                                                     | `AI_ENABLE_MOCK=true` (explicit) or non-production default | —                                                              | n/a                                               | Deterministic; production never silent |

## Discipline verified in this pass

- **Fail-closed health (F-3):** every adapter returns the existing union member
  `'down'` when keyless/unconfigured — never a fabricated `'healthy'`. Union is
  `'healthy' | 'degraded' | 'unstable' | 'down'` (`packages/ai/src/types/index.ts:45`).
  Regression tests: `OpenAICompatibleProvider.test.ts:132,140,145-159`,
  `VercelAIProvider.test.ts:219`, `GoogleGeminiProvider.test.ts:243`,
  `DeepSeekProvider.test.ts:249`, `OllamaProvider.test.ts:56`, `OpenAIProvider.test.ts:59`.
  This closes the historical G-01 (out-of-union `'unhealthy'` literal).
- **Mock isolation (SPRINT-088):** when `AI_ENABLE_MOCK=true` in non-test env,
  only the mock serves (`index.ts:188-192`), preventing real-provider timeout
  burn before fallback. Production never sets it unless explicitly opted in.
- **No silent substitution:** per-request `modelId` refuses with typed
  `MODEL_NOT_FOUND`; `fallbackToInstalledModel: true` is an explicit deployment
  opt-in for Ollama only.
- **Observability:** mission AI runs through the same trace-backed
  observability + per-user CostLedger (`ApiApplicationService.ts` mission
  composition).

## Model evaluation

- Deterministic benchmark scripts exist for brain, planning, execution,
  intelligence, bridge, ai-world scheduler, continuous/outcome intelligence,
  runtime verification, learning (`package.json` scripts; `scripts/*.ts`).
- **Not run in this pass** (bounded read-only audit; long-running). Therefore no
  fresh model-quality measurement is claimed.

## Open AI/provider findings

| ID          | Finding                                                                                                     | Evidence                                                                         | Severity                        |
| ----------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------- |
| D-06 (G-02) | Runtime-matrix doc still labels Google/OpenRouter/Ollama unsupported/catalog-only while code registers them | README + provider runtime matrix vs `services/orchestrator/src/index.ts:214-247` | P2 (trust/doc drift)            |
| D-05 (G-17) | Fabric instantiated with `enableProviderRouting: true`; a second routing authority is advertised            | `ApiApplicationService.ts:2799`, `routers/OrchestrationFabricRouter.ts`          | P2 (deferred — do not activate) |
| —           | No live cloud-provider execution in any fresh evidence                                                      | only local Ollama historically                                                   | unverified risk                 |
| —           | Retry/timeout/backoff behavior verified only by unit tests, not by observed live failure injection          | adapter test files                                                               | unverified risk                 |
