// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain Stories
// EPIC-004 / EI-008 — Enterprise Brain (Central Decision Intelligence)
// ─────────────────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import {
  DecisionCard,
  PipelineStep,
  PlanCard,
  ConfidenceBadge,
} from '../app/enterprise-brain/components.js';
import type { BrainDecisionDTO, BrainPlanDTO } from '@vedmoulya/enterprise-brain';

const decision: BrainDecisionDTO = {
  decisionId: 'decision_demo_001',
  planId: 'plan_demo_001',
  goalId: 'goal_blog_seed',
  type: 'provider_selection',
  title: 'Select the reasoning provider for this goal',
  description:
    'Chosen among the healthy providers in the Provider Registry for the blog goal capability mix.',
  recommendation: {
    entityType: 'provider',
    entityId: 'anthropic_claude-3-opus',
    entityLabel: 'Anthropic Claude 3 Opus',
    action: 'use',
    params: { maxRetries: 2 },
  },
  confidence: {
    score: 0.92,
    level: 'high',
    factors: ['provider health 98%', 'benchmark win-rate 0.94', 'cost within budget'],
  },
  reason: {
    why: 'The provider has the strongest health score and benchmark win-rate for the reasoning capability, within the goal budget.',
    evidence: [
      'Health score 0.98 (fleet leader)',
      'Benchmark win-rate 0.94 on reasoning tasks',
      'Estimated cost $1.86 within the $2.50 budget',
    ],
    tradeoffs: [
      'Higher per-call latency than the economy tier',
      'More expensive than the open-source alternative',
    ],
    alternatives: [
      'openai_gpt-4o (win-rate 0.90, 0.31ms faster)',
      'google_gemini-2.0 (cheaper, lower win-rate)',
    ],
    risks: ['Cost overrun if quality threshold forces a retry'],
  },
  context: {
    goalId: 'goal_blog_seed',
    goalTitle: 'Launch a blog with 3 seed posts',
    goalCategory: 'content',
    goalPriority: 'high',
    business: ['content', 'marketing'],
    budgetUsd: 2.5,
    engineSources: [
      'goals',
      'providers',
      'capabilities',
      'context',
      'learning',
      'execution-strategy',
    ],
    observedAt: '2026-08-06T08:00:00.000Z',
  },
  status: 'proposed',
  version: 1,
  actor: 'enterprise-brain',
  history: [
    {
      auditId: 'audit_demo_001',
      action: 'created',
      version: 1,
      actor: 'enterprise-brain',
      timestamp: '2026-08-06T08:00:00.000Z',
    },
  ],
  createdAt: '2026-08-06T08:00:00.000Z',
  updatedAt: '2026-08-06T08:00:00.000Z',
};

const plan: BrainPlanDTO = {
  planId: 'plan_demo_001',
  goalId: 'goal_blog_seed',
  goalTitle: 'Launch a blog with 3 seed posts',
  status: 'proposed',
  decisions: [decision],
  overallConfidence: 0.88,
  pipeline: [
    { step: 'Receive Goal', engine: 'gateway', consulted: true },
    { step: 'Analyze Goal', engine: 'goals', consulted: true },
    { step: 'Consult Goal Engine', engine: 'goals', consulted: true },
    { step: 'Consult Learning', engine: 'learning-intelligence', consulted: true },
    { step: 'Consult Capability Registry', engine: 'capabilities', consulted: true },
    { step: 'Consult Provider Intelligence', engine: 'providers', consulted: true },
    { step: 'Consult Context Intelligence', engine: 'context', consulted: true },
    { step: 'Consult Execution Strategy', engine: 'execution-strategy', consulted: true },
    { step: 'Generate Decision Plan', engine: 'enterprise-brain', consulted: true },
    { step: 'Explain Decision', engine: 'enterprise-brain', consulted: true },
    { step: 'Pass to Execution Orchestrator', engine: 'execution-orchestrator', consulted: false },
  ],
  version: 1,
  actor: 'enterprise-brain',
  createdAt: '2026-08-06T08:00:00.000Z',
  updatedAt: '2026-08-06T08:00:00.000Z',
};

const meta: Meta<typeof DecisionCard> = {
  title: 'EnterpriseBrain/DecisionCard',
  component: DecisionCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One fully explained enterprise decision: recommendation, confidence, and the complete explainability block (why · evidence · trade-offs · alternatives · risks) — the Enterprise Brain never decides without explaining.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof DecisionCard>;

export const ProposedDecision: Story = {
  args: { decision },
  parameters: {
    docs: {
      description: {
        story: 'A proposed provider-selection decision awaiting human approval.',
      },
    },
  },
};

export const ApprovedDecision: Story = {
  args: {
    decision: {
      ...decision,
      status: 'approved',
      version: 2,
      actor: 'owner',
      history: [
        ...decision.history,
        {
          auditId: 'audit_demo_002',
          action: 'approved',
          version: 2,
          actor: 'owner',
          note: 'looks good',
          timestamp: '2026-08-06T09:00:00.000Z',
        },
      ],
      updatedAt: '2026-08-06T09:00:00.000Z',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'The same decision after human approval — version bumped, audit appended.',
      },
    },
  },
};

export const DecisionWithActions: Story = {
  args: {
    decision,
    actions: (
      <div className="flex gap-2">
        <button className="rounded-md bg-[#22C55E] px-2.5 py-1 text-[11px] font-semibold text-white">
          Approve
        </button>
        <button className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
          Reject
        </button>
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Decision card rendered with the human-approval action row (Recommendations tab).',
      },
    },
  },
};

export const PipelineStepStory: Story = {
  render: () => (
    <div className="max-w-md p-4">
      {plan.pipeline.map((step, index) => (
        <PipelineStep
          key={step.step}
          step={step}
          index={index}
          last={index === plan.pipeline.length - 1}
        />
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The ten-step decision pipeline trace — receive goal through handoff to the Execution Orchestrator.',
      },
    },
  },
};

export const PlanCardStory: Story = {
  render: () => (
    <div className="max-w-lg p-4">
      <PlanCard plan={plan} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'One decision plan: goal, pipeline consult trace, and overall confidence.',
      },
    },
  },
};

export const ConfidenceBadgeStory: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-2 p-4">
      <ConfidenceBadge score={0.92} level="high" />
      <ConfidenceBadge score={0.64} level="medium" />
      <ConfidenceBadge score={0.31} level="low" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'The three confidence levels rendered by the Enterprise Brain.',
      },
    },
  },
};
