# Pipeline Validation

> EPIC-004 / EI-006 / INT-001 — the Enterprise Intelligence Pipeline validation contract.
> Owner: Chief Enterprise Integration Architect · Updated: 2026-08-05

## Purpose

The pipeline validator verifies the INT-001 contract end-to-end: capabilities exist, providers exist, context is available, the strategy is valid, the execution graph is valid, and the execution session was created. It explains failures per stage — never executes.

## Validation Checks

The validator produces exactly seven checks, one per pipeline stage:

| #   | Stage               | Check                 | Passes when                                                                |
| --- | ------------------- | --------------------- | -------------------------------------------------------------------------- |
| 1   | `goal`              | Goal exists           | The goal step status is `passed`                                           |
| 2   | `capabilities`      | Capabilities exist    | `artifacts.capabilities.length > 0`                                        |
| 3   | `providers`         | Providers exist       | `artifacts.providers.length > 0`                                           |
| 4   | `context`           | Context available     | `artifacts.contextItems > 0`                                               |
| 5   | `strategy`          | Strategy valid        | `artifacts.strategyId` is defined AND the strategy step status is `passed` |
| 6   | `execution-graph`   | Execution graph valid | `artifacts.graphId` is defined AND the graph step status is `passed`       |
| 7   | `execution-session` | Session created       | `artifacts.sessionId` is defined AND the session step status is `passed`   |

## Validation Result

```ts
interface PipelineValidation {
  passed: boolean;
  checks: PipelineValidationCheck[];
  summary: string;
}

interface PipelineValidationCheck {
  stage: PipelineStage;
  check: string;
  passed: boolean;
  detail: string;
}
```

The pipeline passes when **all seven checks pass**. The summary is:

- **Passed:** `"All INT-001 stages passed — the goal is ready for execution."`
- **Failed:** `"N INT-001 stage(s) failed: <check names>."`

## Failure Explanation

Each failed check includes a human-readable detail explaining the exact engine gap:

| Stage               | Failure detail                                                       |
| ------------------- | -------------------------------------------------------------------- |
| `goal`              | `"Goal could not be resolved (<goalId>)."`                           |
| `capabilities`      | `"No capabilities were resolved for the goal."`                      |
| `providers`         | `"No provider candidates were found for the required capabilities."` |
| `context`           | `"No context items available for assembly."`                         |
| `strategy`          | `"No valid execution strategy was produced."`                        |
| `execution-graph`   | `"No valid execution graph was produced."`                           |
| `execution-session` | `"No execution session was created."`                                |

## Pipeline Status

The pipeline status is derived from the step statuses:

- **`ready`** — all steps passed (no failed, no skipped)
- **`failed`** — at least one step failed or was skipped

## Example

A fully built pipeline for `goal_blog_seed`:

```
Goal requires 4 Capabilities, 3 Provider Candidates, 18 Context Items,
1 Execution Strategy, 1 Execution Graph, 1 Session — ready for execution.
```

## References

- `ENTERPRISE_PIPELINE.md` — pipeline overview
- `PIPELINE_SPECIFICATION.md` — detailed pipeline specification
- `EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md` — the 13-engine architecture
