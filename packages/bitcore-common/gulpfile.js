const startGulp = require('@bitpay-labs/bitcore-build');

Object.assign(exports, startGulp('common', {
  skipBrowser: true
}));
