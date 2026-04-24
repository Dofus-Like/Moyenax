module.exports = {
  displayName: 'game-engine',
  preset: '../../jest.preset.js',
  passWithNoTests: true,
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/game-engine',
  coverageReporters: ['text', 'html', 'lcov', 'json-summary'],
};
