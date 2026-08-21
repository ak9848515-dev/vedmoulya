// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Fabric · VerificationChainPolicy
// SPRINT-030 — G-6 · bounded composition-level verification.
//
// A multi-provider system must not blindly trust one model. This policy
// evaluates a FIXED, pre-declared chain (answer → critique → verify) against
// a verdict model:
//   VERIFIED       — answer and verifier agree
//   CONTRADICTED   — verifier explicitly contradicts the answer
//   NEEDS_REVIEW   — disagreement or unresolved conflict between chain steps
//   INCONCLUSIVE   — evidence insufficient (never claimed as success)
//
// Termination is deterministic: the chain length is FIXED at plan time and
// bounded by maxDepth / maxProviders / timeoutMs / maxCostUsd. This package
// NEVER spawns an unbounded AI-to-AI loop — it validates a plan and evaluates
// a declared result set.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  VerificationChainConfig,
  VerificationChainDecision,
  VerificationVerdict,
} from '../types/fabric-types.js';

export interface ChainStepResult {
  /** Which provider/model produced this step. */
  providerId: string;
  /** The step's own verdict about the previous step's output. */
  verdict: 'AGREE' | 'CONTRADICT' | 'UNKNOWN';
  /** Human-readable rationale. */
  note: string;
}

export interface ChainEvaluation {
  answer: ChainStepResult;
  critique?: ChainStepResult;
  verify?: ChainStepResult;
  /** Cost actually incurred by the chain (from the cost ledger). */
  costUsd?: number;
  /** Wall-clock actually spent (from execution telemetry). */
  timeMs?: number;
}

export interface VerificationPlan {
  depth: number;
  providers: number;
  timeoutMs: number;
  costUsd?: number;
}

/**
 * Validates a verification-chain PLAN against the configured bounds, and
 * evaluates a declared chain result set into a verdict. Deterministic;
 * never loops.
 */
export class VerificationChainPolicy {
  private readonly config: VerificationChainConfig;

  constructor(config: VerificationChainConfig) {
    this.config = config;
  }

  /** A chain may only run when its plan is within bounds (fail-closed). */
  validatePlan(plan: VerificationPlan): { allowed: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let allowed = true;
    if (plan.depth > this.config.maxDepth) {
      allowed = false;
      reasons.push(`depth ${plan.depth} exceeds maxDepth ${this.config.maxDepth}.`);
    }
    if (plan.providers > this.config.maxProviders) {
      allowed = false;
      reasons.push(`providers ${plan.providers} exceed maxProviders ${this.config.maxProviders}.`);
    }
    if (plan.timeoutMs > this.config.timeoutMs) {
      allowed = false;
      reasons.push(
        `timeout ${plan.timeoutMs}ms exceeds the configured ${this.config.timeoutMs}ms.`,
      );
    }
    if (plan.costUsd !== undefined && plan.costUsd > this.config.maxCostUsd) {
      allowed = false;
      reasons.push(
        `cost $${plan.costUsd.toFixed(4)} exceeds maxCostUsd $${this.config.maxCostUsd.toFixed(4)}.`,
      );
    }
    if (allowed) reasons.push('Chain plan is within all bounds.');
    return { allowed, reasons };
  }

  /** Evaluate a declared chain result set (already executed within bounds). */
  evaluate(chain: ChainEvaluation): VerificationChainDecision {
    const reasons: string[] = [
      `Answer step (${chain.answer.providerId}) produced: ${chain.answer.verdict}.`,
    ];
    const depthUsed = 1 + (chain.critique ? 1 : 0) + (chain.verify ? 1 : 0);
    const providersUsed = new Set(
      [chain.answer.providerId, chain.critique?.providerId, chain.verify?.providerId].filter(
        (p): p is string => p !== undefined,
      ),
    ).size;

    let verdict: VerificationVerdict;
    if (!chain.verify) {
      // No independent verifier — a critique that contradicts still forces review.
      if (chain.critique?.verdict === 'CONTRADICT') {
        verdict = 'NEEDS_REVIEW';
        reasons.push(
          `Critique (${chain.critique.providerId}) contradicts the answer — needs human review.`,
        );
      } else if (chain.critique?.verdict === 'UNKNOWN') {
        verdict = 'INCONCLUSIVE';
        reasons.push('Critique returned UNKNOWN — evidence insufficient, never claimed success.');
      } else {
        verdict = 'INCONCLUSIVE';
        reasons.push(
          'No independent verifier and no contradiction — inconclusive without verification.',
        );
      }
    } else if (chain.verify.verdict === 'AGREE' && chain.answer.verdict === 'AGREE') {
      verdict = 'VERIFIED';
      reasons.push(`Independent verifier (${chain.verify.providerId}) agrees with the answer.`);
    } else if (chain.verify.verdict === 'CONTRADICT') {
      verdict = 'CONTRADICTED';
      reasons.push(`Independent verifier (${chain.verify.providerId}) contradicts the answer.`);
    } else {
      verdict = 'NEEDS_REVIEW';
      reasons.push(
        'Verifier did not clearly agree — disagreement or insufficient evidence, needs review.',
      );
    }

    if (chain.costUsd !== undefined) reasons.push(`Chain cost $${chain.costUsd.toFixed(4)}.`);
    if (chain.timeMs !== undefined) reasons.push(`Chain wall-clock ${chain.timeMs}ms.`);

    return {
      verdict,
      reasons,
      depthUsed,
      providersUsed,
      withinBounds:
        depthUsed <= this.config.maxDepth &&
        providersUsed <= this.config.maxProviders &&
        (chain.timeMs === undefined || chain.timeMs <= this.config.timeoutMs) &&
        (chain.costUsd === undefined || chain.costUsd <= this.config.maxCostUsd),
    };
  }
}
