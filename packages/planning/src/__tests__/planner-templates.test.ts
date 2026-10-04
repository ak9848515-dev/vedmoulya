// ──────────────────────────────────────────────────────────────────
// Deterministic Plan Templates — the template catalog
//
// Every template must produce a structurally valid AgentPlan (the
// frozen validatePlanStructure is authoritative), with bounded
// recovery, verification on every meaningful step and valid
// dependency DAGs. New templates (content/analysis/learning) must
// match their goals deterministically and never steal a more
// specific template's goals.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { validatePlanStructure } from '@vedmoulya/agent-execution';
import { GoalUnderstandingService } from '../domain/goal-understanding.js';
import { PLAN_TEMPLATES, selectTemplate } from '../domain/planner-templates.js';
import type { AgentPlan } from '@vedmoulya/agent-execution';

const understandingService = new GoalUnderstandingService();

function understand(goal: string) {
  return understandingService.derive({ goal });
}

/** Build the selected template's plan and run the frozen structural validator. */
function buildPlan(goal: string): { plan: AgentPlan; templateId: string } {
  const understanding = understand(goal);
  const template = selectTemplate(understanding, PLAN_TEMPLATES);
  const plan = template.build(understanding, 'plan-test');
  const issues = validatePlanStructure(plan);
  expect(
    issues.filter((i) => i.severity === 'error'),
    `structural issues: ${JSON.stringify(issues)}`,
  ).toEqual([]);
  return { plan, templateId: template.id };
}

