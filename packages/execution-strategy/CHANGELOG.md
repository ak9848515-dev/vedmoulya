# Changelog

All notable changes to `@vedmoulya/execution-strategy` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-08-04

### Added

- **Enterprise Execution Strategy Engine (EI-004)** — creates a complete execution strategy for any business goal without making AI calls.
- **Capability Planner** (`CapabilityPlannerService`) — template-driven capability plans with sequential/parallel/optional/conditional nested steps (blog, summarize, translate, analyze, classify, learn, generic fallback).
- **Provider Candidates** (`ProviderCandidateService`) — ranks eligible providers by composite score; never selects.
- **Budget Engine** (`BudgetEngineService`) — token, cost, and latency estimates with confidence, plus quality targets per tier.
- **Risk Engine** (`RiskEngineService`) — provider, execution, budget, and latency risk dimensions combined into an overall risk score and level.
- **Fallback Engine** (`FallbackEngineService`) — primary/secondary/emergency/local fallback plan and retry policy.
- **Strategy Validator** (`StrategyValidatorService`) — six checks (capability, context, provider, budget, latency, quality) with score and summary.
- **Execution Strategy Service** (`ExecutionStrategyService`) — orchestrates the full build from goal to validated strategy.
- **Application layer** — `ExecutionStrategyApplicationService` (create, validate, get, delete, search, list, explain, estimate, summary), `StrategyDTO`, `StrategyMapper`.
- **Infrastructure** — `InMemoryExecutionStrategyRepository` (CRUD, search filters, pagination, counts, averages).
- **Seed catalog** — 4 realistic strategies covering common business goals.
- **Tests** — 7 test files / 74 tests (planner, budget, risk, validator, fallback, repository, application service).
