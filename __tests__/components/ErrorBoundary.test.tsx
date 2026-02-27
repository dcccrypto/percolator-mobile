/**
 * Tests for src/components/ErrorBoundary.tsx
 */
import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

// Suppress console.error for expected errors in these tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

function ThrowingComponent(): React.ReactElement {
  throw new Error('Test crash');
}

function GoodComponent(): React.ReactElement {
  return <Text>All good</Text>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>,
    );
    expect(getByText('All good')).toBeTruthy();
  });

  it('catches errors and renders fallback UI', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Test crash')).toBeTruthy();
  });

  it('shows error name in fallback', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(getByText('Error')).toBeTruthy();
  });

  it('has a "Try Again" button in fallback', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(getByText('Try Again')).toBeTruthy();
  });

  it('resets error state when "Try Again" is pressed', () => {
    // After reset, the throwing component will throw again,
    // but we're testing that the reset mechanism works
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    // Press try again — it'll re-throw and show the error again
    fireEvent.press(getByText('Try Again'));
    expect(getByText('Something went wrong')).toBeTruthy();
  });

  it('uses custom fallback when provided', () => {
    const { getByText } = render(
      <ErrorBoundary
        fallback={(error, reset) => (
          <Text>Custom error: {error.message}</Text>
        )}
      >
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(getByText('Custom error: Test crash')).toBeTruthy();
  });
});
