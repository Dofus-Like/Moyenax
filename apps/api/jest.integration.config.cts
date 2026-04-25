module.exports = {
  displayName: 'api-integration',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  testMatch: ['<rootDir>/test/integration/**/*.int.spec.ts'],
  testTimeout: 60_000, // testcontainers démarre en 15-20s
  maxWorkers: 1, // séquentiel: un container partagé par suite
  coverageDirectory: '../../coverage/apps/api-integration',
};
