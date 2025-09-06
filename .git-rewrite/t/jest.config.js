module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/packages'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'packages/*/src/**/*.{ts,tsx}',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/index.ts',
    '!packages/*/src/**/*.stories.tsx'
  ],
  moduleNameMapper: {
    '@unified-video/core': '<rootDir>/packages/core/src',
    '@unified-video/web': '<rootDir>/packages/web/src',
    '@unified-video/react-native': '<rootDir>/packages/react-native/src',
    '@unified-video/enact': '<rootDir>/packages/enact/src',
    '@unified-video/roku': '<rootDir>/packages/roku/src'
  },
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
