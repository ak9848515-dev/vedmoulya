// @vedmoulya/eslint-config — Shared ESLint configuration
// Usage: extend this config in your project's eslint.config.js

export default {
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'always'],
  },
};
