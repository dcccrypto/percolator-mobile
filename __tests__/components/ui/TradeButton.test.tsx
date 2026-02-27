/**
 * Tests for src/components/ui/TradeButton.tsx
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TradeButton } from '../../../src/components/ui/TradeButton';

describe('TradeButton', () => {
  it('renders with the given label', () => {
    const { getByText } = render(
      <TradeButton label="Long ▲" direction="long" />,
    );
    expect(getByText('Long ▲')).toBeTruthy();
  });

  it('renders short button', () => {
    const { getByText } = render(
      <TradeButton label="Short ▼" direction="short" />,
    );
    expect(getByText('Short ▼')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <TradeButton label="Long ▲" direction="long" onPress={onPress} />,
    );

    fireEvent.press(getByText('Long ▲'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <TradeButton label="Long ▲" direction="long" onPress={onPress} disabled />,
    );

    fireEvent.press(getByText('Long ▲'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders with sm size', () => {
    const { getByText } = render(
      <TradeButton label="Long" direction="long" size="sm" />,
    );
    expect(getByText('Long')).toBeTruthy();
  });

  it('renders with fullWidth prop', () => {
    const { getByText } = render(
      <TradeButton label="Long" direction="long" fullWidth />,
    );
    expect(getByText('Long')).toBeTruthy();
  });
});
