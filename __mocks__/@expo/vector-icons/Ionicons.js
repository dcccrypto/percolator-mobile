const React = require('react');
const { Text } = require('react-native');

function Ionicons({ name, size, color, ...props }) {
  return React.createElement(Text, { ...props, testID: `icon-${name}` }, name);
}

module.exports = Ionicons;
