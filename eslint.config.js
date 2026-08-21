// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';

// `defineConfig()` not yet in typescript-eslint@8.65.0 — using deprecated `config()` instead
// eslint-disable-next-line @typescript-eslint/no-deprecated
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            '*.config.ts',
            '*.config.js',
            '*.config.mjs',
            'vitest.workspace.ts',
            'tests/vitest.setup.ts',
          'packages/*/vitest.config.ts',            'apps/web/scripts/*.mjs',
            'packages/*/coverage-analyze.mjs',
            'packages/services/src/*.js',
            'packages/services/src/ai/*.js',
            'packages/services/src/business/*.js',
            'packages/services/src/career/*.js',
            'packages/services/src/dashboard/*.js',
            'packages/services/src/decision/*.js',
            'packages/services/src/execution/*.js',
            'packages/services/src/identity/*.js',
            'packages/services/src/knowledge/*.js',
            'packages/services/src/learning/*.js',
            'packages/services/src/lifeos/*.js',
            'packages/services/src/marketplace/*.js',
            'packages/services/src/memory/*.js',
            'services/*/vitest.config.ts',
            'tooling/eslint-config/index.js',
            'apps/web/postcss.config.js',
            'apps/web/public/sw.js',
            'scripts/*.js',
            'scripts/*.mjs',
            'scripts/*.ts',
            'scripts/lib/*.ts',
            'scripts/load/*.js',
          ],
          defaultProject: './tsconfig.eslint.json',
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 200,
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // ── Security rules (warn level — detect dangerous patterns) ────────────
  {
    plugins: {
      security,
    },
    rules: {
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-new-buffer': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'warn',
    },
  },
  // ── Global rules (apply to all files unless overridden below) ─────────────
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      // Numbers and booleans stringify deterministically in JS (ToString on a
      // primitive is well-defined); only objects are ambiguous. The codebase
      // interpolates counters, currency amounts, and percentages into log/UX
      // strings, so allow those without masking genuine object interpolation.
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/prefer-readonly': 'warn',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  // ── File-specific overrides ───────────────────────────────────────────────
  // Auto-generated Next.js type file — inline eslint comments don't persist
  {
    files: ['**/next-env.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
  // Service worker files use browser/service worker globals not available in the TS project
  {
    files: ['**/public/sw.js', '**/service-worker.js'],
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  // In-memory test doubles implement Promise-returning repository contracts
  // from @vedmoulya/domain. The `async` keyword is REQUIRED for interface
  // conformance even though the map-backed bodies never await — require-await
  // is a false positive here (removing `async` would break the contract).
  {
    files: ['packages/services/src/content-agency/InMemory*Repository.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  // EPIC-018 scheduler benchmark: the scripted discovery/notify doubles are
  // synchronous bodies behind the async SchedulerDiscoveryPort/SchedulerNotifyPort
  // contracts — same interface-conformance rationale as the InMemory*Repository
  // override above (removing `async` would break the port contract).
  {
    files: [
      'scripts/ai-world-scheduler-benchmark.ts',
      // EPIC-020 continuous-intelligence benchmark: the scripted execution /
      // usage / discovery doubles implement the async Brain*Port contracts with
      // synchronous bodies — identical interface-conformance rationale.
      'scripts/continuous-intelligence-benchmark.ts',
      // EPIC-020 outcome-intelligence benchmark — same rationale.
      'scripts/outcome-intelligence-benchmark.ts',
      // SPRINT-023 outcome-journey benchmark — the scripted execution /
      // candidates / usage / discovery doubles implement the async Brain*Port
      // contracts with synchronous bodies — identical rationale.
      'scripts/outcome-journey-benchmark.ts',
      // SPRINT-024 runtime-verification benchmark — the scripted execution
      // port writes REAL artifacts into a temp boundary (await fs) while the
      // candidates / usage / discovery doubles stay synchronous behind the
      // async Brain*Port contracts — identical interface-conformance rationale.
      'scripts/runtime-verification-benchmark.ts',
      // SPRINT-025 learning benchmark — the scripted execution / candidates /
      // usage / discovery doubles implement the async Brain*Port contracts with
      // synchronous bodies — identical interface-conformance rationale.
      'scripts/learning-benchmark.ts',
    ],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  // EPIC-020 Brain in-memory stores implement the async BrainMemoryPort /
  // BrainExperiencePort contracts from @vedmoulya/brain — the `async` keyword
  // is required for interface conformance (same rationale as above).
  {
    files: ['packages/brain/src/infrastructure/InMemory*.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  // security/detect-object-injection is a heuristic that flags ANY computed
  // member access (obj[key]). These files only index typed records with keys
  // drawn from closed string-literal unions (e.g. TRANSITIONS[from] where
  // `from: ExecutionState`) or from Map/Object.keys() iteration — never from
  // raw user input. The project compiles with strict + noUncheckedIndexedAccess,
  // so reads are already null-safe and keys cannot be attacker-controlled.
  // The rule stays enabled everywhere else (genuinely dynamic access still
  // warns), but these specific files are proven type-safe.
  {
    files: [
      'apps/web/src/app/context/page.tsx',
      'apps/web/src/app/execution-strategy/page.tsx',
      'apps/web/src/app/execution/page.tsx',
      'apps/web/src/app/execution/sessions-view.tsx',
      'apps/web/src/app/execution/workers-view.tsx',
      'apps/web/src/app/providers/page.tsx',
      // EPIC-020 Brain in-memory continuous stores — the only computed reads
      // are `list[index]` where `index` comes from Array.findIndex() on an
      // owner-scoped array (never user-controlled), same rationale as above.
      'packages/brain/src/infrastructure/InMemoryContinuousStores.ts',
      // Explorer components extracted from route pages (CERT-002) — same
      // closed-union lookup pattern, typed and safe.
      'apps/web/src/app/execution/components.tsx',
      'apps/web/src/app/execution-strategy/components.tsx',
      'apps/web/src/app/goals/components.tsx',
      'apps/web/src/app/providers/benchmark-view.tsx',
      'apps/web/src/app/providers/model-registry-view.tsx',
      // SPRINT-024 goals problem panel: VERDICT_COLORS[verdict] /
      // OUTCOME_VERDICT_LABELS[verdict] index typed records over the closed
      // OutcomeVerdict union (never raw user input) — same proven pattern.
      'apps/web/src/app/goals/problem-panel.tsx',
      // Enterprise Brain (EI-008) presentational components — same closed-union
      // lookup pattern (decision type / status / action / confidence level
      // keys from typed records), safe and null-safe under noUncheckedIndexedAccess.
      'apps/web/src/app/enterprise-brain/components.tsx',
      'packages/context/src/application/ContextApplicationService.ts',
      'packages/context/src/application/ContextMapper.ts',
      'packages/context/src/infrastructure/InMemoryContextRepository.ts',
      'packages/execution-orchestrator/src/domain/services/ExecutionGraphBuilderService.ts',
      'packages/execution-orchestrator/src/domain/services/ExecutionRecoveryService.ts',
      'packages/execution-orchestrator/src/domain/services/ExecutionStateMachineService.ts',
      'packages/execution-strategy/src/domain/services/BudgetEngineService.ts',
      'packages/execution-strategy/src/infrastructure/InMemoryExecutionStrategyRepository.ts',
      'packages/goals/src/domain/services/GoalClassificationService.ts',
      'packages/goals/src/domain/services/GoalUnderstandingService.ts',
      'packages/intelligence/src/domain/services/PipelineExplainerService.ts',
      'packages/providers/src/domain/services/ProviderBenchmarkDatasetService.ts',
      // Application Factory (EPIC-007): typed closed-union record lookups only —
      // policy.grants[actionClass] (actionClass: ExecutionActionClass), and
      // adapters[target] (target: DeploymentTargetId) — keys are never raw
      // user input; strict + noUncheckedIndexedAccess keeps reads null-safe.
      'packages/app-factory/src/contracts/factory-ports.ts',
      'packages/app-factory/src/domain/DeploymentAbstraction.ts',
      'packages/app-factory/src/domain/ExecutionPolicy.ts',
      // Loop Engine (EPIC-006): typed closed-union record lookups only —
      // SPECIALIST_LABELS[capability] (capability: CapabilityType),
      // SUCCESS_SECTION_MAP[pattern] (pattern: GoalPattern), and
      // task.toolArguments?.[toolName] (toolName from the fixed template
      // allowlist) — keys are never raw user input; strict + noUncheckedIndexedAccess
      // keeps every read null-safe.
      'packages/loop-engine/src/catalog/loop-catalog.ts',
      'packages/loop-engine/src/domain/GoalUnderstandingService.ts',
      'packages/loop-engine/src/domain/LoopEngine.ts',
      // Requirements Engine (EPIC-009): typed closed-union record lookups only —
      // byCategory[cat] (cat: RequirementCategory), dependencies[r.id] /
      // downstream[dep] (requirement ids drawn from the session's own set),
      // STATUS_ORDER/AREA lookups over closed string-literal unions, and the
      // UI's tones[tone]/tone[phase]/labels[phase]/draftAnswers[questionId]
      // (question ids from the engine's own plan) — keys are never raw user
      // input; strict + noUncheckedIndexedAccess keeps every read null-safe.
      'packages/requirements/src/domain/CompletenessEngine.ts',
      'packages/requirements/src/domain/ConflictDetector.ts',
      'packages/requirements/src/domain/RequirementExtractionEngine.ts',
      'packages/requirements/src/domain/RequirementGraphBuilder.ts',
      'packages/requirements/src/catalog/knowledge.ts',
      // experience KNOWLEDGE[archetype] indexes a typed record over the closed
      // AppArchetype union (same proven pattern as the requirements catalog).
      'packages/experience/src/catalog/design-knowledge.ts',
      'apps/web/src/app/applications/builder.tsx',
      // Provider Experience (EPIC-012A): MODEL_CAPABILITY_LABELS[cap] indexes
      // a typed record over the closed CapabilityType union — keys come from
      // the registry's own model metadata, never raw user input; strict +
      // noUncheckedIndexedAccess keeps the read null-safe.
      'services/api/src/services/ProviderExperienceService.ts',
      // Provider Intelligence (EPIC-012A/B): CAPABILITY_LABELS[cap] indexes a
      // typed record over the closed CapabilityType union (same proven pattern
      // as the Provider Experience label map above).
      'packages/providers/src/domain/services/ProviderIntelligenceService.ts',
      // Provider configuration view (EPIC-012B): VERIFICATION_CONFIG[state] /
      // LIFECYCLE_CONFIG[status] index typed records over the closed
      // verification/lifecycle unions returned by the gateway (never raw user
      // input) — same proven pattern as the providers page above.
      'apps/web/src/app/providers/ProviderDetailView.tsx',
      // Capability Marketplace (EPIC-013): CAPABILITY_TO_AI_FEATURES[cap] /
      // CAPABILITY_DISCOVERY_KEYWORDS[cap] index typed records over the closed
      // CapabilityId union — keys come from the planner's own graph, never raw
      // user input; strict + noUncheckedIndexedAccess keeps reads null-safe.
      'services/api/src/infrastructure/CapabilitySourcePorts.ts',
      // Capability Marketplace view model (EPIC-013): CAPABILITY_LABELS[id]
      // indexes a typed record over the closed CapabilityId union (same proven
      // pattern as CapabilitySourcePorts above).
      'packages/capability-marketplace/src/application/CapabilityMarketplaceApplicationService.ts',
      // Capability Marketplace approval engine (EPIC-013): ACTION_KEYWORDS[action]
      // indexes a typed record over the closed IrreversibleAction union — the
      // action is always drawn from the frozen IRREVERSIBLE_ACTIONS constant,
      // never raw user input (same proven closed-union pattern).
      'packages/capability-marketplace/src/domain/ApprovalEngine.ts',
      // AI insight card (EPIC-013 enrichment): CAPABILITY_LABELS[id] indexes a
      // typed record over the closed CapabilityId union — id always comes from
      // the provider's whitelisted suggestedCapabilities (filterCapabilities in
      // the gateway), never raw user input (same proven closed-union pattern).
      'apps/web/src/components/capability/AIPlanInsightCard.tsx',
      // Ecosystem Intelligence UI (EPIC-015): the per-state palette maps index
      // typed records over CLOSED unions (GitHubConnectionState, LifecycleState,
      // SecurityClassification, AcquisitionState, RecommendationKind,
      // BestOptionKind, IntelligenceNotificationKind) — every key comes from a
      // typed value or a fixed constant list, never raw user input (same proven
      // closed-union pattern as the Brain / Enterprise Brain UI maps).
      'apps/web/src/app/ecosystem-intelligence/intelligence-ui.ts',
      // Intelligence Graph (SPRINT-055): STATUS_CONFIG[node.status] and
      // TYPE_ICONS[node.type] index typed records over the closed GraphNode
      // status/type unions — keys are never raw user input (same proven
      // closed-union pattern).
      'apps/web/src/components/spatial/IntelligenceGraph.tsx',
      'apps/web/src/app/ecosystem-intelligence/task-panel.tsx',
      'apps/web/src/app/ecosystem-intelligence/github-panel.tsx',
      'apps/web/src/app/ecosystem-intelligence/repository-panel.tsx',
      'apps/web/src/app/ecosystem-intelligence/memory-panel.tsx',
      // AI World Scheduler (EPIC-018): FREQUENCY_MS[frequency] (frequency:
      // ScheduleFrequency), DISCOVERY_JOB_LABELS[category] (category from the
      // DISCOVERY_JOB_CATEGORIES constant), MEANINGFUL_FIELDS[field] (field
      // from the fixed const list) and DEFAULT_JOB_POLICIES[jobCategory]
      // (jobCategory: the closed DiscoveryJobCategory union) — every key comes
      // from a typed value or a fixed constant list, never raw user input (same
      // proven closed-union pattern).
      'packages/ai-world-scheduler/src/domain/ScheduleEngine.ts',
      'packages/ai-world-scheduler/src/domain/ChangeDetector.ts',
      'packages/ai-world-scheduler/src/domain/DiscoveryScheduler.ts',
      'packages/ai-world-scheduler/src/application/SchedulerApplicationService.ts',
      // SPRINT-039 FounderEvidenceLoop — PROSPECT_NEXT[from] (from:
      // ProspectDiscoveryStatus, the closed status union; the record covers
      // every key, noUncheckedIndexedAccess keeps reads null-safe) and the
      // discovery chain scenario iterates a fixed `as const` status array
      // with a bounded loop index — identical closed-union rationale.
      'packages/world-model/src/domain/FounderEvidenceLoop.ts',
      'packages/world-model/src/benchmark/CustomerDiscoveryScenarios.ts',
      // Ecosystem Workflow Execution (SPRINT-051/052): execution.stepResults[i]
      // where i is a bounded loop index over an owner-scoped typed array —
      // never user-controlled, same rationale as InMemoryContinuousStores.
      'packages/ecosystem/src/application/WorkflowExecutionService.ts',
    ],
    rules: {
      'security/detect-object-injection': 'off',
    },
  },
  // Config files linted without full type info for Node built-in modules
  {
    files: ['**/vitest.config.ts', 'tooling/eslint-config/index.js'],
    rules: {
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-useless-default-assignment': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  // Plain JavaScript files (scripts, compiled output) lack TypeScript type information,
  // so @typescript-eslint rules that rely on type checking cannot apply.
  {
    files: [
      'packages/services/src/**/*.js',
      'packages/*/coverage-analyze.mjs',
      'scripts/*.js',
      'scripts/*.mjs',
      'scripts/*.ts',
      'scripts/lib/*.ts',
      'scripts/load/*.js',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'no-undef': 'off',
      // Dev-tooling scripts parse dynamic JSON/files and print progress — the
      // security rules are heuristic and produce false positives here; the
      // files are not shipped to production.
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-regexp': 'off',
      'no-console': 'off',
    },
  },
  // Next.js build/mobile scripts run under Node with a custom loader; they
  // use process/console without importing Node types (same rationale as the
  // root scripts glob).
  {
    files: ['apps/web/scripts/*.mjs'],
    rules: {
      'no-undef': 'off',
      'no-console': 'off',
    },
  },
  // Service worker (apps/web/public/sw.js) is plain browser JS operating on
  // Web Worker globals (self, FetchEvent, caches) that the TS default project
  // (`tsconfig.eslint.json`, types:["node"]) cannot type. Type-aware no-unsafe-*
  // rules only produce false positives here — the file must stay plain JS for
  // the browser (no imports, no TS types).
  {
    files: ['apps/web/public/sw.js'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      // Plain browser JS cannot carry TS return-type annotations.
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/.next/**',
      '**/coverage/**',
      '**/__tests__/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/.storybook/**',
      // Generated build output (never authored, never linted):
      'apps/web/out/**', // Next.js static export
      'apps/web/android/**', // Capacitor wrapper incl. copied web assets
      'apps/web/storybook-static/**', // Storybook build output (EI-008 stories)
    ],
  },
);
