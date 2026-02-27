/**
 * Tests for src/components/ui/Panel.tsx
 */
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { Panel } from '../../../src/components/ui/Panel';

describe('Panel', () => {
  it('renders children', () => {
    const { getByText } = render(
      <Panel>
        <Text>Panel Content</Text>
      </Panel>,
    );
    expect(getByText('Panel Content')).toBeTruthy();
  });

  it('renders with custom style', () => {
    const { getByText } = render(
      <Panel style={{ marginTop: 20 }}>
        <Text>Styled Panel</Text>
      </Panel>,
    );
    expect(getByText('Styled Panel')).toBeTruthy();
  });

  it('renders multiple children', () => {
    const { getByText } = render(
      <Panel>
        <Text>Child 1</Text>
        <Text>Child 2</Text>
      </Panel>,
    );
    expect(getByText('Child 1')).toBeTruthy();
    expect(getByText('Child 2')).toBeTruthy();
  });
});
