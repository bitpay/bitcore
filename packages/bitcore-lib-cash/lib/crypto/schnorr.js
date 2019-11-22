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
    var dPrime, p,P,N,G;
    N = Point.getN();
    G = Point.getG();
    p = new BN('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F', 'hex');
    dPrime = d;
    
    $.checkState(d.isNeg(), new Error('privkey out of field of curve'));
    $.checkState(d.gt(N), new Error('privkey out of field of curve'));
    P = G.mul(dPrime);

    var dOld;
    if(P.hasSquare(P)) {
        dOld = N.sub(dPrime);
    }
    else {
       dOld =  N.sub(dPrime);
    }


    
    
    
    
    // try different values of k until r, s are valid
    // var badrs = 0;
    // var k, Q, r, s;
    // do {
    //   if (!this.k || badrs > 0) {
    //     this.deterministicK(badrs);
    //   }
    //   badrs++;
    //   k = this.k;
    //   Q = G.mul(k);
    //   r = Q.x.umod(N);
    //   s = k.invm(N).mul(e.add(d.mul(r))).umod(N);
    // } while (r.cmp(BN.Zero) <= 0 || s.cmp(BN.Zero) <= 0);
  
    // s = ECDSA.toLowS(s);
    return {
      s: s,
      r: r
    };
  
  };


