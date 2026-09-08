// ──────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Planning Intelligence: Deterministic Templates
//
// The smallest viable plan that can accomplish a goal. Deterministic
// templates (no AI) prefer: deterministic operations where possible,
// existing capabilities (frozen taxonomy), explicit verification and
// bounded recovery. No speculative actions: every step maps to a real
// AI action (routing-backed) or a registry-validated tool.
//
// Templates produce the frozen AgentPlan contract directly — the same
// shape the execution engine consumes, so a deterministic plan skips no
// validation (it still passes the full pipeline + readiness).
// ──────────────────────────────────────────────────────────────────

import type { AgentPlan, AgentPlanStep, VerificationPolicy } from '@vedmoulya/agent-execution';
import type { GoalUnderstanding } from '../types/planning-types.js';

export interface PlanTemplate {
  id: string;
  matches(understanding: GoalUnderstanding): boolean;
  build(understanding: GoalUnderstanding, planId: string): AgentPlan;
}

// ── Small builders ────────────────────────────────────────────────

function rulePolicy(
  checks: {
    name: string;
    kind: 'includes' | 'notIncludes' | 'minLength';
    text?: string;
    length?: number;
  }[],
  description: string,
): VerificationPolicy {
  return {
    kind: 'rule',
    description,
    checks: checks.map((check) =>
      check.kind === 'minLength'
        ? { name: check.name, kind: 'minLength' as const, length: check.length ?? 1 }
        : { name: check.name, kind: check.kind, text: check.text ?? '' },
    ),
  };
}

const BOUNDED_RECOVERY = { maxAttempts: 2, maxRevisions: 1 };

function aiStep(
  stepId: string,
  objective: string,
  capability: AgentPlanStep['capability'],
  instruction: string,
  verification: VerificationPolicy,
  dependencies: string[] = [],
  requiredCapabilities?: AgentPlanStep['requiredCapabilities'],
): AgentPlanStep {
  return {
    stepId,
    objective,
    capability,
    requiredCapabilities,
    allowedTools: [],
    dependencies,
    actions: [
      {
        actionId: `${stepId}-action`,
        kind: 'ai',
        capability: capability ?? 'reasoning',
        requiredCapabilities,
        instruction,
        expectedOutcome: objective,
      },
    ],
    expectedOutcome: objective,
    verificationPolicy: verification,
    recoveryPolicy: BOUNDED_RECOVERY,
  };
}

// ── Template 1: repository fix (the canonical example) ────────────

const REPOSITORY_FIX_PATTERN =
  /(fix|repair|resolve).*(test|build|failure)|(test|build|failure).*(fix|repair|resolve)|failing tests?/i;

