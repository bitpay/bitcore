var SecureRandom = require('../SecureRandom');
var bignum = require('bignum');
var elliptic = require('elliptic');
var Point = require('./Point');
var CommonKey = require('../common/Key');
var util = require('util');

var Key = function( k0 ) {
  this._public = null;
  this._private = null;
  this._compressed = true; // default
  
  if (k0) {
    this._private = k0;
  }
};

for (var i in CommonKey) {
  if (CommonKey.hasOwnProperty(i))
    Key[i] = CommonKey[i];
}

var bufferToArray = Key.bufferToArray = function(buffer) {
  var ret = [];

  var l = buffer.length;
  for (var i = 0; i < l; i++) {
    ret.push(buffer.readUInt8(i));
  }

  return ret;
}

Object.defineProperty( Key.prototype , 'public', {
  set: function(p) {
    if (!Buffer.isBuffer(p)) throw new Error('Arg should be a buffer');

    var type = p[0];
    this._compressed = type !== 0x04;
    this._public = p;
  },
  get: function() {
    if (!this._private) this.regenerateSync();
    if (!this._public) this.regenerateSync();

    return this._public;
  }
});

Object.defineProperty( Key.prototype , 'private', {
  set: function(k0) {
    if (!k0) throw new Error('You must specify a private key');
    if (!k0 === this._private) return true;
    
    // regenerate it.
    this.regenerateSync();

    return this._private;
  },
  get: function() {
    return this._private;
  }
});

Object.defineProperty(Key.prototype, 'compressed', {
  set: function(c) {
    var oldc = this._compressed;
    this._compressed = !!c;
    if (oldc == this._compressed)
      return;
    var oldp = this._public;
    if (this._public) {
      if (this._compressed) {
        var xbuf = this._public.slice(1, 33);
        var ybuf = this._public.slice(33, 65);
        var x = new bignum(xbuf);
        var y = new bignum(ybuf);
        var p = new Point(x, y);
        this._public = p.toCompressedPubKey();
      } else {
        var ec = elliptic.curves.secp256k1;
        var xbuf = this._public.slice(1, 33);
        var odd = this._public[0] == 3 ? true : false;
        var p = ec.curve.pointFromX(odd, xbuf);
        var ybuf = new Buffer(p.y.toArray());
        var xb = new bignum(xbuf);
        var yb = new bignum(ybuf);
        var pb = new Point(xb, yb);
        this._public = pb.toUncompressedPubKey();
      }
    }
    if (!this._compressed) {
      //bug in eckey
      //oldp.slice(1).copy(this._public, 1);
    }
  },
  get: function() {
    return this._compressed;
  }
});

Key.prototype.generateSync = function() {
  var privbuf;

  var ec = elliptic.curves.secp256k1;
  while (true) {
    var bufferSize = 32;
    privbuf = SecureRandom.getRandomBuffer( bufferSize );

    if ((bignum.fromBuffer( privbuf , { size: bufferSize } )).cmp( ec.n ) < 0) {
      break;
    }
  }

  this._private = privbuf;
  this.regenerateSync();

  return this;
}

Key.prototype.regenerateSync = function() {
  if (!this._private) this.generateSync();

  var ec = elliptic.curves.secp256k1;
  var g = ec.g;
  var ecp = ec.g.mul(this._private);
  var x = new bignum(ecp.x.toArray());
  var y = new bignum(ecp.y.toArray());
  var p = new Point(x, y);
  if (this.compressed) {
    this._public = p.toCompressedPubKey();
  } else {
    this._public = p.toUncompressedPubKey();
  }

  return this;
};

Key.prototype.signSync = function(hash) {
  var ec = elliptic.curves.secp256k1;

  if (!this._private) {
    throw new Error('Key does not have a private key set');
  }

  if (!Buffer.isBuffer(hash) || hash.length !== 32) {
    throw new Error('Arg should be a 32 bytes hash buffer');
  }
  var privnum = new bignum(this._private);
  var sigrs = Key.sign(hash, privnum);
  var der = Key.rs2DER(sigrs.r, sigrs.s);

  return der;
};

Key.prototype.verifySignature = function(hash, sig, callback) {
  try {
    var result = this.verifySignatureSync(hash, sig);
    callback(null, result);
  } catch (e) {
    callback(e);
  }
};

Key.prototype.verifySignatureSync = function(hash, sig) {
  var ec = new elliptic.ec(elliptic.curves.secp256k1);
  var msg = hash.toString('hex');
  var pub = this._public.toString('hex');
  var sig = sig.toString('hex');
  var v = ec.verify(msg, sig, pub);
  return v;
};

module.exports = Key;
