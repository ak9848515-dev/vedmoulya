// ──────────────────────────────────────────────────────────────────
// VedMoulya — Display Components Stories
// BLD-003A Design System Quality & Documentation
// Covers: Badge, Avatar, Progress, Loading, Skeleton, Divider
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import {
  Badge,
  Avatar,
  Progress,
  Loading,
  Skeleton,
  Divider,
} from '../components/display/Display.js';

const meta: Meta<typeof Badge> = {
  title: 'Components/Display',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Display components: Badge, Avatar, Progress, Loading, Skeleton, Divider.',
      },
    },
  },
};

export default meta;

// ── Badge ─────────────────────────────────────────────────────────────────

export const BadgeDefault: StoryObj = {
  render: () => <Badge variant="default">Default</Badge>,
  name: 'Badge — Default',
};
export const BadgeSuccess: StoryObj = {
  render: () => <Badge variant="success">Success</Badge>,
  name: 'Badge — Success',
};
export const BadgeWarning: StoryObj = {
  render: () => <Badge variant="warning">Warning</Badge>,
  name: 'Badge — Warning',
};
export const BadgeDanger: StoryObj = {
  render: () => <Badge variant="danger">Danger</Badge>,
  name: 'Badge — Danger',
};
export const BadgeInfo: StoryObj = {
  render: () => <Badge variant="info">Info</Badge>,
  name: 'Badge — Info',
};
export const BadgeAI: StoryObj = {
  render: () => <Badge variant="ai">AI</Badge>,
  name: 'Badge — AI',
};
export const BadgePremium: StoryObj = {
  render: () => <Badge variant="premium">Premium</Badge>,
  name: 'Badge — Premium',
};
export const BadgeNew: StoryObj = {
  render: () => <Badge variant="new">New!</Badge>,
  name: 'Badge — New',
};

export const BadgeAllVariants: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="danger">Danger</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="ai">AI</Badge>
      <Badge variant="premium">Premium</Badge>
      <Badge variant="draft">Draft</Badge>
      <Badge variant="published">Published</Badge>
      <Badge variant="archived">Archived</Badge>
      <Badge variant="beta">Beta</Badge>
      <Badge variant="new">New</Badge>
    </div>
  ),
  name: 'Badge — 🎨 All Variants',
};

export const BadgeSizes: StoryObj = {
  render: () => (
    <div className="flex items-center gap-3">
      <Badge size="sm">Small</Badge>
      <Badge size="md">Medium</Badge>
      <Badge size="lg">Large</Badge>
    </div>
  ),
  name: 'Badge — 📐 All Sizes',
};

// ── Avatar ────────────────────────────────────────────────────────────────

export const AvatarWithImage: StoryObj = {
  render: () => <Avatar src="https://i.pravatar.cc/150?u=john" alt="John Doe" size="lg" />,
  name: 'Avatar — With Image',
};

export const AvatarInitials: StoryObj = {
  render: () => <Avatar alt="Sarah Johnson" size="lg" />,
  name: 'Avatar — Initials Fallback',
};

export const AvatarWithStatus: StoryObj = {
  render: () => (
    <div className="flex gap-4 items-center">
      <Avatar alt="Online" size="md" src="https://i.pravatar.cc/150?u=online" status="online" />
      <Avatar alt="Offline" size="md" status="offline" />
      <Avatar alt="Away" size="md" status="away" />
      <Avatar alt="Busy" size="md" status="busy" />
    </div>
  ),
  name: 'Avatar — Status Indicators',
};

export const AvatarSizes: StoryObj = {
  render: () => (
    <div className="flex items-end gap-4">
      <Avatar alt="Small" size="sm" src="https://i.pravatar.cc/150?u=sm" />
      <Avatar alt="Medium" size="md" />
      <Avatar alt="Large" size="lg" />
      <Avatar alt="XL" size="xl" />
    </div>
  ),
  name: 'Avatar — 📐 All Sizes',
};

// ── Progress ──────────────────────────────────────────────────────────────

export const ProgressDefault: StoryObj = {
  render: () => <Progress value={65} variant="default" showLabel />,
  name: 'Progress — Default',
};

export const ProgressSuccess: StoryObj = {
  render: () => <Progress value={80} variant="success" showLabel />,
  name: 'Progress — Success',
};

export const ProgressAI: StoryObj = {
  render: () => <Progress value={45} variant="ai" showLabel />,
  name: 'Progress — AI',
};

export const ProgressEmpty: StoryObj = {
  render: () => <Progress value={0} showLabel />,
  name: 'Progress — Empty (0%)',
};

export const ProgressFull: StoryObj = {
  render: () => <Progress value={100} showLabel />,
  name: 'Progress — Full (100%)',
};

export const ProgressSizes: StoryObj = {
  render: () => (
    <div className="space-y-4 w-full max-w-sm">
      <Progress size="sm" value={50} />
      <Progress size="md" value={75} showLabel />
      <Progress size="lg" value={90} showLabel />
    </div>
  ),
  name: 'Progress — 📐 All Sizes',
};

// ── Loading ───────────────────────────────────────────────────────────────

export const LoadingSmall: StoryObj = {
  render: () => <Loading size="sm" />,
  name: 'Loading — Small',
};
export const LoadingMedium: StoryObj = {
  render: () => <Loading size="md" />,
  name: 'Loading — Medium',
};
export const LoadingLarge: StoryObj = {
  render: () => <Loading size="lg" />,
  name: 'Loading — Large',
};
export const LoadingWithLabel: StoryObj = {
  render: () => <Loading size="md" label="Loading..." />,
  name: 'Loading — With Label',
};
export const LoadingSizes: StoryObj = {
  render: () => (
    <div className="flex items-end gap-4">
      <Loading size="sm" />
      <Loading size="md" />
      <Loading size="lg" />
    </div>
  ),
  name: 'Loading — 📐 All Sizes',
};

// ── Skeleton ──────────────────────────────────────────────────────────────

export const SkeletonText: StoryObj = {
  render: () => <Skeleton width="100%" height="16px" />,
  name: 'Skeleton — Text Line',
};
export const SkeletonAvatar: StoryObj = {
  render: () => <Skeleton width="48px" height="48px" rounded="full" />,
  name: 'Skeleton — Avatar',
};

export const SkeletonCard: StoryObj = {
  render: () => (
    <div className="w-[300px] p-4 border border-[#E8EDF5] rounded-[24px] space-y-3">
      <Skeleton width="100%" height="16px" />
      <Skeleton width="75%" height="16px" />
      <Skeleton width="100%" height="100px" rounded="lg" />
      <Skeleton width="50%" height="16px" />
    </div>
  ),
  name: 'Skeleton — Card Placeholder',
};

// ── Divider ───────────────────────────────────────────────────────────────

export const DividerHorizontal: StoryObj = {
  render: () => <Divider />,
  name: 'Divider — Horizontal',
};
export const DividerWithLabel: StoryObj = {
  render: () => <Divider label="Section Label" />,
  name: 'Divider — With Label',
};

export const DividerVertical: StoryObj = {
  render: () => (
    <div className="flex items-center gap-4 h-10">
      <span className="text-[14px] text-[#64748B]">Left</span>
      <Divider orientation="vertical" />
      <span className="text-[14px] text-[#64748B]">Center</span>
      <Divider orientation="vertical" />
      <span className="text-[14px] text-[#64748B]">Right</span>
    </div>
  ),
  name: 'Divider — Vertical',
};
