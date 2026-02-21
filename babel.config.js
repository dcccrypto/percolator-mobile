module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      // react-native-reanimated MUST be last
      'react-native-reanimated/plugin',
    ],
  };
};
