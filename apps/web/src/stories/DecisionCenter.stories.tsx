// ──────────────────────────────────────────────────────────────────
// VedMoulya — DecisionCenter Stories
// BLD-016C — Storybook Component Library
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { DecisionCenter } from '../app/sections/DecisionCenter.js';
import type { DecisionSummary } from '../app/sections/types.js';

const meta: Meta<typeof DecisionCenter> = {
  title: 'Dashboard/DecisionCenter',
  component: DecisionCenter,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DecisionCenter>;

const active: DecisionSummary = {
  pendingDecisions: 5,
  decisionsToday: 2,
  averageConfidence: 0.78,
  highRiskCount: 1,
  topPending: ['Q3 budget allocation', 'Hiring plan approval', 'Tooling upgrade decision'],
};
const none: DecisionSummary = {
  pendingDecisions: 0,
  decisionsToday: 0,
  averageConfidence: 0,
  highRiskCount: 0,
  topPending: [],
};

export const WithPending: Story = { args: { decisions: active } };
export const NoDecisions: Story = { args: { decisions: none } };
