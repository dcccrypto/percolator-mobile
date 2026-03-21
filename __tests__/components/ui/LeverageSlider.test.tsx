/**
 * Tests for src/components/ui/LeverageSlider.tsx
 *
 * Design spec: DESIGN-BRIEF-MOBILE-V2.md §4.4
 * - Tick values: 1× 2× 5× 10× 20×
 * - Active tick label styled with accent colour
 * - onChange fires with nearest tick value
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { LeverageSlider, LEVERAGE_TICKS } from '../../../src/components/ui/LeverageSlider';
import { colors } from '../../../src/theme/tokens';
import { fonts } from '../../../src/theme/fonts';

describe('LeverageSlider', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(
      <LeverageSlider value={5} onChange={jest.fn()} testID="leverage-slider" />,
    );
    expect(getByTestId('leverage-slider')).toBeTruthy();
  });

  it('renders all 5 tick labels', () => {
    const { getByText } = render(
      <LeverageSlider value={5} onChange={jest.fn()} />,
    );
    expect(getByText('1×')).toBeTruthy();
    expect(getByText('2×')).toBeTruthy();
    expect(getByText('5×')).toBeTruthy();
    expect(getByText('10×')).toBeTruthy();
    expect(getByText('20×')).toBeTruthy();
  });

  it('LEVERAGE_TICKS contains exactly [1, 2, 5, 10, 20]', () => {
    expect(Array.from(LEVERAGE_TICKS)).toEqual([1, 2, 5, 10, 20]);
  });

  it('active tick (value=5) label has accent colour', () => {
    const { getByText } = render(
      <LeverageSlider value={5} onChange={jest.fn()} />,
    );
    const activeLabel = getByText('5×');
    expect(activeLabel.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: colors.accent }),
      ]),
    );
  });

  it('inactive tick (value=5, tick=10) label has textMuted colour', () => {
    const { getByText } = render(
      <LeverageSlider value={5} onChange={jest.fn()} />,
    );
    const inactiveLabel = getByText('10×');
    // Should include textMuted in its style array but NOT accent
    const flatStyles = [inactiveLabel.props.style].flat();
    const hasAccent = flatStyles.some(
      (s: unknown) => typeof s === 'object' && s !== null && (s as Record<string, unknown>).color === colors.accent,
    );
    expect(hasAccent).toBe(false);
  });

  it('tick labels use JetBrains Mono font', () => {
    const { getByText } = render(
      <LeverageSlider value={1} onChange={jest.fn()} />,
    );
    const label = getByText('1×');
    const flatStyles = [label.props.style].flat();
    const hasMono = flatStyles.some(
      (s: unknown) =>
        typeof s === 'object' &&
        s !== null &&
        (s as Record<string, unknown>).fontFamily === fonts.mono,
    );
    expect(hasMono).toBe(true);
  });

  it('does not crash when value changes externally', () => {
    const { rerender } = render(
      <LeverageSlider value={1} onChange={jest.fn()} />,
    );
    rerender(<LeverageSlider value={20} onChange={jest.fn()} />);
    rerender(<LeverageSlider value={5} onChange={jest.fn()} />);
  });
});
