// ──────────────────────────────────────────────────────────────────
// VedMoulya — Storybook Configuration
// Implements BLD-003A Design System Quality & Documentation
// ──────────────────────────────────────────────────────────────────

import type { StorybookConfig } from '@storybook/react';

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y', '@storybook/addon-interactions'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
    defaultName: 'Documentation',
  },
  typescript: {
    reactDocgen: 'react-docgen',
  },
  staticDirs: [],
};

export default config;
