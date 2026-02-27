/**
 * Tests for src/components/ui/HudCorners.tsx
 */
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { HudCorners } from '../../../src/components/ui/HudCorners';

describe('HudCorners', () => {
  it('renders children', () => {
    const { getByText } = render(
      <HudCorners>
        <Text>Content</Text>
      </HudCorners>,
    );
    expect(getByText('Content')).toBeTruthy();
  });

  it('renders with custom size and color props', () => {
    const { getByText } = render(
      <HudCorners size={20} color="#ff0000" opacity={0.8}>
        <Text>Custom</Text>
      </HudCorners>,
    );
    expect(getByText('Custom')).toBeTruthy();
  });

  it('renders with custom style', () => {
    const { getByText } = render(
      <HudCorners style={{ padding: 10 }}>
        <Text>Styled</Text>
      </HudCorners>,
    );
    expect(getByText('Styled')).toBeTruthy();
  });
});
