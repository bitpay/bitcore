/**
 * @file util/bitcoin.js
 * Contains utilities to handle magnitudes inside of bitcoin
 */
'use strict';

var SATOSHIS_PER_BTC = 1e8;

module.exports = {
  /**
   * @param number satoshis - amount of satoshis to convert
   * @return string an exact representation of such amount, in form of a string
   *     (avoids duplicate representations in ieee756 of the same number)
   */
  satoshisToBitcoin: function(satoshis) {
    return satoshis / SATOSHIS_PER_BTC;
  }
};
