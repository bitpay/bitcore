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
    this.endian = obj.endian || this.endian; //the endianness of hashbuf
    this.privkey = obj.privkey || this.privkey;
    this.pubkey = obj.pubkey || (this.privkey ? this.privkey.publicKey : this.pubkey);
    this.sig = obj.sig || this.sig;
    this.verified = obj.verified || this.verified;
    return this;
};

Schnorr.prototype.privkey2pubkey = function() {
    this.pubkey = this.privkey.toPublicKey();
};

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
    
    this.sig = new Signature(obj);
    return this;
};

Schnorr.prototype._findSignature = function(d, e) {
    // d is the private key;
    // e is the message to be signed

    var dPrime, D, P, N, G, R, k;
    N = Point.getN();
    G = Point.getG();
    dPrime = d;
    D = d;

    $.checkState(!d.lte(0), new Error('privkey out of field of curve'));
    $.checkState(!d.gte(N), new Error('privkey out of field of curve'));
    P = G.mul(dPrime);

    if((P.hasSquare())) {
      console.log("private key", d);
      D = d;
    } else {
      D = N.sub(dPrime);
    }

    let secretKeyMessageConcat =  Buffer.concat([D.toBuffer(), e.toBuffer()]);
    //console.log("secretKeyMessageConcat", secretKeyMessageConcat);
    let secretKeyMessageConcatBIPSchnorrHash = taggedHash("BIPSchnorrDerive", secretKeyMessageConcat);
    //console.log(secretKeyMessageConcatBIPSchnorrHash, "SecretKeyMessageConcatBIPSchnorrDeriveHash");
    let k0 = (BN.fromBuffer(secretKeyMessageConcatBIPSchnorrHash).umod(N));
    
    // k should be of type number here.
    $.checkState(!k0.eqn(0), new Error('Failure. This happens only with negligible probability.'));

    R = G.mul(k0);

    // Find deterministic k
    if(R.hasSquare()) {
      k = k0;
    } else {
      k = N.sub(k0);
    }
    
    let concatBytes = Buffer.concat([R.getX().toBuffer(), P.getX().toBuffer(), e.toBuffer()]);
    let pointConcat= taggedHash("BIPSchnorr", concatBytes);
    let eSig = BN.fromBuffer(pointConcat).mod(N);
    
    let a = (eSig.mul(D)).add(k);
    let half_sig = a.mod(N);
    
    let sig = Buffer.concat([R.getX().toBuffer(), half_sig.toBuffer()]);

    let r = sig.slice(0, 32);
    let s = sig.slice(32, 64);

    return {
      r: BN.fromBuffer(r),
      s: BN.fromBuffer(s)
    };
  };

  Schnorr.prototype.sigError = function() {
    if (!BufferUtil.isBuffer(this.hashbuf) || this.hashbuf.length !== 32) {
      return 'hashbuf must be a 32 byte buffer';
    }

    var sigBuf = this.sig.toBuffer();

    console.log("this.sig", this.sig)
    console.log("sigBuf length", sigBuf.length);

    // if(sigBuf.length !== 64 || sigBuf.length !==65) {
    //   return 'signature must be a 64 byte or 65 byte array';
    // }

    // if(this.pubkey.toBuffer().length !== 32 || this.pubkey.toBuffer().length !== 33 ) {
    //   return 'public key must be a 32 bytes';
    // }
    
    var pubkeyObj = this.pubkey.toObject();
    
    var P = pubkeyPointfromX(BN.fromString(pubkeyObj.x, 'hex'));
    var publicKey = PublicKey(P, { compressed: true } );
    console.log(publicKey);
    var G = Point.getG();

    if(P.isInfinity()) return true;
    
    var r = this.sig.r;
    var s = this.sig.s;

    let p = new BN('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F', 'hex');
    let n = Point.getN();

    if(r.gte(p) || s.gte(n)) {
      console.log("Failed >= condition");
      return true;
    }
    
    let hash = taggedHash("BIPSchnorr", Buffer.concat([r.toBuffer(), this.pubkey.toBuffer().slice(1,33), this.hashbuf]));
    let e = BN.fromBuffer(hash, 'big').umod(n);
  
    let sG = G.mul(s);
    let eP = P.mul(new BN(n.sub(e)));
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
  * @param {tag | string}
  * @param {bytesSecretKeyMessage | Buffer} buffer to be hashed
  */
  function taggedHash(tag,bytesSecretKeyMessage) {
    let tagHash = Hash.sha256(Buffer.from(tag, 'utf-8'));
    // console.log("tagHash", tagHash);
    return Hash.sha256(Buffer.concat([tagHash, tagHash, bytesSecretKeyMessage]));
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

  /**
   * 
   * @param {*} x | BN, public key curve
   * @return undefined | Point(x,y) point for public key.
   */
  function pubkeyPointfromX(x) {
    let p = new BN('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F', 'hex');
    if (x.gte(p)) {
      return undefined;
    } 
    let ySq = modPow(x,new BN(3),p).add(new BN(7)).mod(p);
    let y = modPow(ySq, p.add(new BN(1)).div(new BN(4)), p);
    if (!modPow(y, new BN(2), p).eq(ySq)) {
      return undefined;
    }
    return new Point(x, y);
  }
  
  /**
   * use Red reduction for faster calculation modular exponentiation
   * @param {*} base BN
   * @param {*} exponent BN
   * @param {*} moduloDivisor BN
   * @return (base^power) % moduloDivisor
   */
  function modPow(base, power, moduloDivisor) {
    let redMultiplier = base.toRed(BN.red(moduloDivisor));
    return redMultiplier.redPow(power).fromRed();
  }

  module.exports = Schnorr;


