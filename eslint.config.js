// @ts-check
import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/node_modules/', '**/dist/', '**/build/', '**/coverage/', 'graphify-out/']),
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Determinism guard (ADR-0002): simulation code must not read wall-clock
    // time or unseeded randomness, and must avoid transcendental Math
    // functions whose results may differ across engines and platforms.
    // Time and randomness are passed in explicitly (tick clock, seeded PRNG).
    files: ['packages/simulation/src/**/*.ts'],
    ignores: ['packages/simulation/src/**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...['random', 'sin', 'cos', 'tan', 'exp', 'log', 'pow'].map((property) => ({
          object: 'Math',
          property,
          message:
            'Non-deterministic or platform-dependent in simulation code; use the seeded PRNG or deterministic math helpers.',
        })),
        {
          object: 'Date',
          property: 'now',
          message:
            'Wall-clock time is not allowed in simulation code; use the simulated tick clock.',
        },
        {
          object: 'performance',
          property: 'now',
          message:
            'Wall-clock time is not allowed in simulation code; use the simulated tick clock.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message:
            'Wall-clock time is not allowed in simulation code; use the simulated tick clock.',
        },
        {
          selector: "CallExpression[callee.name='Date']",
          message:
            'Wall-clock time is not allowed in simulation code; use the simulated tick clock.',
        },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
  },
);
