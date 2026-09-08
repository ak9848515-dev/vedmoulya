// ──────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Planning Intelligence: Goal Understanding
//
// Deterministic normalization of a raw user goal into a typed
// GoalUnderstanding. Same goal → same understanding (controlled
// interpretation). No LLM is required and no uncontrolled inference is
// allowed: anything that cannot be determined deterministically is
// listed in `unknownAspects` — the planner never invents unavailable
// tools, permissions or system state.
//
// Deliberately separate from loop-engine's GoalUnderstandingService
// (content-loop patterns/evidence) and the goals package's category
// analysis: this boundary feeds the Agent Execution Intelligence
// planning pipeline and reuses the frozen capability taxonomy.
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import type { CapabilityType } from '@vedmoulya/ai';
import { AGENT_AUTONOMY_LEVELS, DEFAULT_AGENT_RUN_BUDGET } from '@vedmoulya/agent-execution';
import type { AgentAutonomyLevel, AgentRunBudgetConfig } from '@vedmoulya/agent-execution';
import type { GoalInput, GoalUnderstanding, PlanConstraint } from '../types/planning-types.js';

// ── Deterministic capability inference (frozen taxonomy only) ─────
const CAPABILITY_KEYWORDS: Array<{ capability: CapabilityType; keywords: string[] }> = [
  {
    capability: 'coding',
    keywords: [
      'code',
      'coding',
      'implement',
      'fix',
      'build',
      'refactor',
      'script',
      'test',
      'debug',
      'patch',
      'repository',
      'repo',
      'app',
      'software',
      'automation',
    ],
  },
  {
    capability: 'reasoning',
    keywords: [
      'analyze',
      'analyse',
      'plan',
      'diagnose',
      'strategy',
      'evaluate',
      'research',
      'decide',
      'investigate',
      'root cause',
      'review',
    ],
  },
  {
    capability: 'content_generation',
    keywords: ['write', 'create', 'draft', 'blog', 'article', 'copy', 'report', 'generate'],
  },
  { capability: 'summarization', keywords: ['summarize', 'summary', 'digest', 'brief'] },
  {
    capability: 'classification',
    keywords: ['classify', 'categorize', 'tag', 'organize', 'label'],
  },
  { capability: 'translation', keywords: ['translate', 'translation', 'localize'] },
  { capability: 'vision', keywords: ['image', 'vision', 'photo', 'design', 'logo'] },
  {
    capability: 'general_conversation',
    keywords: ['brainstorm', 'discuss', 'coach', 'advice'],
  },
];

// ── Deterministic constraint inference ────────────────────────────
const CONSTRAINT_KEYWORDS: Array<{ keywords: string[]; constraint: string }> = [
  { keywords: ['secure', 'security', 'critical', 'production'], constraint: 'secure by design' },
  {
    keywords: ['budget', 'cheap', 'cost-effective', 'low cost'],
    constraint: 'cost-conscious execution',
  },
  { keywords: ['fast', 'quick', 'urgent', 'asap'], constraint: 'deliver promptly' },
  {
    keywords: ['quality', 'reliable', 'robust'],
    constraint: 'quality-first with explicit verification',
  },
];

// ── Deterministic verification expectations ───────────────────────
const VERIFICATION_EXPECTATION_RULES: Array<{ keywords: string[]; expectation: string }> = [
  { keywords: ['test', 'fail', 'pass'], expectation: 'tests pass after the change' },
  {
    keywords: ['write', 'create', 'draft', 'blog', 'article'],
    expectation: 'deliverable exists and satisfies the stated requirements',
  },
  {
    keywords: ['analyze', 'diagnose', 'research'],
    expectation: 'analysis is documented and checkable',
  },
];

const PLACEHOLDER_PHRASING =
  /(^|\s)(todo|tbd|fill this in|as you like|you decide|whatever you want|something similar|etc)(\s|$|\.)/i;