describe('deterministic template catalog', () => {
  it('catalog exposes all six templates in specificity order (generic last)', () => {
    const ids = PLAN_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual([
      'repository-fix',
      'file-artifact',
      'content',
      'analysis',
      'learning',
      'generic',
    ]);
  });

  it('content goal → content template with a valid 5-step DAG', () => {
    const { plan, templateId } = buildPlan(
      'Write a blog post about our product launch for the marketing team',
    );
    expect(templateId).toBe('content');
    expect(plan.steps.length).toBe(5);
    // DAG: strictly linear dependencies, no cycles, unique ids.
    const ids = plan.steps.map((s) => s.stepId);
    expect(new Set(ids).size).toBe(ids.length);
    plan.steps.forEach((step, index) => {
      if (index === 0) {
        expect(step.dependencies).toEqual([]);
      } else {
        expect(step.dependencies).toEqual([plan.steps[index - 1]?.stepId]);
      }
      expect(step.verificationPolicy).toBeDefined();
      expect(step.recoveryPolicy?.maxAttempts ?? 0).toBeLessThanOrEqual(3);
    });
    // The drafting step carries the full multi-capability requirement set.
    const draft = plan.steps.find((s) => s.stepId === 'step-2');
    expect(draft?.capability).toBe('content_generation');
    expect(draft?.actions[0]?.kind === 'ai').toBe(true);
    if (draft?.actions[0]?.kind === 'ai') {
      expect(draft.actions[0].requiredCapabilities).toEqual(['content_generation', 'reasoning']);
    }
  });

  it('analysis goal → analysis template with a valid 4-step DAG', () => {
    const { plan, templateId } = buildPlan(
      'Analyze our monthly churn data and report the findings',
    );
    expect(templateId).toBe('analysis');
    expect(plan.steps.length).toBe(4);
    const ids = plan.steps.map((s) => s.stepId);
    expect(new Set(ids).size).toBe(ids.length);
    // The report step is the content-bearing action with full requirements.
    const report = plan.steps.find((s) => s.stepId === 'step-3');
    expect(report?.capability).toBe('content_generation');
    expect(report?.dependencies).toEqual(['step-2']);
    for (const step of plan.steps) {
      expect(step.verificationPolicy).toBeDefined();
      expect(step.recoveryPolicy).toBeDefined();
    }
  });

  it('learning goal → learning template with a valid 5-step DAG', () => {
    const { plan, templateId } = buildPlan(
      'Learn the fundamentals of TypeScript for backend development',
    );
    expect(templateId).toBe('learning');
    expect(plan.steps.length).toBe(5);
    const ids = plan.steps.map((s) => s.stepId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const step of plan.steps) {
      expect(step.verificationPolicy).toBeDefined();
      expect(step.recoveryPolicy).toBeDefined();
    }
  });

  it('repository-fix goal still wins over analysis (specificity order preserved)', () => {
    const understanding = understand('Analyze this repository and fix the failing tests');
    const template = selectTemplate(understanding, PLAN_TEMPLATES);
    expect(template.id).toBe('repository-fix');
    const plan = template.build(understanding, 'plan-test');
    expect(plan.steps.length).toBe(7);
  });

  it('unmatched goal falls back to the generic template', () => {
    const { plan, templateId } = buildPlan('Compile a weekly inventory snapshot of the warehouse');
    expect(templateId).toBe('generic');
    expect(plan.steps.length).toBeGreaterThanOrEqual(3);
  });

  it('analysis-pattern words alone do not hijack content goals', () => {
    // "review" appears in the analysis pattern AND is a common content word —
    // the content template must win when the artifact keywords dominate.
    const { templateId } = buildPlan('Draft a review article about the quarterly results');
    expect(templateId).toBe('content');
  });

  // ──────────────────────────────────────────────────────────────────
  // file-artifact template — tool provisioning (this sprint)
  //
  // A live Mission that asked for a file with exact content fell through
  // to GENERIC, which contains no tool action at all, so the engine had
  // nothing to dispatch and the mission never touched the workspace.
  // These tests pin the provisioned behaviour: the plan now carries REAL
  // governed tool actions, the literal content is deterministic, and the
  // authorization/validation guards still reject everything they did before.
  // ──────────────────────────────────────────────────────────────────
  describe('file-artifact template provisions real tool actions', () => {
    const ACCEPTANCE_GOAL =
      'Create a file named mission-acceptance.txt with exact contents VEDMOULYA_MISSION_ACCEPTANCE_OK';

    it('B: selects the file-artifact template for a create-file objective', () => {
      const { templateId } = buildPlan(ACCEPTANCE_GOAL);
      expect(templateId).toBe('file-artifact');
    });

    it('C: produces a real workspace_write tool action carrying the literal content', () => {
      const { plan } = buildPlan(ACCEPTANCE_GOAL);
      const write = plan.steps
        .flatMap((s) => s.actions)
        .find((a) => a.kind === 'tool' && a.toolName === 'workspace_write');
      expect(write).toBeDefined();
      expect(write?.kind === 'tool' ? write.arguments : undefined).toEqual({
        relativePath: 'mission-acceptance.txt',
        content: 'VEDMOULYA_MISSION_ACCEPTANCE_OK',
      });
    });

    it('C: produces a real workspace_read read-back action for the same file', () => {
      const { plan } = buildPlan(ACCEPTANCE_GOAL);
      const read = plan.steps
        .flatMap((s) => s.actions)
        .find((a) => a.kind === 'tool' && a.toolName === 'workspace_read');
      expect(read).toBeDefined();
      expect(read?.kind === 'tool' ? read.arguments : undefined).toEqual({
        relativePath: 'mission-acceptance.txt',
      });
    });

    it('C: the tool step declares both governed tools in its allowlist', () => {
      const { plan } = buildPlan(ACCEPTANCE_GOAL);
      const step = plan.steps.find((s) => s.actions.some((a) => a.kind === 'tool'));
      expect(step?.allowedTools).toEqual(['workspace_write', 'workspace_read']);
    });

    it('D: the tool action is reachable by the engine (kind/toolName/args shape)', () => {
      const { plan } = buildPlan(ACCEPTANCE_GOAL);
      const action = plan.steps.flatMap((s) => s.actions).find((a) => a.kind === 'tool');
      // The engine's executeToolAction reads exactly these fields.
      expect(action).toMatchObject({ kind: 'tool', toolName: 'workspace_write' });
      expect(typeof (action as { actionId: string }).actionId).toBe('string');
    });

    it('D: step-1 is verified by the REAL read-back tool outcome, not model prose', () => {
      const { plan } = buildPlan(ACCEPTANCE_GOAL);
      const step = plan.steps.find((s) => s.stepId === 'step-1');
      expect(step?.verificationPolicy).toMatchObject({
        kind: 'command',
        command: { toolName: 'workspace_read', expect: 'ok' },
      });
    });

    it('the confirmation step is verified by grounding, not by model echo', () => {
      const { plan } = buildPlan(ACCEPTANCE_GOAL);
      const step = plan.steps.find((s) => s.stepId === 'step-2');
      expect(step?.verificationPolicy).toMatchObject({ kind: 'rule' });
      const checks = (step?.verificationPolicy as { checks: { text?: string }[] }).checks;
      // Grounded in the real read-back: the step must name the actual file.
      expect(checks.map((c) => c.text)).toContain('mission-acceptance.txt');
      // It must NOT gate success on the model echoing the literal token —
      // verbosity is not evidence of artifact content (see the template note).
      expect(checks.map((c) => c.text)).not.toContain('VEDMOULYA_MISSION_ACCEPTANCE_OK');
    });

    it('exact content is guaranteed deterministically, not by the model', () => {
      const { plan } = buildPlan(ACCEPTANCE_GOAL);
      const write = plan.steps
        .flatMap((s) => s.actions)
        .find((a) => a.kind === 'tool' && a.toolName === 'workspace_write');
      // The write carries the literal content as a plan-controlled argument,
      // and the step is verified by the REAL read-back tool outcome.
      expect(write?.kind === 'tool' ? write.arguments : undefined).toMatchObject({
        content: 'VEDMOULYA_MISSION_ACCEPTANCE_OK',
      });
      const step = plan.steps.find((s) => s.stepId === 'step-1');
      expect(step?.verificationPolicy).toMatchObject({
        kind: 'command',
        command: { toolName: 'workspace_read', expect: 'ok' },
      });
    });

    it('stays bounded: exactly one AI step and two tool actions (latency budget)', () => {
      const { plan } = buildPlan(ACCEPTANCE_GOAL);
      const actions = plan.steps.flatMap((s) => s.actions);
      // One real AI call — the previous failure burned seven on a generic plan.
      expect(actions.filter((a) => a.kind === 'ai')).toHaveLength(1);
      expect(actions.filter((a) => a.kind === 'tool')).toHaveLength(2);
    });

    it('A: does NOT steal non-file goals (falls through unchanged)', () => {
      const { templateId } = buildPlan(
        'Write a blog post about our product launch for the marketing team',
      );
      expect(templateId).toBe('content');
    });

    it('A: a create goal with no literal file target does not match', () => {
      const understanding = understand('Create a summary document for the team');
      const template = selectTemplate(understanding, PLAN_TEMPLATES);
      expect(template.id).not.toBe('file-artifact');
    });

    it('E: never invents a file target when extraction yields nothing', () => {
      const understanding = understand(ACCEPTANCE_GOAL);
      const template = selectTemplate(understanding, PLAN_TEMPLATES);
      expect(template.id).toBe('file-artifact');
      // The path is a LITERAL from the goal, never model-supplied.
      const plan = template.build(understanding, 'p1');
      const paths = plan.steps
        .flatMap((s) => s.actions)
        .filter((a) => a.kind === 'tool')
        .map((a) => (a as { arguments: { relativePath: string } }).arguments.relativePath);
      expect(new Set(paths)).toEqual(new Set(['mission-acceptance.txt']));
    });
  });
});
