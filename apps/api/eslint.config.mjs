import baseConfig from '../../eslint.config.mjs';
import nestjsTyped from '@darraghor/eslint-plugin-nestjs-typed';

export default [
  ...baseConfig,
  // Type-aware rules uniquement sur les fichiers de production (pas les spec, couverts par tsconfig.app.json)
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@darraghor/nestjs-typed': nestjsTyped.plugin,
    },
    rules: {
      '@darraghor/nestjs-typed/injectable-should-be-provided': 'error',
      '@darraghor/nestjs-typed/api-method-should-specify-api-response': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
];
