'use strict';

const BufferUtil = require('../util/buffer');
const JSUtil = require('../util/js');
const $ = require('../util/preconditions');
const BN = require('./bn');

/** Whether the byte's high bit is set (DER integer sign bit). */
function isDerByteMsbSet(byte) {
  // eslint-disable-next-line no-bitwise
  return (byte & 0x80) !== 0;
}

const Signature = function Signature(r, s, isSchnorr) {
  if (!(this instanceof Signature)) {
    return new Signature(r, s, isSchnorr);
  }
  if (r instanceof BN) {
    this.set({
      r: r,
      s: s,
      isSchnorr: isSchnorr
    });
  } else if (r) {
    const obj = r;
    this.set(obj);
  }
};

/* jshint maxcomplexity: 7 */
Signature.prototype.set = function(obj) {
  this.r = obj.r || this.r || undefined;
  this.s = obj.s || this.s || undefined;

  // public key recovery parameter in range [0, 3]
  this.i = typeof obj.i === 'undefined' ? this.i : obj.i;
  // whether the recovered pubkey is compressed
  this.compressed = typeof obj.compressed === 'undefined' ? this.compressed : obj.compressed;
  this.isSchnorr = typeof obj.isSchnorr === 'undefined' ? this.isSchnorr : obj.isSchnorr;
  this.nhashtype = obj.nhashtype || this.nhashtype || undefined;
  return this;
};

Signature.fromCompact = function(buf) {
  $.checkArgument(BufferUtil.isBuffer(buf), 'Argument is expected to be a Buffer');

  const sig = new Signature();

  let compressed = true;
  let i = buf.slice(0, 1)[0] - 27 - 4;
  if (i < 0) {
    compressed = false;
    i = i + 4;
  }

  const b2 = buf.slice(1, 33);
  const b3 = buf.slice(33, 65);

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
  const sig = new Signature();

  // Schnorr Signatures use 65 byte for in tx r [len] 32 , s [len] 32, nhashtype
  // NOTE: this check is not very reliable. You should use .fromSchnorr directly if you know it's a schnorr sig.
  if ((buf.length === 64 || buf.length === 65) && buf[0] != 0x30) {
    return Signature.fromSchnorr(buf);
  }
  
  $.checkArgument(!(buf.length === 64 && buf[0] === 0x30), new Error('64 DER (ecdsa) signatures not allowed'));
  
  const obj = Signature.parseDER(buf, strict);

  sig.r = obj.r;
  sig.s = obj.s;

  return sig;
};

// The format used in a tx
Signature.fromTxFormat = function(buf) {
  const nhashtype = buf.readUInt8(buf.length - 1);
  const derbuf = buf.slice(0, buf.length - 1);
  const sig = new Signature.fromDER(derbuf, false);
  sig.nhashtype = nhashtype;
  return sig;
};

Signature.fromString = function(str) {
  const buf = Buffer.from(str, 'hex');
  return Signature.fromDER(buf);
};


/**
 * In order to mimic the non-strict DER encoding of OpenSSL, set strict = false.
 */
