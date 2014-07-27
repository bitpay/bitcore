var crypto = require('crypto');
var bignum = require('bignum');
var Binary = require('binary');
var Put = require('bufferput');
var buffertools = require('buffertools');
var sjcl = require('../lib/sjcl');
if (process.browser) {
  var hashjs = require('hash.js');
}

var sha256 = exports.sha256 = function(data) {
  return new Buffer(crypto.createHash('sha256').update(data).digest('binary'), 'binary');
};

var sha512 = exports.sha512 = function(data) {
  if (process.browser) {
    var datahex = data.toString('hex');
    var databits = sjcl.codec.hex.toBits(datahex);
    var hashbits = sjcl.hash.sha512.hash(databits);
    var hashhex = sjcl.codec.hex.fromBits(hashbits);
    var hash = new Buffer(hashhex, 'hex');
    return hash;
  };
  return new Buffer(crypto.createHash('sha512').update(data).digest('binary'), 'binary');
};

var sha512hmac = exports.sha512hmac = function(data, key) {
  if (process.browser) {
    var skey = sjcl.codec.hex.toBits(key.toString('hex'));
    var sdata = sjcl.codec.hex.toBits(data.toString('hex'));
    var hmac = new sjcl.misc.hmac(skey, sjcl.hash.sha512);
    var encrypted = hmac.encrypt(sdata);
    var enchex = sjcl.codec.hex.fromBits(encrypted);
    var encbuf = new Buffer(enchex, 'hex');
    return encbuf;
  };
  var hmac = crypto.createHmac('sha512', key);
  var hash = hmac.update(data).digest();
  return hash;
};

var ripe160 = exports.ripe160 = function(data) {
  if (process.browser) {
    return new Buffer(hashjs.ripemd160().update(data).digest());
  }
  return new Buffer(crypto.createHash('rmd160').update(data).digest('binary'), 'binary');
};

var sha1 = exports.sha1 = function(data) {
  return new Buffer(crypto.createHash('sha1').update(data).digest('binary'), 'binary');
};

var twoSha256 = exports.twoSha256 = function(data) {
  return sha256(sha256(data));
};

var sha256ripe160 = exports.sha256ripe160 = function(data) {
  return ripe160(sha256(data));
};

/**
 * Format a block hash like the official client does.
 */
var formatHash = exports.formatHash = function(hash) {
  var hashEnd = new Buffer(10);
  hash.copy(hashEnd, 0, 22, 32);
  return buffertools.reverse(hashEnd).toString('hex');
};

/**
 * Display the whole hash, as hex, in correct endian order.
 */
