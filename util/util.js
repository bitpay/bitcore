
var crypto = require('crypto');
var bignum = require('bignum');
var Binary = require('binary');
var Put = require('bufferput');
var buffertools = require('buffertools');
var bjs;
if (!process.versions) {
  // browser version
  bjs = require('../browser/bitcoinjs-lib.js');
}


var sha256 = exports.sha256 = function (data) {
  return new Buffer(crypto.createHash('sha256').update(data).digest('binary'), 'binary');
};

var ripe160 = exports.ripe160 = function (data) {
  if (!process.versions) {
    var RIPEMD160 = bjs.RIPEMD160;
    var WordArray = bjs.WordArray;
    data = data.toString();
    var result = RIPEMD160(data) + '';
    return new Buffer(result, 'hex');
  }
  return new Buffer(crypto.createHash('rmd160').update(data).digest('binary'), 'binary');
};

var sha1 = exports.sha1 = function (data) {
  return new Buffer(crypto.createHash('sha1').update(data).digest('binary'), 'binary');
};

var twoSha256 = exports.twoSha256 = function (data) {
  return sha256(sha256(data));
};

var sha256ripe160 = exports.sha256ripe160 = function (data) {
  return ripe160(sha256(data));
};

/**
 * Format a block hash like the official client does.
 */
var formatHash = exports.formatHash = function (hash) {
  var hashEnd = new Buffer(10);
  hash.copy(hashEnd, 0, 22, 32);
  return buffertools.reverse(hashEnd).toString('hex');
};

/**
 * Display the whole hash, as hex, in correct endian order.
 */
var formatHashFull = exports.formatHashFull = function (hash) {
  var copy = new Buffer(hash.length);
  hash.copy(copy);
  var hex = buffertools.toHex(buffertools.reverse(copy));
  return hex;
};

/**
 * Format a block hash like Block Explorer does.
 *
 * Formats a block hash by removing leading zeros and truncating to 10 characters.
 */
var formatHashAlt = exports.formatHashAlt = function (hash) {
  var hex = formatHashFull(hash);
  hex = hex.replace(/^0*/, '');
  return hex.substr(0, 10);
};

var formatBuffer = exports.formatBuffer = function (buffer, maxLen) {
  // Calculate amount of bytes to display
  if (maxLen === null) {
    maxLen = 10;
  }
  if (maxLen > buffer.length || maxLen === 0) {
    maxLen = buffer.length;
  }

  // Copy those bytes into a temporary buffer
  var temp = new Buffer(maxLen);
  buffer.copy(temp, 0, 0, maxLen);

  // Format as string
  var output = buffertools.toHex(temp);
  if (temp.length < buffer.length) {
    output += "...";
  }
  return output;
};

var valueToBigInt = exports.valueToBigInt = function (valueBuffer) {
  if (Buffer.isBuffer(valueBuffer)) {
    return bignum.fromBuffer(valueBuffer, {endian: 'little', size: 8});
  } else {
    return valueBuffer;
  }
};

var bigIntToValue = exports.bigIntToValue = function (valueBigInt) {
  if (Buffer.isBuffer(valueBigInt)) {
    return valueBigInt;
  } else {
    return valueBigInt.toBuffer({endian: 'little', size: 8});
  }
};

var formatValue = exports.formatValue = function (valueBuffer) {
  var value = valueToBigInt(valueBuffer).toString();
  var integerPart = value.length > 8 ? value.substr(0, value.length-8) : '0';
  var decimalPart = value.length > 8 ? value.substr(value.length-8) : value;
  while (decimalPart.length < 8) {
    decimalPart = "0"+decimalPart;
  }
  decimalPart = decimalPart.replace(/0*$/, '');
  while (decimalPart.length < 2) {
    decimalPart += "0";
  }
  return integerPart+"."+decimalPart;
};

var reFullVal = /^\s*(\d+)\.(\d+)/;
var reFracVal = /^\s*\.(\d+)/;
var reWholeVal = /^\s*(\d+)/;

function padFrac(frac)
{
  frac=frac.substr(0,8); //truncate to 8 decimal places
  while (frac.length < 8)
    frac = frac + '0';
  return frac;
}

function parseFullValue(res)
{
  return bignum(res[1]).mul('100000000').add(padFrac(res[2]));
}

function parseFracValue(res)
{
  return bignum(padFrac(res[1]));
}

function parseWholeValue(res)
{
  return bignum(res[1]).mul('100000000');
}

exports.parseValue = function parseValue(valueStr)
{
  var res = valueStr.match(reFullVal);
  if (res)
    return parseFullValue(res);

  res = valueStr.match(reFracVal);
  if (res)
    return parseFracValue(res);

  res = valueStr.match(reWholeVal);
  if (res)
    return parseWholeValue(res);

  return undefined;
};

// Utility that synchronizes function calls based on a key
var createSynchrotron = exports.createSynchrotron = function (fn) {
  var table = {};
  return function (key) {
    var args = Array.prototype.slice.call(arguments);
    var run = function () {
      // Function fn() will call when it finishes
      args[0] = function next() {
        if (table[key]) {
          if (table[key].length) {
            table[key].shift()();
          } else {
            delete table[key];
          }
        }
      };

      fn.apply(null, args);
    };

    if (!table[key]) {
      table[key] = [];
      run();
    } else {
      table[key].push(run);
    }
  };
};

