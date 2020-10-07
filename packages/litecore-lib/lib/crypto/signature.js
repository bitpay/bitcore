'use strict';

var BN = require('./bn');
var _ = require('lodash');
var $ = require('../util/preconditions');
var BufferUtil = require('../util/buffer');
var JSUtil = require('../util/js');

var Signature = function Signature(r, s) {
  if (!(this instanceof Signature)) {
    return new Signature(r, s);
  }
  if (r instanceof BN) {
    this.set({
      r: r,
      s: s
    });
  } else if (r) {
    var obj = r;
    this.set(obj);
  }
};

/* jshint maxcomplexity: 7 */
Signature.prototype.set = function(obj) {
  this.r = obj.r || this.r || undefined;
  this.s = obj.s || this.s || undefined;

  this.i = typeof obj.i !== 'undefined' ? obj.i : this.i; //public key recovery parameter in range [0, 3]
  this.compressed = typeof obj.compressed !== 'undefined' ?
    obj.compressed : this.compressed; //whether the recovered pubkey is compressed
  this.nhashtype = obj.nhashtype || this.nhashtype || undefined;
  return this;
};

Signature.fromCompact = function(buf) {
  $.checkArgument(BufferUtil.isBuffer(buf), 'Argument is expected to be a Buffer');

  var sig = new Signature();

  var compressed = true;
  var i = buf.slice(0, 1)[0] - 27 - 4;
  if (i < 0) {
    compressed = false;
    i = i + 4;
  }

  var b2 = buf.slice(1, 33);
  var b3 = buf.slice(33, 65);

  $.checkArgument(i === 0 || i === 1 || i === 2 || i === 3, new Error('i must be 0, 1, 2, or 3'));
  $.checkArgument(b2.length === 32, new Error('r must be 32 bytes'));
  $.checkArgument(b3.length === 32, new Error('s must be 32 bytes'));

  sig.compressed = compressed;
  sig.i = i;
  sig.r = BN.fromBuffer(b2);
  sig.s = BN.fromBuffer(b3);

  return sig;
};

Signature.fromDER = Signature.fromBuffer = function(buf, strict) {
  var obj = Signature.parseDER(buf, strict);
  var sig = new Signature();

  sig.r = obj.r;
  sig.s = obj.s;

  return sig;
};

// The format used in a tx
Signature.fromTxFormat = function(buf) {
  var nhashtype = buf.readUInt8(buf.length - 1);
  var derbuf = buf.slice(0, buf.length - 1);
  var sig = new Signature.fromDER(derbuf, false);
  sig.nhashtype = nhashtype;
  return sig;
};

Signature.fromString = function(str) {
  var buf = Buffer.from(str, 'hex');
  return Signature.fromDER(buf);
};


/**
 * In order to mimic the non-strict DER encoding of OpenSSL, set strict = false.
 */
Signature.parseDER = function(buf, strict) {
  $.checkArgument(BufferUtil.isBuffer(buf), new Error('DER formatted signature should be a buffer'));
  if (_.isUndefined(strict)) {
    strict = true;
  }

  var header = buf[0];
  $.checkArgument(header === 0x30, new Error('Header byte should be 0x30'));

  var length = buf[1];
  var buflength = buf.slice(2).length;
  $.checkArgument(!strict || length === buflength, new Error('Length byte should length of what follows'));

  length = length < buflength ? length : buflength;

  var rheader = buf[2 + 0];
  $.checkArgument(rheader === 0x02, new Error('Integer byte for r should be 0x02'));

  var rlength = buf[2 + 1];
  var rbuf = buf.slice(2 + 2, 2 + 2 + rlength);
  var r = BN.fromBuffer(rbuf);
  var rneg = buf[2 + 1 + 1] === 0x00 ? true : false;
  $.checkArgument(rlength === rbuf.length, new Error('Length of r incorrect'));

  var sheader = buf[2 + 2 + rlength + 0];
  $.checkArgument(sheader === 0x02, new Error('Integer byte for s should be 0x02'));

  var slength = buf[2 + 2 + rlength + 1];
  var sbuf = buf.slice(2 + 2 + rlength + 2, 2 + 2 + rlength + 2 + slength);
  var s = BN.fromBuffer(sbuf);
  var sneg = buf[2 + 2 + rlength + 2 + 2] === 0x00 ? true : false;
  $.checkArgument(slength === sbuf.length, new Error('Length of s incorrect'));

  var sumlength = 2 + 2 + rlength + 2 + slength;
  $.checkArgument(length === sumlength - 2, new Error('Length of signature incorrect'));

  var obj = {
    header: header,
    length: length,
    rheader: rheader,
    rlength: rlength,
    rneg: rneg,
    rbuf: rbuf,
    r: r,
    sheader: sheader,
    slength: slength,
    sneg: sneg,
    sbuf: sbuf,
    s: s
  };

  return obj;
};


Signature.prototype.toCompact = function(i, compressed) {
  i = typeof i === 'number' ? i : this.i;
  compressed = typeof compressed === 'boolean' ? compressed : this.compressed;

  if (!(i === 0 || i === 1 || i === 2 || i === 3)) {
    throw new Error('i must be equal to 0, 1, 2, or 3');
  }

  var val = i + 27 + 4;
  if (compressed === false) {
    val = val - 4;
  }
  var b1 = Buffer.from([val]);
  var b2 = this.r.toBuffer({
    size: 32
  });
  var b3 = this.s.toBuffer({
    size: 32
  });
  return Buffer.concat([b1, b2, b3]);
};

