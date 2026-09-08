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
  it('catalog exposes all five templates in specificity order (generic last)', () => {
    const ids = PLAN_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(['repository-fix', 'content', 'analysis', 'learning', 'generic']);
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
});
