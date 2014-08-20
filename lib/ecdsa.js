var BN = require('./bn');
var Point = require('./point');
var Signature = require('./signature');
var Key = require('./key');
var Privkey = require('./privkey');
var Pubkey = require('./pubkey');
var Random = require('./random');

var ECDSA = function ECDSA(hashbuf, key, sig, k) {
  if (!(this instanceof ECDSA))
    return new ECDSA(hashbuf, key, sig, k);
  this.hashbuf = hashbuf;
  this.key = key;
  this.sig = sig;
  this.k = k;
};

ECDSA.prototype.calci = function() {
  for (var i = 0; i < 4; i++) {
    this.sig.i = i;
    try {
      var Qprime = this.sig2pubkey();
    } catch (e) {
      console.log(e);
      continue;
    }

    if (Qprime.point.eq(this.key.pubkey.point)) {
      return this;
    }
  }

  this.sig.i = undefined;
  throw new Error('Unable to find valid recovery factor');
};

ECDSA.prototype.fromString = function(str) {
  var obj = JSON.parse(str);
  if (obj.hashbuf)
    this.hashbuf = new Buffer(obj.hashbuf, 'hex');
  if (obj.key)
    this.key = Key().fromString(obj.key);
  if (obj.sig)
    this.sig = Signature().fromString(obj.sig);
  if (obj.k)
    this.k = BN(obj.k, 10);
  return this;
};

ECDSA.prototype.randomK = function() {
  var N = Point.getN();
  var k;
  do {
    k = BN().fromBuffer(Random.getRandomBuffer(32));
  } while (!(k.lt(N) && k.gt(0)));
  this.k = k;
  return this;
};

ECDSA.prototype.sig2pubkey = function() {
  var i = this.sig.i;
  if (!(i === 0 || i === 1 || i === 2 || i === 3))
    throw new Error('signature: i must be equal to 0, 1, 2, or 3');

  var e = BN().fromBuffer(this.hashbuf);
  var r = this.sig.r;
  var s = this.sig.s;

  // A set LSB signifies that the y-coordinate is odd
  var isYOdd = i & 1;

  // The more significant bit specifies whether we should use the
  // first or second candidate key.
  var isSecondKey = i >> 1;

  var n = Point.getN();
  var G = Point.getG();

  // 1.1 Let x = r + jn
  var x = isSecondKey ? r.add(n) : r;
  var R = Point.fromX(isYOdd, x);

  // 1.4 Check that nR is at infinity
  var nR = R.mul(n);

  if (!nR.isInfinity())
    throw new Error('nR is not a valid curve point');

  // Compute -e from e
  var eNeg = e.neg().mod(n);

  // 1.6.1 Compute Q = r^-1 (sR - eG)
  // Q = r^-1 (sR + -eG)
  var rInv = r.invm(n);

  //var Q = R.multiplyTwo(s, G, eNeg).mul(rInv);
  var Q = R.mul(s).add(G.mul(eNeg)).mul(rInv);

  var pubkey = new Pubkey(Q);
  pubkey.validate();

  return pubkey;
};

ECDSA.prototype.sigError = function() {
  if (!Buffer.isBuffer(this.hashbuf) || this.hashbuf.length !== 32)
    return 'Invalid hash';

  try {
    this.key.pubkey.validate();
  } catch (e) {
    return 'Invalid pubkey: ' + e;
  }

  var r = this.sig.r;
  var s = this.sig.s;
  if (!(r.gt(0) && r.lt(Point.getN()))
   || !(s.gt(0) && s.lt(Point.getN())))
    return 'r and s not in range';

  var e = BN().fromBuffer(this.hashbuf);
  var n = Point.getN();
  var sinv = s.invm(n);
  var u1 = sinv.mul(e).mod(n);
  var u2 = sinv.mul(r).mod(n);

  var p = Point.getG().mulAdd(u1, this.key.pubkey.point, u2);
  if (p.isInfinity())
    return 'p is infinity';

  if (!(p.getX().mod(n).cmp(r) === 0))
    return 'Invalid signature';
  else
    return false;
};

ECDSA.prototype.sign = function() {
  var hashbuf = this.hashbuf;
  var privkey = this.key.privkey;
  var k = this.k;
  var d = privkey.bn;

  if (!hashbuf || !privkey || !k || !d)
    throw new Error('ecdsa: invalid parameters');

  var N = Point.getN();
  var G = Point.getG();
  var e = BN().fromBuffer(hashbuf);

  do {
    var Q = G.mul(k);
    var r = Q.x.mod(N);
    var s = k.invm(N).mul(e.add(d.mul(r))).mod(N);
  } while (r.cmp(0) <= 0 || s.cmp(0) <= 0);

  this.sig = new Signature(r, s);
  return this.sig;
};

ECDSA.prototype.signRandomK = function() {
  var k = this.randomK();
  return this.sign();
};

ECDSA.prototype.toString = function() {
  var obj = {};
  if (this.hashbuf)
    obj.hashbuf = this.hashbuf.toString('hex');
  if (this.key)
    obj.key = this.key.toString();
  if (this.sig)
    obj.sig = this.sig.toString();
  if (this.k)
    obj.k = this.k.toString();
  return JSON.stringify(obj);
};

ECDSA.prototype.verify = function() {
  if (!this.sigError())
    return true;
  else
    return false;
};

module.exports = ECDSA;