var formatHashFull = exports.formatHashFull = function(hash) {
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
var formatHashAlt = exports.formatHashAlt = function(hash) {
  var hex = formatHashFull(hash);
  hex = hex.replace(/^0*/, '');
  return hex.substr(0, 10);
};

var formatBuffer = exports.formatBuffer = function(buffer, maxLen) {
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

var valueToBigInt = exports.valueToBigInt = function(valueBuffer) {
  if (Buffer.isBuffer(valueBuffer)) {
    return bignum.fromBuffer(valueBuffer, {
      endian: 'little',
      size: 8
    });
  } else {
    return valueBuffer;
  }
};

var bigIntToValue = exports.bigIntToValue = function(valueBigInt) {
  if (Buffer.isBuffer(valueBigInt)) {
    return valueBigInt;
  } else {
    return valueBigInt.toBuffer({
      endian: 'little',
      size: 8
    });
  }
};

var fitsInNBits = function(integer, n) {
  // TODO: make this efficient!!!
  return integer.toString(2).replace('-', '').length < n;
};
exports.bytesNeededToStore = bytesNeededToStore = function(integer) {
  if (integer === 0) return 0;
  return Math.ceil(((integer).toString(2).replace('-', '').length + 1) / 8);
};

exports.negativeBuffer = negativeBuffer = function(b) {
  // implement two-complement negative
  var c = new Buffer(b.length);
  // negate each byte
  for (var i = 0; i < b.length; i++) {
    c[i] = ~b[i];
    if (c[i] < 0) c[i] += 256;
  }
  // add one
  for (var i = b.length - 1; i >= 0; i--) {
    c[i] += 1;
    if (c[i] >= 256) c[i] -= 256;
    if (c[i] !== 0) break;
  }
  return c;
};

/*
 * Transforms an integer into a buffer using two-complement encoding
 * For example, 1 is encoded as 01 and -1 is encoded as ff
 * For more info see:
 * http://en.wikipedia.org/wiki/Signed_number_representations#Two.27s_complement
 */
exports.intToBuffer2C = function(integer) {
  var size = bytesNeededToStore(integer);
  var buf = new Put();
  var s = integer.toString(16);
  var neg = s[0] === '-';
  s = s.replace('-', '');
  for (var i = 0; i < size; i++) {
    var si = s.substring(s.length - 2 * (i + 1), s.length - 2 * (i));
    if (si.length === 1) {
      si = '0' + si;
    }
    var pi = parseInt(si, 16);
    buf.word8(pi);
  }
  var ret = buf.buffer();
  if (neg) {
    ret = buffertools.reverse(ret);
    ret = negativeBuffer(ret);
    ret = buffertools.reverse(ret);
  }
  return ret;
};


var padSign = function(b) {
  var c;
  if (b[0] & 0x80) {
    c = new Buffer(b.length + 1);
    b.copy(c, 1);
    c[0] = 0;
  } else {
    c = b;
  }
  return c;
}


/*
 * Transforms an integer into a buffer using sign+magnitude encoding
 * For example, 1 is encoded as 01 and -1 is encoded as 81
 * For more info see:
 * http://en.wikipedia.org/wiki/Signed_number_representations#Signed_magnitude_representation
 */
exports.intToBufferSM = function(v) {
  if ("number" === typeof v) {
    v = bignum(v);
  }
  var b, c;
  var cmp = v.cmp(0);
  if (cmp > 0) {
    b = v.toBuffer();
    c = padSign(b);
    c = buffertools.reverse(c);
  } else if (cmp == 0) {
    c = new Buffer([]);
  } else {
    b = v.neg().toBuffer();
    c = padSign(b);
    c[0] |= 0x80;
    c = buffertools.reverse(c);
  }
  return c;
};

/*
 * Reverse of intToBufferSM
 */
exports.bufferSMToInt = function(v) {
  if (!v.length) {
    return bignum(0);
  }
  // Arithmetic operands must be in range [-2^31...2^31]
  if (v.length > 4) {
    throw new Error('Bigint cast overflow (> 4 bytes)');
  }

  var w = new Buffer(v.length);
  v.copy(w);
  w = buffertools.reverse(w);
  var isNeg = w[0] & 0x80;
  if (isNeg) {
    w[0] &= 0x7f;
    return bignum.fromBuffer(w).neg();
  } else {
    return bignum.fromBuffer(w);
  }
};



var formatValue = exports.formatValue = function(valueBuffer) {
  var value = valueToBigInt(valueBuffer).toString();
  var integerPart = value.length > 8 ? value.substr(0, value.length - 8) : '0';
  var decimalPart = value.length > 8 ? value.substr(value.length - 8) : value;
  while (decimalPart.length < 8) {
    decimalPart = "0" + decimalPart;
  }
  decimalPart = decimalPart.replace(/0*$/, '');
  while (decimalPart.length < 2) {
    decimalPart += "0";
  }
  return integerPart + "." + decimalPart;
};

var reFullVal = /^\s*(\d+)\.(\d+)/;
var reFracVal = /^\s*\.(\d+)/;
var reWholeVal = /^\s*(\d+)/;

function padFrac(frac) {
  frac = frac.substr(0, 8); //truncate to 8 decimal places
  while (frac.length < 8)
    frac = frac + '0';
  return frac;
}

function parseFullValue(res) {
  return bignum(res[1]).mul('100000000').add(padFrac(res[2]));
}

function parseFracValue(res) {
  return bignum(padFrac(res[1]));
}

function parseWholeValue(res) {
  return bignum(res[1]).mul('100000000');
}

exports.parseValue = function parseValue(valueStr) {
  if (typeof valueStr !== 'string')
    valueStr = valueStr.toString();

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
var createSynchrotron = exports.createSynchrotron = function(fn) {
  var table = {};
  return function(key) {
    var args = Array.prototype.slice.call(arguments);
    var run = function() {
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
 * Decode difficulty bits.
 *
 * This function calculates the difficulty target given the difficulty bits.
 */
var decodeDiffBits = exports.decodeDiffBits = function(diffBits, asBigInt) {
  diffBits = +diffBits;

  var target = bignum(diffBits & 0xffffff);
  /*
   * shiftLeft is not implemented on the bignum browser
   *
   * target = target.shiftLeft(8*((diffBits >>> 24) - 3));
   */

  var mov = 8 * ((diffBits >>> 24) - 3);
  while (mov-- > 0)
    target = target.mul(2);

  if (asBigInt) {
    return target;
  }

  // Convert to buffer
  var diffBuf = target.toBuffer();
  var targetBuf = new Buffer(32);
  buffertools.fill(targetBuf, 0);
  diffBuf.copy(targetBuf, 32 - diffBuf.length);
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
  if (size >= 2) compact |= mpiBuf[5] << 8;
  if (size >= 3) compact |= mpiBuf[6];

  return compact;
};

/**
 * Calculate "difficulty".
 *
 * This function calculates the maximum difficulty target divided by the given
 * difficulty target.
 */
var calcDifficulty = exports.calcDifficulty = function(target) {
  if (!Buffer.isBuffer(target)) {
    target = decodeDiffBits(target);
  }
  var targetBigint = bignum.fromBuffer(target, {
    order: 'forward'
  });
  var maxBigint = bignum.fromBuffer(MAX_TARGET, {
    order: 'forward'
  });
  return maxBigint.div(targetBigint).toNumber();
};

var reverseBytes32 = exports.reverseBytes32 = function(data) {
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

  if (i < 253) {
    // unsigned char
    return 1;
  } else if (i < 0x10000) {
    // unsigned short (LE)
    return 3;
  } else if (i < 0x100000000) {
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
    buf = new Buffer(1 + 8);
    buf.writeUInt8(255, 0);
    buf.writeInt32LE(n & -1, 1);
    buf.writeUInt32LE(Math.floor(n / 0x100000000), 5);
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
exports.BIT = 100;

var MAX_TARGET = exports.MAX_TARGET = new Buffer('00000000FFFF0000000000000000000000000000000000000000000000000000', 'hex');
