// ──────────────────────────────────────────────────────────────────
// VedMoulya — State Components Stories
// BLD-003A Design System Quality & Documentation
// Covers: EmptyState, ErrorState, OfflineState, SuccessState
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import React from 'react';
import { EmptyState, ErrorState, OfflineState, SuccessState } from '../components/state/State.js';

const meta: Meta = {
  title: 'Components/State',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'State components: EmptyState, ErrorState, OfflineState, SuccessState.',
      },
    },
  },
};

export default meta;

// ── EmptyState ────────────────────────────────────────────────────────────

export const EmptyStateDefault: StoryObj = {
  render: () => (
    <EmptyState
      title="No items found"
      description="Get started by creating your first item."
      action={{ label: 'Create Item', onClick: fn() }}
      secondaryAction={{ label: 'Learn more', onClick: fn() }}
    />
  ),
  name: 'EmptyState — Default',
};

export const EmptyStateNoActions: StoryObj = {
  render: () => (
    <EmptyState title="No search results" description="Try adjusting your search terms." />
  ),
  name: 'EmptyState — No Actions',
};

export const EmptyStateCustomIcon: StoryObj = {
  render: () => (
    <EmptyState
      icon={
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#CBD5E1"
          strokeWidth="1.5"
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      }
      title="No downloads yet"
      description="Files you download will appear here."
    />
  ),
  name: 'EmptyState — Custom Icon',
};

// ── ErrorState ────────────────────────────────────────────────────────────

export const ErrorStateDefault: StoryObj = {
  render: () => <ErrorState onRetry={fn()} onDismiss={fn()} />,
  name: 'ErrorState — Default',
};

export const ErrorStateWithErrorObject: StoryObj = {
  render: () => (
    <ErrorState error={new Error('Network request failed with status 500')} onRetry={fn()} />
  ),
  name: 'ErrorState — With Error Object',
};

export const ErrorStateMinimal: StoryObj = {
  render: () => <ErrorState title="Failed to load" message="Could not fetch data." />,
  name: 'ErrorState — Minimal',
};

// ── OfflineState ──────────────────────────────────────────────────────────

export const OfflineStateDefault: StoryObj = {
  render: () => <OfflineState lastSynced="2 minutes ago" onReconnect={fn()} />,
  name: 'OfflineState — Default',
};

export const OfflineStateMinimal: StoryObj = {
  render: () => <OfflineState title="No connection" message="Check your network." />,
  name: 'OfflineState — Minimal',
};

// ── SuccessState ──────────────────────────────────────────────────────────

export const SuccessStateDefault: StoryObj = {
  render: () => (
    <SuccessState
      title="Success!"
      message="Changes saved."
      action={{ label: 'View', onClick: fn() }}
      onDismiss={fn()}
    />
  ),
  name: 'SuccessState — Default',
};

export const SuccessStateNoAction: StoryObj = {
  render: () => <SuccessState title="Done!" message="Profile updated." onDismiss={fn()} />,
  name: 'SuccessState — No Action',
};
