// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Domain Service: Capability Planner
// Given a Goal, produces the Capability Plan: WHAT to execute, in what
// order, with support levels (required/optional/conditional), nested
// sub-steps, and provider-family eligibility per step. No execution.
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, ProviderFamily } from '@vedmoulya/ai';
import type {
  CapabilityPlan,
  CapabilityPlanStep,
  CapabilityFlowType,
  CapabilitySupport,
} from '../../types/strategy-types.js';

let stepCounter = 0;

function step(
  capability: CapabilityType,
  label: string,
  description: string,
  flowType: CapabilityFlowType,
  support: CapabilitySupport,
  weight: number,
  eligibleFamilies: ProviderFamily[],
  children: CapabilityPlanStep[] = [],
): CapabilityPlanStep {
  stepCounter += 1;
  return {
    stepId: `step_${String(stepCounter)}_${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    capability,
    label,
    description,
    flowType,
    support,
    skippable: support !== 'required',
    weight,
    eligibleFamilies,
    children,
  };
}

// ── Service ─────────────────────────────────────────────────────────────────

export class CapabilityPlannerService {
  /**
   * Build a capability plan for a goal using registered templates.
   * Falls back to a generic reasoning + content pipeline when no template matches.
   */
  plan(goal: string, _business: string[] = []): CapabilityPlan {
    const steps = this.selectTemplate(goal);
    const requiredCapabilities = collectRequiredCapabilities(steps);
    return {
      goal,
      steps,
      requiredCapabilities,
      feasible: steps.some((s) => s.support === 'required' && !s.skippable),
      summary: describePlan(steps),
    };
  }

  /**
   * Build a nested capability plan for a goal using a custom decomposition.
   * Supports sequential, parallel, optional, and conditional flows.
   */
  planWithDecomposition(goal: string, decomposition: CapabilityPlanStep[]): CapabilityPlan {
    const requiredCapabilities = collectRequiredCapabilities(decomposition);
    return {
      goal,
      steps: decomposition,
      requiredCapabilities,
      feasible: decomposition.some((s) => s.support === 'required' && !s.skippable),
      summary: describePlan(decomposition),
    };
  }

  private selectTemplate(goal: string): CapabilityPlanStep[] {
    const g = goal.toLowerCase();
    if (/generate|write|create|craft|blog/.test(g)) {
      return [
        step(
          'content_generation',
          'Research',
          'Research the topic and gather sources',
          'sequential',
          'required',
          0.25,
          ['anthropic', 'openai', 'google'],
        ),
        step(
          'content_generation',
          'Writing',
          'Draft the primary content',
          'sequential',
          'required',
          0.4,
          ['anthropic', 'openai', 'google'],
        ),
        step('reasoning', 'SEO', 'Optimize content for search', 'sequential', 'optional', 0.15, [
          'openai',
          'google',
        ]),
        step('reasoning', 'Review', 'Quality review and revision', 'sequential', 'required', 0.1, [
          'anthropic',
          'openai',
        ]),
        step(
          'content_generation',
          'Publishing',
          'Format for publication',
          'sequential',
          'optional',
          0.1,
          ['openai', 'ollama', 'mock'],
        ),
      ];
    }
    if (/summariz|summary|digest/.test(g)) {
      return [
        step('summarization', 'Extraction', 'Extract key points', 'sequential', 'required', 0.5, [
          'openai',
          'anthropic',
          'google',
        ]),
        step(
          'reasoning',
          'Synthesis',
          'Synthesize into concise summary',
          'sequential',
          'required',
          0.3,
          ['anthropic', 'openai'],
        ),
        step(
          'content_generation',
          'Formatting',
          'Format summary for delivery',
          'sequential',
          'optional',
          0.2,
          ['openai', 'google'],
        ),
      ];
    }
    if (/translat/.test(g)) {
      return [
        step(
          'translation',
          'Translation',
          'Translate the source text',
          'sequential',
          'required',
          0.7,
          ['google', 'openai', 'anthropic'],
        ),
        step(
          'reasoning',
          'Accuracy',
          'Review translation accuracy',
          'sequential',
          'required',
          0.3,
          ['anthropic', 'openai'],
        ),
      ];
    }
    if (/analy|investigat/.test(g)) {
      return [
        step('reasoning', 'Analysis', 'Analyze the provided data', 'sequential', 'required', 0.5, [
          'anthropic',
          'openai',
          'deepseek',
        ]),
        step(
          'summarization',
          'Insights',
          'Extract actionable insights',
          'sequential',
          'required',
          0.3,
          ['anthropic', 'openai'],
        ),
        step(
          'content_generation',
          'Reporting',
          'Build the analysis report',
          'sequential',
          'optional',
          0.2,
          ['openai', 'google'],
        ),
      ];
    }
    if (/classif|tag|categor/.test(g)) {
      return [
        step(
          'classification',
          'Classification',
          'Classify the input items',
          'sequential',
          'required',
          1.0,
          ['openai', 'google', 'anthropic'],
        ),
      ];
    }
    if (/learn|curriculum|study/.test(g)) {
      return [
        step(
          'reasoning',
          'Assessment',
          'Assess current knowledge level',
          'sequential',
          'required',
          0.25,
          ['anthropic', 'openai'],
        ),
        step('reasoning', 'Planning', 'Design the learning path', 'sequential', 'required', 0.4, [
          'anthropic',
          'openai',
          'google',
        ]),
        step(
          'content_generation',
          'Material',
          'Generate learning material',
          'sequential',
          'optional',
          0.25,
          ['openai', 'google'],
        ),
        step(
          'summarization',
          'Review',
          'Summarize progress checkpoints',
          'sequential',
          'optional',
          0.1,
          ['openai', 'google'],
        ),
      ];
    }
    return [
      step(
        'reasoning',
        'Understanding',
        'Understand the goal and requirements',
        'sequential',
        'required',
        0.3,
        ['anthropic', 'openai', 'deepseek'],
      ),
      step(
        'reasoning',
        'Planning',
        'Plan the steps to achieve the goal',
        'sequential',
        'required',
        0.3,
        ['anthropic', 'openai'],
      ),
      step(
        'content_generation',
        'Execution',
        'Produce the goal output',
        'sequential',
        'required',
        0.4,
        ['openai', 'anthropic', 'google'],
      ),
    ];
  }
}

function collectRequiredCapabilities(steps: CapabilityPlanStep[]): CapabilityType[] {
  const seen = new Set<CapabilityType>();
  const walk = (list: CapabilityPlanStep[]): void => {
    for (const s of list) {
      if (!s.skippable) seen.add(s.capability);
      if (s.children.length > 0) walk(s.children);
    }
  };
  walk(steps);
  return [...seen];
}

function describePlan(steps: CapabilityPlanStep[]): string {
  const flows = steps.map((s) => `${s.label} (${s.flowType}: ${s.capability})`);
  return `${String(steps.length)} step plan: ${flows.join(' → ')}`;
}
