// ──────────────────────────────────────────────────────────────────
// VedMoulya — RecommendationsPanel Stories
// BLD-016C — Storybook Component Library
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { RecommendationsPanel } from '../app/sections/RecommendationsPanel.js';
import type { Recommendation } from '../app/sections/types.js';

const meta: Meta<typeof RecommendationsPanel> = {
  title: 'Dashboard/RecommendationsPanel',
  component: RecommendationsPanel,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RecommendationsPanel>;

const recs: Recommendation[] = [
  {
    id: 'r1',
    title: 'Complete TypeScript Advanced',
    description: 'Finish the advanced TypeScript path to close skill gap.',
    priority: 1,
    confidence: 0.92,
    sources: ['career', 'learning'],
    reason: 'Skill gap identified',
    actionLabel: 'Start',
    actionRoute: '/learning',
    isDismissed: false,
    category: 'Learning',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'r2',
    title: 'Review Q3 Budget',
    description: 'Pending decision on Q3 budget allocation needs your review.',
    priority: 2,
    confidence: 0.85,
    sources: ['business'],
    reason: 'High priority decision',
    actionLabel: 'Review',
    actionRoute: '/business',
    isDismissed: false,
    category: 'Business',
    createdAt: new Date().toISOString(),
  },
];

export const WithRecommendations: Story = { args: { recommendations: recs } };
export const Empty: Story = { args: { recommendations: [] } };
