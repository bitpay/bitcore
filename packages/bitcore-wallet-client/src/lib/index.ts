/**
 * The official client library for bitcore-wallet-service.
 * @module Client
 */

// /**
// * Client API.
// * @alias module:Client.API
// */
const client = require('./api');

// /**
// * Verifier module.
// * @alias module:Client.Verifier
// */
client.Verifier = require('./verifier');
client.Key = require('./key');
client.Utils = require('./common/utils');
client.sjcl = require('sjcl');
client.errors = require('./errors');

// Expose bitcore
client.Bitcore = require('bitcore-lib');
client.BitcoreCash = require('bitcore-lib-cash');
module.exports = client;
// client.Core = require('crypto-wallet-core');