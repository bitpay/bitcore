const webpack = require('webpack');
const ionicWebpack = require('./node_modules/@ionic/app-scripts/config/webpack.config');
const webpackMerge = require('webpack-merge');
const customConfig = {
  plugins: [
    new webpack.DefinePlugin({
      'process.env': JSON.stringify({
        NETWORK: process.env.NETWORK,
        DEFAULT_CURRENCY: process.env.DEFAULT_CURRENCY,
        API_PREFIX: process.env.API_PREFIX
      }),
    })
  ]
};

module.exports = webpackMerge(ionicWebpack, customConfig);
