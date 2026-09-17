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

// ── Governed tool step builders (FINAL-02) ────────────────────────
//
// The planning package stays provider-neutral: it never names a command
// executor, a shell, or a permission class. It expresses a step as an
// EXPLICIT governed tool action against a declared tool NAME, and states
// which tool the step must be verified with — exactly the frozen
// AgentPlanStep/AgentActionSpec contract. Whether the named tool exists,
// which permission class it carries, and whether the principal holds that
// class are decided downstream by the authoritative tool registry and the
// mission constraints. A plan that names an unavailable or ungranted tool
// is REJECTED by validation — never fabricated, never bypassed.
//
// Every tool step's verification is deterministic (kind:'command'): the
// REAL tool outcome decides the verdict. Model prose can never mark a
// command step verified.

/** The governed command-execution tool name (mission runtime registers it). */
export const COMMAND_TOOL_NAME = 'run_command';

export interface GovernedToolStepInput {
  stepId: string;
  objective: string;
  capability: AgentPlanStep['capability'];
  toolName: string;
  args?: Record<string, unknown>;
  verification: VerificationPolicy;
  expectedOutcome: string;
  dependencies?: string[];
  /** Single-action steps (default) or several ordered tool actions. */
  extraActions?: { actionId: string; toolName: string; args: Record<string, unknown> }[];
}

/**
 * A step whose work is performed by EXPLICIT governed tool action(s).
 * Arguments are literal values fixed by the plan builder — the AI never
 * supplies them, and no AI output is ever parsed into a tool call.
 */
function toolStep(input: GovernedToolStepInput): AgentPlanStep {
  const actions: Extract<AgentPlanStep['actions'][number], { kind: 'tool' }>[] = [
    {
      actionId: `${input.stepId}-action`,
      kind: 'tool',
      toolName: input.toolName,
      arguments: input.args ?? {},
      expectedOutcome: input.expectedOutcome,
    },
    ...(input.extraActions ?? []).map((extra) => ({
      actionId: extra.actionId,
      kind: 'tool' as const,
      toolName: extra.toolName,
      arguments: extra.args,
      expectedOutcome: input.expectedOutcome,
    })),
  ];
  const allowedTools = [...new Set(actions.map((action) => action.toolName))];
  return {
    stepId: input.stepId,
    objective: input.objective,
    capability: input.capability,
    allowedTools,
    dependencies: input.dependencies ?? [],
    actions,
    expectedOutcome: input.expectedOutcome,
    verificationPolicy: input.verification,
    recoveryPolicy: BOUNDED_RECOVERY,
  };
}

/**
 * A step that runs the governed command tool through the frozen
 * ToolRuntime and is verified by the REAL process outcome: `expect:'ok'`
 * passes only when the command actually succeeded. A non-zero exit, a
 * timeout, or a security denial can never be reported as success.
 */
function commandToolStep(input: {
  stepId: string;
  objective: string;
  commandId: string;
  fileArg?: string;
  dependencies?: string[];
}): AgentPlanStep {
  const args: Record<string, unknown> = { command: input.commandId };
  if (input.fileArg !== undefined) args['fileArg'] = input.fileArg;
  return toolStep({
    stepId: input.stepId,
    objective: input.objective,
    capability: 'coding',
    toolName: COMMAND_TOOL_NAME,
    args,
    expectedOutcome: `command ${input.commandId} exits successfully (real process status)`,
    dependencies: input.dependencies ?? [],
    verification: {
      kind: 'command',
      description: `command ${input.commandId} must exit successfully — the REAL process exit status decides the verdict, never model output`,
      command: { toolName: COMMAND_TOOL_NAME, arguments: args, expect: 'ok' },
    },
  });
}

// ── Template 1: repository fix (the canonical example) ────────────
//
// FINAL-02 — the repository mission path performs REAL repository work
// through EXPLICIT governed tool actions:
//
//   step-1  inspect      AI (reasoning only — no repository access)
//   step-2  identify     governed run_command (REAL failing exit status)
//   step-3  diagnose     AI (reasoning only)
//   step-4  repair       governed workspace_write + read-back verification
//   step-5  targeted     governed run_command (REAL exit status must be 0)
//   step-6  broader      governed run_command (REAL exit status must be 0)
//   step-7  verify       AI (reasoning only)
//
// Nothing is parsed out of model output: every command id and every file
// target is a literal chosen by this builder through the EXISTING
// deterministic goal-extraction mechanism. A command step's verdict comes
// exclusively from the real process outcome (kind:'command'); model prose
// can never mark a test run as passed.
//
// When the goal carries no explicit workspace file/repair target (i.e. the
// bounded deterministic extraction yields nothing), the repair step stays
// AI-only — the builder never invents a file to write, and the run steps
// still execute real commands through the governed tool.

const REPAIR_TARGET_PATTERN =
  /(?:fix|repair|update|correct)[\s\S]*?workspace file\s+([A-Za-z0-9][A-Za-z0-9._\-/]{0,80})/i;
const REPAIR_CONTENT_PATTERN = /(?:with|containing)[\s:]+(.{3,200})$/i;

/**
 * Deterministic extraction of the repair file target a repository-fix goal
 * may carry, e.g.:
 *
 *   "fix the workspace file calc.ts with the corrected content"
 *
 * The rule is the SAME bounded rule the mission runtime's workspace-file
 * template uses (relative filename only — never absolute, never '..').
 * The planning package cannot depend on the mission runtime (the runtime
 * depends on this package), so the rule lives here with the templates.
 * Undefined → the goal carries no explicit repair target and the repair
 * step stays AI-only (a target is never invented).
 */
