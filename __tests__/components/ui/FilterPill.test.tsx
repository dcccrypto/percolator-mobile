/**
 * Tests for src/components/ui/FilterPill.tsx
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FilterPill } from '../../../src/components/ui/FilterPill';

describe('FilterPill', () => {
  it('renders the label text', () => {
    const { getByText } = render(<FilterPill label="Hot 🔥" />);
    expect(getByText('Hot 🔥')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <FilterPill label="Volume ↓" onPress={onPress} />,
    );
    fireEvent.press(getByText('Volume ↓'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders in active state', () => {
    const { getByText } = render(
      <FilterPill label="Active" active />,
    );
    expect(getByText('Active')).toBeTruthy();
  });

  it('renders in inactive state by default', () => {
    const { getByText } = render(
      <FilterPill label="Inactive" />,
    );
    expect(getByText('Inactive')).toBeTruthy();
  });
});
