// ──────────────────────────────────────────────────────────────────
// VedMoulya — Loop Engine: Goal Understanding Service
// EPIC-006 — Phase 1. Converts a raw user goal into a typed
// GoalSpecification (objective, constraints, required capabilities,
// evidence requirements, success criteria, risk, budget, latency
// preference, allowed tools, maximum iterations) — deterministically,
// with every derivation recorded in `derivationReasons`. No LLM is
// required and no uncontrolled interpretation is allowed.
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import {
  capabilitiesForPattern,
  detectGoalPattern,
  evidenceForPattern,
  patternLabel,
} from '../catalog/loop-catalog.js';
import type {
  EvidenceRequirement,
  GoalPattern,
  GoalSpecification,
  LatencyPreference,
  LoopBudgetConfig,
  LoopRiskLevel,
  SuccessCriterion,
} from '../types/loop-types.js';
import { DEFAULT_LOOP_BUDGET } from '../types/loop-types.js';

export interface GoalUnderstandingOverrides {
  budget?: Partial<LoopBudgetConfig>;
  pattern?: GoalPattern;
  qualityTier?: GoalSpecification['qualityTier'];
  collection?: string;
  latencyPreference?: LatencyPreference;
}

/**
 * Deterministic goal-understanding rules. Keyword-driven so the same goal
 * always produces the same specification (controlled interpretation).
 */
const RISK_KEYWORDS: Array<{ keywords: string[]; level: LoopRiskLevel }> = [
  { keywords: ['production', 'critical', 'billing', 'payment', 'security', 'sap'], level: 'high' },
  { keywords: ['complex', 'enterprise', 'integration', 'migration'], level: 'medium' },
  { keywords: ['simple', 'demo', 'prototype', 'mockup'], level: 'low' },
];

const CONSTRAINT_KEYWORDS: Array<{ keywords: string[]; constraint: string }> = [
  { keywords: ['modern', 'modern look', 'contemporary'], constraint: 'modern, contemporary UX' },
  { keywords: ['fast', 'performance', 'responsive'], constraint: 'responsive and fast' },
  { keywords: ['secure', 'security'], constraint: 'secure by design' },
  { keywords: ['mobile', 'app store'], constraint: 'mobile-ready' },
  { keywords: ['multi-tenant', 'multi tenant'], constraint: 'tenant-isolated' },
  { keywords: ['budget', 'cheap', 'cost-effective'], constraint: 'cost-conscious execution' },
];

const SUCCESS_SECTION_MAP: Record<GoalPattern, string[]> = {
  'abap-debugger': ['Diagnosis', 'Explanation', 'Corrected Code', 'Validation'],
  'app-builder': ['Requirements', 'Architecture', 'UI Plan', 'Implementation Plan'],
  'ai-app-builder': ['Requirements', 'Architecture', 'Capabilities', 'Implementation'],
  generic: ['Deliverable'],
};

