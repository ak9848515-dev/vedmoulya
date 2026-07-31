// ──────────────────────────────────────────────────────────────────
// VedMoulya — QuickActions Stories
// BLD-016C — Storybook Component Library
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { QuickActions } from '../app/sections/QuickActions.js';

const meta: Meta<typeof QuickActions> = {
  title: 'Dashboard/QuickActions',
  component: QuickActions,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof QuickActions>;

export const Default: Story = {};
