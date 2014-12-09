'use strict';

var _BN = require('bn.js');

var BN = function BN(n, base) {
  if (!(this instanceof BN)) {
    return new BN(n, base);
  }
  _BN.apply(this, arguments);
};

BN.prototype = _BN.prototype;

var reversebuf = function(buf) {
  var buf2 = new Buffer(buf.length);
  for (var i = 0; i < buf.length; i++) {
    buf2[i] = buf[buf.length-1-i];
  }
  return buf2;
};

BN.prototype.toJSON = function() {
  return this.toString();
};

BN.prototype.fromJSON = function(str) {
  var bn = BN(str);
  bn.copy(this);
  return this;
};

BN.prototype.fromNumber = function(n) {
  var bn = BN(n);
  bn.copy(this);
  return this;
};

BN.prototype.toNumber = function() {
  return parseInt(this['toString'](10), 10);
};

BN.prototype.fromString = function(str) {
  var bn = BN(str);
  bn.copy(this);
  return this;
};

BN.fromBuffer = function(buf, opts) {
  if (typeof opts !== 'undefined' && opts.endian === 'little') {
    buf = reversebuf(buf);
  }
  var hex = buf.toString('hex');
  var bn = new BN(hex, 16);
  return bn;
};

BN.prototype.fromBuffer = function(buf, opts) {
  var bn = BN.fromBuffer(buf, opts);
  bn.copy(this);

  return this;
};

BN.prototype.toBuffer = function(opts) {
  var buf;
  if (opts && opts.size) {
    var hex = this.toString(16, 2);
    var natlen = hex.length/2;
    buf = new Buffer(hex, 'hex');

    if (natlen == opts.size)
      buf = buf;

    else if (natlen > opts.size) {
      buf = buf.slice(natlen - buf.length, buf.length);
    }

    else if (natlen < opts.size) {
      var rbuf = new Buffer(opts.size);
      for (var i = 0; i < buf.length; i++)
        rbuf[rbuf.length-1-i] = buf[buf.length-1-i];
      for (var i = 0; i < opts.size - natlen; i++)
        rbuf[i] = 0;
      buf = rbuf;
    }
  }
  else {
    var hex = this.toString(16, 2);
    buf = new Buffer(hex, 'hex');
  }

  if (typeof opts !== 'undefined' && opts.endian === 'little') {
    buf = reversebuf(buf);
  }

  return buf;
};

// signed magnitude buffer
// most significant bit represents sign (0 = positive, -1 = negative)
BN.prototype.fromSM = function(buf, opts) {
  if (buf.length === 0)
    this.fromBuffer(new Buffer([0]));

  var endian = 'big';
  if (opts)
    endian = opts.endian;

  if (endian == 'little')
    buf = reversebuf(buf);

  if (buf[0] & 0x80) {
    buf[0] = buf[0] & 0x7f;
    this.fromBuffer(buf);
    this.neg().copy(this);
  } else {
    this.fromBuffer(buf);
  }
  return this;
};

BN.prototype.toSM = function(opts) {
  var endian = 'big';
  if (opts)
    endian = opts.endian;

  var buf;
  if (this.cmp(0) == -1) {
    buf = this.neg().toBuffer();
    if (buf[0] & 0x80)
      buf = Buffer.concat([new Buffer([0x80]), buf]);
    else
      buf[0] = buf[0] | 0x80;
  } else {
    buf = this.toBuffer();
    if (buf[0] & 0x80)
      buf = Buffer.concat([new Buffer([0x00]), buf]);
  }

  if (buf.length === 1 & buf[0] === 0)
    buf = new Buffer([]);

  if (endian == 'little')
    buf = reversebuf(buf);

  return buf;
};

// This is analogous to the constructor for CScriptNum in bitcoind. Many ops in
// bitcoind's script interpreter use CScriptNum, which is not really a proper
// bignum. Instead, an error is thrown if trying to input a number bigger than
// 4 bytes. We copy that behavior here.
BN.prototype.fromCScriptNumBuffer = function(buf, fRequireMinimal) {
  var nMaxNumSize = 4;
  if (buf.length > nMaxNumSize)
    throw new Error('script number overflow');
  if (fRequireMinimal && buf.length > 0) {
    // Check that the number is encoded with the minimum possible
    // number of bytes.
    //
    // If the most-significant-byte - excluding the sign bit - is zero
    // then we're not minimal. Note how this test also rejects the
    // negative-zero encoding, 0x80.
    if ((buf[buf.length - 1] & 0x7f) === 0) {
      // One exception: if there's more than one byte and the most
      // significant bit of the second-most-significant-byte is set
      // it would conflict with the sign bit. An example of this case
      // is +-255, which encode to 0xff00 and 0xff80 respectively.
      // (big-endian).
      if (buf.length <= 1 || (buf[buf.length - 2] & 0x80) === 0) {
        throw new Error("non-minimally encoded script number");
      }
    }
  }
  return this.fromSM(buf, {endian: 'little'});
};

// The corollary to the above, with the notable exception that we do not throw
// an error if the output is larger than four bytes. (Which can happen if
// performing a numerical operation that results in an overflow to more than 4
// bytes).
BN.prototype.toCScriptNumBuffer = function(buf) {
  return this.toSM({endian: 'little'});
};

function decorate(name) {
  BN.prototype['_' + name] = BN.prototype[name];
  var f = function(b) {
    if (typeof b === 'string')
      b = new BN(b);
    else if (typeof b === 'number')
      b = new BN(b.toString());
    return this['_' + name](b);
  };
  BN.prototype[name] = f;
};

BN.prototype.gt = function(b) {
  return this.cmp(b) > 0;
};

BN.prototype.lt = function(b) {
  return this.cmp(b) < 0;
};

decorate('add');
decorate('sub');
decorate('mul');
decorate('mod');
decorate('div');
decorate('cmp');
decorate('gt');
decorate('lt');

module.exports = BN;
