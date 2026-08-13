// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Task Decomposition Service
// EI-006 — Enterprise Goal & Task Intelligence Engine
// Converts a Goal into ordered Tasks using per-category templates.
// Supports sequential, parallel, conditional, optional, and nested
// task structures. Deterministic templates (no AI execution) — the
// Task Planner decides HOW, never executes.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { Goal, Task, TaskFlowType, TaskRetryPolicy } from '../../types/goal-types.js';
import { generateTaskId } from '../value-objects/Identifiers.js';

interface TemplateStep {
  title: string;
  capability: CapabilityType;
  flowType: TaskFlowType;
  /** Weight share of tokens/cost/time 0–1 (sums to 1 across the template). */
  weight: number;
  /** Optional nested steps. */
  children?: Array<Pick<TemplateStep, 'title' | 'capability' | 'flowType' | 'weight'>>;
  /** Validation rules attached to this task. */
  validation?: string[];
}

interface DecompositionTemplate {
  category: string;
  steps: TemplateStep[];
}

const TEMPLATES: DecompositionTemplate[] = [
  {
    category: 'business',
    steps: [
      {
        title: 'Define business objective',
        capability: 'reasoning',
        flowType: 'sequential',
        weight: 0.1,
        validation: ['Objective is measurable', 'Owner assigned'],
      },
      {
        title: 'Research market context',
        capability: 'reasoning',
        flowType: 'sequential',
        weight: 0.2,
        validation: ['Sources documented'],
      },
      {
        title: 'Draft execution approach',
        capability: 'content_generation',
        flowType: 'sequential',
        weight: 0.2,
        validation: ['Approach approved'],
      },
      {
        title: 'Review and refine',
        capability: 'reasoning',
        flowType: 'parallel',
        weight: 0.15,
        children: [
          { title: 'Quality review', capability: 'reasoning', flowType: 'parallel', weight: 0.08 },
          {
            title: 'Compliance check',
            capability: 'classification',
            flowType: 'parallel',
            weight: 0.07,
          },
        ],
      },
      {
        title: 'Finalize deliverables',
        capability: 'content_generation',
        flowType: 'sequential',
        weight: 0.2,
        validation: ['Deliverables complete'],
      },
      { title: 'Record outcome', capability: 'embeddings', flowType: 'optional', weight: 0.15 },
    ],
  },
  {
    category: 'learning',
    steps: [
      {
        title: 'Assess current skill level',
        capability: 'reasoning',
        flowType: 'sequential',
        weight: 0.1,
        validation: ['Baseline recorded'],
      },
      {
        title: 'Select learning path',
        capability: 'reasoning',
        flowType: 'sequential',
        weight: 0.15,
        validation: ['Path chosen'],
      },
      {
        title: 'Study core concepts',
        capability: 'summarization',
        flowType: 'sequential',
        weight: 0.3,
        children: [
          {
            title: 'Module 1 study',
            capability: 'summarization',
            flowType: 'parallel',
            weight: 0.1,
          },
          {
            title: 'Module 2 study',
            capability: 'summarization',
            flowType: 'parallel',
            weight: 0.1,
          },
          {
            title: 'Module 3 study',
            capability: 'summarization',
            flowType: 'parallel',
            weight: 0.1,
          },
        ],
      },
      {
        title: 'Practice exercises',
        capability: 'reasoning',
        flowType: 'sequential',
        weight: 0.15,
        validation: ['Exercises completed'],
      },
      {
        title: 'Assessment & certification',
        capability: 'classification',
        flowType: 'sequential',
        weight: 0.2,
        validation: ['Assessment passed'],
      },
      {
        title: 'Reflect and log learning',
        capability: 'embeddings',
        flowType: 'optional',
        weight: 0.1,
      },
    ],
  },
  {
    category: 'career',
    steps: [
      {
        title: 'Audit current profile',
        capability: 'reasoning',
        flowType: 'sequential',
        weight: 0.1,
        validation: ['Profile audit done'],
      },
      {
        title: 'Research target roles',
        capability: 'reasoning',
        flowType: 'sequential',
        weight: 0.15,
        validation: ['Targets listed'],
      },
      {
        title: 'Craft resume & portfolio',
        capability: 'content_generation',
        flowType: 'sequential',
        weight: 0.25,
        validation: ['Resume reviewed'],
      },
      {
        title: 'Prepare for interviews',
        capability: 'reasoning',
        flowType: 'conditional',
        weight: 0.2,
        children: [
          {
            title: 'Mock interviews',
            capability: 'general_conversation',
            flowType: 'parallel',
            weight: 0.1,
          },
          {
            title: 'Behavioral story bank',
            capability: 'content_generation',
            flowType: 'parallel',
            weight: 0.1,
          },
        ],
      },
      {
        title: 'Apply to target roles',
        capability: 'content_generation',
        flowType: 'sequential',
        weight: 0.15,
        validation: ['Applications sent'],
      },
      {
        title: 'Negotiate offer',
        capability: 'reasoning',
        flowType: 'optional',
        weight: 0.15,
        validation: ['Offer accepted'],
      },
    ],
  },
  {
    category: 'revenue',
    steps: [
      {
        title: 'Define revenue target',
        capability: 'reasoning',
        flowType: 'sequential',
        weight: 0.1,
        validation: ['Target is numeric'],
      },
      {
        title: 'Analyze sales pipeline',
        capability: 'reasoning',
        flowType: 'sequential',
        weight: 0.15,
        validation: ['Pipeline analyzed'],
      },
      {
        title: 'Craft offer & pricing',
        capability: 'content_generation',
        flowType: 'sequential',
        weight: 0.2,
        validation: ['Pricing approved'],
      },
      {
        title: 'Execute sales outreach',
        capability: 'content_generation',
        flowType: 'parallel',
        weight: 0.25,
        children: [
          {
            title: 'Cold outreach batch 1',
            capability: 'content_generation',
            flowType: 'parallel',
            weight: 0.13,
          },
          {
            title: 'Follow-ups',
            capability: 'general_conversation',
            flowType: 'parallel',
            weight: 0.12,
          },
        ],
      },
      {
        title: 'Convert & close',
        capability: 'reasoning',
        flowType: 'sequential',
        weight: 0.15,
        validation: ['Deals closed'],
      },
      {
        title: 'Track revenue metrics',
        capability: 'classification',
        flowType: 'sequential',
        weight: 0.15,
        validation: ['Metrics logged'],
      },
    ],
  },
  {
    category: 'project',
    steps: [
      {
        title: 'Define project scope',
        capability: 'reasoning',
        flowType: 'sequential',
        weight: 0.15,
        validation: ['Scope documented'],
      },
      {
        title: 'Plan milestones',
        capability: 'reasoning',
        flowType: 'sequential',
        weight: 0.15,
        validation: ['Milestones defined'],
      },
      {
        title: 'Build core components',
        capability: 'coding',
        flowType: 'parallel',
        weight: 0.3,
        children: [
          { title: 'Component A', capability: 'coding', flowType: 'parallel', weight: 0.1 },
          { title: 'Component B', capability: 'coding', flowType: 'parallel', weight: 0.1 },
          { title: 'Component C', capability: 'coding', flowType: 'parallel', weight: 0.1 },
        ],
      },
      {
        title: 'Integrate and test',
        capability: 'reasoning',
        flowType: 'sequential',
        weight: 0.2,
        validation: ['Tests pass'],
      },
      {
        title: 'Launch & release',
        capability: 'content_generation',
        flowType: 'sequential',
        weight: 0.1,
        validation: ['Released'],
      },
      { title: 'Post-launch review', capability: 'reasoning', flowType: 'optional', weight: 0.1 },
    ],
  },
  {
    category: 'health',
    steps: [
      {
        title: 'Assess health baseline',
        capability: 'reasoning',
        flowType: 'sequential',
        weight: 0.15,
        validation: ['Baseline recorded'],
      },
      {
        title: 'Define wellness targets',
        capability: 'reasoning',
        flowType: 'sequential',
        weight: 0.15,
        validation: ['Targets set'],
      },
      {
        title: 'Build daily routine',
        capability: 'general_conversation',
        flowType: 'sequential',
        weight: 0.25,
        validation: ['Routine established'],
      },
      {
        title: 'Track progress weekly',
        capability: 'classification',
        flowType: 'parallel',
        weight: 0.2,
        children: [
          {
            title: 'Exercise log',
            capability: 'classification',
            flowType: 'parallel',
            weight: 0.1,
          },
          {
            title: 'Nutrition log',
            capability: 'classification',
            flowType: 'parallel',
            weight: 0.1,
          },
        ],
      },
      {
        title: 'Review and adjust',
        capability: 'reasoning',
        flowType: 'sequential',
        weight: 0.15,
        validation: ['Review done'],
      },
      {
        title: 'Celebrate milestones',
        capability: 'general_conversation',
        flowType: 'optional',
        weight: 0.1,
      },
    ],
  },
];

