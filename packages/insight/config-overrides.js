// config-overrides.js
// eslint-disable-next-line @typescript-eslint/no-var-requires
const webpack = require('webpack');

module.exports = function override(config, env) {
  config.resolve.fallback = {
    ...config.resolve.fallback,
    assert: require.resolve('assert/'),
    buffer: require.resolve('buffer'),
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    url: require.resolve('url/')
  };

  config.plugins.push(
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer']
    })
  )

  return config;
};