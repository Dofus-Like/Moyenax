module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/api',
  coverageReporters: ['text', 'html', 'lcov', 'json-summary'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/src/test/',
    '<rootDir>/src/main.ts',
    '\\.module\\.ts$',
    '\\.dto\\.ts$',
    '\\.d\\.ts$',
  ],
};
