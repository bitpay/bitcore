const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
// const TerserPlugin = require('terser-webpack-plugin');

const testFiles = fs.readdirSync('./test', {
  recursive: true,
  withFileTypes: true
}).filter(item => item.isFile() && item.name.endsWith('test.js'));

const entry = {};
for (const file of testFiles) {
  entry[file.name.replace('.test.js', '')] = './' + path.join(file.path, file.name); 
}

module.exports = {
  mode: 'development',
  devServer: {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
    },
  },
  entry,
  output: {
    filename: '[name].test.js',
    path: path.resolve(__dirname, 'build'),
    publicPath: '/'
  },
  resolve: {
    extensions: ['.js', '.json'],
    alias: {
      assert: require.resolve('assert/'),
      buffer: require.resolve('buffer/'),
    },
    fallback: {
      constants: false,
      crypto: require.resolve('crypto-browserify'),
      dns: false,
      fs: false,
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      http2: require.resolve('stream-http'),
      net: false,
      os: false,
      path: false,
      stream: require.resolve('stream-browserify'),
      tls: false,
      url: require.resolve('url/'),
      vm: false,
      zlib: false,
      async: require.resolve('async'),
    }
  },
  externals: {
    'wasmer_wasi_js_bg.wasm': true
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    }),
    new webpack.NormalModuleReplacementPlugin(
      /\@silencelaboratories\/dkls-wasm-ll-node/,
      '@silencelaboratories/dkls-wasm-ll-web'
    ),
  ],
  node: {
    global: true,
  },
  experiments: {
    backCompat: false,
    asyncWebAssembly: true,
    syncWebAssembly: true,
  },
  // optimization: {
  //   minimizer: [
  //     new TerserPlugin({
  //       parallel: true,
  //       terserOptions: {
  //         ecma: 6,
  //         warnings: true,
  //         mangle: false,
  //         keep_classnames: true,
  //         keep_fnames: true,
  //       },
  //     }),
  //   ],
  // },
};