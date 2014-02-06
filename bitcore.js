/*
 * Bitcore bindings for the browser
 */


module.exports.bignum = require('bignum');
module.exports.base58 = require('base58-native');
module.exports.EncodedData = require('./util/EncodedData');
module.exports.VersionedData = require('./util/VersionedData');
module.exports.Address = require('./Address');
module.exports.config = require('./config');
module.exports.log = require('./util/log');
module.exports.Opcode = require('./Opcode');
module.exports.util = require('./util/util');
module.exports.Script = require('./Script');
//module.exports.Transaction = require('./Transaction');


if (typeof process.versions === 'undefined') {
  module.exports.bignum.config({EXPONENTIAL_AT: 9999999, DECIMAL_PLACES: 0, ROUNDING_MODE: 1});
}

