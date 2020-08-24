'use strict';

var BN = require('./bn');
var _ = require('lodash');
var $ = require('../util/preconditions');
var BufferUtil = require('../util/buffer');
var JSUtil = require('../util/js');
const { sign } = require('./ecdsa');

var Signature = function Signature(r, s, isSchnorr) {
  if (!(this instanceof Signature)) {
    return new Signature(r, s, isSchnorr);
  }
  if (r instanceof BN) {
    this.set({
      r: r,
      s: s,
      isSchnorr: isSchnorr,
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
    obj.compressed : this.compressed; // whether the recovered pubkey is compressed
  this.isSchnorr = obj.isSchnorr;
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
  // Schnorr Signatures use 65 byte for in tx r [len] 32 , s [len] 32, nhashtype 
  if((buf.length === 64 || buf.length === 65) && buf[0] != 0x30) {
    let obj = Signature.parseSchnorrEncodedSig(buf);
    let sig = new Signature();
    sig.r = obj.r;
    sig.s = obj.s;
    sig.isSchnorr = true;
    return sig;
  } if (buf.length === 64 && buf[0] === 0x30) {
    return "64 DER (ecdsa) signatures not allowed";
  }
  
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


// The format used in a tx
Signature.fromDataFormat = function(buf) {
  var derbuf = buf.slice(0, buf.length);
  var sig = new Signature.fromDER(derbuf, false);
  return sig;
};


Signature.fromString = function(str) {
  var buf = Buffer.from(str, 'hex');
  
  return Signature.fromDER(buf);
};


Signature.parseSchnorrEncodedSig = function(buf) {
  let r = buf.slice(0,32);
  let s = buf.slice(32, 64);
  let hashtype;
  if (buf.length === 65) {
    hashtype = buf.slice(64,65);
    this.nhashtype = hashtype;
  }

  var obj = {
    r: BN.fromBuffer(r),
    s: BN.fromBuffer(s),
    nhashtype: hashtype
  };

  return obj;
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

Signature.prototype.toBuffer = Signature.prototype.toDER = function(signingMethod) {

  // Schnorr signatures use a 64 byte r,s format, where as ECDSA takes the form decribed
  // below, above the isDER function signature.

  signingMethod = signingMethod || "ecdsa";


  var rnbuf = this.r.toBuffer();
  var snbuf = this.s.toBuffer();

  if(signingMethod === "schnorr") {
    return Buffer.concat([rnbuf, snbuf]);
  }
  
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


Signature.isTxDER = function(buf) {
  return Signature.isDER(buf.slice(0, buf.length-1));
}

/**
 * This function is translated from bitcoind's IsDERSignature and is used in
 * the script interpreter.  This "DER" format actually includes an extra byte,
 * the nhashtype, at the end. It is really the tx format, not DER format.
 *
 * A canonical signature exists of: [30] [total len] [02] [len R] [R] [02] [len S] [S]
 * Where R and S are not negative (their first byte has its highest bit not set), and not
 * excessively padded (do not start with a 0 byte, unless an otherwise negative number follows,
 * in which case a single 0 byte is necessary and even required).
 *
 * See https://bitcointalk.org/index.php?topic=8392.msg127623#msg127623
 */
Signature.isDER = function(buf) {
  // Format: 0x30 [total-length] 0x02 [R-length] [R] 0x02 [S-length] [S]
  // * total-length: 1-byte length descriptor of everything that follows,
  // excluding the sighash byte.
  // * R-length: 1-byte length descriptor of the R value that follows.
  // * R: arbitrary-length big-endian encoded R value. It must use the
  // shortest possible encoding for a positive integers (which means no null
  // bytes at the start, except a single one when the next byte has its
  // highest bit set).
  // * S-length: 1-byte length descriptor of the S value that follows.
  // * S: arbitrary-length big-endian encoded S value. The same rules apply.

  // Minimum and maximum size constraints.
  if (buf.length < 8 || buf.length > 72) {
    return false;
  }

  //
  // Check that the signature is a compound structure of proper size.
  //

  // A signature is of type 0x30 (compound).
  if (buf[0] != 0x30) {
    return false;
  }

  // Make sure the length covers the entire signature.
  // Remove:
  // * 1 byte for the coupound type.
  // * 1 byte for the length of the signature.
  if (buf[1] != buf.length - 2) {
    return false;
  }

  //
  // Check that R is an positive integer of sensible size.
  //

  // Check whether the R element is an integer.
  if (buf[2] != 0x02) {
    return false;
  }

  // Extract the length of the R element.
  var lenR = buf[3];

  // Zero-length integers are not allowed for R.
  if (lenR == 0) {
    return false;
  }

  // Negative numbers are not allowed for R.
  if (buf[4] & 0x80) {
    return false;
  }

  // Make sure the length of the R element is consistent with the signature
  // size.
  // Remove:
  // * 1 byte for the coumpound type.
  // * 1 byte for the length of the signature.
  // * 2 bytes for the integer type of R and S.
  // * 2 bytes for the size of R and S.
  // * 1 byte for S itself.
  if (lenR > (buf.length - 7)) {
    return false;
  }

  // Null bytes at the start of R are not allowed, unless R would otherwise be
  // interpreted as a negative number.
  //
  // /!\ This check can only be performed after we checked that lenR is
  //     consistent with the size of the signature or we risk to access out of
  //     bound elements.
  if (lenR > 1 && (buf[4] == 0x00) && !(buf[5] & 0x80)) {
    return false;
  }

  //
  // Check that S is an positive integer of sensible size.
  //

  // S's definition starts after R's definition:
  // * 1 byte for the coumpound type.
  // * 1 byte for the length of the signature.
  // * 1 byte for the size of R.
  // * lenR bytes for R itself.
  // * 1 byte to get to S.
  var startS = lenR + 4;

  // Check whether the S element is an integer.
  if (buf[startS] != 0x02) {
    return false;
  }

  // Extract the length of the S element.
  var lenS = buf[startS + 1];

  // Zero-length integers are not allowed for S.
  if (lenS == 0) {
    return false;
  }

  // Negative numbers are not allowed for S.
  if (buf[startS + 2] & 0x80) {
    return false;
  }

  // Verify that the length of S is consistent with the size of the signature
  // including metadatas:
  // * 1 byte for the integer type of S.
  // * 1 byte for the size of S.
  if (startS + lenS + 2 != buf.length) {
    return false;
  }

  // Null bytes at the start of S are not allowed, unless S would otherwise be
  // interpreted as a negative number.
  //
  // /!\ This check can only be performed after we checked that lenR and lenS
  //     are consistent with the size of the signature or we risk to access
  //     out of bound elements.
  if (lenS > 1 && (buf[startS + 2] == 0x00) && !(buf[startS + 3] & 0x80)) {
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
  // base mask was 1F
  var mask =  ~(Signature.SIGHASH_FORKID | Signature.SIGHASH_ANYONECANPAY) >>>0;
  var temp = this.nhashtype  & mask;
  if (temp < Signature.SIGHASH_ALL || temp > Signature.SIGHASH_SINGLE) {
    return false;
  }
  return true;
};

Signature.prototype.toTxFormat = function(signingMethod) {
  var derbuf = this.toDER(signingMethod);
  var buf = Buffer.alloc(1);
  buf.writeUInt8(this.nhashtype, 0);
  return Buffer.concat([derbuf, buf]);
};

Signature.SIGHASH_ALL = 0x01;
Signature.SIGHASH_NONE = 0x02;
Signature.SIGHASH_SINGLE = 0x03;
Signature.SIGHASH_FORKID = 0x40;
Signature.SIGHASH_ANYONECANPAY = 0x80;

module.exports = Signature;
