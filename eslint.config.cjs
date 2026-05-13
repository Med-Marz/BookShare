const js = require('@eslint/js');
const globals = require('globals');
const importPlugin = require('eslint-plugin-import');
const reactPlugin = require('eslint-plugin-react');
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

  // apps/web Node-side config files — CommonJS (no "type": "module" in apps/web/package.json).
  {
    files: ['apps/web/tailwind.config.js', 'apps/web/postcss.config.js', 'apps/web/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },

  // apps/web Vite config — ESM-only (.mjs extension forces ESM regardless of package.json).
  {
    files: ['apps/web/vite.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },

  // apps/web React source — ESM + browser + JSX, with React plugin for JSX usage tracking.
  {
    files: ['apps/web/src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { react: reactPlugin },
    settings: { react: { version: 'detect' } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // React 17+ JSX transform — React doesn't need to be in scope, but JSX usage of an
      // imported identifier (e.g. <App />) must still count as "used" for no-unused-vars.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off',
    },
  },

  // Prettier disables stylistic rules that would conflict with the formatter — keep last.
  prettier,
];
