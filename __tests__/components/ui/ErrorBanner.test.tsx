/**
 * Tests for src/components/ui/ErrorBanner.tsx
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ErrorBanner, ConnectionBanner } from '../../../src/components/ui/ErrorBanner';

describe('ErrorBanner', () => {
  it('renders the error message', () => {
    const { getByText } = render(
      <ErrorBanner message="Something went wrong" />,
    );
    expect(getByText('⚠ Something went wrong')).toBeTruthy();
  });

  it('renders retry button when onRetry is provided', () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <ErrorBanner message="Error" onRetry={onRetry} />,
    );
    expect(getByText('Retry')).toBeTruthy();
  });

  it('calls onRetry when retry button is pressed', () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <ErrorBanner message="Error" onRetry={onRetry} />,
    );
    fireEvent.press(getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry is not provided', () => {
    const { queryByText } = render(
      <ErrorBanner message="Error" />,
    );
    expect(queryByText('Retry')).toBeNull();
  });
});

describe('ConnectionBanner', () => {
  it('returns null when status is "connected"', () => {
    const { toJSON } = render(
      <ConnectionBanner status="connected" />,
    );
    expect(toJSON()).toBeNull();
  });

  it('shows "Reconnecting..." when status is "connecting"', () => {
    const { getByText } = render(
      <ConnectionBanner status="connecting" />,
    );
    expect(getByText('⏳ Reconnecting...')).toBeTruthy();
  });

  it('shows "Connection lost" for other statuses', () => {
    const { getByText } = render(
      <ConnectionBanner status="disconnected" />,
    );
    expect(getByText('❌ Connection lost')).toBeTruthy();
  });
});
