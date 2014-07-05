var ECKey = require('../../browser/vendor-bundle.js').ECKey;
var SecureRandom = require('../SecureRandom');
var Curve = require('../Curve');
var bignum = require('bignum');
var elliptic = require('elliptic');

var Key = function() {
  this._pub = null;
  this._compressed = true; // default
};

var bufferToArray = Key.bufferToArray = function(buffer) {
  var ret = [];

  var l = buffer.length;
  for (var i = 0; i < l; i++) {
    ret.push(buffer.readUInt8(i));
  }

  return ret;
}

Object.defineProperty(Key.prototype, 'public', {
  set: function(p) {
    if (!Buffer.isBuffer(p)) {
      throw new Error('Arg should be a buffer');
    }
    var type = p[0];
    this._compressed = type !== 0x04;
    this._pub = p;
  },
  get: function() {
    return this._pub;
  }
});

Object.defineProperty(Key.prototype, 'compressed', {
  set: function(c) {
    var oldc = this._compressed;
    this._compressed = !!c;
    if (oldc == this._compressed)
      return;
    var oldp = this._pub;
    if (this._pub) {
      var eckey = new ECKey();
      eckey.setPub(bufferToArray(this.public));
      eckey.setCompressed(this._compressed);
      this._pub = new Buffer(eckey.getPub());
    }
    if (!this._compressed) {
      //bug in eckey
      //oldp.slice(1).copy(this._pub, 1);
    }
  },
  get: function() {
    return this._compressed;
  }
});

Key.generateSync = function() {
  var privbuf;

  while (true) {
    privbuf = SecureRandom.getRandomBuffer(32);
    if ((bignum.fromBuffer(privbuf, {
      size: 32
    })).cmp(Curve.getN()) < 0)
      break;
  }

  var privhex = privbuf.toString('hex');
  var eck = new ECKey(privhex);
  eck.setCompressed(true);
  var pub = eck.getPub();

  ret = new Key();
  ret.private = privbuf;
  ret._compressed = true;
  ret.public = new Buffer(eck.getPub());

  return ret;
};

Key.prototype.regenerateSync = function() {
  if (!this.private) {
    throw new Error('Key does not have a private key set');
  }

  var ec = elliptic.curves.secp256k1;
  var g = ec.g;
  var ecp = ec.g.mul(this.private);
  var x = new bignum(ecp.x.toArray());
  var y = new bignum(ecp.y.toArray());
  var p = new Point(x, y);
  if (this.compressed)
    this._pub = p.toCompressedPubKey();
  else
    this._pub = p.toUncompressedPubKey();

  return this;
};

Key.prototype.signSync = function(hash) {
  /*
  var getSECCurveByName = require('../../browser/vendor-bundle.js').getSECCurveByName;
  var BigInteger = require('../../browser/vendor-bundle.js').BigInteger;
  var rng = new SecureRandom();
  var ecparams = getSECCurveByName('secp256k1');
  */
  var ec = elliptic.curves.secp256k1;

  var genk = function() {
    //TODO: account for when >= n
    return new bignum(SecureRandom.getRandomBuffer(8));
  };

  var sign = function(hash, priv) {
    var d = priv;
    //var n = ecparams.getN();
    var n = ec.n;
    //var e = BigInteger.fromByteArrayUnsigned(hash);
    var e = new bignum(hash);

    do {
      var k = genk();
      var G = ec.g;
      var Q = G.mul(k);
      var r = Q.getX().mod(n);
      var s = k.invm(n).mul(e.add(d.mul(r))).mod(n);
    } while (r.cmp(new bignum(0)) <= 0 || s.cmp(new bignum(0)) <= 0);

    return serializeSig(r, s);
  };

  var serializeSig = function(r, s) {
    var rBa = r.toArray();
    var sBa = s.toArray();

    var sequence = [];
    sequence.push(0x02); // INTEGER
    sequence.push(rBa.length);
    sequence = sequence.concat(rBa);

    sequence.push(0x02); // INTEGER
    sequence.push(sBa.length);
    sequence = sequence.concat(sBa);

    sequence.unshift(sequence.length);
    sequence.unshift(0x30); // SEQUENCE

    return sequence;
  };

  if (!this.private) {
    throw new Error('Key does not have a private key set');
  }

  if (!Buffer.isBuffer(hash) || hash.length !== 32) {
    throw new Error('Arg should be a 32 bytes hash buffer');
  }
  //var privhex = this.private.toString('hex');
  //var privnum = new BigInteger(privhex, 16);
  var privnum = new bignum(this.private);
  //var signature = sign(bufferToArray(hash), privnum);
  var signature = sign(hash, privnum);

  return new Buffer(signature);
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
  var self = this;

  if (!Buffer.isBuffer(hash) || hash.length !== 32) {
    throw new Error('Arg 1 should be a 32 bytes hash buffer');
  }
  if (!Buffer.isBuffer(sig)) {
    throw new Error('Arg 2 should be a buffer');
  }
  if (!self.public) {
    throw new Error('Key does not have a public key set');
  }

  var eck = new ECKey();
  eck.setPub(bufferToArray(self.public));
  eck.setCompressed(self._compressed);
  var sigA = bufferToArray(sig);
  var ret = eck.verify(bufferToArray(hash), sigA);
  return ret;
};

module.exports = Key;