/** Generic fallback template for custom/personal goals. */
const FALLBACK_TEMPLATE: DecompositionTemplate = {
  category: 'custom',
  steps: [
    {
      title: 'Clarify the objective',
      capability: 'reasoning',
      flowType: 'sequential',
      weight: 0.15,
      validation: ['Objective is clear'],
    },
    {
      title: 'Research what is needed',
      capability: 'reasoning',
      flowType: 'sequential',
      weight: 0.2,
    },
    {
      title: 'Execute the plan',
      capability: 'content_generation',
      flowType: 'sequential',
      weight: 0.3,
    },
    {
      title: 'Review the results',
      capability: 'reasoning',
      flowType: 'sequential',
      weight: 0.15,
      validation: ['Results reviewed'],
    },
    { title: 'Finalize and record', capability: 'embeddings', flowType: 'optional', weight: 0.2 },
  ],
};

const DEFAULT_RETRY: TaskRetryPolicy = {
  maxRetries: 2,
  retryDelayMs: 1000,
  retryableFailures: ['timeout', 'rate_limited', 'provider_unavailable', 'low_confidence'],
};

export interface DecompositionResult {
  tasks: Task[];
  /** Root tasks (no parent) in declaration order. */
  rootTasks: string[];
}

export class TaskDecompositionService {
  /**
   * Decompose a goal into tasks. Top-level template steps become root
   * tasks (sequential chain); children become nested sub-tasks of their
   * parent. Budget weights split estimated tokens/cost/time.
   */
  decompose(goal: Goal): DecompositionResult {
    const template = TEMPLATES.find((t) => t.category === goal.category) ?? FALLBACK_TEMPLATE;
    const tasks: Task[] = [];
    const rootTasks: string[] = [];

    const totalBudget = Math.max(1, goal.estimatedEffort) * 1000; // rough effort→ms mapping

    template.steps.forEach((step, idx) => {
      const task = this.buildTask(goal, step, idx, totalBudget, undefined);
      tasks.push(task);
      rootTasks.push(task.taskId);

      for (const child of step.children ?? []) {
        const childTask = this.buildTask(goal, child, idx, totalBudget, task.taskId);
        task.subTaskIds.push(childTask.taskId);
        tasks.push(childTask);
      }
    });

    return { tasks, rootTasks };
  }

