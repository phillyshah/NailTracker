import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Base JS + TypeScript recommended rules
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // Project-level rule overrides
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // ── Security (hard errors) ───────────────────────────────────────
      'no-eval': 'error',
      'no-implied-eval': 'error',

      // ── Practical downgrades for existing codebase ───────────────────
      // `any` is sometimes required at Express/Prisma API boundaries.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Empty interfaces are a common TypeScript pattern (e.g. extending
      // a base type without adding members, or module augmentation).
      '@typescript-eslint/no-empty-object-type': 'off',

      // TypeScript namespace syntax is used in auth middleware for global
      // type augmentation (declare global / declare namespace Express).
      '@typescript-eslint/no-namespace': 'off',

      // Catch-block error bindings are often not used when the handler
      // passes a generic message instead of the raw error. Allow `_`-
      // prefixed names and ignore caught errors entirely.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'none',       // catch (err) { ... } is fine
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // Ignore build outputs, generated files, and plain-JS config files
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'client/public/**',
      'server/prisma/migrations/**',
      '*.config.js',     // vite.config.js, ecosystem.config.js etc.
      '*.config.cjs',
    ],
  },
);
