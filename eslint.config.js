// ESLint flat config — root level
// https://eslint.org/docs/latest/use/configure/configuration-files

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
  // Base JS recommended
  js.configs.recommended,

  // TypeScript recommended (relaxed: no no-unused-vars strict, no explicit-any ban)
  ...tseslint.configs.recommended,

  // Global ignores
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/vite.config.ts',
      '**/tailwind.config.js',
      '**/postcss.config.js',
      '**/nest-cli.json',
    ],
  },

  // Node files (scripts/, tooling)
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: { ...globals.node },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },

  // TypeScript files (apps + packages)
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // React
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // not needed with React 17+ JSX transform
      'react/prop-types': 'off', // we use TypeScript
      'react/no-unescaped-entities': 'warn', // too noisy in Spanish copy with accents and quotes
      'react-refresh/only-export-components': 'off', // too noisy in this codebase
      'react-hooks/set-state-in-effect': 'off', // many valid patterns set state from effects; existing code uses them
      'react-hooks/static-components': 'off', // same — many render-time helper components
      'react-hooks/exhaustive-deps': 'warn', // warn-only; fix ad-hoc

      // TypeScript: relaxed rules for existing code
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn', // warn, not error — many places use `any`
      '@typescript-eslint/no-non-null-assertion': 'off', // intentional in several places
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-this-alias': 'off',

      // General
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
    },
  },

  // Tests (vitest-style, when added)
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
