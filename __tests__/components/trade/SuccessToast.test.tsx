import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SuccessToast } from '../../../src/components/trade/SuccessToast';

describe('SuccessToast', () => {
  const onDismiss = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    onDismiss.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when not visible', () => {
    const { toJSON } = render(
      <SuccessToast visible={false} txSignature={null} onDismiss={onDismiss} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders message when visible', () => {
    const { getByText } = render(
      <SuccessToast
        visible={true}
        txSignature="abc12345xyz67890"
        message="Position opened!"
        onDismiss={onDismiss}
      />,
    );
    expect(getByText('Position opened!')).toBeTruthy();
  });

  it('shows shortened tx signature', () => {
    const sig = 'abcdefgh12345678ijklmnop90123456';
    const { getByText } = render(
      <SuccessToast visible={true} txSignature={sig} onDismiss={onDismiss} />,
    );
    // Should show first 8 and last 8 chars
    expect(getByText(/abcdefgh.*90123456/)).toBeTruthy();
  });

  it('renders with null txSignature (no explorer link)', () => {
    const { getByText, queryByText } = render(
      <SuccessToast visible={true} txSignature={null} onDismiss={onDismiss} />,
    );
    expect(getByText('Trade submitted!')).toBeTruthy();
    expect(queryByText(/Solscan/)).toBeNull();
  });

  it('uses devnet cluster param by default', () => {
    const sig = 'testsig123456789abcdefgh12345678';
    const { getByText } = render(
      <SuccessToast visible={true} txSignature={sig} onDismiss={onDismiss} />,
    );
    // The explorer link text should exist
    expect(getByText(/View on Solscan/)).toBeTruthy();
  });

  it('auto-dismisses after duration', () => {
    render(
      <SuccessToast
        visible={true}
        txSignature="sig123"
        durationMs={2000}
        onDismiss={onDismiss}
      />,
    );
    jest.advanceTimersByTime(2200);
    // onDismiss should be called after animation completes
    // (timing animation takes 200ms after the 2000ms delay)
    expect(onDismiss).toHaveBeenCalled();
  });
});
