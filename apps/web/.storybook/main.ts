// ──────────────────────────────────────────────────────────────────
// VedMoulya — Storybook Configuration (Life OS Web Application)
// BLD-016C — Storybook Component Library
//
// Framework: @storybook/nextjs (v10) — the Next.js-compatible webpack
// builder for this Next 15 application. It supplies the babel/TSX
// toolchain that the bare react-webpack5 framework does not, so
// `.stories.tsx` files and every imported `.tsx` component compile.
//
// webpackFinal mirrors the application's next.config.ts resolver
// (resolve.extensionAlias .js → .ts/.tsx): the whole app imports ESM
// specifiers with `.js` extensions for Node compatibility, and webpack
// must resolve those to the actual `.ts`/`.tsx` source files — exactly
// as the production Next build does.
// ──────────────────────────────────────────────────────────────────

import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)'],
  addons: [],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  docs: {
    autodocs: 'tag',
    defaultName: 'Documentation',
  },
  typescript: {
    reactDocgen: false,
  },
  staticDirs: ['../public'],
  async webpackFinal(config) {
    // Resolve .js extension imports to .ts/.tsx in the monorepo (mirror of
    // apps/web/next.config.ts). Without it Storybook cannot resolve the
    // app's own ESM-style relative imports (e.g. '../app/sections/X.js'
    // where X is X.tsx).
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default config;
