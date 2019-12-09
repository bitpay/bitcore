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
    
    let secretKeyMessageConcat =  Buffer.concat([D.toBuffer(), e.toBuffer()]);
    let secretKeyMessageConcatBIPSchnorrHash = taggedHash("BIPSchnorrDerive", secretKeyMessageConcat); //BN
    let k0 = (BN.fromBuffer(secretKeyMessageConcatBIPSchnorrHash).mod(N)).toBuffer();
    

    // k should be of type number here
    $.checkState(k0.eqn(0), new Error('Failure. This happens only with negligible probability.'));
    
    let R = G.mul(k0);

    if(!(R.hasSquare(R))) {
      k = N.sub(k0);
    } else {
      k = new BN(k0);
    }
    
    // e = int_from_bytes(tagged_hash("BIPSchnorr", bytes_from_point(R) + bytes_from_point(P) + msg)) % n
    let pointConcat= taggedHash("BIPSchnorr", Buffer.concat([R.getX().toBuffer(), P.getX().toBuffer(), e.toBuffer()])); //Buffer
    BN.fromBuffer(pointConcat)
    let  e_sig = (BN.fromBuffer(pointConcat)).mod(N);

    let sig_operation = k.add(e_sig.mul(D)); // k + ed
    //let half_sig_buffer = new BN(new Number(sig_operation.toNumber().valueOf() % N.toNumber().valueOf())); // Bytes((k+ ed) mod n)
    let half_sig_buffer = sig_operation.mod(N);
    
    let sig = Buffer.concat([R.getX().toBuffer(), half_sig_buffer.toBuffer()]);

    let r = sig.slice(0, 32);
    let s = sig.slice(32, 64);

    return {
      r: r,
      s: s
    };
  
  };

  Schnorr.prototype.sigError = function() {
    
  };

  Schnorr.prototype.verify = function() {
    if (!this.sigError()) {
      this.verified = true;
    } else {
      this.verified = false;
    }
    return this;
  };



  function taggedHash(tag,bytesSecretKeyMessage) {
    Buffer.concat([tag.toBuffer(), tag.toBuffer(), bytesSecretKeyMessage]);
    return Hash.sha256(Buffer.concat([tag.toBuffer(), tag.toBuffer(), bytesSecretKeyMessage]))
  }


