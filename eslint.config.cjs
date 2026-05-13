const js = require('@eslint/js');
const globals = require('globals');
const importPlugin = require('eslint-plugin-import');
const prettier = require('eslint-config-prettier');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'apps/web/dist/**',
      'coverage/**',
      '_bmad/**',
      '_bmad-output/**',
      '.claude/**',
    ],
  },

  // Base recommended rules for every JS file.
  js.configs.recommended,

  // Backend defaults — CommonJS in Node (gateway + services).
  {
    files: ['apps/gateway/**/*.js', 'services/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    plugins: { import: importPlugin },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Frontend overrides — React + browser + ESM modules under apps/web/src.
  {
    files: ['apps/web/src/**/*.{js,jsx}', 'apps/web/vite.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Prettier disables stylistic rules that would conflict with the formatter — keep last.
  prettier,
];
