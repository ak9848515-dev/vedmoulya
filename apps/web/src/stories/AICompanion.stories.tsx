// ──────────────────────────────────────────────────────────────────
// VedMoulya — AICompanion Stories
// BLD-016C — Storybook Component Library
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { AICompanion } from '../components/AICompanion.js';

const meta: Meta<typeof AICompanion> = {
  title: 'Life OS/AICompanion',
  component: AICompanion,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Right-side AI chat drawer with message history, thinking indicator, suggested questions, and voice input.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AICompanion>;

export const Closed: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-[14px] text-[#64748B]">
        Click the AI icon or trigger via Zustand store to open the AI companion panel.
      </p>
      <AICompanion />
    </div>
  ),
};
