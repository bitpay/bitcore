'use strict';
/***
 * https://github.com/bitcoincashjs/cashaddr
 * Copyright (c) 2018 Matias Alejo Garcia
 * Copyright (c) 2017 Emilio Almansi
 * Distributed under the MIT software license, see the accompanying
 * file LICENSE or http://www.opensource.org/licenses/mit-license.php.
 */


var $ = require('./preconditions');

/***
 * Charset containing the 32 symbols used in the base32 encoding.
 */
var CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

/***
 * Inverted index mapping each symbol into its index within the charset.
 */
var  CHARSET_INVERSE_INDEX = {
  'q': 0, 'p': 1, 'z': 2, 'r': 3, 'y': 4, '9': 5, 'x': 6, '8': 7,
  'g': 8, 'f': 9, '2': 10, 't': 11, 'v': 12, 'd': 13, 'w': 14, '0': 15,
  's': 16, '3': 17, 'j': 18, 'n': 19, '5': 20, '4': 21, 'k': 22, 'h': 23,
  'c': 24, 'e': 25, '6': 26, 'm': 27, 'u': 28, 'a': 29, '7': 30, 'l': 31,
};

/***
 * Encodes the given array of 5-bit integers as a base32-encoded string.
 *
 * @param {Array} data Array of integers between 0 and 31 inclusive.
 */
function encode(data) {
  $.checkArgument(data instanceof Array, 'Must be Array');
  var base32 = '';
  for (var i=0; i<data.length; i++) {
    var value = data[i];
    $.checkArgument(0 <= value && value < 32, 'value ' + value);
    base32 += CHARSET[value];
  }
  return base32;
}

/***
 * Decodes the given base32-encoded string into an array of 5-bit integers.
 *
 * @param {string} base32 
 */
function decode(base32) {
  $.checkArgument(typeof base32 === 'string', 'Must be base32-encoded string');
  var data = [];
  for (var i=0; i<base32.length; i++) {
    var value = base32[i];
    $.checkArgument(value in CHARSET_INVERSE_INDEX, 'value '+ value);
    data.push(CHARSET_INVERSE_INDEX[value]);
  }
  return data;
}

module.exports = {
  encode: encode,
  decode: decode,
};