  private buildTask(
    goal: Goal,
    step: TemplateStep,
    order: number,
    totalBudget: number,
    parentTaskId: string | undefined,
  ): Task {
    const taskId = generateTaskId();
    const weight = step.weight;
    return {
      taskId,
      goalId: goal.goalId,
      title: step.title,
      capability: step.capability,
      priority: 0, // computed by the prioritization service
      businessValue: Math.round(goal.importance * 100) / 100,
      urgency: Math.round(goal.urgency * 100) / 100,
      importance: Math.round(goal.importance * 100) / 100,
      risk: 0, // computed from confidence after prioritization
      confidence: 0.8 + (order % 3) * 0.05, // initial estimate, calibrated later
      estimatedTokens: Math.round(totalBudget * 0.5 * weight),
      estimatedCostUsd: Number((totalBudget * 0.5 * weight * 0.0001).toFixed(2)),
      estimatedTimeMs: Math.round(totalBudget * weight),
      dependencies: parentTaskId ? [parentTaskId] : [],
      parallelEligible: step.flowType === 'parallel',
      flowType: step.flowType,
      retryPolicy: DEFAULT_RETRY,
      validationRules: (step.validation ?? []).map((description, i) => ({
        ruleId: `rule_${taskId}_${String(i + 1)}`,
        description,
      })),
      status: 'proposed',
      parentTaskId,
      subTaskIds: [],
      order: order + 1,
      critical: false,
      slack: 0,
      metadata: { template: goal.category, weight: step.weight },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}
