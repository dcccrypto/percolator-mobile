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
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@solana-mobile/.*|@solana/.*|@supabase/.*|nativewind|zustand)',
  ],
  setupFiles: ['./jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'App.tsx',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '\\.png$': '<rootDir>/__mocks__/fileMock.js',
    '\\.jpg$': '<rootDir>/__mocks__/fileMock.js',
    '\\.svg$': '<rootDir>/__mocks__/fileMock.js',
  },
};
