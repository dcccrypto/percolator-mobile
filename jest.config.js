/** @type {import('jest').Config} */
const { defaults: tsjPreset } = require('ts-jest/presets');

module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': [
      'babel-jest',
      {
        caller: { name: 'metro', bundler: 'metro', platform: 'ios' },
      },
    ],
  },
  // pnpm stores packages under node_modules/.pnpm/<pkg@ver>/node_modules/<pkg>/
  // so the pattern must match both flat (npm/yarn) and nested (pnpm) layouts.
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@solana-mobile/.*|@solana/.*|@supabase/.*|nativewind|zustand))',
  ],
  // pnpm resolves react-test-renderer transitively to a patch version that
  // doesn't match react exactly (e.g. 19.2.4 vs 19.1.0). RNTL's peer-dep
  // check throws on any mismatch; skip it since the actual render path works.
  testEnvironmentOptions: {
    // Note: env vars for setupFiles must be set before module load.
  },
  setupFiles: ['<rootDir>/jest.env.js', './jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  // Run serially to prevent Zustand store pollution between test suites
  maxWorkers: 1,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'App.tsx',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40,
    },
  },
  moduleNameMapper: {
    '\\.png$': '<rootDir>/__mocks__/fileMock.js',
    '\\.jpg$': '<rootDir>/__mocks__/fileMock.js',
    '\\.svg$': '<rootDir>/__mocks__/fileMock.js',
    '^react-native-safe-area-context$': '<rootDir>/__mocks__/react-native-safe-area-context.js',
    '^@react-navigation/native$': '<rootDir>/__mocks__/@react-navigation/native.js',
  },
};