const REPOSITORY_FIX_TEMPLATE: PlanTemplate = {
  id: 'repository-fix',
  matches: (understanding) => REPOSITORY_FIX_PATTERN.test(understanding.normalizedGoal),
  build: (understanding, planId): AgentPlan => ({
    planId,
    goalId: understanding.goalId,
    objective: understanding.normalizedGoal,
    steps: [
      aiStep(
        'step-1',
        'Inspect the repository and current test state',
        'reasoning',
        'Inspect the repository state for the goal: {goal}. Identify the test setup, recent changes and where failures are likely. Report a concise, factual summary of what you found.',
        rulePolicy(
          [
            { name: 'has-repository', kind: 'includes', text: 'repository' },
            { name: 'has-test-context', kind: 'includes', text: 'test' },
          ],
          'the inspection summary must describe the repository and test context',
        ),
      ),
      aiStep(
        'step-2',
        'Identify the failing tests',
        'reasoning',
        'Based on the inspection of {outputOf:step-1} for the goal: {goal}. List the specific failing tests with the observed failure signals. Do not guess — only report what the inspection shows.',
        rulePolicy(
          [
            { name: 'has-failure-signal', kind: 'includes', text: 'fail' },
            { name: 'lists-tests', kind: 'minLength', length: 40 },
          ],
          'the failing-test list must name specific failures with evidence',
        ),
        ['step-1'],
      ),
      aiStep(
        'step-3',
        'Diagnose the root cause',
        'reasoning',
        'Diagnose the root cause of the failing tests identified in {outputOf:step-2} for the goal: {goal}. Explain the cause precisely and why the current behavior produces the failure.',
        rulePolicy(
          [
            { name: 'has-diagnosis', kind: 'includes', text: 'cause' },
            { name: 'diagnosis-length', kind: 'minLength', length: 60 },
          ],
          'the diagnosis must name a root cause and explain the failure mechanism',
        ),
        ['step-2'],
      ),
      aiStep(
        'step-4',
        'Implement the minimal fix',
        'coding',
        'Implement the minimal fix for the root cause from {outputOf:step-3} in service of the goal: {goal}. Prefer the smallest change that addresses the diagnosis. Do not introduce speculative changes.',
        rulePolicy(
          [
            { name: 'has-fix', kind: 'includes', text: 'fix' },
            { name: 'fix-length', kind: 'minLength', length: 40 },
          ],
          'the fix must describe the change made and why it addresses the root cause',
        ),
        ['step-3'],
        ['coding', 'reasoning'],
      ),
      aiStep(
        'step-5',
        'Run the targeted tests',
        'coding',
        'Run the tests that were failing (from {outputOf:step-2}) after the fix in {outputOf:step-4}. Report the outcome truthfully — including any remaining failures.',
        rulePolicy(
          [
            { name: 'has-outcome', kind: 'includes', text: 'pass' },
            { name: 'outcome-length', kind: 'minLength', length: 30 },
          ],
          'the targeted-test run must report a pass outcome with the test names',
        ),
        ['step-4'],
        ['coding', 'reasoning'],
      ),
      aiStep(
        'step-6',
        'Run the relevant broader tests',
        'reasoning',
        'Run the broader relevant test suite to ensure the fix in {outputOf:step-4} did not regress anything, for the goal: {goal}. Report pass/fail truthfully.',
        rulePolicy(
          [
            { name: 'has-pass', kind: 'includes', text: 'pass' },
            { name: 'broad-length', kind: 'minLength', length: 30 },
          ],
          'the broader run must report a pass outcome or explicitly list regressions',
        ),
        ['step-5'],
      ),
      aiStep(
        'step-7',
        'Verify the final state',
        'reasoning',
        'Verify the final repository state for the goal: {goal}: failing tests fixed, no new regressions, and the change minimal. State the final verification conclusion explicitly.',
        rulePolicy(
          [
            { name: 'has-verified', kind: 'includes', text: 'verified' },
            { name: 'final-length', kind: 'minLength', length: 40 },
          ],
          'the final verification must explicitly state that the goal is verified',
        ),
        ['step-6'],
        ['reasoning', 'coding'],
      ),
    ],
    finalVerification: rulePolicy(
      [
        { name: 'goal-verified', kind: 'includes', text: 'verified' },
        { name: 'goal-passing', kind: 'includes', text: 'pass' },
      ],
      'the final summary must state the goal is verified with passing tests',
    ),
    completionCriteria: [
      'failing tests identified with evidence',
      'root cause diagnosed',
      'minimal fix implemented',
      'targeted and broader tests pass',
      'final state verified',
    ],
  }),
};

// ── Template 2: content creation (blog/article/copy/newsletter) ────

const CONTENT_PATTERN =
  /(write|create|draft|produce|compose).*(blog|article|post|copy|newsletter|content|email|landing page|case study)|(blog|article|post|newsletter|landing page|case study).*(write|create|draft)/i;

