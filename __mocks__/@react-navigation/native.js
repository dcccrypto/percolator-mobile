const React = require('react');

module.exports = {
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    reset: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({
    params: {},
    name: 'MockRoute',
  }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
  NavigationContainer: ({ children }) => children,
  createNavigationContainerRef: () => ({
    current: null,
    isReady: () => false,
  }),
};
