/**
 * The official client library for bitcore-wallet-service.
 * @module Client
 */

/**
 * Client API.
 * @alias module:Client.API
 */
var client = module.exports = require('./api');

/**
 * Verifier module.
 * @alias module:Client.Verifier
 */
client.Verifier = require('./verifier');

client.Utils = require('./utils');

// Expose bitcore
client.Bitcore = require('bitcore-wallet-utils').Bitcore;
