module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      ['module:@react-native/babel-preset', { enableBabelRuntime: false }],
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