Signature.parseDER = function(buf, strict) {
  $.checkArgument(BufferUtil.isBuffer(buf), new Error('DER formatted signature should be a buffer'));
  if (strict == null) {
    strict = true;
  }

  const header = buf[0];
  $.checkArgument(header === 0x30, new Error('Header byte should be 0x30'));

  let length = buf[1];
  const buflength = buf.slice(2).length;
  $.checkArgument(!strict || length === buflength, new Error('Length byte should length of what follows'));

  length = length < buflength ? length : buflength;

  const rheader = buf[2 + 0];
  $.checkArgument(rheader === 0x02, new Error('Integer byte for r should be 0x02'));

  const rlength = buf[2 + 1];
  const rbuf = buf.slice(2 + 2, 2 + 2 + rlength);
  const r = BN.fromBuffer(rbuf);
  const rneg = buf[2 + 1 + 1] === 0x00 ? true : false;
  $.checkArgument(rlength === rbuf.length, new Error('Length of r incorrect'));

  const sheader = buf[2 + 2 + rlength + 0];
  $.checkArgument(sheader === 0x02, new Error('Integer byte for s should be 0x02'));

  const slength = buf[2 + 2 + rlength + 1];
  const sbuf = buf.slice(2 + 2 + rlength + 2, 2 + 2 + rlength + 2 + slength);
  const s = BN.fromBuffer(sbuf);
  const sneg = buf[2 + 2 + rlength + 2 + 2] === 0x00 ? true : false;
  $.checkArgument(slength === sbuf.length, new Error('Length of s incorrect'));

  const sumlength = 2 + 2 + rlength + 2 + slength;
  $.checkArgument(length === sumlength - 2, new Error('Length of signature incorrect'));

  const obj = {
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

  let val = i + 27 + 4;
  if (compressed === false) {
    val = val - 4;
  }
  const b1 = Buffer.from([val]);
  const b2 = this.r.toBuffer({
    size: 32
  });
  const b3 = this.s.toBuffer({
    size: 32
  });
  return Buffer.concat([b1, b2, b3]);
};

/**
 * Returns either a DER encoded buffer or a Schnorr encoded buffer if isSchnor == true
 */
Signature.prototype.toBuffer = Signature.prototype.toDER = function() {
  if (this.isSchnorr) {
    const hashTypeBuf = !this.nhashtype || this.nhashtype === Signature.SIGHASH_DEFAULT ? Buffer.alloc(0) : Buffer.from([this.nhashtype]);
    return Buffer.concat([this.r.toBuffer({ size: 32 }), this.s.toBuffer({ size: 32 }), hashTypeBuf]);
  }

  const rnbuf = this.r.toBuffer();
  const snbuf = this.s.toBuffer();

  const rneg = isDerByteMsbSet(rnbuf[0]);
  const sneg = isDerByteMsbSet(snbuf[0]);

  const rbuf = rneg ? Buffer.concat([Buffer.from([0x00]), rnbuf]) : rnbuf;
  const sbuf = sneg ? Buffer.concat([Buffer.from([0x00]), snbuf]) : snbuf;

  const rlength = rbuf.length;
  const slength = sbuf.length;
  const length = 2 + rlength + 2 + slength;
  const rheader = 0x02;
  const sheader = 0x02;
  const header = 0x30;

  const der = Buffer.concat([Buffer.from([header, length, rheader, rlength]), rbuf, Buffer.from([sheader, slength]), sbuf]);
  return der;
};

Signature.prototype.toString = function() {
  const buf = this.toDER();
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
  const nLenR = buf[3];
  if (5 + nLenR >= buf.length) {
    //  Non-canonical signature: S length misplaced
    return false;
  }
  const nLenS = buf[5 + nLenR];
  if ((nLenR + nLenS + 7) !== buf.length) {
    //  Non-canonical signature: R+S length mismatch
    return false;
  }

  const R = buf.slice(4);
  if (buf[4 - 2] !== 0x02) {
    //  Non-canonical signature: R value type mismatch
    return false;
  }
  if (nLenR === 0) {
    //  Non-canonical signature: R length is zero
    return false;
  }
  if (isDerByteMsbSet(R[0])) {
    //  Non-canonical signature: R value negative
    return false;
  }
  if (nLenR > 1 && (R[0] === 0x00) && !isDerByteMsbSet(R[1])) {
    //  Non-canonical signature: R value excessively padded
    return false;
  }

  const S = buf.slice(6 + nLenR);
  if (buf[6 + nLenR - 2] !== 0x02) {
    //  Non-canonical signature: S value type mismatch
    return false;
  }
  if (nLenS === 0) {
    //  Non-canonical signature: S length is zero
    return false;
  }
  if (isDerByteMsbSet(S[0])) {
    //  Non-canonical signature: S value negative
    return false;
  }
  if (nLenS > 1 && (S[0] === 0x00) && !isDerByteMsbSet(S[1])) {
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
  // eslint-disable-next-line no-bitwise
  const temp = this.nhashtype & ~Signature.SIGHASH_ANYONECANPAY;
  if (temp < Signature.SIGHASH_ALL || temp > Signature.SIGHASH_SINGLE) {
    return false;
  }
  return true;
};

Signature.prototype.toTxFormat = function() {
  const derbuf = this.toDER();
  const buf = Buffer.alloc(1);
  buf.writeUInt8(this.nhashtype, 0);
  return Buffer.concat([derbuf, buf]);
};

/**
 * Creates a Signature instance from a Schnorr sig
 * @param {Buffer} buf Schnorr signature buffer
 * @returns {Signature}
 */
Signature.fromSchnorr = function(buf) {
  $.checkArgument(Buffer.isBuffer(buf), 'Schnorr signature argument must be a buffer');
  $.checkArgument(buf.length === 64 || buf.length === 65, 'Schnorr signatures must be 64 or 65 bytes');

  const sig = new Signature();
  const r = buf.slice(0, 32);
  const s = buf.slice(32, 64);
  if (buf.length === 65) {
    sig.nhashtype = buf[buf.length - 1];
    $.checkState(sig.nhashtype !== Signature.SIGHASH_DEFAULT, new Error('invalid hashtype'));
  } else {
    sig.nhashtype = Signature.SIGHASH_DEFAULT;
  }
  sig.r = BN.fromBuffer(r);
  sig.s = BN.fromBuffer(s);
  sig.isSchnorr = true;
  return sig;
};

Signature.SIGHASH_DEFAULT = 0x00; // !< Taproot only; implied when sighash byte is missing, and equivalent to SIGHASH_ALL
Signature.SIGHASH_ALL = 0x01;
Signature.SIGHASH_NONE = 0x02;
Signature.SIGHASH_SINGLE = 0x03;
Signature.SIGHASH_ANYONECANPAY = 0x80;

Signature.SIGHASH_OUTPUT_MASK = 3;
Signature.SIGHASH_INPUT_MASK = 128; // 0x80,

Signature.Version = {};
Signature.Version.BASE = 0;
Signature.Version.WITNESS_V0 = 1;
Signature.Version.TAPROOT = 2;
Signature.Version.TAPSCRIPT = 3;

module.exports = Signature;
