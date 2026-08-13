// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Goal Explorer Stories
// EI-006 — Enterprise Goal & Task Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { GoalCard } from '../app/goals/components.js';
import { TaskRow } from '../app/goals/task-graph-view.js';
import type { GoalDTO, TaskDTO } from '@vedmoulya/goals';

const goal: GoalDTO = {
  goalId: 'goal_demo_001',
  title: 'Grow recurring revenue by 25%',
  description: 'Increase monthly subscription sales and retainers this quarter.',
  category: 'revenue',
  business: ['sales'],
  priority: 'high',
  urgency: 0.8,
  importance: 0.9,
  complexity: 'moderate',
  estimatedEffort: 30,
  status: 'active',
  confidence: 0.72,
  goalScore: 0.78,
  successCriteria: [
    {
      criterionId: 'c_1',
      definition: 'Recurring revenue grows 25% quarter-over-quarter',
      validation: 'Compare MRR in the revenue dashboard',
      completionCriteria: ['25% MRR growth', '3 retainers signed'],
      expectedOutcome: 'Sustained monthly recurring baseline',
      met: false,
    },
  ],
  milestones: [
    {
      milestoneId: 'm_1',
      title: 'Offer packaged',
      description: 'Retainers priced',
      taskIds: [],
      order: 1,
      achieved: false,
    },
    {
      milestoneId: 'm_2',
      title: 'Targets closed',
      description: 'Three deals signed',
      taskIds: [],
      order: 2,
      achieved: false,
    },
  ],
  dependencies: [],
  childGoalIds: [],
  tags: ['revenue', 'retainers'],
  classification: {
    businessDomain: ['sales', 'finance'],
    requiredCapabilities: ['reasoning', 'content_generation'],
    requiredContext: ['client_data', 'business_rules'],
    riskScore: 0.45,
    riskLevel: 'medium',
    complexity: 'moderate',
    estimatedTokenRange: { min: 8000, max: 24000 },
    estimatedCostRangeUsd: { min: 0.8, max: 2.4 },
  },
  events: [
    {
      eventId: 'e_1',
      goalId: 'goal_demo_001',
      type: 'created',
      timestamp: '2026-08-04T09:00:00.000Z',
      message: 'Goal created.',
    },
    {
      eventId: 'e_2',
      goalId: 'goal_demo_001',
      type: 'activated',
      timestamp: '2026-08-04T09:05:00.000Z',
      message: 'Goal activated.',
    },
  ],
  createdAt: '2026-08-04T09:00:00.000Z',
  updatedAt: '2026-08-04T09:05:00.000Z',
};

const task: TaskDTO = {
  taskId: 'task_demo_001',
  goalId: 'goal_demo_001',
  title: 'Execute sales outreach',
  capability: 'content_generation',
  priority: 88,
  businessValue: 0.9,
  urgency: 0.8,
  importance: 0.85,
  risk: 0.2,
  confidence: 0.82,
  estimatedTokens: 2400,
  estimatedCostUsd: 0.24,
  estimatedTimeMs: 7200000,
  dependencies: ['task_demo_000'],
  parallelEligible: true,
  flowType: 'parallel',
  retryPolicy: {
    maxRetries: 2,
    retryDelayMs: 1000,
    retryableFailures: ['timeout', 'rate_limited'],
  },
  validationRules: [{ ruleId: 'r_1', description: 'Outreach approved' }],
  status: 'ready',
  subTaskIds: [],
  order: 4,
  critical: true,
  slack: 0,
  createdAt: '2026-08-04T09:00:00.000Z',
  updatedAt: '2026-08-04T09:00:00.000Z',
};

const byId = new Map<string, TaskDTO>([
  [task.taskId, task],
  [
    'task_demo_000',
    {
      ...task,
      taskId: 'task_demo_000',
      title: 'Craft offer & pricing',
      priority: 82,
      critical: false,
      slack: 3600000,
      dependencies: [],
    },
  ],
]);

const metaGoal: Meta<typeof GoalCard> = {
  title: 'Explorer/GoalCard',
  component: GoalCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Goal card for the Enterprise Goal Explorer: status/priority/risk badges, score & confidence bars, classification chips, and Analyze / Generate Tasks / Validate actions.',
      },
    },
  },
};

export default metaGoal;

type GoalStory = StoryObj<typeof GoalCard>;
type TaskStory = StoryObj<typeof TaskRow>;

export const RevenueGoalActive: GoalStory = {
  args: {
    goal,
    busy: false,
    onAnalyze: () => undefined,
    onGenerate: () => undefined,
    onValidate: () => undefined,
  },
};

export const GoalCardBlocked: GoalStory = {
  args: {
    goal: {
      ...goal,
      goalId: 'goal_demo_002',
      status: 'blocked',
      priority: 'critical',
      confidence: 0.4,
      goalScore: 0.55,
      classification: goal.classification
        ? { ...goal.classification, riskScore: 0.72, riskLevel: 'high' }
        : undefined,
    },
    busy: true,
    onAnalyze: () => undefined,
    onGenerate: () => undefined,
    onValidate: () => undefined,
  },
  parameters: {
    docs: {
      description: { story: 'A blocked critical goal with elevated risk (busy state).' },
    },
  },
};

const metaTask: Meta<typeof TaskRow> = {
  title: 'Explorer/TaskRow',
  component: TaskRow,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A prioritized task row: capability/flow chips, duration/cost/token estimates, confidence bar, dependencies, and critical-path highlight.',
      },
    },
  },
};

export const CriticalTask: TaskStory = {
  args: { task, byId, onCritical: true },
};

export const SlackTask: TaskStory = {
  args: {
    task: {
      ...task,
      taskId: 'task_demo_002',
      title: 'Follow-ups',
      priority: 64,
      critical: false,
      slack: 1800000,
      parallelEligible: true,
    },
    byId,
    onCritical: false,
  },
  parameters: {
    docs: {
      description: { story: 'A non-critical task with slack.' },
    },
  },
};

export { metaTask };
