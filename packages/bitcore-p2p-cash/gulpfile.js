'use strict';

const startGulp = require('@bitpay-labs/bitcore-build');

Object.assign(exports, startGulp('p2p', { skipBrowser: true }));
