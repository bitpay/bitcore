const schnorr = require('bip-schnorr');
const $ = require('../util/preconditions');
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

Schnorr.sign = function(privateKey, message, aux) {
  // TODO

  if (!(message instanceof Buffer)) {
    throw new Error('message must be a buffer');
  }

  if (aux && !(aux instanceof Buffer)) {
    throw new Error('aux must be a buffer');
  }
  return schnorr.sign(privateKey.toString(), message, aux);
};


Schnorr.verify = function(publicKey, message, signature) {
  if ($.isType(publicKey, 'PublicKey')) {
    publicKey = publicKey.point.x.toBuffer();
  }
  if (publicKey.length !== 32) {
    throw new Error('Public key should be 32 bytes for schnorr signatures');
  }

  if (typeof message === 'string') {
    message = Buffer.from(message, 'hex');
  }
  if (message.length !== 32) {
    throw new Error('Message should be a 32 byte buffer');
  }

  if (typeof signature === 'string') {
    signature = Buffer.from(signature, 'hex');
  }
  if (typeof signature.toBuffer === 'function') {
    signature = signature.toBuffer();
    if (signature.length === 65) {
      signature = signature.slice(0, 64);
    }
  }
  if (signature.length !== 64) {
    throw new Error('Signature should be a 64 byte buffer');
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

const getE = function(r, P, message) {
  const n = Point.getN();
  const hash = new TaggedHash('BIP0340/challenge', Buffer.concat([r.toBuffer({ size: 32 }), P.x.toBuffer({ size: 32 }), message])).finalize();
  return new BN(hash).mod(n);
};

module.exports = Schnorr;