/** Collapse whitespace deterministically. */
function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export class GoalUnderstandingService {
  /**
   * Convert a raw goal (+ optional context/constraints) into a typed,
   * explained GoalUnderstanding. Deterministic: same input → same output.
   */
  derive(input: GoalInput): GoalUnderstanding {
    const rawGoal = input.goal.trim();
    if (rawGoal.length < 3) {
      throw new Error('goal must be at least 3 characters');
    }
    const reasons: string[] = [];
    const unknownAspects: string[] = [];
    const normalizedGoal = normalizeText(rawGoal);
    const text = normalizedGoal.toLowerCase();
    const contextText = (input.context ?? '').toLowerCase();

    // 1. Capability inference — deterministic keyword scoring over goal +
    //    context. When nothing matches, the capability is EXPLICITLY unknown
    //    (the planner may still propose one; nothing is fabricated here).
    const matched = CAPABILITY_KEYWORDS.filter((rule) =>
      rule.keywords.some((k) => text.includes(k) || contextText.includes(k)),
    );
    const capabilities = matched.map((rule) => rule.capability);
    const primaryCapability = capabilities[0];
    if (primaryCapability) {
      reasons.push(
        `Primary capability ${primaryCapability} inferred from goal text (deterministic keyword rules).`,
      );
      for (const extra of capabilities.slice(1)) {
        reasons.push(`Additional hard capability ${extra} inferred from goal text.`);
      }
    } else {
      unknownAspects.push(
        'primary capability could not be inferred from the goal text — the planner will propose one and validation will gate it.',
      );
    }

    // 2. Constraints — deterministic keyword rules + explicit constraints.
    const constraints = CONSTRAINT_KEYWORDS.filter((rule) =>
      rule.keywords.some((k) => text.includes(k)),
    ).map((rule) => rule.constraint);
    if (constraints.length === 0) {
      constraints.push('quality-first delivery with explicit verification');
    }
    reasons.push(`Constraints derived: ${constraints.join('; ')}.`);

    // 3. Verification expectations — what a successful outcome looks like.
    const verificationExpectations = VERIFICATION_EXPECTATION_RULES.filter((rule) =>
      rule.keywords.some((k) => text.includes(k)),
    ).map((rule) => rule.expectation);
    if (verificationExpectations.length === 0) {
      unknownAspects.push(
        'verification expectations could not be inferred — every meaningful step must still declare a verification policy.',
      );
    }
    reasons.push(
      `Verification expectations derived: ${verificationExpectations.join('; ') || 'none'}.`,
    );

    // 4. Expected outcome — only when deterministically inferable.
    let expectedOutcome: string | undefined;
    if (/test/i.test(text) && /fail/i.test(text)) {
      expectedOutcome = 'failing tests fixed and the final repository state verified';
    } else if (/write|create|draft/i.test(text)) {
      expectedOutcome = 'a deliverable that satisfies the stated requirements';
    }
    if (expectedOutcome === undefined) {
      unknownAspects.push('expected outcome could not be inferred from the goal text.');
    } else {
      reasons.push(`Expected outcome derived: ${expectedOutcome}.`);
    }

    // 5. Autonomy + budget — explicit wins, frozen defaults otherwise.
    const autonomyLevel = this.resolveAutonomy(input.constraints);
    reasons.push(`Autonomy ceiling: ${autonomyLevel}.`);
    const budget: AgentRunBudgetConfig = {
      ...DEFAULT_AGENT_RUN_BUDGET,
      ...(input.constraints?.budget ?? {}),
    };
    reasons.push(
      `Budget envelope: ${String(budget.maxAttemptsPerStep)} attempts/step, ${String(
        budget.maxRevisionsPerStep,
      )} revisions/step, ${String(budget.maxToolCalls)} tool calls, ${String(budget.maxTokens)} tokens, $${String(budget.maxCostUsd)} cost.`,
    );

    // 6. Deterministic underspecification — ask instead of guessing.
    const clarificationNeeded = this.detectClarificationNeeded(rawGoal);
    if (clarificationNeeded) {
      reasons.push(`Clarification required: ${clarificationNeeded}`);
    }

    return {
      goalId: `goal-${generateId()}`,
      userId: input.userId,
      rawGoal,
      normalizedGoal,
      primaryCapability,
      requiredCapabilities: capabilities,
      constraints,
      expectedOutcome,
      verificationExpectations,
      autonomyLevel,
      budget,
      clarificationNeeded: clarificationNeeded ? { reason: clarificationNeeded } : undefined,
      unknownAspects,
      derivationReasons: reasons,
    };
  }

  /** Autonomy: explicit constraint wins; else the frozen execution default. */
  private resolveAutonomy(constraints?: PlanConstraint): AgentAutonomyLevel {
    const level = constraints?.autonomyLevel;
    if (level !== undefined && AGENT_AUTONOMY_LEVELS.includes(level)) {
      return level;
    }
    return 'SUPERVISED';
  }

  /**
   * Deterministic underspecification rules: too-short goals and explicit
   * placeholder phrasing can never be planned reliably.
   */
  private detectClarificationNeeded(goal: string): string | undefined {
    if (goal.length < 21) {
      return `The goal is too short (${String(goal.length)} chars) to derive reliable requirements. Provide more detail (what, for whom, constraints, expected outcome).`;
    }
    if (PLACEHOLDER_PHRASING.test(goal)) {
      return 'The goal contains placeholder phrasing (todo/tbd/you decide). State the actual requirement precisely.';
    }
    return undefined;
  }
}
