/**
 * The official client library for bitcore-wallet-service.
 * @module Client
 */

/**
 * Client API.
 * @alias module:Client.API
 */
var client = (module.exports = require('./api'));

/**
 * Verifier module.
 * @alias module:Client.Verifier
 */
client.Verifier = require('./verifier');
client.Key = require('./key');
client.Utils = require('./common/utils');
client.sjcl = require('sjcl');

// Expose bitcore
client.Bitcore = require('bitcore-lib');
client.BitcoreCash = require('bitcore-lib-cash');
//client.Core = require('crypto-wallet-core');