/**
 * Generate a random 64-bit number.
 *
 * With ideas from node-uuid:
 * Copyright (c) 2010 Robert Kieffer
 * https://github.com/broofa/node-uuid/
 *
 * @returns Buffer random nonce
 */
var generateNonce = exports.generateNonce = function () {
  var b32 = 0x100000000, ff = 0xff;
  var b = new Buffer(8), i = 0;

  // Generate eight random bytes
  r = Math.random()*b32;
  b[i++] = r & ff;
  b[i++] = (r=r>>>8) & ff;
  b[i++] = (r=r>>>8) & ff;
  b[i++] = (r=r>>>8) & ff;
  r = Math.random()*b32;
  b[i++] = r & ff;
  b[i++] = (r=r>>>8) & ff;
  b[i++] = (r=r>>>8) & ff;
  b[i++] = (r=r>>>8) & ff;

  return b;
};

/**
 * Decode difficulty bits.
 *
 * This function calculates the difficulty target given the difficulty bits.
 */
var decodeDiffBits = exports.decodeDiffBits = function (diffBits, asBigInt) {
  diffBits = +diffBits;
  var target = bignum(diffBits & 0xffffff);
  target = target.shiftLeft(8*((diffBits >>> 24) - 3));

  if (asBigInt) {
    return target;
  }

  // Convert to buffer
  var diffBuf = target.toBuffer();
  var targetBuf = new Buffer(32);
  buffertools.fill(targetBuf, 0);
  diffBuf.copy(targetBuf, 32-diffBuf.length);
  return targetBuf;
};

/**
 * Encode difficulty bits.
 *
 * This function calculates the compact difficulty, given a difficulty target.
 */
var encodeDiffBits = exports.encodeDiffBits = function encodeDiffBits(target) {
  if (Buffer.isBuffer(target)) {
    target = bignum.fromBuffer(target);
  } else if ("function" === typeof target.toBuffer) { // duck-typing bignum
    // Nothing to do
  } else {
    throw new Error("Incorrect variable type for difficulty");
  }

  var mpiBuf = target.toBuffer("mpint");
  var size = mpiBuf.length - 4;

  var compact = size << 24;
  if (size >= 1) compact |= mpiBuf[4] << 16;
  if (size >= 2) compact |= mpiBuf[5] <<  8;
  if (size >= 3) compact |= mpiBuf[6]      ;

  return compact;
};

/**
 * Calculate "difficulty".
 *
 * This function calculates the maximum difficulty target divided by the given
 * difficulty target.
 */
var calcDifficulty = exports.calcDifficulty = function (target) {
  if (!Buffer.isBuffer(target)) {
    target = decodeDiffBits(target);
  }
  var targetBigint = bignum.fromBuffer(target, {order: 'forward'});
  var maxBigint = bignum.fromBuffer(MAX_TARGET, {order: 'forward'});
  return maxBigint.div(targetBigint).toNumber();
};

var reverseBytes32 = exports.reverseBytes32 = function (data) {
  if (data.length % 4) {
    throw new Error("Util.reverseBytes32(): Data length must be multiple of 4");
  }
  var put = new Put();
  var parser = Binary.parse(data);
  while (!parser.eof()) {
    var word = parser.word32le('word').vars.word;
    put.word32be(word);
  }
  return put.buffer();
};

var getVarIntSize = exports.getVarIntSize = function getVarIntSize(i) {

  if (i < 0xFD) {
    // unsigned char
    return 1;
  } else if (i <= 1<<16) {
    // unsigned short (LE)
    return 3;
  } else if (i <= 1<<32) {
    // unsigned int (LE)
    return 5;
  } else {
    // unsigned long long (LE)
    return 9;
  }
};

var varIntBuf = exports.varIntBuf = function varIntBuf(n) {
  var buf = undefined;
  if (n < 253) {
    buf = new Buffer(1);
    buf.writeUInt8(n, 0);
  } else if (n < 0x10000) {
    buf = new Buffer(1 + 2);
    buf.writeUInt8(253, 0);
    buf.writeUInt16LE(n, 1);
  } else if (n < 0x100000000) {
    buf = new Buffer(1 + 4);
    buf.writeUInt8(254, 0);
    buf.writeUInt32LE(n, 1);
  } else {
    throw new Error("quadword not supported");
  }

  return buf;
};

var varStrBuf = exports.varStrBuf = function varStrBuf(s) {
  return Buffer.concat([varIntBuf(s.length), s]);
};

// Initializations
exports.NULL_HASH = buffertools.fill(new Buffer(32), 0);
exports.EMPTY_BUFFER = new Buffer(0);
exports.ZERO_VALUE = buffertools.fill(new Buffer(8), 0);
var INT64_MAX = new Buffer('ffffffffffffffff', 'hex');
exports.INT64_MAX = INT64_MAX;

// How much of Bitcoin's internal integer coin representation
// makes 1 BTC
exports.COIN = 100000000;

exports.MAX_TARGET = new Buffer('00000000FFFF0000000000000000000000000000000000000000000000000000', 'hex');
