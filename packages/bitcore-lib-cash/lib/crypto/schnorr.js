'use strict';

var BN = require('./bn');
var Point = require('./point');
var Signature = require('./signature');
var PublicKey = require('../publickey');
var Random = require('./random');
var Hash = require('./hash');
var BufferUtil = require('../util/buffer');
var _ = require('lodash');
var $ = require('../util/preconditions');

var Schnorr = function Schnorr(obj) {
  if (!(this instanceof Schnorr)) {
    return new Schnorr(obj);
  }
  if (obj) {
    this.set(obj);
  }
};

/* jshint maxcomplexity: 9 */
Schnorr.prototype.set = function(obj) {
    this.hashbuf = obj.hashbuf || this.hashbuf;
    this.endian = obj.endian || this.endian; // the endianness of hashbuf
    this.privkey = obj.privkey || this.privkey;
    this.pubkey = obj.pubkey || (this.privkey ? this.privkey.publicKey : this.pubkey);
    this.sig = obj.sig || this.sig;
    this.verified = obj.verified || this.verified;
    return this;
};

Schnorr.prototype.privkey2pubkey = function() {
    this.pubkey = this.privkey.toPublicKey();
};

Schnorr.prototype.toPublicKey = function() {
  return this.privkey.toPublicKey();
}

Schnorr.prototype.sign = function() {
    var hashbuf = this.hashbuf;
    var privkey = this.privkey;
    var d = privkey.bn;
  
    $.checkState(hashbuf && privkey && d, new Error('invalid parameters'));
    $.checkState(BufferUtil.isBuffer(hashbuf) && hashbuf.length === 32, new Error('hashbuf must be a 32 byte buffer'));

    var e = BN.fromBuffer(hashbuf, this.endian ? {
      endian: this.endian
    } : undefined);
    
    var obj = this._findSignature(d, e);
    obj.compressed = this.pubkey.compressed;
    obj.isSchnorr = true;
    
    this.sig = new Signature(obj);
    return this;
};

/**
 * Schnorr implementation used from bitcoinabc at https://reviews.bitcoinabc.org/D2501
 */
Schnorr.prototype._findSignature = function(d, e) {
    // d is the private key;
    // e is the message to be signed

    let n = Point.getN();
    let G = Point.getG();

    $.checkState(!d.lte(new BN(0)), new Error('privkey out of field of curve'));
    $.checkState(!d.gte(n), new Error('privkey out of field of curve'));
  
    
    let k = nonceFunctionRFC6979(d.toBuffer({ size: 32 }), e.toBuffer({ size: 32 }));

    let P = G.mul(d);
    let R = G.mul(k);

    // Find deterministic k
    if(R.hasSquare()) {
      k = k;
    } else {
      k = n.sub(k);
    }
    
    let r = R.getX();
    let e0 = BN.fromBuffer(Hash.sha256(Buffer.concat([r.toBuffer(), Point.pointToCompressed(P), e.toBuffer({ size: 32 })])));
    
    let s = ((e0.mul(d)).add(k)).mod(n);

    return {
      r: r,
      s: s
    };
  };

  Schnorr.prototype.sigError = function() {
    if (!BufferUtil.isBuffer(this.hashbuf) || this.hashbuf.length !== 32) {
      return 'hashbuf must be a 32 byte buffer';
    }

    let sigLength = this.sig.r.toBuffer().length + this.sig.s.toBuffer().length;
    
    if(!(sigLength === 64 || sigLength === 65)) {
      return 'signature must be a 64 byte or 65 byte array';
    } 


    let hashbuf = this.endian === 'little' ? BufferUtil.reverse(this.hashbuf) : this.hashbuf
    
    let P = this.pubkey.point;
    let G = Point.getG();

    if(P.isInfinity()) return true;
    
    let r = this.sig.r;
    let s = this.sig.s;

    let p = new BN('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F', 'hex');
    let n = Point.getN();

    if(r.gte(p) || s.gte(n)) {
      // ("Failed >= condition") 
      return true;
    }
    
    let Br = r.toBuffer();
    let Bp = Point.pointToCompressed(P);
    
    let hash = Hash.sha256(Buffer.concat([Br, Bp, hashbuf]));
    let e = BN.fromBuffer(hash, 'big').umod(n);
    
    let sG = G.mul(s);
    let eP = P.mul(n.sub(e));
    let R = sG.add(eP);
    
    if(R.isInfinity() || !R.hasSquare() || !R.getX().eq(r)) {
      return true;
    } 
    return false;
  };

  Schnorr.prototype.verify = function() {

    if (!this.sigError()) {
      this.verified = true;
    } else {
      this.verified = false;
    }
    return this;
  };

  /**
   * RFC6979 deterministic nonce generation used from https://reviews.bitcoinabc.org/D2501
   * @param {Buffer} privkeybuf 
   * @param {Buffer} msgbuf 
   * @return k {BN}
   */
  function nonceFunctionRFC6979(privkey, msgbuf) {
    let V = Buffer.from("0101010101010101010101010101010101010101010101010101010101010101","hex");
    let K = Buffer.from("0000000000000000000000000000000000000000000000000000000000000000","hex");

    let blob = Buffer.concat([privkey, msgbuf, Buffer.from("", "ascii"), Buffer.from("Schnorr+SHA256  ", "ascii")]);

    K = Hash.sha256hmac(Buffer.concat([V, Buffer.from('00', 'hex'), blob]), K);
    V = Hash.sha256hmac(V,K); 

    K = Hash.sha256hmac(Buffer.concat([V,Buffer.from('01','hex'), blob]), K);
    V = Hash.sha256hmac(V,K);

    let k = new BN(0);
    let T;
    while (true) {
      V = Hash.sha256hmac(V,K);
      T = BN.fromBuffer(V);
      $.checkState(T.toBuffer().length >= 32, "T failed test");
      k = T;
      
      if (k.gt(new BN(0) && k.lt(Point.getN()))) {
        break;
      }
      K = Hash.sha256hmac(Buffer.concat([V, Buffer.from("00", 'hex')]), K);
      V = Hash.hmac(Hash.sha256, V, K);
    }
    return k;
  }

  Schnorr.sign = function(hashbuf, privkey, endian) {
    return Schnorr().set({
      hashbuf: hashbuf,
      endian: endian,
      privkey: privkey
    }).sign().sig;
  };
  
  Schnorr.verify = function(hashbuf, sig, pubkey, endian) {
    return Schnorr().set({
      hashbuf: hashbuf,
      endian: endian,
      sig: sig,
      pubkey: pubkey
    }).verify().verified;
  };

  module.exports = Schnorr;