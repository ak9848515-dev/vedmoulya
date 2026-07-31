// ──────────────────────────────────────────────────────────────────
// VedMoulya — AIInsights Stories
// BLD-016C — Storybook Component Library
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { AIInsights } from '../app/sections/AIInsights.js';
import type { AIContext } from '../app/sections/types.js';

const meta: Meta<typeof AIInsights> = {
  title: 'Dashboard/AIInsights',
  component: AIInsights,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AIInsights>;

const aiContext: AIContext = {
  currentFocus: 'Complete the Q3 Strategy Project and advance TypeScript skills.',
  recentActivity: ['Completed Q2 review', 'Added 3 new memories', 'Started new learning path'],
  suggestedQuestions: [
    'What should I focus on today?',
    'How is my career progressing?',
    'What skills should I learn next?',
  ],
  contextSummary: 'You are making excellent progress on your strategic goals.',
  topPriorities: ['Q3 Strategy Project', 'TypeScript Advanced Path'],
  crossDomainInsights: [
    'Your learning progress in TypeScript directly supports your career goal of Senior Frontend Engineer.',
    'Your business KPI improvements align with your learning investments.',
  ],
};

export const FullData: Story = {
  args: {
    metrics: { lifeScore: 76 },
    execution: { completedToday: 3, activePlans: 4 },
    memory: { totalMemories: 142 },
    aiContext,
    recommendationCount: 5,
  },
};

export const Minimal: Story = {
  args: {
    metrics: { lifeScore: 50 },
    execution: { completedToday: 0, activePlans: 0 },
    memory: { totalMemories: 0 },
    aiContext: {
      currentFocus: 'Getting started with Life OS',
      recentActivity: [],
      suggestedQuestions: [],
      contextSummary: '',
      topPriorities: [],
      crossDomainInsights: [],
    },
    recommendationCount: 0,
  },
};
