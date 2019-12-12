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
      console.log('has square')
      D = d; // D is secret key
    } else {
      D = N.sub(dPrime);
      //D = d;
    }
    
    let secretKeyMessageConcat =  Buffer.concat([D.toBuffer(), e.toBuffer()]);
    let secretKeyMessageConcatBIPSchnorrHash = taggedHash("BIPSchnorrDerive", secretKeyMessageConcat);
    let k0 = (BN.fromBuffer(secretKeyMessageConcatBIPSchnorrHash).mod(N));
    

    // k should be of type number here
    $.checkState(!k0.eqn(0), new Error('Failure. This happens only with negligible probability.'));
    
    R = G.mul(k0);

    // Find deterministic k
    if(R.hasSquare()) {
      console.log('has square');
      k = k0;
    } else {
      k = N.sub(k0);
      //k = k0;
    }
    
    // e = int_from_bytes(tagged_hash("BIPSchnorr", bytes_from_point(R) + bytes_from_point(P) + msg)) % n
    let concatBytes = Buffer.concat([R.getX().toBuffer(), P.getX().toBuffer(), e.toBuffer()]);
    let pointConcat= taggedHash("BIPSchnorr", concatBytes); //Buffer
    let eSig = BN.fromBuffer(pointConcat).mod(N);

    console.log(eSig.toString());
    
    let a = (eSig.mul(D)).add(k);
    // let sig_operation = k.add(a); // k + ed
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

    if(sigBuf.length !== 64) {
      return 'signature must be a 64 byte array';
    }

    if(this.pubkey.toBuffer().length !== 32) {
      return 'public key must be a 32 bytes';
    } 

    //Check if point P is none.
    var pointObj = this.pubkey.pointObject();
    var pubkeyPoint = new Point(pointObj.x, pointObj.y);
    if(pubkeyPoint.isInfinity()) return true;
    
    var r = this.sig.r;
    var s = this.sig.s;

    let p = new BN('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F', 'hex');
    let n = Point.getN();

    if(r.gte(p) || s.gte(n)) {
      return true;
    }

    let e = BN.fromBuffer(taggedHash("BIPSchnorr", Buffer.concat([r.toBuffer(),this.pubkey.toBuffer(), this.hashbuf]))).mod(n);

    // G.mul(s);
    // P.mul(n.sub(e));
    let R = (G.mul(s)).add(P.mul(n.sub(e)));
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

  /*
  ** @param {tag | string}
  ** @param {bytesSecretKeyMessage | Buffer} buffer to be hashed
  **/
  function taggedHash(tag,bytesSecretKeyMessage) {
    let tagHash = Hash.sha256(Buffer.from(tag, 'utf-8'));
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

  module.exports = Schnorr;


