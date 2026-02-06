'use strict';

const startGulp = require('@bitpay-labs/bitcore-build');

module.exports = startGulp('p2p', { skipBrowser: true });
