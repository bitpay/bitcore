const crypto = require('crypto');
const $ = require('../util/preconditions');
const JS = require('../util/js');
const BN = require('./bn');
const Point = require('./point');
const TaggedHash = require('./taggedhash');

const Schnorr = function Schnorr() {
  if (!(this instanceof Schnorr)) {
    return new Schnorr();
  }
  return this;
};

Schnorr.prototype.set = function() {};

/**
 * Create a schnorr signature
 * @param {PrivateKey|Buffer|BN} privateKey
 * @param {String|Buffer} message Hex string or buffer
 * @param {String|Buffer} aux Hex string or buffer
 * @returns {Buffer}
 * @link https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki#Default_Signing
 */
Schnorr.sign = function(privateKey, message, aux) {
  privateKey = Buffer.isBuffer(privateKey) ? privateKey : privateKey.toBuffer();
  if (privateKey.length !== 32) {
    throw new Error('Private key should be 32 bytes for schnorr signatures');
  }

  if (typeof message === 'string') {
    $.checkArgument(JS.isHexaString(message), 'Schnorr message string is not hex');
    message = Buffer.from(message, 'hex')
  }
  $.checkArgument($.isType(message, 'Buffer'), 'Schnorr message must be a hex string or buffer');

  if (!aux) {
    aux = crypto.randomBytes(32);
  }
  if (typeof aux === 'string') {
    $.checkArgument(JS.isHexaString(aux), 'Schnorr aux string is not hex');
    aux = Buffer.from(aux, 'hex')
  }
  $.checkArgument($.isType(aux, 'Buffer'), 'Schnorr aux must be a hex string or buffer');

  const G = Point.getG();
  const n = Point.getN();

  const dPrime = new BN(privateKey);
  if (dPrime.eqn(0) || dPrime.gte(n)) {
    throw new Error('Invalid private key for schnorr signing');
  }
  const P = G.mul(dPrime);
  const Pbuf = Buffer.from(P.encodeCompressed().slice(1)); // slice(1) removes the encoding prefix byte
  const d = P.y.isEven() ? dPrime : n.sub(dPrime);
  const t = d.xor(new BN(new TaggedHash('BIP0340/aux', aux).finalize()));
  const rand = new TaggedHash('BIP0340/nonce', Buffer.concat([t.toBuffer(), Pbuf, message])).finalize();
  const kPrime = new BN(rand).mod(n);
  if (kPrime.eqn(0)) {
    throw new Error('Error creating schnorr signature');
  }
  const R = G.mul(kPrime);
  const Rbuf = Buffer.from(R.encodeCompressed().slice(1)); // slice(1) removes the encoding prefix byte
  const k = R.y.isEven() ? kPrime : n.sub(kPrime);
  const e = new BN(new TaggedHash('BIP0340/challenge', Buffer.concat([Rbuf, Pbuf, message])).finalize()).mod(n);
  const sig = Buffer.concat([Rbuf, k.add(e.mul(d)).mod(n).toBuffer({ size: 32 })]);

  if (!Schnorr.verify(Pbuf, message, sig)) {
    throw new Error('Error creating schnorr signature. Verification failed');
  }
  return sig;
};


/**
 * Verify a schnorr signature
 * @param {PublicKey|Buffer} publicKey
 * @param {String|Buffer} message Hex string or buffer
 * @param {String|Signature|Buffer} signature Hex string, Signature instance, or buffer
 * @returns {Boolean}
 * @link https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki#Verification
 */
Schnorr.verify = function(publicKey, message, signature) {
  if ($.isType(publicKey, 'PublicKey')) {
    publicKey = publicKey.point.x.toBuffer();
  }
  if (publicKey.length !== 32) {
    throw new Error('Public key should be 32 bytes for schnorr signatures');
  }

  if (typeof message === 'string') {
    $.checkArgument(JS.isHexaString(message), 'Schnorr message string is not hex');
    message = Buffer.from(message, 'hex');
  }
  if (message.length !== 32) {
    throw new Error('Message should be a 32 byte buffer');
  }

  if (typeof signature === 'string') {
    $.checkArgument(JS.isHexaString(signature), 'Schnorr signature string is not hex');
    signature = Buffer.from(signature, 'hex');
  }
  if (typeof signature.toBuffer === 'function') {
    signature = signature.toBuffer();
    if (signature.length === 65) {
      signature = signature.slice(0, 64); // remove the sighashType byte
    }
  }
  if (signature.length !== 64) {
    throw new Error('Signature should be a 64 byte buffer. Got ' + signature.length + ' bytes');
  }

  try {
    const p = Point.getP();
    const n = Point.getN();

    const P = Point.fromX(false, publicKey).liftX();
    const r = new BN(signature.slice(0, 32));
    const s = new BN(signature.slice(32, 64));
    if (r.gte(p) || s.gte(n)) {
      return false;
    }
    const e = getE(r, P, message);
    const G = Point.getG();
    const R = G.mul(s).add(P.mul(e).neg());
    if (R.inf || !R.y.isEven() || !R.x.eq(r)) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
};

/* Utility function used in Verify() */
const getE = function(r, P, message) {
  const n = Point.getN();
  const hash = new TaggedHash('BIP0340/challenge', Buffer.concat([r.toBuffer({ size: 32 }), P.x.toBuffer({ size: 32 }), message])).finalize();
  return new BN(hash).mod(n);
};

module.exports = Schnorr;