export class GoalUnderstandingService {
  /** Convert a raw goal into a typed, explained GoalSpecification. */
  derive(rawGoal: string, overrides: GoalUnderstandingOverrides = {}): GoalSpecification {
    const goal = rawGoal.trim();
    if (goal.length < 3) {
      throw new Error('goal must be at least 3 characters');
    }

    const pattern = overrides.pattern ?? detectGoalPattern(goal);
    const reasons: string[] = [];
    reasons.push(
      `Pattern "${patternLabel(pattern)}" matched from goal text${overrides.pattern ? ' (explicit override)' : ''}.`,
    );

    const capabilities = capabilitiesForPattern(pattern, goal);
    capabilities.forEach((capability) =>
      reasons.push(
        `Required capability ${capability} — required by the ${patternLabel(pattern)} pattern.`,
      ),
    );

    // Evidence requirement (Phase 6): grounded work must be evidence-first.
    const collection = overrides.collection ?? `loop:${pattern}`;
    const evidenceDescription = evidenceForPattern(pattern, goal);
    const evidenceRequirements: EvidenceRequirement[] = [
      {
        collection,
        queryTemplate: goal.length > 240 ? `${goal.slice(0, 240)}…` : goal,
        topK: 5,
        groundingRequired: true,
        reason: `The ${patternLabel(pattern)} pattern requires grounding in ${evidenceDescription}.`,
      },
    ];

    // Success criteria (deterministic, checkable by the critic).
    const requiredSections = SUCCESS_SECTION_MAP[pattern];
    const successCriteria: SuccessCriterion[] = [
      {
        criterionId: 'c1',
        description: `Final answer must contain the expected sections for ${patternLabel(pattern)}.`,
        requiredSections,
        minLength: pattern === 'abap-debugger' ? 400 : 600,
      },
    ];

    // Risk from deterministic keyword rules.
    const riskLevel = this.detectRisk(goal);

    // Constraints from deterministic keyword rules.
    const constraints = CONSTRAINT_KEYWORDS.filter((rule) =>
      rule.keywords.some((keyword) => goal.toLowerCase().includes(keyword)),
    ).map((rule) => rule.constraint);
    if (constraints.length === 0) {
      constraints.push('quality-first delivery with explicit validation');
    }
    reasons.push(`Risk level ${riskLevel} detected from keywords.`);

    // Budget envelope (Phase 4/8): derived from risk + pattern.
    const budget: LoopBudgetConfig = {
      ...DEFAULT_LOOP_BUDGET,
      ...this.budgetForRisk(riskLevel, pattern),
      ...overrides.budget,
    };
    reasons.push(
      `Budget envelope: max ${budget.maxIterations} iterations, ${String(budget.maxTokens)} tokens, $${String(budget.maxCostUsd)} cost, ${String(budget.maxProviderCalls)} provider calls, ${String(budget.maxToolCalls)} tool calls.`,
    );

    const latencyPreference: LatencyPreference =
      overrides.latencyPreference ?? (budget.maxLatencyMs <= 60_000 ? 'latency_first' : 'balanced');

    const allowedTools = pattern === 'abap-debugger' || pattern === 'generic' ? ['calculator'] : [];

    // Deterministic underspecification detection (Phase 7/12): when the goal
    // is too ambiguous to plan reliably, the loop asks instead of guessing.
    const clarificationNeeded = this.detectClarificationNeeded(goal);
    if (clarificationNeeded) {
      reasons.push(`Clarification required: ${clarificationNeeded}`);
    }

    return {
      goalId: generateId(),
      rawGoal: goal,
      objective: `Solve: ${goal}`,
      constraints,
      requiredCapabilities: capabilities,
      evidenceRequirements,
      successCriteria,
      riskLevel,
      budget,
      latencyPreference,
      allowedTools,
      maxIterations: budget.maxIterations,
      pattern,
      derivationReasons: reasons,
      qualityTier: overrides.qualityTier ?? (riskLevel === 'high' ? 'premium' : 'standard'),
      clarificationNeeded: clarificationNeeded ? { reason: clarificationNeeded } : undefined,
    };
  }

  /**
   * Deterministic underspecification rules: too-short goals and explicit
   * placeholder phrasing can never be planned reliably.
   */
  private detectClarificationNeeded(goal: string): string | undefined {
    if (goal.length < 21) {
      return `The goal is too short (${String(goal.length)} chars) to derive reliable requirements. Provide more detail (what, for whom, constraints, expected outcome).`;
    }
    const placeholder =
      /(^|\s)(todo|tbd|fill this in|as you like|you decide|whatever you want|something similar|etc)(\s|$|\.)/i.test(
        goal,
      );
    if (placeholder) {
      return 'The goal contains placeholder phrasing (todo/tbd/you decide). State the actual requirement precisely.';
    }
    return undefined;
  }

  /** Deterministic risk detection from goal keywords. */
  private detectRisk(goal: string): LoopRiskLevel {
    const normalized = goal.toLowerCase();
    for (const rule of RISK_KEYWORDS) {
      if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
        return rule.level;
      }
    }
    return 'low';
  }

  /** Budget scaling by risk + pattern (still bounded by the defaults). */
  private budgetForRisk(riskLevel: LoopRiskLevel, pattern: GoalPattern): Partial<LoopBudgetConfig> {
    const base = { maxIterations: 8, maxTokens: 8_000, maxCostUsd: 1.0, maxProviderCalls: 32 };
    if (pattern === 'abap-debugger' || pattern === 'ai-app-builder') {
      return { ...base, maxIterations: 10, maxTokens: 12_000, maxProviderCalls: 40 };
    }
    if (riskLevel === 'high' || riskLevel === 'critical') {
      return { ...base, maxIterations: 10, maxTokens: 12_000, maxCostUsd: 2.0 };
    }
    return base;
  }
}