Signature.prototype.toBuffer = Signature.prototype.toDER = function() {
  var rnbuf = this.r.toBuffer();
  var snbuf = this.s.toBuffer();

  var rneg = rnbuf[0] & 0x80 ? true : false;
  var sneg = snbuf[0] & 0x80 ? true : false;

  var rbuf = rneg ? Buffer.concat([Buffer.from([0x00]), rnbuf]) : rnbuf;
  var sbuf = sneg ? Buffer.concat([Buffer.from([0x00]), snbuf]) : snbuf;

  var rlength = rbuf.length;
  var slength = sbuf.length;
  var length = 2 + rlength + 2 + slength;
  var rheader = 0x02;
  var sheader = 0x02;
  var header = 0x30;

  var der = Buffer.concat([Buffer.from([header, length, rheader, rlength]), rbuf, Buffer.from([sheader, slength]), sbuf]);
  return der;
};

Signature.prototype.toString = function() {
  var buf = this.toDER();
  return buf.toString('hex');
};

/**
 * This function is translated from bitcoind's IsDERSignature and is used in
 * the script interpreter.  This "DER" format actually includes an extra byte,
 * the nhashtype, at the end. It is really the tx format, not DER format.
 *
 * A canonical signature exists of: [30] [total len] [02] [len R] [R] [02] [len S] [S] [hashtype]
 * Where R and S are not negative (their first byte has its highest bit not set), and not
 * excessively padded (do not start with a 0 byte, unless an otherwise negative number follows,
 * in which case a single 0 byte is necessary and even required).
 *
 * See https://bitcointalk.org/index.php?topic=8392.msg127623#msg127623
 */
Signature.isTxDER = function(buf) {
  if (buf.length < 9) {
    //  Non-canonical signature: too short
    return false;
  }
  if (buf.length > 73) {
    // Non-canonical signature: too long
    return false;
  }
  if (buf[0] !== 0x30) {
    //  Non-canonical signature: wrong type
    return false;
  }
  if (buf[1] !== buf.length - 3) {
    //  Non-canonical signature: wrong length marker
    return false;
  }
  var nLenR = buf[3];
  if (5 + nLenR >= buf.length) {
    //  Non-canonical signature: S length misplaced
    return false;
  }
  var nLenS = buf[5 + nLenR];
  if ((nLenR + nLenS + 7) !== buf.length) {
    //  Non-canonical signature: R+S length mismatch
    return false;
  }

  var R = buf.slice(4);
  if (buf[4 - 2] !== 0x02) {
    //  Non-canonical signature: R value type mismatch
    return false;
  }
  if (nLenR === 0) {
    //  Non-canonical signature: R length is zero
    return false;
  }
  if (R[0] & 0x80) {
    //  Non-canonical signature: R value negative
    return false;
  }
  if (nLenR > 1 && (R[0] === 0x00) && !(R[1] & 0x80)) {
    //  Non-canonical signature: R value excessively padded
    return false;
  }

  var S = buf.slice(6 + nLenR);
  if (buf[6 + nLenR - 2] !== 0x02) {
    //  Non-canonical signature: S value type mismatch
    return false;
  }
  if (nLenS === 0) {
    //  Non-canonical signature: S length is zero
    return false;
  }
  if (S[0] & 0x80) {
    //  Non-canonical signature: S value negative
    return false;
  }
  if (nLenS > 1 && (S[0] === 0x00) && !(S[1] & 0x80)) {
    //  Non-canonical signature: S value excessively padded
    return false;
  }
  return true;
};

/**
 * Compares to bitcoind's IsLowDERSignature
 * See also ECDSA signature algorithm which enforces this.
 * See also BIP 62, "low S values in signatures"
 */
Signature.prototype.hasLowS = function() {
  if (this.s.lt(new BN(1)) ||
    this.s.gt(new BN('7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0', 'hex'))) {
    return false;
  }
  return true;
};

/**
 * @returns true if the nhashtype is exactly equal to one of the standard options or combinations thereof.
 * Translated from bitcoind's IsDefinedHashtypeSignature
 */
Signature.prototype.hasDefinedHashtype = function() {
  if (!JSUtil.isNaturalNumber(this.nhashtype)) {
    return false;
  }
  // accept with or without Signature.SIGHASH_ANYONECANPAY by ignoring the bit
  var temp = this.nhashtype & ~Signature.SIGHASH_ANYONECANPAY;
  if (temp < Signature.SIGHASH_ALL || temp > Signature.SIGHASH_SINGLE) {
    return false;
  }
  return true;
};

Signature.prototype.toTxFormat = function() {
  var derbuf = this.toDER();
  var buf = Buffer.alloc(1);
  buf.writeUInt8(this.nhashtype, 0);
  return Buffer.concat([derbuf, buf]);
};

Signature.SIGHASH_ALL = 0x01;
Signature.SIGHASH_NONE = 0x02;
Signature.SIGHASH_SINGLE = 0x03;
Signature.SIGHASH_ANYONECANPAY = 0x80;

module.exports = Signature;
