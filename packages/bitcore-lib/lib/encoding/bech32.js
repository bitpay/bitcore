'use strict';

var bech32 = require('bech32');

/**
 * Decode bech32/bech32m string
 * @param {String} str String to decode
 * @returns {Object} Decoded string info
 */
var decode = function(str) {
  if (typeof str !== 'string') {
    throw new Error('Input should be a string');
  }

  var decoded;
  let fromWords = bech32.bech32.fromWords;
  let encoding = encodings.BECH32;
  try {
    decoded = bech32.bech32.decode(str);
  } catch (e) {
    if (e.message.indexOf('Invalid checksum') > -1) {
      decoded = bech32.bech32m.decode(str);
      encoding = encodings.BECH32M;
      fromWords = bech32.bech32m.fromWords;
    } else {
      throw e;
    }
  }

  const version = decoded.words[0];
  if (version >= 1 && encoding !== encodings.BECH32M) {
    throw new Error('Version 1+ witness address must use Bech32m checksum');
  }

  return {
    prefix: decoded.prefix,
    data: Buffer.from(fromWords(decoded.words.slice(1))),
    version
  };
};

/**
 * Encode using BECH32 encoding
 * @param {String} prefix bech32 prefix
 * @param {Number} version
 * @param {String|Buffer} data 
 * @param {String|Number} encoding (optional, default=bech32) Valid encodings are 'bech32', 'bech32m', 0, and 1.
 * @returns {String} encoded string
 */
var encode = function(prefix, version, data, encoding) {
	if (typeof prefix !== 'string') {
		throw new Error('Prefix should be a string');
	}
	if (typeof version !== 'number') {
		throw new Error('version should be a number');
	}
  // convert string to number
  if (encoding && typeof encoding == 'string') {
    encoding = encodings[encoding.toUpperCase()] || -1; // fallback to -1 so it throws invalid encoding below
  }
  if (encoding && !(encoding == encodings.BECH32 || encoding == encodings.BECH32M)) {
    throw new Error('Invalid encoding specified');
  }
  
  let b32Variety = encoding == encodings.BECH32M ? bech32.bech32m : bech32.bech32;
  let words = b32Variety.toWords(data);

  words.unshift(version);
	return b32Variety.encode(prefix, words);
}

const encodings = {
  BECH32: 1,
  BECH32M: 2
}

module.exports = { decode: decode, encode: encode, encodings };