const CONTENT_TEMPLATE: PlanTemplate = {
  id: 'content',
  matches: (understanding) => CONTENT_PATTERN.test(understanding.normalizedGoal),
  build: (understanding, planId): AgentPlan => ({
    planId,
    goalId: understanding.goalId,
    objective: understanding.normalizedGoal,
    steps: [
      aiStep(
        'step-1',
        'Clarify the content brief',
        'reasoning',
        'Clarify the content brief for the goal: {goal}. Identify the target audience, tone, format, length and the key message that must land. List any constraints explicitly.',
        rulePolicy(
          [
            { name: 'has-audience', kind: 'includes', text: 'audience' },
            { name: 'brief-length', kind: 'minLength', length: 60 },
          ],
          'the brief must state the audience, tone, format and key message',
        ),
      ),
      aiStep(
        'step-2',
        'Draft the content',
        'content_generation',
        'Draft the content for the goal: {goal} following the brief from {outputOf:step-1}. Produce the full deliverable — never a placeholder outline.',
        rulePolicy(
          [{ name: 'has-deliverable', kind: 'minLength', length: 120 }],
          'the draft must be the complete deliverable addressing every brief point',
        ),
        ['step-1'],
        ['content_generation', 'reasoning'],
      ),
      aiStep(
        'step-3',
        'Review the draft against the brief',
        'reasoning',
        'Review the draft from {outputOf:step-2} against the brief from {outputOf:step-1} for the goal: {goal}. Report each unmet requirement explicitly — do not claim completeness that is not there.',
        rulePolicy(
          [
            { name: 'has-review', kind: 'includes', text: 'brief' },
            { name: 'review-length', kind: 'minLength', length: 60 },
          ],
          'the review must compare the draft against every brief requirement',
        ),
        ['step-2'],
      ),
      aiStep(
        'step-4',
        'Refine the content',
        'content_generation',
        'Refine the draft from {outputOf:step-2} to close the gaps found in {outputOf:step-3} for the goal: {goal}. Keep changes targeted — do not rewrite content that already meets the brief.',
        rulePolicy(
          [{ name: 'refined-length', kind: 'minLength', length: 120 }],
          'the refined content must address the review findings',
        ),
        ['step-3'],
        ['content_generation', 'reasoning'],
      ),
      aiStep(
        'step-5',
        'Verify the final content',
        'reasoning',
        'Verify the final content from {outputOf:step-4} against the brief from {outputOf:step-1} for the goal: {goal}. State explicitly that the deliverable is verified and complete.',
        rulePolicy(
          [
            { name: 'has-verified', kind: 'includes', text: 'verified' },
            { name: 'final-length', kind: 'minLength', length: 40 },
          ],
          'the final verification must explicitly state the content is verified against the brief',
        ),
        ['step-4'],
      ),
    ],
    finalVerification: rulePolicy(
      [
        { name: 'goal-verified', kind: 'includes', text: 'verified' },
        { name: 'goal-complete', kind: 'includes', text: 'complete' },
      ],
      'the final summary must state the content is verified and complete',
    ),
    completionCriteria: [
      'content brief clarified with audience, tone and key message',
      'full deliverable drafted',
      'draft reviewed against the brief',
      'targeted refinements applied',
      'final content verified against the brief',
    ],
  }),
};

// ── Template 3: analysis (data/report/impact review) ──────────────

const ANALYSIS_PATTERN =
  /(analy(s|z)e|assess|evaluate|benchmark|investigate|diagnose|root cause|review).*(data|report|performance|impact|trend|metrics|usage|failure|findings)|(data|report|metrics|findings).*(analy(s|z)e|assess|evaluate)/i;

