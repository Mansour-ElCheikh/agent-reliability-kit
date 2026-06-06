// Flat ESLint config (ESLint 10 + typescript-eslint 8).
//
// Reference config the scaffold ships AND dogfoods. Calibrated pragmatic,
// not maximalist: real-bug rules stay error; stylistic/incremental-adoption
// noise is `warn` so a previously-unlinted codebase surfaces issues without
// a hard wall. Adopters tighten warn→error as their debt drops (the same
// soft-start philosophy as ADR-0007's governance ramp).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      'node_modules/**',
      '**/test/**/fixtures/**',
      '**/golden-output/**',
      'canonical/**',
      'docs/**',
      '.claude/**',
      '**/*.example',
      '**/*.example.*',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly' },
    },
    rules: {
      // TS itself checks undefined identifiers; ESLint's no-undef is
      // redundant + wrong for type-only refs (typescript-eslint guidance).
      'no-undef': 'off',
      // Incremental-adoption band (warn, not error) — surfaces debt
      // without a hard wall; adopters tighten as the count drops:
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // ESLint 10 added these; reasonable as warnings on adopting code:
      'preserve-caught-error': 'warn',
      'no-useless-assignment': 'warn',
      // Real-bug rules stay error (the floor that earns its cost):
      'no-debugger': 'error',
      'no-cond-assign': 'error',
      'no-dupe-keys': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },
);
