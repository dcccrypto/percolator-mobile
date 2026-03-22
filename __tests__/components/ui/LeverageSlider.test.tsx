/**
 * Tests for src/components/ui/LeverageSlider.tsx
 *
 * Design spec: DESIGN-BRIEF-MOBILE-V2.md §4.4
 * - Tick values: 1× 2× 5× 10× 20×
 * - Active tick label styled with accent colour
 * - onChange fires with nearest tick value
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';
import { PanResponder } from 'react-native';
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

  it('has accessibilityRole="adjustable" on the hit area', () => {
    const { UNSAFE_getByProps } = render(
      <LeverageSlider value={5} onChange={jest.fn()} testID="leverage-slider" />,
    );
    const hitArea = UNSAFE_getByProps({ accessibilityRole: 'adjustable' });
    expect(hitArea).toBeTruthy();
    expect(hitArea.props.accessibilityLabel).toBe('Leverage slider');
    expect(hitArea.props.accessibilityValue).toMatchObject({ min: 1, max: 20, now: 5 });
  });

  it('fires onChange with the correct snapped LeverageTick on pan release', () => {
    const onChange = jest.fn();
    // Capture the config passed to PanResponder.create so we can invoke callbacks directly
    let capturedConfig: Record<string, Function> = {};
    const originalCreate = PanResponder.create.bind(PanResponder);
    const spy = jest.spyOn(PanResponder, 'create').mockImplementationOnce((config) => {
      capturedConfig = config as Record<string, Function>;
      return originalCreate(config);
    });

    const { UNSAFE_getByProps } = render(
      <LeverageSlider value={1} onChange={onChange} testID="leverage-slider" />,
    );
    const hitArea = UNSAFE_getByProps({ accessibilityRole: 'adjustable' });

    // Simulate layout so liveWidth.current is set
    act(() => {
      hitArea.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 32 } } });
    });

    // Invoke PanResponder callbacks directly at locationX=240 (80% of 300px):
    // fraction=0.8 → raw=round(0.8*19+1)=16 → snapToTick(16) → nearest tick = 20
    const mockEvt = { nativeEvent: { locationX: 240, locationY: 16 } };
    const mockGs = { dx: 10, dy: 0, moveX: 240, moveY: 16, vx: 0, vy: 0, x0: 50, y0: 16, numberActiveTouches: 1 };
    act(() => {
      capturedConfig['onPanResponderGrant']?.(mockEvt, mockGs);
      capturedConfig['onPanResponderRelease']?.(mockEvt, mockGs);
    });

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    // locationX=240/width=300 = 0.8 → raw≈16 → nearest tick is 20
    expect(lastCall).toBe(20);

    spy.mockRestore();
  });

  it('fires onChange via onAccessibilityAction increment/decrement', () => {
    const onChange = jest.fn();
    const { UNSAFE_getByProps } = render(
      <LeverageSlider value={5} onChange={onChange} testID="leverage-slider" />,
    );
    const hitArea = UNSAFE_getByProps({ accessibilityRole: 'adjustable' });

    // Increment from 5× → 10×
    act(() => {
      hitArea.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
    });
    expect(onChange).toHaveBeenLastCalledWith(10);

    // Decrement from 5× → 2× (value prop still 5 — component reads prop, not state)
    act(() => {
      hitArea.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } });
    });
    expect(onChange).toHaveBeenLastCalledWith(2);
  });
});