const ANALYSIS_TEMPLATE: PlanTemplate = {
  id: 'analysis',
  matches: (understanding) => ANALYSIS_PATTERN.test(understanding.normalizedGoal),
  build: (understanding, planId): AgentPlan => ({
    planId,
    goalId: understanding.goalId,
    objective: understanding.normalizedGoal,
    steps: [
      aiStep(
        'step-1',
        'Scope the analysis and gather the inputs',
        'reasoning',
        'Scope the analysis for the goal: {goal}. Define the question being answered, the data/inputs needed and the success criteria for the analysis. Report the scope explicitly.',
        rulePolicy(
          [
            { name: 'has-scope', kind: 'includes', text: 'scope' },
            { name: 'scope-length', kind: 'minLength', length: 60 },
          ],
          'the scope must state the question, the inputs needed and the success criteria',
        ),
      ),
      aiStep(
        'step-2',
        'Analyze the inputs',
        'reasoning',
        'Analyze the inputs gathered in {outputOf:step-1} for the goal: {goal}. Work through the data methodically and record each finding with its supporting evidence.',
        rulePolicy(
          [
            { name: 'has-findings', kind: 'includes', text: 'finding' },
            { name: 'analysis-length', kind: 'minLength', length: 80 },
          ],
          'the analysis must record findings with supporting evidence',
        ),
        ['step-1'],
      ),
      aiStep(
        'step-3',
        'Produce the analysis report',
        'content_generation',
        'Produce the analysis report from the findings in {outputOf:step-2} for the goal: {goal}. State conclusions, the evidence behind each, and any remaining unknowns honestly.',
        rulePolicy(
          [
            { name: 'has-conclusion', kind: 'includes', text: 'conclusion' },
            { name: 'report-length', kind: 'minLength', length: 100 },
          ],
          'the report must state conclusions with evidence and remaining unknowns',
        ),
        ['step-2'],
        ['content_generation', 'reasoning'],
      ),
      aiStep(
        'step-4',
        'Verify the analysis report',
        'reasoning',
        'Verify the analysis report from {outputOf:step-3} against the scope from {outputOf:step-1} for the goal: {goal}. Confirm every conclusion is evidenced and checkable, and state the verification explicitly.',
        rulePolicy(
          [
            { name: 'has-verified', kind: 'includes', text: 'verified' },
            { name: 'final-length', kind: 'minLength', length: 40 },
          ],
          'the final verification must explicitly confirm the analysis is checkable and verified',
        ),
        ['step-3'],
      ),
    ],
    finalVerification: rulePolicy(
      [
        { name: 'goal-verified', kind: 'includes', text: 'verified' },
        { name: 'goal-evidenced', kind: 'includes', text: 'evidence' },
      ],
      'the final summary must state the analysis is verified and evidence-backed',
    ),
    completionCriteria: [
      'analysis scope and inputs defined',
      'inputs analyzed with evidence',
      'analysis report produced with conclusions and unknowns',
      'report verified against the scope',
    ],
  }),
};

// ── Template 4: learning (study/master a topic/skill) ─────────────

const LEARNING_PATTERN =
  /(learn|study|master|train).*(concept|topic|framework|skill|language|subject|fundamentals|basics|essentials)|understand.*(concept|topic|framework)/i;

const LEARNING_TEMPLATE: PlanTemplate = {
  id: 'learning',
  matches: (understanding) => LEARNING_PATTERN.test(understanding.normalizedGoal),
  build: (understanding, planId): AgentPlan => ({
    planId,
    goalId: understanding.goalId,
    objective: understanding.normalizedGoal,
    steps: [
      aiStep(
        'step-1',
        'Establish the learning baseline and path',
        'reasoning',
        'Establish the learning baseline and path for the goal: {goal}. Define the target level, the prerequisite concepts and the ordered path from baseline to target. Report them explicitly.',
        rulePolicy(
          [
            { name: 'has-path', kind: 'includes', text: 'path' },
            { name: 'baseline-length', kind: 'minLength', length: 60 },
          ],
          'the baseline must state the target level, prerequisites and ordered learning path',
        ),
      ),
      aiStep(
        'step-2',
        'Produce the structured learning material',
        'content_generation',
        'Produce the structured learning material for the goal: {goal} following the path from {outputOf:step-1}. Cover each concept with explanation, examples and key takeaways — a complete study guide, never placeholders.',
        rulePolicy(
          [{ name: 'material-length', kind: 'minLength', length: 120 }],
          'the learning material must cover every path concept with examples and takeaways',
        ),
        ['step-1'],
        ['content_generation', 'reasoning'],
      ),
      aiStep(
        'step-3',
        'Practice and apply the concepts',
        'reasoning',
        'Practice and apply the concepts from {outputOf:step-2} for the goal: {goal}. Work through representative exercises against the material and record the outcomes.',
        rulePolicy(
          [
            { name: 'has-practice', kind: 'includes', text: 'practice' },
            { name: 'practice-length', kind: 'minLength', length: 60 },
          ],
          'the practice must work through representative exercises with recorded outcomes',
        ),
        ['step-2'],
      ),
      aiStep(
        'step-4',
        'Assess understanding against the baseline',
        'reasoning',
        'Assess understanding against the baseline from {outputOf:step-1} for the goal: {goal}. Check each target concept and report what is mastered and what still needs work — no fabricated mastery.',
        rulePolicy(
          [
            { name: 'has-assessment', kind: 'includes', text: 'mastered' },
            { name: 'assessment-length', kind: 'minLength', length: 60 },
          ],
          'the assessment must report mastered concepts and remaining gaps honestly',
        ),
        ['step-3'],
      ),
      aiStep(
        'step-5',
        'Verify the learning outcome',
        'reasoning',
        'Verify the learning outcome for the goal: {goal} using the assessment from {outputOf:step-4}. State explicitly whether the target level from {outputOf:step-1} is reached.',
        rulePolicy(
          [
            { name: 'has-verified', kind: 'includes', text: 'verified' },
            { name: 'final-length', kind: 'minLength', length: 40 },
          ],
          'the final verification must explicitly state whether the target level is reached',
        ),
        ['step-4'],
      ),
    ],
    finalVerification: rulePolicy(
      [
        { name: 'goal-verified', kind: 'includes', text: 'verified' },
        { name: 'goal-target', kind: 'includes', text: 'target' },
      ],
      'the final summary must state the learning target is verified',
    ),
    completionCriteria: [
      'learning baseline and path established',
      'structured learning material produced',
      'concepts practiced and applied',
      'understanding assessed against the baseline',
      'learning outcome verified',
    ],
  }),
};

