// ──────────────────────────────────────────────────────────────────
// VedMoulya — Storybook Configuration (Life OS Web Application)
// BLD-016C — Storybook Component Library
// ──────────────────────────────────────────────────────────────────

import type { StorybookConfig } from '@storybook/nextjs';
import { join, dirname } from 'path';

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y', '@storybook/addon-interactions'],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  docs: {
    autodocs: 'tag',
    defaultName: 'Documentation',
  },
  typescript: {
    reactDocgen: 'react-docgen',
  },
  staticDirs: ['../public'],
};

export default config;
