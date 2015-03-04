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

/**
 * Air gapped module.
 * @alias module:Client.AirGapped
 */
client.AirGapped = require('./airgapped');
