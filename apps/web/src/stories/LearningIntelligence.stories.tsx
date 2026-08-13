// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Learning Intelligence Explorer Stories
// EI-007 — Enterprise Learning Intelligence Platform
// ─────────────────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { LearningEventRow } from '../app/learning-intelligence/components.js';
import type { LearningEventDTO } from '@vedmoulya/learning-intelligence';

const successEvent: LearningEventDTO = {
  eventId: 'evt_demo_001',
  category: 'provider',
  entityType: 'provider',
  entityId: 'anthropic_claude-3-opus',
  entityLabel: 'Anthropic Claude 3 Opus',
  outcome: 'success',
  quality: 0.97,
  confidence: 0.95,
  costUsd: 0.42,
  latencyMs: 1200,
  accuracy: 0.96,
  retries: 0,
  occurredAt: '2026-08-06T08:00:00.000Z',
  createdAt: '2026-08-06T08:00:00.000Z',
  sourceRef: { sourceType: 'session', sourceId: 'session_demo_001' },
  metadata: {},
};

const failureEvent: LearningEventDTO = {
  eventId: 'evt_demo_002',
  category: 'failure',
  entityType: 'provider',
  entityId: 'openai_gpt-4o',
  entityLabel: 'OpenAI GPT-4o',
  outcome: 'failure',
  quality: 0.42,
  confidence: 0.7,
  costUsd: 0.31,
  latencyMs: 4800,
  accuracy: 0.5,
  retries: 2,
  occurredAt: '2026-08-06T09:30:00.000Z',
  createdAt: '2026-08-06T09:30:00.000Z',
  sourceRef: { sourceType: 'session', sourceId: 'session_demo_002' },
  metadata: { error: 'quality_below_threshold' },
};

const budgetEvent: LearningEventDTO = {
  eventId: 'evt_demo_003',
  category: 'budget',
  entityType: 'budget',
  entityId: 'goal_demo_001',
  entityLabel: 'Blog post budget plan',
  outcome: 'success',
  quality: 0.88,
  confidence: 0.9,
  costUsd: 0.004,
  latencyMs: 240,
  accuracy: 0.9,
  retries: 0,
  occurredAt: '2026-08-06T10:15:00.000Z',
  createdAt: '2026-08-06T10:15:00.000Z',
  metadata: {},
};

const meta: Meta<typeof LearningEventRow> = {
  title: 'LearningIntelligence/LearningEventRow',
  component: LearningEventRow,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One row in the learning event log: category dot, outcome badges, and the measurable signals (quality, cost, latency, confidence) recorded for a provider, capability, context, strategy, budget, or prompt.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof LearningEventRow>;

export const SuccessSignal: Story = {
  args: { event: successEvent },
  parameters: {
    docs: {
      description: {
        story:
          'A successful provider signal with high quality, low latency, and an execution-session source ref.',
      },
    },
  },
};

export const FailureSignal: Story = {
  args: { event: failureEvent },
  parameters: {
    docs: {
      description: {
        story: 'A failure signal (quality below threshold) with retries — feeds failure learning.',
      },
    },
  },
};

export const BudgetSignal: Story = {
  args: { event: budgetEvent },
  parameters: {
    docs: {
      description: {
        story: 'A budget-category signal for a sub-cent cost event.',
      },
    },
  },
};
