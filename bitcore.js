/*
 * Bitcore bindings for the browser
 */


module.exports.bignum = require('bignum');
module.exports.base58 = require('base58-native');
//module.exports.Address = require('./Address');



if (typeof process.versions === 'undefined') {
  module.exports.bignum.config({EXPONENTIAL_AT: 9999999, DECIMAL_PLACES: 0, ROUNDING_MODE: 1});
}

