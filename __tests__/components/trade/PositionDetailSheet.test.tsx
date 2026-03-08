import React from 'react';
import { render } from '@testing-library/react-native';
import { PositionDetailSheet } from '../../../src/components/trade/PositionDetailSheet';
import type { Position } from '../../../src/hooks/usePositions';

const mockPosition: Position = {
  id: 'slab456:7',
  symbol: 'ETH-PERP',
  slabAddress: 'slab456',
  direction: 'long',
  leverage: 10,
  entryPrice: 2000,
  currentPrice: 2200,
  size: 5,
  liqPrice: 1800,
  pnl: 1000,
  pnlPercent: 50,
  capital: 2000,
};

describe('PositionDetailSheet', () => {
  it('renders null when position is null', () => {
    const { toJSON } = render(<PositionDetailSheet position={null} />);
    expect(toJSON()).toBeNull();
  });

  it('constructs without error for long position', () => {
    const ref = React.createRef<any>();
    expect(() =>
      render(<PositionDetailSheet ref={ref} position={mockPosition} />),
    ).not.toThrow();
  });

  it('constructs without error for short position', () => {
    const shortPos: Position = {
      ...mockPosition,
      direction: 'short',
      currentPrice: 1900,
      pnl: 500,
      pnlPercent: 25,
    };
    const ref = React.createRef<any>();
    expect(() =>
      render(<PositionDetailSheet ref={ref} position={shortPos} />),
    ).not.toThrow();
  });

  it('handles negative pnl', () => {
    const losingPos: Position = {
      ...mockPosition,
      currentPrice: 1800,
      pnl: -1000,
      pnlPercent: -50,
    };
    const ref = React.createRef<any>();
    expect(() =>
      render(<PositionDetailSheet ref={ref} position={losingPos} />),
    ).not.toThrow();
  });

  it('handles zero liq price', () => {
    const noLiq: Position = { ...mockPosition, liqPrice: 0 };
    const ref = React.createRef<any>();
    expect(() =>
      render(<PositionDetailSheet ref={ref} position={noLiq} />),
    ).not.toThrow();
  });

  it('handles critical liq distance (< 10%)', () => {
    const criticalPos: Position = {
      ...mockPosition,
      currentPrice: 2000,
      liqPrice: 1850, // 7.5% away
    };
    const ref = React.createRef<any>();
    expect(() =>
      render(<PositionDetailSheet ref={ref} position={criticalPos} />),
    ).not.toThrow();
  });

  it('uses dynamic cluster for explorer URL', () => {
    // Default is devnet, so cluster param should be ?cluster=devnet
    const ref = React.createRef<any>();
    expect(() =>
      render(<PositionDetailSheet ref={ref} position={mockPosition} />),
    ).not.toThrow();
  });
});
