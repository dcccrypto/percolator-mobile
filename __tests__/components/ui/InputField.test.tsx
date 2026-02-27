/**
 * Tests for src/components/ui/InputField.tsx
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { InputField } from '../../../src/components/ui/InputField';

describe('InputField', () => {
  it('renders with label', () => {
    const { getByText } = render(
      <InputField label="Amount" value="" onChangeText={() => {}} />,
    );
    expect(getByText('Amount')).toBeTruthy();
  });

  it('renders without label', () => {
    const { queryByText } = render(
      <InputField value="100" onChangeText={() => {}} />,
    );
    // No label rendered
    expect(queryByText('Amount')).toBeNull();
  });

  it('displays the current value', () => {
    const { getByDisplayValue } = render(
      <InputField value="42.5" onChangeText={() => {}} />,
    );
    expect(getByDisplayValue('42.5')).toBeTruthy();
  });

  it('calls onChangeText when text changes', () => {
    const onChangeText = jest.fn();
    const { getByDisplayValue } = render(
      <InputField value="100" onChangeText={onChangeText} />,
    );

    fireEvent.changeText(getByDisplayValue('100'), '200');
    expect(onChangeText).toHaveBeenCalledWith('200');
  });

  it('renders with suffix', () => {
    const { getByText } = render(
      <InputField value="100" onChangeText={() => {}} suffix="SOL" />,
    );
    expect(getByText('SOL')).toBeTruthy();
  });

  it('renders right action button', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <InputField
        value="0"
        onChangeText={() => {}}
        rightAction={{ label: 'MAX', onPress }}
      />,
    );
    expect(getByText('MAX')).toBeTruthy();
    fireEvent.press(getByText('MAX'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders with placeholder', () => {
    const { getByPlaceholderText } = render(
      <InputField
        value=""
        onChangeText={() => {}}
        placeholder="Enter amount"
      />,
    );
    expect(getByPlaceholderText('Enter amount')).toBeTruthy();
  });
});
