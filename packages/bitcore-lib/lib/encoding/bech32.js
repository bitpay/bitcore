'use strict';

var bech32 = require('bech32');

var decode = function(str) {
  if (typeof str !== 'string') {
    throw new Error('Input should be a string');
  }
  var decoded = bech32.decode(str);
  return {
    prefix: decoded.prefix,
    data: Buffer.from(bech32.fromWords(decoded.words.slice(1))),
    version: decoded.words[0]
  };
};

module.exports = { decode: decode };
