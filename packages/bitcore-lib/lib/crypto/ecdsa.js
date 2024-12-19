'use strict';

const BN = require('./bn');
const Point = require('./point');
const Signature = require('./signature');
const PublicKey = require('../publickey');
const Random = require('./random');
const Hash = require('./hash');
const BufferUtil = require('../util/buffer');
const $ = require('../util/preconditions');


/**
 * Attach the recovery factor i to an ECDSA signature.
 * @param {Buffer} hashbuf
 * @param {Signature} sig
 * @param {PulicKey} pubkey
 * @returns {Signature}
 */
const calci = function(hashbuf, sig, pubkey) {
  for (var i = 0; i < 4; i++) {
    var Qprime;
    try {
      Qprime = getPublicKey(hashbuf, sig, i);
    } catch (e) {
      console.error(e);
      continue;
    }

    if (Qprime.point.eq(pubkey.point)) {
      sig.i = i;
      sig.compressed = pubkey.compressed;
      return sig;
    }
  }

  throw new Error('Unable to find valid recovery factor');
};

/**
 * Information about public key recovery:
 * https://bitcointalk.org/index.php?topic=6430.0
 * http://stackoverflow.com/questions/19665491/how-do-i-get-an-ecdsa-public-key-from-just-a-bitcoin-signature-sec1-4-1-6-k 
 * @param {Buffer} hashbuf
 * @param {Signature} sig
 * @param {Number} i
 * @returns {PublicKey}
 */
const getPublicKey = function(hashbuf, sig, i) {
  /* jshint maxstatements: 25 */
  $.checkArgument(i === 0 || i === 1 || i === 2 || i === 3, new Error('i must be equal to 0, 1, 2, or 3'));

  var e = BN.fromBuffer(hashbuf);
  var r = sig.r;
  var s = sig.s;

  // A set LSB signifies that the y-coordinate is odd
  var isYOdd = i & 1;

  // The more significant bit specifies whether we should use the
  // first or second candidate key.
  var isSecondKey = i >> 1;

  var n = Point.getN();
  var G = Point.getG();

  // 1.1 Let x = r + jn
  var x = isSecondKey ? r.add(n) : r;
  var R = Point.fromX(isYOdd, x);

  // 1.4 Check that nR is at infinity
  var nR = R.mul(n);

  if (!nR.isInfinity()) {
    throw new Error('nR is not a valid curve point');
  }

  // Compute -e from e
  var eNeg = e.neg().umod(n);

  // 1.6.1 Compute Q = r^-1 (sR - eG)
  // Q = r^-1 (sR + -eG)
  var rInv = r.invm(n);

  //var Q = R.multiplyTwo(s, G, eNeg).mul(rInv);
  var Q = R.mul(s).add(G.mul(eNeg)).mul(rInv);

  var pubkey = PublicKey.fromPoint(Q, sig.compressed);

  return pubkey;
};


/**
 * Recover a public key from a signature.
 * @param {Buffer} hashbuf
 * @param {Signature} sig Signature with the recovery factor i.
 * @returns {PublicKey}
 */
const recoverPublicKey = function(hashbuf, sig) {
  return getPublicKey(hashbuf, sig, sig.i);
};


/**
 * Generate a random k
 * @returns {BN}
 */
const getRandomK = function() {
  var N = Point.getN();
  var k;
  do {
    k = BN.fromBuffer(Random.getRandomBuffer(32));
  } while (!(k.lt(N) && k.gt(BN.Zero)));
  return k;
};


/**
 * Generate a deterministic k
 * REF: https://tools.ietf.org/html/rfc6979#section-3.2
 * @param {Buffer} hashbuf
 * @param {PrivateKey} privkey
 * @param {Number} badrs Increment until a valid k is found
 * @returns {BN}
 */
const getDeterministicK = function(hashbuf, privkey, badrs) {
  /* jshint maxstatements: 25 */
  // if r or s were invalid when this function was used in signing,
  // we do not want to actually compute r, s here for efficiency, so,
  // we can increment badrs. explained at end of RFC 6979 section 3.2
  if (!badrs) {
    badrs = 0;
  }
  var v = Buffer.alloc(32);
  v.fill(0x01);
  var k = Buffer.alloc(32);
  k.fill(0x00);
  var x = privkey.bn.toBuffer({
    size: 32
  });
  k = Hash.sha256hmac(Buffer.concat([v, Buffer.from([0x00]), x, hashbuf]), k);
  v = Hash.sha256hmac(v, k);
  k = Hash.sha256hmac(Buffer.concat([v, Buffer.from([0x01]), x, hashbuf]), k);
  // double hash v
  v = Hash.sha256hmac(v, k);
  v = Hash.sha256hmac(v, k);
  var T = BN.fromBuffer(v);
  var N = Point.getN();

  // also explained in 3.2, we must ensure T is in the proper range (0, N)
  for (var i = 0; i < badrs || !(T.lt(N) && T.gt(BN.Zero)); i++) {
    k = Hash.sha256hmac(Buffer.concat([v, Buffer.from([0x00])]), k);
    // double hash v
    v = Hash.sha256hmac(v, k);
    v = Hash.sha256hmac(v, k);
    T = BN.fromBuffer(v);
  }

  return T;
};


