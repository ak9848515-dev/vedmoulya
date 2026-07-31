// ──────────────────────────────────────────────────────────────────
// VedMoulya — Storybook Preview Configuration
// Design tokens, theme decorator, accessibility checker
// ──────────────────────────────────────────────────────────────────

import type { Preview } from '@storybook/react';
import React from 'react';

// Import design tokens as CSS variables
import '../src/styles/globals.css';

// ── Theme Decorator ────────────────────────────────────────────────────────

const withTheme = (
  Story: React.ComponentType,
  context: { globals?: { theme?: string } },
): React.JSX.Element => {
  const theme = context.globals.theme || 'light';
  return (
    <div
      className={theme}
      style={{
        padding: '24px',
        background: theme === 'dark' ? '#0F172A' : '#F5F7FA',
        minHeight: '100vh',
      }}
    >
      <Story />
    </div>
  );
};

// ── Preview Configuration ─────────────────────────────────────────────────

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#F5F7FA' },
        { name: 'dark', value: '#0F172A' },
      ],
    },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'label', enabled: true },
          { id: 'aria-required-attr', enabled: true },
          { id: 'button-name', enabled: true },
        ],
      },
    },
    viewport: {
      viewports: {
        mobileS: { name: 'Mobile S', styles: { width: '375px', height: '667px' } },
        mobile: { name: 'Mobile', styles: { width: '768px', height: '1024px' } },
        tablet: { name: 'Tablet', styles: { width: '1024px', height: '768px' } },
        desktop: { name: 'Desktop', styles: { width: '1440px', height: '900px' } },
      },
    },
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light mode' },
          { value: 'dark', title: 'Dark mode' },
        ],
        showName: true,
      },
    },
  },
  decorators: [withTheme],
  tags: ['autodocs'],
};

export default preview;
