'use strict';

// Important references for schnorr implementation
// https://github.com/bitcoincashorg/bitcoincash.org/blob/master/spec/2019-05-15-schnorr.md
// https://github.com/bitcoincashorg/bitcoincash.org/blob/master/spec/2019-11-15-schnorrmultisig.md#wallet-implementation-guidelines

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

/**
   * Function written to ensure r part of signature is at least 32 bytes, when converting 
   * from a BN to type Buffer.
   * The BN type naturally cuts off leading zeros, e.g.
   * <BN: 4f92d8094f710bc11b93935ac157730dda26c5c2a856650dbd8ebcd730d2d4> 31 bytes
   * Buffer <00 4f 92 d8 09 4f 71 0b c1 1b 93 93 5a c1 57 73 0d da 26 c5 c2 a8 56 65 0d bd 8e bc d7 30 d2 d4> 32 bytes
   * Both types are equal, however Schnorr signatures must be a minimum of 64 bytes.
   * In a previous implementation of this schnorr module, was resulting in 63 byte signatures. 
   * (Although it would have been verified, it's proper to ensure the min requirement)
   * @param {*} s BN
   * @return {Buffer}
   */
  function getrBuffer(r) {

    let rNaturalLength = r.toBuffer().length;


    if (rNaturalLength < 32) {
      return r.toBuffer({size: 32});
    }
    return r.toBuffer();
  }

  /**
   * Function written to ensure s part of signature is at least 32 bytes, when converting 
   * from a BN to type Buffer.
   * The BN type naturally cuts off leading zeros, e.g.
   * <BN: 4f92d8094f710bc11b93935ac157730dda26c5c2a856650dbd8ebcd730d2d4> 31 bytes
   * Buffer <00 4f 92 d8 09 4f 71 0b c1 1b 93 93 5a c1 57 73 0d da 26 c5 c2 a8 56 65 0d bd 8e bc d7 30 d2 d4> 32 bytes
   * Both types are equal, however Schnorr signatures must be a minimum of 64 bytes.
   * In a previous implementation of this schnorr module, was resulting in 63 byte signatures. 
   * (Although it would have been verified, it's proper to ensure the min requirement)
   * @param {*} s BN
   * @return {Buffer}
   */
  function getsBuffer(s) {
    let sNaturalLength = s.toBuffer().length;


    if (sNaturalLength < 32) {
      return s.toBuffer({size: 32});
    }
    return s.toBuffer();
  }

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
  
    
    let k = this.nonceFunctionRFC6979(d.toBuffer({ size: 32 }), e.toBuffer({ size: 32 }));

    let P = G.mul(d);
    let R = G.mul(k);

    // Find deterministic k
    if(R.hasSquare()) {
      k = k;
    } else {
      k = n.sub(k);
    }
    
    let r = R.getX();
    let e0 = BN.fromBuffer(Hash.sha256(Buffer.concat([getrBuffer(r), Point.pointToCompressed(P), e.toBuffer({ size: 32 })])));
    
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

    let sigLength = getrBuffer(this.sig.r).length + getsBuffer(this.sig.s).length;
    
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
    
    let Br = getrBuffer(this.sig.r);
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
  Schnorr.prototype.nonceFunctionRFC6979 = function(privkey, msgbuf) {
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

      k = T;
      $.checkState(V.length >= 32, "V length should be >= 32");
      if (k.gt(new BN(0)) && k.lt(Point.getN())) {
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