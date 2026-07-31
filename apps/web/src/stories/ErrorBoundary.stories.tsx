// ──────────────────────────────────────────────────────────────────
// VedMoulya — ErrorBoundary Stories
// BLD-016C — Storybook Component Library
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary.js';
import { Button, Card } from '@vedmoulya/ui';
import { AlertTriangle } from 'lucide-react';

function CrashComponent(): React.JSX.Element {
  throw new Error('Simulated render crash');
}

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Life OS/ErrorBoundary',
  component: ErrorBoundary,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Catches React rendering errors and displays a friendly error card with a retry button.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

export const NormalChildren: Story = {
  args: {
    section: 'dashboard',
    children: (
      <Card variant="standard" padding="lg">
        <p className="text-[14px] text-[#374151]">Content renders normally within the boundary.</p>
      </Card>
    ),
  },
};

export const CaughtError: Story = {
  args: {
    section: 'dashboard',
    children: <CrashComponent />,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the error fallback UI when a child component throws during render.',
      },
    },
  },
};

export const CustomFallback: Story = {
  args: {
    section: 'profile',
    fallback: (
      <div className="flex flex-col items-center justify-center p-8 gap-3">
        <AlertTriangle className="h-8 w-8 text-[#F59E0B]" />
        <p className="text-[14px] text-[#64748B]">Custom fallback for profile section</p>
        <Button variant="secondary" size="sm">
          Dismiss
        </Button>
      </div>
    ),
    children: <CrashComponent />,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A custom fallback UI can be provided via the `fallback` prop instead of the default error card.',
      },
    },
  },
};

export const WithSectionContext: Story = {
  args: {
    section: 'execution',
    children: <CrashComponent />,
  },
  parameters: {
    docs: {
      description: {
        story:
          'The section prop provides context in the error message: "Unable to load execution".',
      },
    },
  },
};
