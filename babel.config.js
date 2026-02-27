module.exports = function (api) {
  api.cache(true);

  const plugins = [];

  // react-native-reanimated plugin MUST be last in non-test envs.
  // In test env, skip it — we mock reanimated in jest.setup.js.
  if (process.env.NODE_ENV !== 'test') {
    plugins.push('react-native-reanimated/plugin');
  }

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins,
  };
};
