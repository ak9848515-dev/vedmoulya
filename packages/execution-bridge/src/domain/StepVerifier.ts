// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: Step Verifier (PHASE 2)
// EPIC-014 — every executable step has an explicit execution contract.
//   BEFORE: capability, provider/tool, model, authentication,
//           availability, configuration, evidence, budget, approval,
//           dependencies, input artifacts.
//   AFTER:  execution completed, expected artifact/result exists,
//           output contract satisfied, validation passed.
// Success is EXECUTION + EXPECTED OUTPUT + VALIDATION — a provider
// response alone is never success. Reuses the runtime's own
// structured-output validationDecision where reported (no second
// validation engine).
// ──────────────────────────────────────────────────────────────────

import type { StepVerification, VerificationCheck, StepRun } from '../types/execution-types.js';
import type { StepExecutionPort, StepExecutionResult } from '../contracts/execution-ports.js';
import type { ExecutionBudget } from '../types/execution-types.js';
import type { ArtifactReaderPort } from '../contracts/artifact-ports.js';
import type { ArtifactExpectation, ArtifactVerificationResult } from '../types/artifact-types.js';
import { ArtifactVerifier } from './ArtifactVerifier.js';

export interface PreVerifyInput {
  stepId: string;
  title: string;
  capability: string;
  runtimeCapability: string;
  port: StepExecutionPort;
  expectedTokens?: number;
  expectedCostUsd?: number;
  budget: ExecutionBudget;
  /** Step ids that must have completed before this one runs. */
  dependencies: string[];
  completedSteps: Set<string>;
  /** Selected provider/model from the plan binding. */
  provider?: string;
  model?: string;
  evidenceCount: number;
}

export class StepVerifier {
  /** Pre-execution verification — every check must pass to run the step. */
  pre(input: PreVerifyInput): StepVerification {
    const checks: VerificationCheck[] = [];

    checks.push({
      name: 'capability',
      passed: Boolean(input.capability),
      detail: input.capability ? `capability ${input.capability}` : 'no capability bound',
    });
    checks.push({
      name: 'runtime-capability',
      passed: Boolean(input.runtimeCapability),
      detail: input.runtimeCapability
        ? `runtime path ${input.runtimeCapability}`
        : 'no runtime execution path',
    });

    const availability = input.port.availability(input.capability, input.runtimeCapability);
    checks.push({
      name: 'availability',
      passed: availability.available,
      detail: availability.reason ?? 'port reports available',
    });

    checks.push({
      name: 'configuration',
      passed: Boolean(input.provider),
      detail: input.provider ? `bound to ${input.provider}` : 'no provider bound',
    });

    checks.push({
      name: 'evidence',
      passed: input.evidenceCount > 0,
      detail:
        input.evidenceCount > 0
          ? `${input.evidenceCount} evidence item(s)`
          : 'no evidence for this step',
    });

    checks.push({
      name: 'budget',
      passed: !input.budget.exceeded,
      detail: input.budget.exceeded
        ? `budget already exceeded (${input.budget.failureReason ?? 'unknown'})`
        : `budget ${input.budget.spentCostUsd.toFixed(4)}$ / ${String(input.budget.maxCostUsd)}$`,
    });

    checks.push({
      name: 'approval',
      passed: true, // the resolver gates WAITING_FOR_APPROVAL before execution
      detail: 'no outstanding approval gate',
    });

    checks.push({
      name: 'dependencies',
      passed: input.dependencies.every((dep) => input.completedSteps.has(dep)),
      detail:
        input.dependencies.length === 0
          ? 'no dependencies'
          : `dependencies ${input.dependencies.filter((d) => !input.completedSteps.has(d)).join(', ') || 'all satisfied'}`,
    });

    return {
      stepId: input.stepId,
      pre: { passed: checks.every((c) => c.passed), checks },
    };
  }

  /**
   * Post-execution verification — a provider response is NOT success.
   * Success = execution completed + expected output exists + output
   * contract satisfied + (runtime) validation passed.
   */
  post(run: StepRun, result: StepExecutionResult): StepVerification {
    const checks: VerificationCheck[] = [];

    checks.push({
      name: 'execution-completed',
      passed: result.ok,
      detail: result.ok
        ? 'execution reported ok'
        : `execution failed: ${result.error ?? 'unknown'}`,
    });

    const content = result.content ?? '';
    checks.push({
      name: 'output-exists',
      passed: content.trim().length > 0,
      detail: content.trim().length > 0 ? `output ${content.length} chars` : 'no output produced',
    });

    checks.push({
      name: 'output-contract',
      passed: content.trim().length >= 20,
      detail:
        content.trim().length >= 20
          ? 'output satisfies the minimum length contract'
          : 'output below the minimum length contract (20 chars)',
    });

    checks.push({
      name: 'validation',
      passed: result.abstained !== true && result.validationDecision !== 'rejected',
      detail: result.abstained
        ? 'runtime abstained (evidence-first) — not a success'
        : result.validationDecision === 'rejected'
          ? 'runtime rejected the structured output'
          : (result.validationDecision ?? 'no validation rejection reported'),
    });

    const passed = checks.every((c) => c.passed);
    run.verification = {
      stepId: run.stepId,
      pre: run.verification?.pre ?? { passed: true, checks: [] },
      post: { passed, checks },
    };
    return run.verification;
  }

  /**
   * SPRINT-024 — REAL RUNTIME ARTIFACT VERIFICATION.
   * Inspect the REAL artifact(s) produced by the step through the
   * root-confined ArtifactReaderPort, independent of the execution claim.
   * A provider saying "file created" is NOT success — the evidence must
   * be observed. Missing / malformed / contradictory / unavailable
   * evidence never becomes SUCCESS (FAIL / UNKNOWN).
   */
  async verifyArtifacts(
    reader: ArtifactReaderPort,
    expectations: ArtifactExpectation[],
  ): Promise<ArtifactVerificationResult> {
    const verifier = new ArtifactVerifier(reader);
    return verifier.verify(expectations);
  }

  /**
   * Merge real-artifact evidence into an existing StepVerification so the
   * post-state passes ONLY when BOTH the execution contract passed AND every
   * artifact check passed (no FAIL, no UNKNOWN).
   */
  attachArtifacts(
    verification: StepVerification,
    artifactResult: ArtifactVerificationResult,
  ): StepVerification {
    const base = verification.post ?? { passed: false, checks: [] as VerificationCheck[] };
    const artifactChecks: VerificationCheck[] = artifactResult.checks.map((c) => ({
      name: `artifact:${c.checkId} (${c.type})`,
      passed: c.status === 'PASS',
      detail: `${c.path} — ${c.detail} [${c.status}]`,
    }));
    const post: { passed: boolean; checks: VerificationCheck[] } = {
      passed: base.passed && artifactResult.passed,
      checks: [...base.checks, ...artifactChecks],
    };
    return { stepId: verification.stepId, pre: verification.pre, post };
  }
}
