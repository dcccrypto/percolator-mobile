/**
 * Tests for src/components/ui/TradeButton.tsx
 *
 * Design spec: DESIGN-BRIEF-MOBILE-V2.md §4.6
 * - Long: #14F195 bg, bgVoid (#06060C) text
 * - Short: #FF3B5C bg, white (#FFFFFF) text
 * - Disabled: bgInset bg, textMuted text
 * - Height: 56px (full CTA), 44px (sm)
 * - Font: JetBrains Mono Bold 14px, radii.lg (12px)
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TradeButton } from '../../../src/components/ui/TradeButton';
import { colors, radii } from '../../../src/theme/tokens';

describe('TradeButton', () => {
  it('renders with the given label', () => {
    const { getByText } = render(
      <TradeButton label="OPEN LONG ▲" direction="long" />,
    );
    expect(getByText('OPEN LONG ▲')).toBeTruthy();
  });

  it('renders short button', () => {
    const { getByText } = render(
      <TradeButton label="OPEN SHORT ▼" direction="short" />,
    );
    expect(getByText('OPEN SHORT ▼')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <TradeButton label="OPEN LONG ▲" direction="long" onPress={onPress} />,
    );
    fireEvent.press(getByText('OPEN LONG ▲'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <TradeButton label="OPEN LONG ▲" direction="long" onPress={onPress} disabled />,
    );
    fireEvent.press(getByText('OPEN LONG ▲'));
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

  it('applies long green background', () => {
    const { getByText } = render(
      <TradeButton label="OPEN LONG ▲" direction="long" />,
    );
    // Traverse up to touchable to check background style
    const text = getByText('OPEN LONG ▲');
    const btn = text.parent?.parent;
    const flatStyle = btn?.props.style;
    const styles = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const hasBg = styles.some(
      (s: any) => s && s.backgroundColor === colors.long,
    );
    expect(hasBg).toBe(true);
  });

  it('applies short red background', () => {
    const { getByText } = render(
      <TradeButton label="OPEN SHORT ▼" direction="short" />,
    );
    const text = getByText('OPEN SHORT ▼');
    const btn = text.parent?.parent;
    const flatStyle = btn?.props.style;
    const styles = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const hasBg = styles.some(
      (s: any) => s && s.backgroundColor === colors.short,
    );
    expect(hasBg).toBe(true);
  });

  it('applies disabled bgInset background when disabled', () => {
    const { getByText } = render(
      <TradeButton label="OPEN LONG ▲" direction="long" disabled />,
    );
    const text = getByText('OPEN LONG ▲');
    const btn = text.parent?.parent;
    const flatStyle = btn?.props.style;
    const styles = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const hasDisabledBg = styles.some(
      (s: any) => s && s.backgroundColor === colors.bgInset,
    );
    expect(hasDisabledBg).toBe(true);
  });

  it('uses dark (bgVoid) text on long button for contrast', () => {
    const { getByText } = render(
      <TradeButton label="OPEN LONG ▲" direction="long" />,
    );
    const text = getByText('OPEN LONG ▲');
    const flatStyle = text.props.style;
    const styles = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const hasColor = styles.some(
      (s: any) => s && s.color === colors.bgVoid,
    );
    expect(hasColor).toBe(true);
  });

  it('uses white text on short button for contrast', () => {
    const { getByText } = render(
      <TradeButton label="OPEN SHORT ▼" direction="short" />,
    );
    const text = getByText('OPEN SHORT ▼');
    const flatStyle = text.props.style;
    const styles = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const hasColor = styles.some(
      (s: any) => s && s.color === '#FFFFFF',
    );
    expect(hasColor).toBe(true);
  });

  it('uses textMuted color when disabled', () => {
    const { getByText } = render(
      <TradeButton label="OPEN LONG ▲" direction="long" disabled />,
    );
    const text = getByText('OPEN LONG ▲');
    const flatStyle = text.props.style;
    const styles = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const hasColor = styles.some(
      (s: any) => s && s.color === colors.textMuted,
    );
    expect(hasColor).toBe(true);
  });

  it('lg button has 56px height', () => {
    const { getByText } = render(
      <TradeButton label="OPEN LONG ▲" direction="long" />,
    );
    const text = getByText('OPEN LONG ▲');
    const btn = text.parent?.parent;
    const flatStyle = btn?.props.style;
    const styles = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const hasHeight = styles.some((s: any) => s && s.height === 56);
    expect(hasHeight).toBe(true);
  });

  it('sm button has 44px height', () => {
    const { getByText } = render(
      <TradeButton label="Long" direction="long" size="sm" />,
    );
    const text = getByText('Long');
    const btn = text.parent?.parent;
    const flatStyle = btn?.props.style;
    const styles = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const hasHeight = styles.some((s: any) => s && s.height === 44);
    expect(hasHeight).toBe(true);
  });

  it('uses radii.lg (12px) border radius on lg button', () => {
    const { getByText } = render(
      <TradeButton label="OPEN LONG ▲" direction="long" />,
    );
    const text = getByText('OPEN LONG ▲');
    const btn = text.parent?.parent;
    const flatStyle = btn?.props.style;
    const styles = Array.isArray(flatStyle) ? flatStyle : [flatStyle];
    const hasRadius = styles.some(
      (s: any) => s && s.borderRadius === radii.lg,
    );
    expect(hasRadius).toBe(true);
  });
});
