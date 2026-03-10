'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const React = require('react');
const { View } = require('react-native');

const insets = { top: 0, bottom: 0, left: 0, right: 0 };
const frame = { x: 0, y: 0, width: 390, height: 844 };

Object.assign(exports, {
  SafeAreaProvider: ({ children, ...props }) =>
    React.createElement(View, props, children),
  SafeAreaView: ({ children, ...props }) =>
    React.createElement(View, props, children),
  useSafeAreaInsets: () => insets,
  useSafeAreaFrame: () => frame,
  initialWindowMetrics: { insets, frame },
  SafeAreaInsetsContext: {
    Consumer: ({ children }) => children(insets),
    Provider: ({ children }) => children,
  },
  SafeAreaFrameContext: {
    Consumer: ({ children }) => children(frame),
    Provider: ({ children }) => children,
  },
});