/**
 * Convert s to a low s
 * see BIP 62, "low S values in signatures"
 * @param {BN} s
 * @returns {BN}
 */
const toLowS = function(s) {
  if (s.gt(new BN('7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0', 'hex'))) {
    s = Point.getN().sub(s);
  }
  return s;
};


/**
 * Sign a hash with a private key.
 * @param {Buffer|Uint8Array} hashbuf
 * @param {PrivateKey} privkey
 * @param {Object|undefined} opts An object of optional parameters
 * @param {String} opts.endian 'big' or 'little' (default: big)
 * @param {Boolean} opts.randomK Use a random value for k - produces a non-deterministic signature (default: false)
 * @returns {Signature}
 */
const sign = function(hashbuf, privkey, opts) {
  const { endian = 'big', randomK = false } = opts || {};
  $.checkState(BufferUtil.isBuffer(hashbuf) && hashbuf.length === 32, 'hashbuf must be a 32 byte buffer');
  $.checkState(privkey && privkey.bn, 'privkey must be a PrivateKey');
  
  var d = privkey.bn;
  hashbuf = Buffer.from(hashbuf);
  if (endian === 'little') {
    hashbuf.reverse();
  }

  var e = BN.fromBuffer(hashbuf);
  var N = Point.getN();
  var G = Point.getG();
  // try different values of k until r, s are valid
  var badrs = 0;
  var k, Q, r, s;
  do {
    k = randomK ? getRandomK() : getDeterministicK(hashbuf, privkey, badrs);
    badrs++;
    Q = G.mul(k);
    r = Q.x.umod(N);
    s = k.invm(N).mul(e.add(d.mul(r))).umod(N);
  } while (r.cmp(BN.Zero) <= 0 || s.cmp(BN.Zero) <= 0);

  s = toLowS(s);

  return new Signature({
    s,
    r,
    compressed: privkey.publicKey.compressed
  });
};


/**
 * Get signature verification error string
 * @param {Buffer} hashbuf
 * @param {Signature} sig
 * @param {PublicKey} pubkey
 * @param {Object|undefined} opts An object of optional parameters
 * @param {String} opts.endian 'big' or 'little' (default: big)
 * @returns {String|undefined} Returns an error string, or undefined if there is no error
 */
const verificationError = function(hashbuf, sig, pubkey, opts) {
  const { endian = 'big' } = opts || {};

  if (!BufferUtil.isBuffer(hashbuf) || hashbuf.length !== 32) {
    return 'hashbuf must be a 32 byte buffer';
  }

  var r = sig.r;
  var s = sig.s;
  if (!(r.gt(BN.Zero) && r.lt(Point.getN())) || !(s.gt(BN.Zero) && s.lt(Point.getN()))) {
    return 'r and s not in range';
  }

  var e = BN.fromBuffer(hashbuf, { endian });
  var n = Point.getN();
  var sinv = s.invm(n);
  var u1 = sinv.mul(e).umod(n);
  var u2 = sinv.mul(r).umod(n);

  var p = Point.getG().mulAdd(u1, pubkey.point, u2);
  if (p.isInfinity()) {
    return 'p is infinity';
  }

  if (p.getX().umod(n).cmp(r) !== 0) {
    return 'Invalid signature';
  }

  return; // no error
};


/**
 * Verify a signature
 * @param {Buffer} hashbuf
 * @param {Signature} sig
 * @param {PublicKey} pubkey
 * @param {Object|undefined} opts An object of optional parameters
 * @param {String} opts.endian 'big' or 'little' (default: big)
 * @returns {Boolean}
 */
const verify = function(hashbuf, sig, pubkey, opts) {
  if (!pubkey) {
    throw new Error('pubkey required for signature verification');
  }
  pubkey = new PublicKey(pubkey);
  
  if (!sig) {
    throw new Error('signature required for verification');
  }
  sig = new Signature(sig);

  return !verificationError(hashbuf, sig, pubkey, opts);
};

module.exports = {
  sign,
  verify,
  verificationError,
 
  // pubkey recovery methods
  calci,
  recoverPublicKey,
};

module.exports.__testing__ = {
  getDeterministicK,
  getPublicKey,
  getRandomK,
  toLowS,
};