export function extractRepositoryFixTarget(
  goal: string,
): { relativePath: string; content: string } | undefined {
  const match = REPAIR_TARGET_PATTERN.exec(goal);
  const rawName = match?.[1];
  if (!rawName) return undefined;
  let relativePath = rawName.toLowerCase();
  if (!/\.[a-z0-9]{1,10}$/.test(relativePath)) relativePath += '.md';
  if (relativePath.includes('..') || relativePath.includes('\\')) return undefined;
  const contentMatch = REPAIR_CONTENT_PATTERN.exec(goal);
  const content = (contentMatch?.[1] ?? 'Repaired by the VedMoulya mission runtime.').trim();
  return { relativePath, content: content.slice(0, 400) };
}

const REPOSITORY_FIX_PATTERN =
  /(fix|repair|resolve).*(test|build|failure)|(test|build|failure).*(fix|repair|resolve)|failing tests?/i;

const REPOSITORY_FIX_TEMPLATE: PlanTemplate = {
  id: 'repository-fix',
  matches: (understanding) => REPOSITORY_FIX_PATTERN.test(understanding.normalizedGoal),
  build: (understanding, planId): AgentPlan => {
    const target = extractRepositoryFixTarget(understanding.normalizedGoal);
    return {
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
        // REAL failure evidence: the governed command tool runs the workspace
        // tests; a non-zero exit fails this step with the process evidence.
        commandToolStep({
          stepId: 'step-2',
          objective: 'Run the test command and observe the REAL failure',
          commandId: 'npm_test',
          dependencies: ['step-1'],
        }),
        aiStep(
          'step-3',
          'Identify the failing tests and diagnose the root cause',
          'reasoning',
          'The REAL test run for the goal: {goal} failed with the observed process output in {outputOf:step-2}. Name the specific failing tests from that evidence and diagnose the root cause precisely (do not guess beyond the observed failure output).',
          rulePolicy(
            [
              { name: 'has-failure-signal', kind: 'includes', text: 'fail' },
              { name: 'has-diagnosis', kind: 'includes', text: 'cause' },
              { name: 'diagnosis-length', kind: 'minLength', length: 60 },
            ],
            'the diagnosis must name the observed failing tests and a root cause',
          ),
          ['step-2'],
        ),
        ...(target
          ? [
              // REAL repair: the governed workspace tool performs the write;
              // verification reads the file back through the same runtime.
              toolStep({
                stepId: 'step-4',
                objective: `Apply the minimal fix to ${target.relativePath} through the governed workspace tool`,
                capability: 'coding',
                toolName: 'workspace_write',
                args: { relativePath: target.relativePath, content: target.content },
                expectedOutcome: `${target.relativePath} is written with the repaired content`,
                dependencies: ['step-3'],
                extraActions: [
                  {
                    actionId: 'step-4-readback',
                    toolName: 'workspace_read',
                    args: { relativePath: target.relativePath },
                  },
                ],
                verification: {
                  kind: 'command',
                  description: `${target.relativePath} must read back through the governed tool after the repair write`,
                  command: {
                    toolName: 'workspace_read',
                    arguments: { relativePath: target.relativePath },
                    expect: 'ok',
                  },
                },
              }),
            ]
          : [
              aiStep(
                'step-4',
                'Implement the minimal fix',
                'coding',
                'Implement the minimal fix for the root cause diagnosed in {outputOf:step-3} in service of the goal: {goal}. Prefer the smallest change that addresses the diagnosis. Do not introduce speculative changes.',
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
            ]),
        // Targeted re-run: only a REAL successful exit status verifies.
        commandToolStep({
          stepId: 'step-5',
          objective: 'Re-run the targeted test command after the repair',
          commandId: 'npm_test',
          dependencies: ['step-4'],
        }),
        commandToolStep({
          stepId: 'step-6',
          objective: 'Run the broader test suite to confirm no regression',
          commandId: 'npm_test',
          dependencies: ['step-5'],
        }),
        aiStep(
          'step-7',
          'Verify the final state',
          'reasoning',
          'Summarize the final repository state for the goal: {goal}. The test commands were executed by the governed runtime — the step evidence in {outputOf:step-5} and {outputOf:step-6} carries the real process exit statuses. State the final verification conclusion explicitly (state "verified" and "pass" only when the real command evidence shows successful exits).',
          rulePolicy(
            [
              { name: 'has-verified', kind: 'includes', text: 'verified' },
              { name: 'has-pass', kind: 'includes', text: 'pass' },
              { name: 'final-length', kind: 'minLength', length: 40 },
            ],
            'the final verification must explicitly state that the goal is verified with passing real test runs',
          ),
          ['step-6'],
          ['reasoning', 'coding'],
        ),
      ],
      // Goal-level verification is the REAL command evidence — never the
      // model's summary. A repository-fix goal can only be ACHIEVED when the
      // governed test command actually exits successfully.
      finalVerification: {
        kind: 'command',
        description:
          'the workspace test command must really exit successfully — the final verdict comes from the governed process exit status, never from model output',
        command: { toolName: COMMAND_TOOL_NAME, arguments: { command: 'npm_test' }, expect: 'ok' },
      },
      completionCriteria: [
        'real test command executed through the governed tool runtime',
        'real failing exit status observed and diagnosed',
        'minimal fix applied through governed workspace tools',
        'real test command re-executed and exited successfully',
        'final repository state verified',
      ],
    };
  },
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
