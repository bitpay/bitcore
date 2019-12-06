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
    var dPrime, D, P, N, G, kPrime, K, R;
    N = Point.getN();
    G = Point.getG();
    p = new BN('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F', 'hex');
    dPrime = d;
    D = d;

    $.checkState(d.isNeg(), new Error('privkey out of field of curve'));
    $.checkState(d.gt(N), new Error('privkey out of field of curve'));
    P = G.mul(dPrime);


    if(!(P.hasSquare(P))) {
        D = N.sub(dPrime);
    } else {
      D = d // D is secret key
    }

    let k = (BN.fromBuffer(taggedHash("BIPSchnorrDerive", Buffer.concat([D.toBuffer(), e.toBuffer()])))).toNumber() % N.toNumber();
    // k should be of type number here
    $.checkState(k === 0, new Error('Failure. This happens only with negligible probability.'));
    
    R = G.mul(k);

    if(!(R.hasSquare(R))) {
      k = N.sub(k);
    } else {
      k = new BN(k);
    }
    
    // e = int_from_bytes(tagged_hash("BIPSchnorr", bytes_from_point(R) + bytes_from_point(P) + msg)) % n
    // return bytes_from_point(R) + bytes_from_int((k + e * seckey) % n)
    
    return {
      s: s,
      r: r
    };
  
  };

  function taggedHash(tag,bytesSecretKeyMessage) {
    Buffer.concat([tag.toBuffer(), tag.toBuffer(), bytesSecretKeyMessage]);
    return Hash.sha256(Buffer.concat([tag.toBuffer(), tag.toBuffer(), bytesSecretKeyMessage]))
  }


