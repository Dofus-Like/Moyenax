import nx from '@nx/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import unicorn from 'eslint-plugin-unicorn';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/.nx',
      '**/node_modules',
      '**/coverage',
      '**/out-tsc',
      '**/vite.config.*.timestamp*',
    ],
  },
  // NX module boundaries
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // type:app ne peut pas dépendre d'un autre type:app
            { sourceTag: 'type:app', notDependOnLibsWithTags: ['type:app'] },
            // type:ui ne peut dépendre que de type:ui, type:util et type:shared
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:ui', 'type:util', 'type:shared'],
            },
            // type:feature peut dépendre de tout sauf type:app
            { sourceTag: 'type:feature', notDependOnLibsWithTags: ['type:app'] },
            // scope:frontend ne peut pas importer type:backend
            { sourceTag: 'scope:frontend', notDependOnLibsWithTags: ['type:backend'] },
          ],
        },
      ],
    },
  },
  // Règles globales TypeScript/TSX
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      import: importPlugin,
      unicorn,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: ['./tsconfig.base.json'],
        },
        node: true,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'import/no-cycle': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'unicorn/no-array-for-each': 'error',
      'unicorn/prefer-node-protocol': 'error',
      // Charte qualité (KISS) — voir docs/CODE_QUALITY.md §3.
      // En `warn` pendant la phase d'adoption pour ne pas bloquer le code legacy ;
      // passer en `error` après la PR `chore/quality-baseline`.
      complexity: ['warn', { max: 10 }],
      'max-lines-per-function': [
        'warn',
        { max: 50, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      'max-depth': ['warn', { max: 4 }],
      'max-params': ['warn', { max: 4 }],
      'no-nested-ternary': 'error',
    },
  },
  // Règles plus souples pour les tests (fixtures, mocks, builders volumineux).
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'max-lines-per-function': 'off',
      complexity: 'off',
      'max-depth': 'off',
    },
  },
];
