// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';

// `defineConfig()` not yet in typescript-eslint@8.65.0 — using deprecated `config()` instead
// eslint-disable-next-line @typescript-eslint/no-deprecated
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            '*.config.ts',
            '*.config.js',
            '*.config.mjs',
            'vitest.workspace.ts',
            'tests/vitest.setup.ts',
            'packages/*/vitest.config.ts',
            'packages/services/src/*.js',
            'packages/services/src/ai/*.js',
            'packages/services/src/business/*.js',
            'packages/services/src/career/*.js',
            'packages/services/src/dashboard/*.js',
            'packages/services/src/decision/*.js',
            'packages/services/src/execution/*.js',
            'packages/services/src/identity/*.js',
            'packages/services/src/knowledge/*.js',
            'packages/services/src/learning/*.js',
            'packages/services/src/lifeos/*.js',
            'packages/services/src/marketplace/*.js',
            'packages/services/src/memory/*.js',
            'services/*/vitest.config.ts',
            'tooling/eslint-config/index.js',
            'apps/web/postcss.config.js',
            'apps/web/public/sw.js',
            'scripts/*.js',
            'scripts/*.mjs',
            'scripts/load/*.js',
          ],
          defaultProject: './tsconfig.eslint.json',
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 200,
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // ── Security rules (warn level — detect dangerous patterns) ────────────
  {
    plugins: {
      security,
    },
    rules: {
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-new-buffer': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'warn',
    },
  },
  // ── Global rules (apply to all files unless overridden below) ─────────────
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/prefer-readonly': 'warn',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  // ── File-specific overrides ───────────────────────────────────────────────
  // Auto-generated Next.js type file — inline eslint comments don't persist
  {
    files: [
      '**/next-env.d.ts',
    ],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
  // Service worker files use browser/service worker globals not available in the TS project
  {
    files: [
      '**/public/sw.js',
      '**/service-worker.js',
    ],
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  // Config files linted without full type info for Node built-in modules
  {
    files: [
      '**/vitest.config.ts',
      'tooling/eslint-config/index.js',
    ],
    rules: {
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-useless-default-assignment': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  // Plain JavaScript files (scripts, compiled output) lack TypeScript type information,
  // so @typescript-eslint rules that rely on type checking cannot apply.
  {
    files: [
      'packages/services/src/**/*.js',
      'scripts/*.js',
      'scripts/*.mjs',
      'scripts/load/*.js',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'no-undef': 'off',
      // Dev-tooling scripts parse dynamic JSON/files and print progress — the
      // security rules are heuristic and produce false positives here; the
      // files are not shipped to production.
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-regexp': 'off',
      'no-console': 'off',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/.next/**',
      '**/coverage/**',
      '**/__tests__/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/.storybook/**',
    ],
  },
);