// ── Template 5: generic fallback (smallest viable plan) ───────────

const GENERIC_TEMPLATE: PlanTemplate = {
  id: 'generic',
  matches: () => true,
  build: (understanding, planId): AgentPlan => {
    const primary = understanding.primaryCapability ?? 'reasoning';
    const requiredCapabilities = understanding.requiredCapabilities;
    const steps: AgentPlanStep[] = [
      aiStep(
        'step-1',
        'Clarify the objective and requirements',
        'reasoning',
        'Clarify the objective and requirements for the goal: {goal}. Summarize what must be delivered and the constraints that apply.',
        rulePolicy(
          [
            { name: 'has-objective', kind: 'includes', text: 'objective' },
            { name: 'objective-length', kind: 'minLength', length: 40 },
          ],
          'the clarification must state the objective and the applicable constraints',
        ),
      ),
      aiStep(
        'step-2',
        'Produce the deliverable',
        primary,
        'Produce the deliverable for the goal: {goal} using the requirements from {outputOf:step-1}. Prefer the smallest viable output that satisfies the objective.',
        rulePolicy(
          [{ name: 'has-deliverable', kind: 'minLength', length: 80 }],
          'the deliverable must be substantial and address the objective',
        ),
        ['step-1'],
        requiredCapabilities.length > 0 ? requiredCapabilities : undefined,
      ),
      aiStep(
        'step-3',
        'Verify the deliverable',
        'reasoning',
        'Verify the deliverable from {outputOf:step-2} against the objective for the goal: {goal}. State explicitly whether it satisfies the requirements.',
        rulePolicy(
          [
            { name: 'has-verdict', kind: 'includes', text: 'verified' },
            { name: 'verdict-length', kind: 'minLength', length: 40 },
          ],
          'the verification must explicitly state whether the deliverable satisfies the objective',
        ),
        ['step-2'],
      ),
    ];
    return {
      planId,
      goalId: understanding.goalId,
      objective: understanding.normalizedGoal,
      steps,
      finalVerification: rulePolicy(
        [{ name: 'goal-verified', kind: 'includes', text: 'verified' }],
        'the final summary must state the goal is verified',
      ),
      completionCriteria: ['objective clarified', 'deliverable produced', 'deliverable verified'],
    };
  },
};

export const PLAN_TEMPLATES: readonly PlanTemplate[] = [
  REPOSITORY_FIX_TEMPLATE,
  CONTENT_TEMPLATE,
  ANALYSIS_TEMPLATE,
  LEARNING_TEMPLATE,
  GENERIC_TEMPLATE,
];

/** First matching template (generic always matches — never undefined). */
export function selectTemplate(
  understanding: GoalUnderstanding,
  templates: readonly PlanTemplate[] = PLAN_TEMPLATES,
): PlanTemplate {
  const template = templates.find((candidate) => candidate.matches(understanding));
  return template ?? GENERIC_TEMPLATE;
}
