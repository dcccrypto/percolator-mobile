/**
 * Tests for src/components/ui/SkeletonLoader.tsx
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SkeletonLoader, MarketCardSkeleton } from '../../../src/components/ui/SkeletonLoader';

describe('SkeletonLoader', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<SkeletonLoader />);
    expect(toJSON()).not.toBeNull();
  });

  it('renders with custom dimensions', () => {
    const { toJSON } = render(
      <SkeletonLoader width={200} height={24} />,
    );
    expect(toJSON()).not.toBeNull();
  });

  it('renders with custom borderRadius', () => {
    const { toJSON } = render(
      <SkeletonLoader borderRadius={12} />,
    );
    expect(toJSON()).not.toBeNull();
  });

  it('renders with string width', () => {
    const { toJSON } = render(
      <SkeletonLoader width="50%" />,
    );
    expect(toJSON()).not.toBeNull();
  });
});

describe('MarketCardSkeleton', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<MarketCardSkeleton />);
    expect(toJSON()).not.toBeNull();
  });

  it('renders a recognizable skeleton structure', () => {
    const tree = render(<MarketCardSkeleton />);
    expect(tree.toJSON()).not.toBeNull();
  });
});
