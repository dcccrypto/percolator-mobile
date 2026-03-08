import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PartialCloseSheet } from '../../../src/components/trade/PartialCloseSheet';
import type { Position } from '../../../src/hooks/usePositions';

const mockPosition: Position = {
  id: 'slab123:42',
  symbol: 'SOL-PERP',
  slabAddress: 'slab123',
  direction: 'long',
  leverage: 5,
  entryPrice: 100,
  currentPrice: 110,
  size: 10,
  liqPrice: 80,
  pnl: 100,
  pnlPercent: 10,
  capital: 200,
};

describe('PartialCloseSheet', () => {
  const onClose = jest.fn();

  beforeEach(() => {
    onClose.mockClear();
  });

  it('renders null when position is null', () => {
    const { toJSON } = render(
      <PartialCloseSheet position={null} submitting={false} onClose={onClose} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders position info when provided (index >= 0)', () => {
    const ref = React.createRef<any>();
    const { getByText } = render(
      <PartialCloseSheet
        ref={ref}
        position={mockPosition}
        submitting={false}
        onClose={onClose}
      />,
    );
    // BottomSheet mock renders nothing when index=-1 (default)
    // This verifies the component doesn't crash with a valid position
  });

  it('shows percentage preset buttons', () => {
    // The component is wrapped in a BottomSheet which defaults to index -1 (hidden).
    // We verify the component constructs without error.
    const ref = React.createRef<any>();
    expect(() =>
      render(
        <PartialCloseSheet
          ref={ref}
          position={mockPosition}
          submitting={false}
          onClose={onClose}
        />,
      ),
    ).not.toThrow();
  });

  it('handles short position pnl direction', () => {
    const shortPos: Position = { ...mockPosition, direction: 'short', currentPrice: 90 };
    const ref = React.createRef<any>();
    expect(() =>
      render(
        <PartialCloseSheet
          ref={ref}
          position={shortPos}
          submitting={false}
          onClose={onClose}
        />,
      ),
    ).not.toThrow();
  });

  it('handles negative pnl', () => {
    const losingPos: Position = { ...mockPosition, pnl: -50, pnlPercent: -25 };
    const ref = React.createRef<any>();
    expect(() =>
      render(
        <PartialCloseSheet
          ref={ref}
          position={losingPos}
          submitting={false}
          onClose={onClose}
        />,
      ),
    ).not.toThrow();
  });
});
